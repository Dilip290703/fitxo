import { createClient } from "@fitxo/supabase/client";

export type StoreReturn = {
  id: string;
  orderNumber: string;
  productName: string;
  colorName: string;
  size: string;
  price: number;
  reason: string | null;
  condition: "good" | "damaged";
  status: "requested" | "scheduled" | "picked_up" | "completed";
  requestedAt: string;
  completedAt: string | null;
};

/**
 * Return requests for this store's items. The returns RLS policy (migration
 * 004) is order-level, so on a multi-store order it can expose returns rows for
 * other stores' items — but the embedded order_item is RLS-filtered to our own
 * lines, and we additionally check products.store_id so a manager's personal
 * customer orders never leak in. Anything without a matching item is dropped.
 */
export async function loadStoreReturns(storeId: string): Promise<StoreReturn[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("returns")
    .select(
      "id, reason, condition, status, requested_at, completed_at, orders(order_number), order_items(id, product_name, color_name, size, price_at_order, products(store_id))",
    )
    .order("requested_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).flatMap((r: any) => {
    const item = Array.isArray(r.order_items) ? r.order_items[0] : r.order_items;
    const product = item && (Array.isArray(item.products) ? item.products[0] : item.products);
    if (!item || product?.store_id !== storeId) return [];
    const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    return [
      {
        id: r.id,
        orderNumber: order?.order_number ?? "—",
        productName: item.product_name ?? "",
        colorName: item.color_name ?? "",
        size: item.size ?? "",
        price: Number(item.price_at_order ?? 0),
        reason: r.reason ?? null,
        condition: r.condition ?? "good",
        status: r.status ?? "requested",
        requestedAt: r.requested_at,
        completedAt: r.completed_at ?? null,
      },
    ];
  });
}
