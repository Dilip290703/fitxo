import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Orders still holding an upfront delivery fee that needs attention
 * (migration 058's `pending_fee_refunds()`).
 *
 * Since G9/050 the fee is charged before the rider moves, so a cancelled order
 * can be sitting on real customer money. Four code paths cancel an order and
 * they did not all handle that; rather than trust each one, the queue is
 * DERIVED from the payment rows, so any future cancel path shows up here on its
 * own.
 */
export type FeeRefundReason = 'cancelled_unrefunded' | 'stale_unclaimed' | 'rider_failed';

export interface PendingFeeRefund {
  order_id: string;
  order_number: string | null;
  user_id: string | null;
  order_status: string;
  reason: FeeRefundReason;
  fee_amount: number | null;
  razorpay_payment_id: string | null;
  order_created_at: string;
}

/**
 * `unavailable` is surfaced rather than swallowed on purpose: if migration 058
 * isn't applied, an empty list would look exactly like "nothing owed", which is
 * the precise failure this queue exists to prevent.
 */
export async function getPendingFeeRefunds(): Promise<{
  rows: PendingFeeRefund[];
  unavailable: boolean;
}> {
  const { data, error } = await createAdminClient().rpc('pending_fee_refunds');
  if (error) {
    console.error('[fee-refunds] pending_fee_refunds() failed:', error.message);
    return { rows: [], unavailable: true };
  }
  return { rows: (data ?? []) as PendingFeeRefund[], unavailable: false };
}

export const FEE_REFUND_LABEL: Record<FeeRefundReason, string> = {
  cancelled_unrefunded: 'cancelled, fee not refunded',
  stale_unclaimed: 'never claimed by a rider',
  rider_failed: 'rider could not deliver — needs a policy call',
};
