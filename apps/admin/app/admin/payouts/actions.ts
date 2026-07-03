'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';
import { computeStorePayables } from './compute';

export async function recordStorePayout(storeId: string): Promise<{ count: number; amount: number }> {
  const actorId = await requireAdmin();

  const admin = createAdminClient();

  // Recompute server-side — never trust a client-supplied amount.
  const payables = await computeStorePayables(admin);
  const store = payables.find((p) => p.storeId === storeId);
  if (!store || store.unpaid.length === 0) throw new Error('Nothing outstanding for this store');

  // NOTE: real Razorpay disbursement is shared infra (not built yet); this records
  // the payout ledger entries as paid. Swap in the Razorpay payout call here later.
  const now = new Date().toISOString();
  const rows = store.unpaid.map((u) => ({
    store_id: storeId,
    order_id: u.orderId,
    amount: u.amount,
    status: 'paid' as const,
    paid_at: now,
  }));

  const { error } = await admin.from('payouts').insert(rows);
  if (error) throw new Error(error.message);

  await logActivity(
    admin,
    {
      action: `Recorded payout to ${store.storeName}`,
      entity_type: 'payout',
      entity_id: storeId,
      new_value: { orders: rows.length, amount: store.netOutstanding },
    },
    actorId,
  );

  revalidatePath('/admin/payouts');
  return { count: rows.length, amount: store.netOutstanding };
}
