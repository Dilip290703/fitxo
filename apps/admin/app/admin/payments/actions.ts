'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';
import { razorpay, razorpayConfigured, razorpayErrorMessage } from '@/lib/razorpay';

export type RefundResult = { success: true; refundId: string | null } | { success: false; error: string };

/**
 * Full-refund one successful Razorpay payment row (Track A Task 4, MVP).
 * Money moves via Razorpay's refund API — never hand-rolled. The payments row
 * flips success → 'refunded' (columns from migration 041) and the action is
 * audit-logged. Deliberately does NOT touch order/item state — the admin fixes
 * that separately via the order-detail actions when needed.
 */
export async function refundPayment(paymentId: string, reason: string): Promise<RefundResult> {
  const actorId = await requireAdmin();

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { success: false, error: 'A reason is required.' };
  if (!razorpayConfigured) {
    return { success: false, error: 'Razorpay keys missing — add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to apps/admin/.env.local.' };
  }

  const admin = createAdminClient();

  const { data: payment, error: loadError } = await admin
    .from('payments')
    .select('id, order_id, amount, currency, status, payment_method, razorpay_payment_id, users(name, email), orders(order_number)')
    .eq('id', paymentId)
    .maybeSingle();

  if (loadError) return { success: false, error: loadError.message };
  if (!payment) return { success: false, error: 'Payment not found.' };
  if (payment.status === 'refunded') return { success: false, error: 'This payment is already refunded.' };
  if (payment.status !== 'success') return { success: false, error: 'Only successful payments can be refunded.' };
  if (payment.payment_method !== 'razorpay' || !payment.razorpay_payment_id) {
    return { success: false, error: 'No Razorpay payment id on this row — nothing to refund at the gateway.' };
  }

  // Pre-flight migration 041 check BEFORE moving money: if the refund columns
  // don't exist, the post-refund ledger write would fail and leave a refund
  // Razorpay knows about but Fitzo doesn't.
  const { error: colError } = await admin.from('payments').select('razorpay_refund_id').limit(1);
  if (colError) {
    return { success: false, error: 'Refund bookkeeping columns missing — apply migration 041 first.' };
  }

  // Move the money: full refund at Razorpay. If Razorpay says it was already
  // fully refunded (e.g. via their dashboard), reconcile our ledger instead of
  // failing — the goal is that Fitzo's books match Razorpay's.
  let refundId: string | null = null;
  try {
    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
      notes: { reason: trimmedReason, source: 'fitzo_admin' },
    });
    refundId = refund.id ?? null;
  } catch (e) {
    const msg = razorpayErrorMessage(e);
    if (!/fully refunded/i.test(msg)) {
      console.error('[refundPayment] razorpay refund failed:', e);
      return { success: false, error: `Razorpay: ${msg}` };
    }
  }

  // Flip the row. The status guard makes a concurrent double-refund a no-op
  // (Razorpay itself rejects the second full refund as the backstop).
  const { data: updated, error: updateError } = await admin
    .from('payments')
    .update({
      status: 'refunded',
      razorpay_refund_id: refundId,
      refunded_at: new Date().toISOString(),
      refund_reason: trimmedReason,
    })
    .eq('id', paymentId)
    .eq('status', 'success')
    .select('id');

  if (updateError) {
    // Money has moved but the ledger write failed — surface loudly.
    console.error('[refundPayment] refund issued at Razorpay but ledger update failed:', updateError);
    return {
      success: false,
      error: `Refund WAS issued at Razorpay (${refundId ?? 'already refunded'}) but recording it failed: ${updateError.message}. Fix and retry — Razorpay will reject a double refund.`,
    };
  }
  if ((updated ?? []).length === 0) {
    return { success: false, error: 'This payment was refunded by someone else just now — refresh.' };
  }

  const users = payment.users as { name?: string; email?: string } | { name?: string; email?: string }[] | null;
  const customer = Array.isArray(users) ? users[0] : users;
  const orders = payment.orders as { order_number?: string } | { order_number?: string }[] | null;
  const order = Array.isArray(orders) ? orders[0] : orders;

  await logActivity(
    admin,
    {
      action: `Refunded payment of ₹${Number(payment.amount).toLocaleString('en-IN')} to ${customer?.name ?? customer?.email ?? 'customer'}`,
      entity_type: 'payment',
      entity_id: paymentId,
      old_value: { status: 'success' },
      new_value: {
        status: 'refunded',
        amount: Number(payment.amount),
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_refund_id: refundId,
        order_number: order?.order_number ?? null,
        reason: trimmedReason,
      },
    },
    actorId,
  );

  revalidatePath('/admin/payments');
  revalidatePath(`/admin/orders/${payment.order_id}`);
  return { success: true, refundId };
}
