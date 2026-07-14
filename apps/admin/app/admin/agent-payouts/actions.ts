'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';
import { computeAgentPayables } from './compute';

export async function recordAgentPayout(riderId: string, reference?: string): Promise<{ count: number; amount: number }> {
  const actorId = await requireAdmin();

  const admin = createAdminClient();

  // Recompute server-side — never trust a client-supplied amount.
  const payables = await computeAgentPayables(admin);
  const rider = payables.find((p) => p.riderId === riderId);
  if (!rider || rider.unpaid.length === 0) throw new Error('Nothing outstanding for this rider');

  // NOTE: money moves by MANUAL bank/UPI transfer for now — RazorpayX
  // disbursement is blocked on business registration + account, see
  // docs/PAYOUTS-GOING-LIVE.md (where this is the "swap in the payout call"
  // spot). reference = the transfer's UTR/txn id; paid_to snapshots the
  // destination at record time (042).
  const now = new Date().toISOString();
  const ref = reference?.trim() || null;
  const rows = rider.unpaid.map((u) => ({
    rider_id: riderId,
    order_id: u.orderId,
    amount: u.amount,
    status: 'paid' as const,
    paid_at: now,
    reference: ref,
    paid_to: rider.destination,
  }));

  let { error } = await admin.from('agent_payouts').insert(rows);
  if (error && error.code === 'PGRST204') {
    // Pre-042: reference/paid_to columns don't exist — record the old shape.
    ({ error } = await admin
      .from('agent_payouts')
      .insert(rows.map(({ reference: _r, paid_to: _p, ...row }) => row)));
  }
  if (error) {
    // 23505 = unique_violation on (rider_id, order_id) — double-payout guard
    // fired (concurrent click / stale page).
    if (error.code === '23505') {
      revalidatePath('/admin/agent-payouts');
      throw new Error('Some of these jobs were already paid out — refresh to see the current outstanding amount.');
    }
    throw new Error(error.message);
  }

  await logActivity(
    admin,
    {
      action: `Recorded payout to rider ${rider.riderName}`,
      entity_type: 'agent_payout',
      entity_id: riderId,
      new_value: { jobs: rows.length, amount: rider.netOutstanding, reference: ref, paid_to: rider.destination },
    },
    actorId,
  );

  revalidatePath('/admin/agent-payouts');
  return { count: rows.length, amount: rider.netOutstanding };
}
