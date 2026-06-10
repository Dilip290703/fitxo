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
  pendingPayout: number;
  paidOut: number;
  payouts: PayoutRow[];
  recentKept: KeptItem[];
};

/**
 * Earnings = what customers kept (gross item value) + the payout ledger.
 * There is no commission config in the DB yet (admin System Settings is a
 * mock), so per the no-hardcoding rule we show gross revenue and treat the
 * admin-created `payouts` rows as the source of truth for amounts actually
 * owed/paid. Kept items are filtered by products.store_id explicitly so a
 * manager's personal customer orders never count as store earnings.
 */
export async function loadStoreEarnings(storeId: string): Promise<EarningsData> {
  const supabase = createClient();

  const [payoutsRes, keptRes] = await Promise.all([
    supabase
      .from("payouts")
      .select("id, amount, status, paid_at, created_at, orders(order_number)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_items")
      .select("id, product_name, size, price_at_order, decision_at, products!inner(store_id)")
      .eq("decision", "keep")
      .eq("products.store_id", storeId)
      .order("decision_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  if (payoutsRes.error) throw payoutsRes.error;
  if (keptRes.error) throw keptRes.error;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentKept: KeptItem[] = (keptRes.data ?? []).map((i: any) => ({
    id: i.id,
    productName: i.product_name ?? "",
    size: i.size ?? "",
    price: Number(i.price_at_order ?? 0),
    decidedAt: i.decision_at ?? null,
  }));

  return {
    grossKeptRevenue: recentKept.reduce((s, i) => s + i.price, 0),
    pendingPayout: payouts
      .filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((s, p) => s + p.amount, 0),
    paidOut: payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    payouts,
    recentKept,
  };
}
