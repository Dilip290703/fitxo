import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentPayable {
  riderId: string;
  riderName: string;
  completedJobs: number;
  grossEarned: number;
  netOutstanding: number;
  totalPaid: number;
  /** delivery_fee for completed jobs not yet settled into agent_payouts. */
  unpaid: { orderId: string; amount: number }[];
}

/**
 * Per-rider payables. A rider earns the order's `delivery_fee` for each completed
 * delivery (the only rider-facing money the DB models — same basis the agent
 * Earnings screen uses). Earned − already-settled (agent_payouts) = outstanding.
 * Used by both the page (display) and the record-payout action (write) so the
 * math is identical.
 */
export async function computeAgentPayables(supabase: SupabaseClient): Promise<AgentPayable[]> {
  const [{ data: riders }, { data: deliveries }, { data: payouts }] = await Promise.all([
    supabase.from('riders').select('id, users(name)').eq('is_verified', true),
    supabase
      .from('deliveries')
      .select('rider_id, order_id, order:orders(delivery_fee)')
      .eq('status', 'completed'),
    supabase.from('agent_payouts').select('rider_id, order_id, amount'),
  ]);

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
        unpaid,
      };
    },
  );
}
