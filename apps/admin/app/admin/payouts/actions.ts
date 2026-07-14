'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';
import { computeStorePayables } from './compute';

/** "UPI name@bank" / "A/c ····1234 · HDFC0001234" — same masking as Agent Payouts. */
function formatStoreDestination(d: {
  upi_id: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
} | null): string | null {
  if (!d) return null;
  if (d.upi_id) return `UPI ${d.upi_id}`;
  if (d.bank_account_number && d.bank_ifsc) {
    return `A/c ····${d.bank_account_number.slice(-4)} · ${d.bank_ifsc}`;
  }
  return null;
}

export async function recordStorePayout(storeId: string, reference?: string): Promise<{ count: number; amount: number }> {
  const actorId = await requireAdmin();

  const admin = createAdminClient();

  // Recompute server-side — never trust a client-supplied amount.
  const payables = await computeStorePayables(admin);
  const store = payables.find((p) => p.storeId === storeId);
  if (!store || store.unpaid.length === 0) throw new Error('Nothing outstanding for this store');

  // NOTE: money moves by MANUAL bank/UPI transfer for now — RazorpayX
  // disbursement is blocked on business registration + account, see
  // docs/PAYOUTS-GOING-LIVE.md (this is its "swap in the payout call" spot).
  // reference = the transfer's UTR/txn id; paid_to snapshots the store's
  // bank/UPI destination (029's onboarding data) at record time (042).
  const { data: biz } = await admin
    .from('store_business_details')
    .select('upi_id, bank_account_number, bank_ifsc')
    .eq('store_id', storeId)
    .maybeSingle();
  const destination = formatStoreDestination(biz);

  const now = new Date().toISOString();
  const ref = reference?.trim() || null;
  const rows = store.unpaid.map((u) => ({
    store_id: storeId,
    order_id: u.orderId,
    amount: u.amount,
    status: 'paid' as const,
    paid_at: now,
    reference: ref,
    paid_to: destination,
  }));

  let { error } = await admin.from('payouts').insert(rows);
  if (error && error.code === 'PGRST204') {
    // Pre-042: reference/paid_to columns don't exist — record the old shape.
    ({ error } = await admin
      .from('payouts')
      .insert(rows.map(({ reference: _r, paid_to: _p, ...row }) => row)));
  }
  if (error) {
    // 23505 = unique_violation on (store_id, order_id) — migration 032's
    // double-payout guard fired (concurrent click / stale page).
    if (error.code === '23505') {
      revalidatePath('/admin/payouts');
      throw new Error('Some of these orders were already paid out — refresh to see the current outstanding amount.');
    }
    throw new Error(error.message);
  }

  await logActivity(
    admin,
    {
      action: `Recorded payout to ${store.storeName}`,
      entity_type: 'payout',
      entity_id: storeId,
      new_value: { orders: rows.length, amount: store.netOutstanding, reference: ref, paid_to: destination },
    },
    actorId,
  );

  revalidatePath('/admin/payouts');
  return { count: rows.length, amount: store.netOutstanding };
}
