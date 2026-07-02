import { createClient } from "@fitzo/supabase/client";

export type StoreOrderItem = {
  id: string;
  productName: string;
  colorName: string;
  size: string;
  sku: string | null;
  price: number;
  decision: "pending" | "keep" | "return";
  returnReason: string | null;
  preparedAt: string | null;
};

export type StoreOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  tryDeadline: string | null;
  itemCount: number;
  subtotal: number;
  keptCount: number;
  returnedCount: number;
  preparedCount: number;
};

export type StoreOrderDetail = StoreOrderSummary & {
  paymentStatus: string;
  items: StoreOrderItem[];
};

// RLS (migration 004) lets a manager read orders containing their products —
// but the base `orders_select` policy ALSO exposes the manager's own personal
// customer orders (user_id = auth.uid()). Every query here therefore filters
// explicitly by products.store_id (same guard earnings/analytics use), so
// personal shopping never shows up in the store panel. We never read
// users/addresses (admin-only) — no customer PII here.
const ITEM_SELECT =
  "id, product_name, color_name, size, price_at_order, decision, return_reason, prepared_at, product_variants(sku)";

const SCOPED_ITEMS = `order_items!inner(${ITEM_SELECT}, products!inner(store_id))`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(i: any): StoreOrderItem {
  const variant = Array.isArray(i.product_variants) ? i.product_variants[0] : i.product_variants;
  return {
    id: i.id,
    productName: i.product_name ?? "",
    colorName: i.color_name ?? "",
    size: i.size ?? "",
    sku: variant?.sku ?? null,
    price: Number(i.price_at_order ?? 0),
    decision: i.decision ?? "pending",
    returnReason: i.return_reason ?? null,
    preparedAt: i.prepared_at ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarize(o: any, items: StoreOrderItem[]): StoreOrderSummary {
  return {
    id: o.id,
    orderNumber: o.order_number ?? o.id,
    status: o.status,
    createdAt: o.created_at,
    tryDeadline: o.try_deadline ?? null,
    itemCount: items.length,
    subtotal: items.reduce((sum, it) => sum + it.price, 0),
    keptCount: items.filter((it) => it.decision === "keep").length,
    returnedCount: items.filter((it) => it.decision === "return").length,
    preparedCount: items.filter((it) => it.preparedAt).length,
  };
}

export async function loadStoreOrders(storeId: string): Promise<StoreOrderSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`id, order_number, status, created_at, try_deadline, ${SCOPED_ITEMS}`)
    .eq("order_items.products.store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => summarize(o, (o.order_items ?? []).map(mapItem)));
}

/** Orders still waiting for this store to confirm — the sidebar badge count. */
export async function countPendingStoreOrders(storeId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id, order_items!inner(products!inner(store_id))", { count: "exact", head: true })
    .eq("order_items.products.store_id", storeId)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function loadStoreOrder(orderId: string, storeId: string): Promise<StoreOrderDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, created_at, try_deadline, payment_status, ${SCOPED_ITEMS}`,
    )
    .eq("order_items.products.store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((data as any).order_items ?? []).map(mapItem);
  return {
    ...summarize(data, items),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentStatus: (data as any).payment_status ?? "pending",
    items,
  };
}

/** Toggle a line item's "ready for pickup" flag via the guarded RPC. */
export async function setItemPrepared(itemId: string, ready: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_order_item_prepared", {
    p_item_id: itemId,
    p_ready: ready,
  });
  if (error) throw error;
}

/**
 * Confirm the store has the items: flips the order pending -> confirmed and
 * creates the delivery so admin can assign a rider. Guarded by store ownership
 * in the store_confirm_order() RPC (migration 013).
 */
export async function confirmOrder(orderId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("store_confirm_order", {
    p_order_id: orderId,
  });
  if (error) throw error;
}
