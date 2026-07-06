import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentPayable {
  riderId: string;
  riderName: string;
  completedJobs: number;
  grossEarned: number;
  netOutstanding: number;
  totalPaid: number;
  /** Where to send the money (rider_payout_details, migration 034); null = rider hasn't added bank/UPI yet. */
  destination: string | null;
  /** delivery_fee for completed jobs not yet settled into agent_payouts. */
  unpaid: { orderId: string; amount: number }[];
}

/** "UPI name@bank" / "A/c ····1234 · HDFC0001234" — compact, mask the account number. */
function formatDestination(d: {
  payout_method: string | null;
  upi_id: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
}): string | null {
  if (d.payout_method === 'upi' && d.upi_id) return `UPI ${d.upi_id}`;
  if (d.bank_account_number && d.bank_ifsc) {
    return `A/c ····${d.bank_account_number.slice(-4)} · ${d.bank_ifsc}`;
  }
  return null;
}

/**
 * Per-rider payables. A rider earns the order's `delivery_fee` for each completed
 * delivery (the only rider-facing money the DB models — same basis the agent
 * Earnings screen uses). Earned − already-settled (agent_payouts) = outstanding.
 * Used by both the page (display) and the record-payout action (write) so the
 * math is identical.
 */
export async function computeAgentPayables(supabase: SupabaseClient): Promise<AgentPayable[]> {
  const [{ data: riders }, { data: deliveries }, { data: payouts }, { data: payoutDetails }] = await Promise.all([
    supabase.from('riders').select('id, users(name)').eq('is_verified', true),
    supabase
      .from('deliveries')
      .select('rider_id, order_id, order:orders(delivery_fee)')
      .eq('status', 'completed'),
    supabase.from('agent_payouts').select('rider_id, order_id, amount'),
    // Pre-034 this table doesn't exist — data comes back null and every
    // destination renders as missing, which is also the truth.
    supabase
      .from('rider_payout_details')
      .select('rider_id, payout_method, upi_id, bank_account_number, bank_ifsc'),
  ]);

  const destByRider = new Map<string, string | null>();
  for (const d of (payoutDetails ?? []) as unknown as {
    rider_id: string;
    payout_method: string | null;
    upi_id: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
  }[]) {
    destByRider.set(d.rider_id, formatDestination(d));
  }

  // rider -> (order -> delivery_fee earned)
  const earnedByRiderOrder = new Map<string, Map<string, number>>();
  for (const d of (deliveries ?? []) as unknown as {
    rider_id: string | null;
    order_id: string;
    order: { delivery_fee: number } | { delivery_fee: number }[] | null;
  }[]) {
    if (!d.rider_id) continue;
    const order = Array.isArray(d.order) ? d.order[0] : d.order;
    const fee = Number(order?.delivery_fee ?? 0);
    const m = earnedByRiderOrder.get(d.rider_id) ?? new Map<string, number>();
    m.set(d.order_id, fee);
    earnedByRiderOrder.set(d.rider_id, m);
  }

  const paidOrders = new Map<string, Set<string>>();
  const paidTotal = new Map<string, number>();
  for (const p of (payouts ?? []) as unknown as { rider_id: string; order_id: string; amount: number }[]) {
    const set = paidOrders.get(p.rider_id) ?? new Set<string>();
    set.add(p.order_id);
    paidOrders.set(p.rider_id, set);
    paidTotal.set(p.rider_id, (paidTotal.get(p.rider_id) ?? 0) + Number(p.amount));
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  return ((riders ?? []) as unknown as { id: string; users: { name: string } | { name: string }[] | null }[]).map(
    (r) => {
      const user = Array.isArray(r.users) ? r.users[0] : r.users;
      const orders = earnedByRiderOrder.get(r.id) ?? new Map<string, number>();
      const paid = paidOrders.get(r.id) ?? new Set<string>();
      let grossEarned = 0;
      const unpaid: { orderId: string; amount: number }[] = [];
      for (const [orderId, fee] of orders) {
        grossEarned += fee;
        if (!paid.has(orderId)) unpaid.push({ orderId, amount: round(fee) });
      }
      return {
        riderId: r.id,
        riderName: user?.name ?? 'Rider',
        completedJobs: orders.size,
        grossEarned: round(grossEarned),
        netOutstanding: round(unpaid.reduce((s, u) => s + u.amount, 0)),
        totalPaid: round(paidTotal.get(r.id) ?? 0),
        destination: destByRider.get(r.id) ?? null,
        unpaid,
      };
    },
  );
}
