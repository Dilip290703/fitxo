'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitxo/supabase/server';
import { razorpay, RAZORPAY_KEY_ID, verifyPaymentSignature } from '@/lib/razorpay';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Customer accepts the doorstep prompt → start the 7-minute try-on window.
 * Calls the guarded RPC (migration 011) which flips the order to
 * try_window_active and sets the try_session deadline to now + 7 min.
 */
export async function startTryWindow(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  const { error } = await supabase.rpc('start_try_window', { p_order_id: orderId });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/order-tracking/${orderId}`);
  return { success: true };
}

/**
 * G4 (migration 054): the customer cancels their own order from the tracking
 * page while it's still cancellable (pending, or confirmed-but-no-rider-
 * claimed). The guarded RPC does the whole state teardown atomically — flips
 * the order to 'cancelled' (the 047 trigger frees reserved stock), fails the
 * live delivery, expires the try session, and notifies the store. If an
 * upfront delivery fee (G9/050) was paid, the RPC hands back its Razorpay
 * payment id and we refund it here (keys are server-side), then record the
 * ledger flip — the same app-then-RPC shape as refundDeliveryFeeIfEligible.
 */
export async function cancelOrder(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  const { data, error } = await supabase.rpc('cancel_order_by_customer', {
    p_order_id: orderId,
  });
  if (error) {
    const msg = error.message;
    if (msg.includes('CANCEL_RIDER_ASSIGNED')) {
      return { success: false, error: 'A rider has already picked up your order — please contact support to cancel.' };
    }
    if (msg.includes('CANCEL_TOO_LATE')) {
      return { success: false, error: 'This order is too far along to cancel here — please contact support.' };
    }
    if (msg.includes('not authorised')) {
      return { success: false, error: 'You can only cancel your own order.' };
    }
    return { success: false, error: msg };
  }

  // Refund the upfront delivery fee if one was paid. Best-effort: a failure
  // here leaves the order cancelled (the important part) and the fee for the
  // admin 041 refund path — it never turns a successful cancel into an error.
  const result = data as { fee_refund_payment_id?: string | null } | null;
  const feePaymentId = result?.fee_refund_payment_id ?? null;
  if (feePaymentId) {
    try {
      let refundId = 'reconciled';
      try {
        const refund = await razorpay.payments.refund(feePaymentId, {
          notes: { reason: 'order_cancelled_by_customer', order_id: orderId },
        });
        refundId = refund.id ?? refundId;
      } catch (e) {
        const emsg =
          e instanceof Error
            ? e.message
            : ((e as { error?: { description?: string } })?.error?.description ?? '');
        // "already fully refunded" reconciles the row; anything else, leave
        // the fee for admin and don't block the cancel.
        if (!/fully refunded/i.test(emsg)) {
          console.error('[cancelOrder] fee refund failed:', e);
          refundId = '';
        }
      }
      if (refundId) {
        const { error: rpcError } = await supabase.rpc('record_cancel_fee_refund', {
          p_order_id: orderId,
          p_refund_id: refundId,
        });
        if (rpcError) {
          console.error(
            `[cancelOrder] refund ${refundId} issued but ledger flip failed:`,
            rpcError.message,
          );
        }
      }
    } catch (e) {
      console.error('[cancelOrder] unexpected fee-refund failure:', e);
    }
  }

  revalidatePath(`/order-tracking/${orderId}`);
  return { success: true };
}

export type CreateKeepPaymentResult =
  | {
      success: true;
      keyId: string;
      rzpOrderId: string;
      amount: number; // paise — item price + deliveryFee when this charge carries it
      currency: string;
      productName: string;
      deliveryFee: number; // rupees folded into this charge (0 once collected / free delivery)
    }
  | { success: false; error: string };

/**
 * Step 1 of keeping an item: create a Razorpay order for that single item and a
 * pending `payments` row. The amount is recomputed server-side from the DB —
 * never trust a client-supplied price. Returns what the browser needs to open
 * Razorpay Checkout. The item is only flipped to 'keep' after payment is verified
 * (see confirmKeepPayment).
 */
export async function createKeepPayment(
  orderItemId: string,
  orderId: string,
): Promise<CreateKeepPaymentResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  // Load the item (RLS guarantees it belongs to this user's order).
  const { data: item, error: itemError } = await supabase
    .from('order_items')
    .select('id, order_id, product_name, price_at_order, decision')
    .eq('id', orderItemId)
    .maybeSingle();

  if (itemError) return { success: false, error: itemError.message };
  if (!item || item.order_id !== orderId) {
    return { success: false, error: 'Item not found.' };
  }
  if (item.decision !== 'pending') {
    return { success: false, error: 'This item has already been decided.' };
  }

  // Re-check the try window server-side (the UI gates it, but don't rely on that).
  const { data: order } = await supabase
    .from('orders')
    .select('status, delivery_fee')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status !== 'try_window_active') {
    return { success: false, error: 'The try window is not open for this order.' };
  }

  const { data: session } = await supabase
    .from('try_sessions')
    .select('deadline_at, status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!session || session.status !== 'active' || new Date(session.deadline_at) <= new Date()) {
    return { success: false, error: 'The try window has closed.' };
  }

  // The customer delivery fee rides the FIRST Keep charge on the order
  // (owner decision, migration 040): include orders.delivery_fee unless a
  // successful payment already carried it. Pre-040 (column missing) the query
  // errors → charge the bare item price, exactly the old behavior.
  let deliveryFee = 0;
  let feeColumnExists = false;
  if (Number(order.delivery_fee ?? 0) > 0) {
    const { data: feeRows, error: feeError } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', orderId)
      .eq('status', 'success')
      .gt('delivery_fee_component', 0)
      .limit(1);
    if (!feeError) {
      feeColumnExists = true;
      if ((feeRows ?? []).length === 0) deliveryFee = Number(order.delivery_fee);
    }
  }

  const amountPaise = Math.round((Number(item.price_at_order) + deliveryFee) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { success: false, error: 'Invalid item amount.' };
  }

  // Create the Razorpay order (needs the secret — server-only).
  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay caps receipt at 40 chars; a bare UUID is 36, so prefix with "k_" (38).
      receipt: `k_${orderItemId}`,
      notes: {
        order_id: orderId,
        order_item_id: orderItemId,
        user_id: user.id,
        delivery_fee: String(deliveryFee),
      },
    });
  } catch (e) {
    // Razorpay's SDK rejects with a plain object ({ statusCode, error: { description } })
    // on API errors, so unwrap it instead of showing a generic message.
    console.error('[createKeepPayment] razorpay.orders.create failed:', e);
    let msg = 'Could not start payment.';
    if (e instanceof Error) {
      msg = e.message;
    } else if (e && typeof e === 'object') {
      const err = e as { error?: { description?: string }; statusCode?: number };
      msg = err.error?.description ?? (err.statusCode ? `HTTP ${err.statusCode}` : msg);
    }
    return { success: false, error: `Razorpay: ${msg}` };
  }

  // Record the pending payment. RLS allows insert where user_id = auth.uid().
  // amount is the FULL charge (webhook 039 verifies captured amount against it);
  // delivery_fee_component records the fee split (only when 040 is applied).
  const { error: payError } = await supabase.from('payments').insert({
    order_id: orderId,
    order_item_id: orderItemId,
    user_id: user.id,
    amount: Number(item.price_at_order) + deliveryFee,
    currency: 'INR',
    status: 'initiated',
    payment_method: 'razorpay',
    razorpay_order_id: rzpOrder.id,
    ...(feeColumnExists ? { delivery_fee_component: deliveryFee } : {}),
  });

  if (payError) return { success: false, error: payError.message };

  return {
    success: true,
    keyId: RAZORPAY_KEY_ID,
    rzpOrderId: rzpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    productName: item.product_name,
    deliveryFee,
  };
}

/**
 * Step 2: verify the signature Razorpay handed the browser, then settle the
 * payment through the guarded SECURITY DEFINER RPC (which re-verifies the
 * signature in-DB and flips the item to 'keep'). Verifying here too gives a
 * fast, clean error before we touch the DB.
 */
export async function confirmKeepPayment(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  const valid = verifyPaymentSignature(
    args.razorpayOrderId,
    args.razorpayPaymentId,
    args.razorpaySignature,
  );
  if (!valid) return { success: false, error: 'Payment verification failed.' };

  const { error } = await supabase.rpc('confirm_keep_payment', {
    p_razorpay_order_id: args.razorpayOrderId,
    p_razorpay_payment_id: args.razorpayPaymentId,
    p_razorpay_signature: args.razorpaySignature,
  });

  if (error) return { success: false, error: error.message };

  // Close the loop: if this was the last undecided item, complete the order
  // and stop the try-window clock.
  await supabase.rpc('finalize_order_if_decided', { p_order_id: args.orderId });

  // G9 waiver (050): if the order just completed with kept value over the
  // free-delivery threshold, auto-refund the upfront fee. Best-effort — the
  // action verifies eligibility itself and never throws.
  await refundDeliveryFeeIfEligible(args.orderId);

  revalidatePath(`/order-tracking/${args.orderId}`);
  return { success: true };
}

export async function returnItem(orderItemId: string, orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  const { error: updateError } = await supabase
    .from('order_items')
    .update({ decision: 'return', decision_at: new Date().toISOString() })
    .eq('id', orderItemId);

  if (updateError) return { success: false, error: updateError.message };

  const { error: returnError } = await supabase
    .from('returns')
    .insert({
      order_id: orderId,
      order_item_id: orderItemId,
      status: 'requested',
      requested_at: new Date().toISOString(),
    });

  if (returnError) return { success: false, error: returnError.message };

  // Close the loop: if this was the last undecided item, complete the order
  // and stop the try-window clock.
  await supabase.rpc('finalize_order_if_decided', { p_order_id: orderId });

  // G9 waiver (050): the last decision may have completed the order with kept
  // value over the threshold — settle the fee refund. Best-effort.
  await refundDeliveryFeeIfEligible(orderId);

  revalidatePath(`/order-tracking/${orderId}`);
  return { success: true };
}

export type CreateFeePaymentResult =
  | {
      success: true;
      keyId: string;
      rzpOrderId: string;
      amount: number; // paise
      currency: string;
      deliveryFee: number; // rupees
    }
  | { success: false; error: string };

/**
 * G9 (migration 050): the delivery fee is its own upfront Razorpay payment,
 * collected right after checkout — whether the customer later keeps or
 * returns. Mirrors createKeepPayment: server-computed amount, pending
 * payments row (order_item_id NULL + delivery_fee_component = fee, which is
 * exactly what 040's fee-carried check and store_confirm_order's gate read).
 * Settlement reuses confirmKeepPayment / the 039 webhook — settle_keep_payment
 * handles item-less payments since 050.
 */
export async function createDeliveryFeePayment(orderId: string): Promise<CreateFeePaymentResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  // Pre-050 guard: without the migration, a fee-only settle would wrongly
  // mark the order paid — refuse until 050 is applied (the tracking page
  // falls back to the 040 fold-into-first-Keep note).
  const { error: probeError } = await supabase
    .from('system_settings')
    .select('first_order_free')
    .eq('id', 1)
    .maybeSingle();
  if (probeError) {
    return { success: false, error: 'Upfront fee payment not enabled yet — apply migration 050.' };
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, delivery_fee')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { success: false, error: 'Order not found.' };
  if (order.status === 'cancelled') {
    return { success: false, error: 'This order was cancelled.' };
  }
  const fee = Number(order.delivery_fee ?? 0);
  if (fee <= 0) return { success: false, error: 'No delivery fee is due on this order.' };

  // Already collected (upfront payment, or a legacy 040 first-Keep carry)?
  const { data: carried, error: carriedError } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'success')
    .gt('delivery_fee_component', 0)
    .limit(1);
  if (carriedError) return { success: false, error: carriedError.message };
  if ((carried ?? []).length > 0) {
    return { success: false, error: 'The delivery fee is already paid.' };
  }

  const amountPaise = Math.round(fee * 100);
  let rzpOrder;
  try {
    rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      // Razorpay caps receipt at 40 chars; "f_" + 36-char UUID = 38.
      receipt: `f_${orderId}`,
      notes: {
        order_id: orderId,
        user_id: user.id,
        purpose: 'delivery_fee',
        delivery_fee: String(fee),
      },
    });
  } catch (e) {
    console.error('[createDeliveryFeePayment] razorpay.orders.create failed:', e);
    let msg = 'Could not start payment.';
    if (e instanceof Error) {
      msg = e.message;
    } else if (e && typeof e === 'object') {
      const err = e as { error?: { description?: string }; statusCode?: number };
      msg = err.error?.description ?? (err.statusCode ? `HTTP ${err.statusCode}` : msg);
    }
    return { success: false, error: `Razorpay: ${msg}` };
  }

  const { error: payError } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount: fee,
    currency: 'INR',
    status: 'initiated',
    payment_method: 'razorpay',
    razorpay_order_id: rzpOrder.id,
    delivery_fee_component: fee,
  });
  if (payError) return { success: false, error: payError.message };

  return {
    success: true,
    keyId: RAZORPAY_KEY_ID,
    rzpOrderId: rzpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    deliveryFee: fee,
  };
}

/**
 * G9 kept-value waiver: when the order has finished with kept-and-paid value
 * ≥ system_settings.free_delivery_above, refund the standalone upfront fee
 * payment. Money moves via Razorpay's refund API first; the guarded RPC
 * record_delivery_fee_refund (050) then flips the ledger row after
 * re-verifying eligibility in-DB. Best-effort by design: any failure leaves
 * the fee row 'success' and the admin Refund path (041) as backstop — it
 * never blocks the keep/return that triggered it.
 */
export async function refundDeliveryFeeIfEligible(
  orderId: string,
): Promise<{ refunded: boolean }> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { refunded: false };

    // Cheap pre-checks under the caller's own RLS (the RPC re-verifies all of
    // this in-DB; these just avoid pointless Razorpay calls).
    const [{ data: settings }, { data: items }, { data: feePayments }] = await Promise.all([
      supabase.from('system_settings').select('free_delivery_above').eq('id', 1).maybeSingle(),
      supabase.from('order_items').select('price_at_order, decision').eq('order_id', orderId),
      supabase
        .from('payments')
        .select('id, status, razorpay_payment_id, order_item_id, delivery_fee_component')
        .eq('order_id', orderId)
        .is('order_item_id', null)
        .gt('delivery_fee_component', 0)
        .order('created_at', { ascending: false }),
    ]);

    const threshold = Number(settings?.free_delivery_above ?? 0);
    if (threshold <= 0) return { refunded: false };
    const all = items ?? [];
    if (all.length === 0 || all.some((i) => i.decision === 'pending')) return { refunded: false };
    const kept = all
      .filter((i) => i.decision === 'keep')
      .reduce((s, i) => s + Number(i.price_at_order ?? 0), 0);
    if (kept < threshold) return { refunded: false };

    const fee = (feePayments ?? []).find((p) => p.status === 'success');
    if (!fee?.razorpay_payment_id) return { refunded: false };

    // Move the money. "Already fully refunded" (e.g. via the Razorpay
    // dashboard) reconciles our row instead of failing — same as 041.
    let refundId = 'reconciled';
    try {
      const refund = await razorpay.payments.refund(fee.razorpay_payment_id, {
        notes: { reason: 'free_delivery_kept_threshold', order_id: orderId },
      });
      refundId = refund.id ?? refundId;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : ((e as { error?: { description?: string } })?.error?.description ?? '');
      if (!/fully refunded/i.test(msg)) {
        console.error('[refundDeliveryFee] razorpay refund failed:', e);
        return { refunded: false };
      }
    }

    const { error: rpcError } = await supabase.rpc('record_delivery_fee_refund', {
      p_order_id: orderId,
      p_refund_id: refundId,
    });
    if (rpcError) {
      // Refund WAS issued — say so loudly in the logs; admin reconciles via 041.
      console.error(
        `[refundDeliveryFee] refund ${refundId} issued at Razorpay but ledger flip failed:`,
        rpcError.message,
      );
      return { refunded: false };
    }

    revalidatePath(`/order-tracking/${orderId}`);
    return { refunded: true };
  } catch (e) {
    console.error('[refundDeliveryFee] unexpected failure:', e);
    return { refunded: false };
  }
}
