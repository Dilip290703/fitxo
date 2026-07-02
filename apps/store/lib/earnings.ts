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

export type EarningsData = {
  grossKeptRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  /** What the store actually receives: gross − Fitzo commission. */
  netEarnings: number;
  /** Net earned but not yet in the payout ledger (or recorded as pending). */
  awaitingPayout: number;
  paidOut: number;
  payouts: PayoutRow[];
  recentKept: KeptItem[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Earnings = what customers kept, net of the Fitzo commission
 * (`system_settings.commission_rate`, authenticated-read since migration 011).
 * The math mirrors Admin > Store Payouts (`computeStorePayables`) exactly:
 * per-order net = round2(order gross × (1 − rate/100)), so the store sees the
 * same rupee figures the admin settles. Payout ledger rows hold NET amounts.
 * Kept items are filtered by products.store_id explicitly so a manager's
 * personal customer orders never count as store earnings.
 */
export async function loadStoreEarnings(storeId: string): Promise<EarningsData> {
  const supabase = createClient();

  const [settingsRes, payoutsRes, keptAllRes, keptRecentRes] = await Promise.all([
    supabase.from("system_settings").select("commission_rate").eq("id", 1).maybeSingle(),
    supabase
      .from("payouts")
      .select("id, amount, status, paid_at, created_at, orders(order_number)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    // ALL kept items (order_id + price only) — totals must not be capped by the
    // display limit below.
    supabase
      .from("order_items")
      .select("order_id, price_at_order, products!inner(store_id)")
      .eq("decision", "keep")
      .eq("products.store_id", storeId),
    supabase
      .from("order_items")
      .select("id, product_name, size, price_at_order, decision_at, products!inner(store_id)")
      .eq("decision", "keep")
      .eq("products.store_id", storeId)
      .order("decision_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  if (payoutsRes.error) throw payoutsRes.error;
  if (keptAllRes.error) throw keptAllRes.error;
  if (keptRecentRes.error) throw keptRecentRes.error;

  const commissionRate = Number(settingsRes.data?.commission_rate ?? 15);
  const factor = 1 - commissionRate / 100;

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

  // Group kept revenue per order and round per order — identical to the admin
  // payout computation, so both panels always show the same net.
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

  const recordedTotal = payouts.reduce((s, p) => s + p.amount, 0);
  const paidOut = round2(payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentKept: KeptItem[] = (keptRecentRes.data ?? []).map((i: any) => ({
    id: i.id,
    productName: i.product_name ?? "",
    size: i.size ?? "",
    price: Number(i.price_at_order ?? 0),
    decidedAt: i.decision_at ?? null,
  }));

  return {
    grossKeptRevenue,
    commissionRate,
    commissionAmount: round2(grossKeptRevenue - netEarnings),
    netEarnings,
    awaitingPayout: Math.max(0, round2(netEarnings - recordedTotal)),
    paidOut,
    payouts,
    recentKept,
  };
}
