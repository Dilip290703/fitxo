'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitzo/supabase/server';
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

export type CreateKeepPaymentResult =
  | {
      success: true;
      keyId: string;
      rzpOrderId: string;
      amount: number; // paise
      currency: string;
      productName: string;
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
    .select('status')
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

  const amountPaise = Math.round(Number(item.price_at_order) * 100);
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
      notes: { order_id: orderId, order_item_id: orderItemId, user_id: user.id },
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
  const { error: payError } = await supabase.from('payments').insert({
    order_id: orderId,
    order_item_id: orderItemId,
    user_id: user.id,
    amount: Number(item.price_at_order),
    currency: 'INR',
    status: 'initiated',
    payment_method: 'razorpay',
    razorpay_order_id: rzpOrder.id,
  });

  if (payError) return { success: false, error: payError.message };

  return {
    success: true,
    keyId: RAZORPAY_KEY_ID,
    rzpOrderId: rzpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    productName: item.product_name,
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

  revalidatePath(`/order-tracking/${orderId}`);
  return { success: true };
}
