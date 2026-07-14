import { createClient } from "@fitzo/supabase/client";

export type PayoutRow = {
  id: string;
  orderNumber: string;
  amount: number;
  status: "pending" | "processing" | "paid";
  paidAt: string | null;
  createdAt: string;
};

export type KeptItem = {
  id: string;
  productName: string;
  size: string;
  price: number;
  decidedAt: string | null;
};

export type PayoutSummary = {
  grossKeptRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  /** Kept-item rupees with no live successful payment (refunded or unpaid) — excluded from net (migration 045). */
  excludedGross: number;
  /** What the store actually receives: paid kept revenue − Fitzo commission. */
  netEarnings: number;
  /** Net earned but not yet in the payout ledger (or recorded as pending). */
  awaitingPayout: number;
  paidOut: number;
  payouts: PayoutRow[];
};

export type EarningsData = PayoutSummary & {
  recentKept: KeptItem[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The money summary. Since migration 045 the math comes from the guarded
 * `store_order_economics` RPC — the per-store slice of the DB's one money
 * truth (044), the same rows Admin > Store Payouts reads, so both panels show
 * identical rupees by construction. Refund-aware: a kept item counts only
 * while its payment is a live SUCCESS; refunded/unpaid kept rupees surface as
 * `excludedGross`. Pre-045 falls back to the old kept × (1−rate) math.
 *
 * This is THE payout figure — the dashboard card and the Earnings page both
 * read it, so they can never disagree.
 */
export async function loadPayoutSummary(storeId: string): Promise<PayoutSummary> {
  const supabase = createClient();

  const [ecoRes, payoutsRes] = await Promise.all([
    supabase.rpc("store_order_economics", { p_store_id: storeId }),
    supabase
      .from("payouts")
      .select("id, amount, status, paid_at, created_at, orders(order_number)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
  ]);

  if (payoutsRes.error) throw payoutsRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payouts: PayoutRow[] = (payoutsRes.data ?? []).map((p: any) => {
    const order = Array.isArray(p.orders) ? p.orders[0] : p.orders;
    return {
      id: p.id,
      orderNumber: order?.order_number ?? "—",
      amount: Number(p.amount ?? 0),
      status: p.status ?? "pending",
      paidAt: p.paid_at ?? null,
      createdAt: p.created_at,
    };
  });
  const recordedTotal = payouts.reduce((s, p) => s + p.amount, 0);
  const paidOut = round2(payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0));

  if (!ecoRes.error) {
    let grossKeptRevenue = 0;
    let netEarnings = 0;
    let commissionAmount = 0;
    let excludedGross = 0;
    let commissionRate = 15;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (ecoRes.data ?? []) as any[]) {
      grossKeptRevenue += Number(r.kept_gross ?? 0);
      netEarnings += Number(r.store_net ?? 0);
      commissionAmount += Number(r.commission ?? 0);
      excludedGross += Number(r.kept_gross ?? 0) - Number(r.kept_paid_gross ?? 0);
      commissionRate = Number(r.commission_rate ?? commissionRate);
    }
    return {
      grossKeptRevenue: round2(grossKeptRevenue),
      commissionRate,
      commissionAmount: round2(commissionAmount),
      excludedGross: round2(excludedGross),
      netEarnings: round2(netEarnings),
      awaitingPayout: Math.max(0, round2(netEarnings - recordedTotal)),
      paidOut,
      payouts,
    };
  }

  // ── Pre-045 fallback: kept × (1 − rate), not refund-aware ────────────────
  const [settingsRes, keptAllRes] = await Promise.all([
    supabase.from("system_settings").select("commission_rate").eq("id", 1).maybeSingle(),
    // ALL kept items (order_id + price only) — totals must never be capped by
    // a display limit.
    supabase
      .from("order_items")
      .select("order_id, price_at_order, products!inner(store_id)")
      .eq("decision", "keep")
      .eq("products.store_id", storeId),
  ]);

  if (keptAllRes.error) throw keptAllRes.error;

  const commissionRate = Number(settingsRes.data?.commission_rate ?? 15);
  const factor = 1 - commissionRate / 100;

  // Group kept revenue per order and round per order — identical to the old
  // admin payout computation, so both panels always show the same net.
  const grossByOrder = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const it of (keptAllRes.data ?? []) as any[]) {
    grossByOrder.set(it.order_id, (grossByOrder.get(it.order_id) ?? 0) + Number(it.price_at_order ?? 0));
  }
  let grossKeptRevenue = 0;
  let netEarnings = 0;
  for (const gross of grossByOrder.values()) {
    grossKeptRevenue += gross;
    netEarnings += round2(gross * factor);
  }
  grossKeptRevenue = round2(grossKeptRevenue);
  netEarnings = round2(netEarnings);

  return {
    grossKeptRevenue,
    commissionRate,
    commissionAmount: round2(grossKeptRevenue - netEarnings),
    excludedGross: 0,
    netEarnings,
    awaitingPayout: Math.max(0, round2(netEarnings - recordedTotal)),
    paidOut,
    payouts,
  };
}

export async function loadStoreEarnings(storeId: string): Promise<EarningsData> {
  const supabase = createClient();

  const [summary, keptRecentRes] = await Promise.all([
    loadPayoutSummary(storeId),
    supabase
      .from("order_items")
      .select("id, product_name, size, price_at_order, decision_at, products!inner(store_id)")
      .eq("decision", "keep")
      .eq("products.store_id", storeId)
      .order("decision_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  if (keptRecentRes.error) throw keptRecentRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentKept: KeptItem[] = (keptRecentRes.data ?? []).map((i: any) => ({
    id: i.id,
    productName: i.product_name ?? "",
    size: i.size ?? "",
    price: Number(i.price_at_order ?? 0),
    decidedAt: i.decision_at ?? null,
  }));

  return { ...summary, recentKept };
}
