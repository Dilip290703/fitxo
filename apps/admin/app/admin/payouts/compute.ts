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

const round = (n: number) => Math.round(n * 100) / 100;

interface EcoRow {
  store_id: string;
  order_id: string;
  kept_gross: number;
  kept_paid_gross: number;
  commission_rate: number;
  commission: number;
  store_net: number;
}

/**
 * Computes per-store payables. Since migration 045 the money math comes from
 * the guarded `store_order_economics` RPC — the per-store slice of 044's one
 * money truth, so this screen, the store panel's Earnings and the admin Money
 * card can never disagree. Refund-aware: a kept item only owes the store money
 * while its payment is a live SUCCESS (a 041 refund drops it automatically).
 * Pre-045 (RPC missing) falls back to the legacy kept-items × (1−rate) math.
 * Used by both the page (display) and the record-payout action (write).
 */
export async function computeStorePayables(supabase: SupabaseClient): Promise<StorePayable[]> {
  const { data: ecoRows, error: ecoError } = await supabase.rpc('store_order_economics');
  if (ecoError) return computeStorePayablesLegacy(supabase);

  const [{ data: stores }, { data: payouts }] = await Promise.all([
    supabase.from('stores').select('id, name').order('name'),
    supabase.from('payouts').select('store_id, order_id, amount'),
  ]);

  // store -> (order -> economics)
  const byStore = new Map<string, EcoRow[]>();
  for (const r of (ecoRows ?? []) as EcoRow[]) {
    const list = byStore.get(r.store_id) ?? [];
    list.push(r);
    byStore.set(r.store_id, list);
  }

  const paidOrders = new Map<string, Set<string>>();
  const paidTotal = new Map<string, number>();
  for (const p of (payouts ?? []) as unknown as { store_id: string; order_id: string; amount: number }[]) {
    const set = paidOrders.get(p.store_id) ?? new Set<string>();
    set.add(p.order_id);
    paidOrders.set(p.store_id, set);
    paidTotal.set(p.store_id, (paidTotal.get(p.store_id) ?? 0) + Number(p.amount));
  }

  return ((stores ?? []) as { id: string; name: string }[]).map((st) => {
    const rows = byStore.get(st.id) ?? [];
    const paid = paidOrders.get(st.id) ?? new Set<string>();
    let grossKept = 0;
    let commissionRate = 15;
    const unpaid: { orderId: string; amount: number }[] = [];
    for (const r of rows) {
      grossKept += Number(r.kept_gross);
      commissionRate = Number(r.commission_rate);
      // Owe only what's actually paid-and-not-refunded; a fully-refunded
      // order has store_net 0 and simply never becomes owed.
      if (!paid.has(r.order_id) && Number(r.store_net) > 0) {
        unpaid.push({ orderId: r.order_id, amount: round(Number(r.store_net)) });
      }
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

/** Pre-045 math: kept items × (1 − commission_rate), NOT refund-aware. */
async function computeStorePayablesLegacy(supabase: SupabaseClient): Promise<StorePayable[]> {
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
