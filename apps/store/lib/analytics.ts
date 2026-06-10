import { createClient } from "@fitzo/supabase/client";

export type DayBucket = {
  label: string; // e.g. "9 Jun"
  orders: number;
  revenue: number;
};

export type TopProduct = {
  productName: string;
  keptCount: number;
  keptRevenue: number;
};

export type AnalyticsData = {
  days: DayBucket[]; // last 30 days, oldest first
  totalOrders: number;
  totalItemRevenue: number;
  keptCount: number;
  returnedCount: number;
  pendingCount: number;
  topProducts: TopProduct[]; // by kept revenue, top 5
};

const WINDOW_DAYS = 30;

/**
 * All metrics derive from this store's order line items over the last 30 days,
 * filtered explicitly by products.store_id (the manager's personal customer
 * orders are RLS-visible but must not count). Revenue = gross item value at
 * order time; orders = distinct orders containing our items that day.
 */
export async function loadStoreAnalytics(storeId: string): Promise<AnalyticsData> {
  const supabase = createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, product_name, price_at_order, decision, products!inner(store_id), orders!inner(id, created_at)",
    )
    .eq("products.store_id", storeId)
    .gte("orders.created_at", since.toISOString());

  if (error) throw error;

  // Pre-fill the 30-day window so quiet days still render.
  const dayKey = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const buckets = new Map<string, { orders: Set<string>; revenue: number }>();
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(Date.now() - i * 86400000)), {
      orders: new Set(),
      revenue: 0,
    });
  }

  let keptCount = 0;
  let returnedCount = 0;
  let pendingCount = 0;
  let totalItemRevenue = 0;
  const allOrders = new Set<string>();
  const top = new Map<string, TopProduct>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const raw of (data ?? []) as any[]) {
    const order = Array.isArray(raw.orders) ? raw.orders[0] : raw.orders;
    if (!order) continue;
    const price = Number(raw.price_at_order ?? 0);
    totalItemRevenue += price;
    allOrders.add(order.id);

    const key = dayKey(new Date(order.created_at));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.orders.add(order.id);
      bucket.revenue += price;
    }

    if (raw.decision === "keep") {
      keptCount++;
      const entry = top.get(raw.product_name) ?? {
        productName: raw.product_name ?? "",
        keptCount: 0,
        keptRevenue: 0,
      };
      entry.keptCount++;
      entry.keptRevenue += price;
      top.set(raw.product_name, entry);
    } else if (raw.decision === "return") {
      returnedCount++;
    } else {
      pendingCount++;
    }
  }

  return {
    days: Array.from(buckets.entries()).map(([label, b]) => ({
      label,
      orders: b.orders.size,
      revenue: b.revenue,
    })),
    totalOrders: allOrders.size,
    totalItemRevenue,
    keptCount,
    returnedCount,
    pendingCount,
    topProducts: Array.from(top.values())
      .sort((a, b) => b.keptRevenue - a.keptRevenue)
      .slice(0, 5),
  };
}
