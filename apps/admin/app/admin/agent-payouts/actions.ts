'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';
import { computeAgentPayables } from './compute';

export async function recordAgentPayout(riderId: string): Promise<{ count: number; amount: number }> {
  const actorId = await requireAdmin();

  const admin = createAdminClient();

  // Recompute server-side — never trust a client-supplied amount.
  const payables = await computeAgentPayables(admin);
  const rider = payables.find((p) => p.riderId === riderId);
  if (!rider || rider.unpaid.length === 0) throw new Error('Nothing outstanding for this rider');

  // NOTE: real Razorpay disbursement is shared infra (not built yet); this records
  // the payout ledger entries as paid. Swap in the Razorpay payout call here later.
  const now = new Date().toISOString();
  const rows = rider.unpaid.map((u) => ({
    rider_id: riderId,
    order_id: u.orderId,
    amount: u.amount,
    status: 'paid' as const,
    paid_at: now,
  }));

  const { error } = await admin.from('agent_payouts').insert(rows);
  if (error) throw new Error(error.message);

  await logActivity(
    admin,
    {
      action: `Recorded payout to rider ${rider.riderName}`,
      entity_type: 'agent_payout',
      entity_id: riderId,
      new_value: { jobs: rows.length, amount: rider.netOutstanding },
    },
    actorId,
  );

  revalidatePath('/admin/agent-payouts');
  return { count: rows.length, amount: rider.netOutstanding };
}
