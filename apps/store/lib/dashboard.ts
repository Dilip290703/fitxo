import { createClient } from "@fitzo/supabase/client";

export type DashboardStats = {
  todayOrders: number;
  activeTryWindows: number;
  returnsRequested: number;
  pendingPayout: number;
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

/**
 * Load every metric the Store Dashboard shows, scoped to one store. Relies on
 * the manager-read RLS policies from migration 004: orders/returns are already
 * restricted to this manager's stores, while products/variants are also visible
 * publicly, so those queries filter by `store_id` explicitly.
 */
export async function loadStoreDashboard(storeId: string): Promise<DashboardData> {
  const supabase = createClient();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [
    todayOrdersRes,
    tryWindowsRes,
    returnsRes,
    payoutsRes,
    liveProductsRes,
    variantsRes,
    totalOrdersRes,
    recentOrdersRes,
  ] = await Promise.all([
    // RLS scopes orders/returns to this manager — no store filter needed.
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "try_window_active"),
    supabase.from("returns").select("*", { count: "exact", head: true }).in("status", ["requested", "scheduled"]),
    supabase.from("payouts").select("amount").eq("store_id", storeId).eq("status", "pending"),
    // Products are publicly visible, so scope to this store.
    supabase.from("products").select("*", { count: "exact", head: true }).eq("store_id", storeId).eq("is_deleted", false),
    supabase
      .from("product_variants")
      .select("id, sku, size, stock_qty, products!inner(name, store_id, is_deleted)")
      .eq("products.store_id", storeId)
      .eq("products.is_deleted", false)
      .lte("stock_qty", LOW_STOCK_THRESHOLD)
      .order("stock_qty", { ascending: true })
      .limit(8),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, order_number, status, final_amount, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pendingPayout = (payoutsRes.data ?? []).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  );

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
      pendingPayout,
      liveProducts: liveProductsRes.count ?? 0,
      lowStockCount: lowStock.length,
      totalOrders: totalOrdersRes.count ?? 0,
    },
    lowStock,
    recentOrders,
  };
}
