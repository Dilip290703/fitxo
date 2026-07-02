import { createClient } from "@fitzo/supabase/client";
import { loadPayoutSummary } from "@/lib/earnings";

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

export type RecentOrder = {
  id: string;
  orderNumber: string;
  status: string;
  amount: number;
  createdAt: string;
};

export type DashboardData = {
  stats: DashboardStats;
  lowStock: LowStockVariant[];
  recentOrders: RecentOrder[];
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
    recentOrdersRes,
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
    supabase
      .from("orders")
      .select(`order_number, status, final_amount, created_at, ${ORDER_SCOPE}`)
      .eq("order_items.products.store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(10),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentOrders: RecentOrder[] = (recentOrdersRes.data ?? []).map((o: any) => ({
    id: o.id,
    orderNumber: o.order_number ?? o.id,
    status: o.status,
    amount: Number(o.final_amount ?? 0),
    createdAt: o.created_at,
  }));

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
    recentOrders,
  };
}
