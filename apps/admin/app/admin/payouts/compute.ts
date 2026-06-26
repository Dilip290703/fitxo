import type { SupabaseClient } from '@supabase/supabase-js';

export interface StorePayable {
  storeId: string;
  storeName: string;
  grossKept: number;
  commissionRate: number;
  netOutstanding: number;
  totalPaid: number;
  /** Net (post-commission) amounts for kept orders not yet paid out. */
  unpaid: { orderId: string; amount: number }[];
}

/**
 * Computes per-store payables from kept order items, minus what's already in the
 * payouts ledger. Store payout = Σ(kept item price) × (1 − commission). Payouts
 * are per-order (the `payouts` table keys on store_id + order_id). Used by both
 * the page (display) and the record-payout action (write) so the math matches.
 */
export async function computeStorePayables(supabase: SupabaseClient): Promise<StorePayable[]> {
  const { data: settings } = await supabase.from('system_settings').select('commission_rate').eq('id', 1).maybeSingle();
  const commissionRate = Number(settings?.commission_rate ?? 15);
  const factor = 1 - commissionRate / 100;

  const [{ data: stores }, { data: keptItems }, { data: payouts }] = await Promise.all([
    supabase.from('stores').select('id, name').order('name'),
    supabase.from('order_items').select('price_at_order, order_id, products(store_id)').eq('decision', 'keep'),
    supabase.from('payouts').select('store_id, order_id, amount'),
  ]);

  // store -> (order -> gross kept revenue)
  const keptByStoreOrder = new Map<string, Map<string, number>>();
  for (const it of (keptItems ?? []) as unknown as { price_at_order: number; order_id: string; products: { store_id: string } | null }[]) {
    const storeId = it.products?.store_id;
    if (!storeId) continue;
    const m = keptByStoreOrder.get(storeId) ?? new Map<string, number>();
    m.set(it.order_id, (m.get(it.order_id) ?? 0) + Number(it.price_at_order));
    keptByStoreOrder.set(storeId, m);
  }

  const paidOrders = new Map<string, Set<string>>();
  const paidTotal = new Map<string, number>();
  for (const p of (payouts ?? []) as unknown as { store_id: string; order_id: string; amount: number }[]) {
    const set = paidOrders.get(p.store_id) ?? new Set<string>();
    set.add(p.order_id);
    paidOrders.set(p.store_id, set);
    paidTotal.set(p.store_id, (paidTotal.get(p.store_id) ?? 0) + Number(p.amount));
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  return ((stores ?? []) as { id: string; name: string }[]).map((st) => {
    const orders = keptByStoreOrder.get(st.id) ?? new Map<string, number>();
    const paid = paidOrders.get(st.id) ?? new Set<string>();
    let grossKept = 0;
    const unpaid: { orderId: string; amount: number }[] = [];
    for (const [orderId, gross] of orders) {
      grossKept += gross;
      if (!paid.has(orderId)) unpaid.push({ orderId, amount: round(gross * factor) });
    }
    return {
      storeId: st.id,
      storeName: st.name,
      grossKept: round(grossKept),
      commissionRate,
      netOutstanding: round(unpaid.reduce((s, u) => s + u.amount, 0)),
      totalPaid: round(paidTotal.get(st.id) ?? 0),
      unpaid,
    };
  });
}
