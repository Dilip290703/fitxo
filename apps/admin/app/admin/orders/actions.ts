'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';
import { razorpay, razorpayConfigured, razorpayErrorMessage } from '@/lib/razorpay';

export type CancelOrderResult =
  | { success: true; orderNumber: string | null; feeRefunded: boolean; feeAmount: number | null; warning?: string }
  | { success: false; error: string };

type CancelRpc = {
  cancelled: boolean;
  already?: boolean;
  order_number?: string | null;
  fee_refund_payment_id?: string | null;
  fee_amount?: number | null;
};

/**
 * Cancel an order and refund the upfront delivery fee (migration 058).
 *
 * Replaces the old client-side `orders.update({ status: 'cancelled' })` in
 * OrderActions, which since G9/050 quietly kept the customer's paid delivery
 * fee and told them nothing. The RPC does the state changes (and notifies the
 * customer + stores); the money moves here, because only the app holds the
 * Razorpay keys.
 *
 * The cancel is NOT rolled back when the refund fails. That is deliberate:
 * cancelling is usually the urgent half (a stuck order blocks the customer's
 * `max_active_orders` slot), and a failed refund is recoverable — the order
 * keeps showing up in `pending_fee_refunds()` until someone retries it from
 * Admin > Payments. Rolling back would leave the order live AND the money
 * taken, which is strictly worse.
 */
export async function cancelOrderWithRefund(
  orderId: string,
  reason: string,
): Promise<CancelOrderResult> {
  const actorId = await requireAdmin();

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { success: false, error: 'A reason is required.' };

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('cancel_order_by_admin', {
    p_order_id: orderId,
    p_reason: trimmedReason,
  });

  if (error) {
    if (/CANCEL_ALREADY_COMPLETED/.test(error.message)) {
      return { success: false, error: 'This order is already completed — it can no longer be cancelled.' };
    }
    if (/does not exist|schema cache/i.test(error.message)) {
      return { success: false, error: 'Cancel RPC missing — apply migration 058 first.' };
    }
    return { success: false, error: error.message };
  }

  const result = (data ?? {}) as CancelRpc;
  const orderNumber = result.order_number ?? null;
  const feePaymentId = result.fee_refund_payment_id ?? null;
  const feeAmount = result.fee_amount != null ? Number(result.fee_amount) : null;

  const finish = async (feeRefunded: boolean, warning?: string): Promise<CancelOrderResult> => {
    await logActivity(
      admin,
      {
        action: `Cancelled order ${orderNumber ?? ''}`.trim(),
        entity_type: 'order',
        entity_id: orderId,
        old_value: { status: 'active' },
        new_value: {
          status: 'cancelled',
          reason: trimmedReason,
          delivery_fee_refunded: feeRefunded,
          ...(feeAmount != null ? { delivery_fee: feeAmount } : {}),
          ...(warning ? { warning } : {}),
        },
      },
      actorId,
    );
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/payments');
    return { success: true, orderNumber, feeRefunded, feeAmount, warning };
  };

  // Nothing was ever charged (pending-state cancel, or a waived first-order
  // fee) — there is no money to move.
  if (!feePaymentId) return finish(false);

  if (!razorpayConfigured) {
    return finish(
      false,
      `Delivery fee of ₹${feeAmount ?? '—'} NOT refunded — Razorpay keys missing in apps/admin/.env.local. It stays queued under pending fee refunds.`,
    );
  }

  // Move the money. "Already fully refunded" is reconciled rather than treated
  // as a failure — the goal is that Fitzo's ledger matches Razorpay's.
  let refundId: string | null = null;
  try {
    const refund = await razorpay.payments.refund(feePaymentId, {
      notes: { reason: trimmedReason, source: 'fitzo_admin_cancel' },
    });
    refundId = refund.id ?? null;
  } catch (e) {
    const msg = razorpayErrorMessage(e);
    if (!/fully refunded/i.test(msg)) {
      console.error('[cancelOrderWithRefund] razorpay refund failed:', e);
      return finish(
        false,
        `Order cancelled, but the ₹${feeAmount ?? '—'} delivery fee refund failed at Razorpay (${msg}). Retry from Admin > Payments.`,
      );
    }
  }

  // Ledger half. Guarded on status='success' so a concurrent refund is a no-op.
  const { data: updated, error: ledgerError } = await admin
    .from('payments')
    .update({
      status: 'refunded',
      razorpay_refund_id: refundId,
      refunded_at: new Date().toISOString(),
      refund_reason: `Order cancelled by admin: ${trimmedReason}`.slice(0, 500),
    })
    .eq('razorpay_payment_id', feePaymentId)
    .eq('status', 'success')
    .select('id');

  if (ledgerError) {
    // Money moved but the books didn't — the loudest possible case.
    console.error('[cancelOrderWithRefund] refund issued but ledger update failed:', ledgerError);
    return finish(
      false,
      `Refund WAS issued at Razorpay (${refundId ?? 'no id'}) but the payment row could not be updated: ${ledgerError.message}. Fix the row by hand — do NOT refund again.`,
    );
  }

  if (!updated || updated.length === 0) {
    return finish(false, 'The delivery-fee payment row was already refunded — nothing further to do.');
  }

  return finish(true);
}
