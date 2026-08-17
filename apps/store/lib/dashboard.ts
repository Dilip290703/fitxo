import { createClient } from "@fitxo/supabase/client";
import { loadPayoutSummary } from "@/lib/earnings";
import { formatCurrency } from "@/lib/format";

export type DashboardStats = {
  todayOrders: number;
  activeTryWindows: number;
  returnsRequested: number;
  awaitingPayout: number;
  liveProducts: number;
  lowStockCount: number;
  totalOrders: number;
};

export type LowStockVariant = {
  id: string;
  sku: string;
  size: string;
  stockQty: number;
  productName: string;
};

export type DashboardData = {
  stats: DashboardStats;
  lowStock: LowStockVariant[];
};

export type ActivityEvent = {
  id: string;
  kind: "order_placed" | "item_kept" | "item_returned" | "payout";
  title: string;
  detail: string;
  at: string;
  href: string;
};

const LOW_STOCK_THRESHOLD = 3;

// The base `orders_select` RLS policy also exposes the manager's own PERSONAL
// customer orders (user_id = auth.uid()), so relying on RLS alone over-counts.
// Every order/returns query is therefore scoped through
// order_items → products.store_id, the same guard earnings/analytics use.
const ORDER_SCOPE = "id, order_items!inner(products!inner(store_id))";

/** Load every metric the Store Dashboard shows, scoped to one store. */
export async function loadStoreDashboard(storeId: string): Promise<DashboardData> {
  const supabase = createClient();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const scopedOrders = () =>
    supabase
      .from("orders")
      .select(ORDER_SCOPE, { count: "exact", head: true })
      .eq("order_items.products.store_id", storeId);

  const [
    todayOrdersRes,
    tryWindowsRes,
    returnsRes,
    payoutSummary,
    liveProductsRes,
    variantsRes,
    totalOrdersRes,
  ] = await Promise.all([
    scopedOrders().gte("created_at", todayStart),
    scopedOrders().eq("status", "try_window_active"),
    supabase
      .from("returns")
      .select("id, order_items!inner(products!inner(store_id))", { count: "exact", head: true })
      .eq("order_items.products.store_id", storeId)
      .in("status", ["requested", "scheduled"]),
    // Same figure as the Earnings page — the two screens must never disagree.
    loadPayoutSummary(storeId),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("is_deleted", false),
    supabase
      .from("product_variants")
      .select("id, sku, size, stock_qty, products!inner(name, store_id, is_deleted)")
      .eq("products.store_id", storeId)
      .eq("products.is_deleted", false)
      .lte("stock_qty", LOW_STOCK_THRESHOLD)
      .order("stock_qty", { ascending: true })
      .limit(8),
    scopedOrders(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lowStock: LowStockVariant[] = (variantsRes.data ?? []).map((v: any) => {
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    return {
      id: v.id,
      sku: v.sku,
      size: v.size,
      stockQty: v.stock_qty,
      productName: product?.name ?? "Product",
    };
  });

  return {
    stats: {
      todayOrders: todayOrdersRes.count ?? 0,
      activeTryWindows: tryWindowsRes.count ?? 0,
      returnsRequested: returnsRes.count ?? 0,
      awaitingPayout: payoutSummary.awaitingPayout,
      liveProducts: liveProductsRes.count ?? 0,
      lowStockCount: lowStock.length,
      totalOrders: totalOrdersRes.count ?? 0,
    },
    lowStock,
  };
}

/**
 * Recent store activity with real timestamps — merged from the three event
 * streams the store's RLS can see: orders arriving, customer keep/return
 * decisions, and payout ledger entries.
 */
export async function loadActivityFeed(storeId: string): Promise<ActivityEvent[]> {
  const supabase = createClient();

  const [ordersRes, decisionsRes, payoutsRes] = await Promise.all([
    supabase
      .from("orders")
      .select(`order_number, created_at, ${ORDER_SCOPE}`)
      .eq("order_items.products.store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("order_items")
      .select(
        "id, product_name, size, decision, decision_at, order_id, orders!inner(order_number), products!inner(store_id)",
      )
      .eq("products.store_id", storeId)
      .in("decision", ["keep", "return"])
      .order("decision_at", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("payouts")
      .select("id, amount, status, created_at, order_id, orders(order_number)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const events: ActivityEvent[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const o of (ordersRes.data ?? []) as any[]) {
    events.push({
      id: `order-${o.id}`,
      kind: "order_placed",
      title: `New order ${o.order_number ?? ""}`.trim(),
      detail: `${(o.order_items ?? []).length} item${(o.order_items ?? []).length === 1 ? "" : "s"}`,
      at: o.created_at,
      href: `/orders/${o.id}`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (decisionsRes.data ?? []) as any[]) {
    if (!d.decision_at) continue;
    const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
    events.push({
      id: `decision-${d.id}`,
      kind: d.decision === "keep" ? "item_kept" : "item_returned",
      title: d.decision === "keep" ? `Kept: ${d.product_name}` : `Returned: ${d.product_name}`,
      detail: `Size ${d.size ?? "—"} · ${order?.order_number ?? ""}`.trim(),
      at: d.decision_at,
      href: `/orders/${d.order_id}`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (payoutsRes.data ?? []) as any[]) {
    const order = Array.isArray(p.orders) ? p.orders[0] : p.orders;
    events.push({
      id: `payout-${p.id}`,
      kind: "payout",
      title: `Payout ${p.status === "paid" ? "paid" : "recorded"}`,
      detail: `${formatCurrency(Number(p.amount ?? 0))}${order?.order_number ? ` · ${order.order_number}` : ""}`,
      at: p.created_at,
      href: "/earnings",
    });
  }

  return events
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);
}
