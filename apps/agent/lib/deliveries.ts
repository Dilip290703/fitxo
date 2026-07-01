import { createClient } from "@fitzo/supabase/client";

export type DeliveryStatus =
  | "assigned" | "accepted" | "picked_up" | "en_route" | "arrived" | "completed" | "failed";

export type OrderStatus =
  | "pending" | "confirmed" | "assigned" | "out_for_delivery" | "delivered"
  | "try_window_active" | "return_requested" | "return_picked" | "completed" | "cancelled";

export type DropAddress = {
  full_name?: string; phone?: string; line1?: string; line2?: string;
  landmark?: string; city?: string; state?: string; pincode?: string;
};

export type DeliveryListItem = {
  id: string;
  status: DeliveryStatus;
  order_id: string;
  drop_address: DropAddress;
  order: { order_number: string; status: OrderStatus; final_amount: number } | null;
};

export type DeliveryItem = {
  id: string;
  product_name: string;
  color_name: string;
  size: string;
  price_at_order: number;
  image_url: string | null;
  decision: "pending" | "keep" | "return";
};

export type DeliveryDetail = {
  id: string;
  status: DeliveryStatus;
  order_id: string;
  drop_address: DropAddress;
  order: { order_number: string; status: OrderStatus; final_amount: number } | null;
  trySession: { deadline_at: string; status: string } | null;
  items: DeliveryItem[];
};

function single<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export async function fetchMyDeliveries(riderId: string): Promise<DeliveryListItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("deliveries")
    .select("id, status, order_id, drop_address, order:orders(order_number, status, final_amount)")
    .eq("rider_id", riderId)
    .order("assigned_at", { ascending: false, nullsFirst: false });

  return (data ?? []).map((d) => ({
    id: d.id,
    status: d.status,
    order_id: d.order_id,
    drop_address: (d.drop_address ?? {}) as DropAddress,
    order: single(d.order) as DeliveryListItem["order"],
  }));
}

export async function fetchDeliveryDetail(deliveryId: string): Promise<DeliveryDetail | null> {
  const supabase = createClient();

  const { data: d } = await supabase
    .from("deliveries")
    .select("id, status, order_id, drop_address, order:orders(order_number, status, final_amount)")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) return null;

  const [{ data: items }, { data: session }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_name, color_name, size, price_at_order, image_url, decision")
      .eq("order_id", d.order_id),
    supabase
      .from("try_sessions")
      .select("deadline_at, status")
      .eq("order_id", d.order_id)
      .maybeSingle(),
  ]);

  return {
    id: d.id,
    status: d.status,
    order_id: d.order_id,
    drop_address: (d.drop_address ?? {}) as DropAddress,
    order: single(d.order) as DeliveryDetail["order"],
    trySession: session ?? null,
    items: (items ?? []) as DeliveryItem[],
  };
}

// ── Self-serve offers (migration 024) ─────────────────────────────────────
export type AvailableJob = {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  dropAddress: DropAddress;
  itemCount: number;
  finalAmount: number;
  deliveryFee: number;
  createdAt: string;
};

/** The live offer feed: unclaimed deliveries for store-confirmed orders. */
export async function fetchAvailableJobs(): Promise<AvailableJob[]> {
  const { data, error } = await createClient().rpc("available_deliveries");
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((d) => ({
    deliveryId: d.delivery_id,
    orderId: d.order_id,
    orderNumber: d.order_number ?? "Order",
    dropAddress: (d.drop_address ?? {}) as DropAddress,
    itemCount: Number(d.item_count ?? 0),
    finalAmount: Number(d.final_amount ?? 0),
    deliveryFee: Number(d.delivery_fee ?? 0),
    createdAt: d.created_at,
  }));
}

/** Atomically claim an offered delivery. Resolves to the order id on success. */
export async function riderClaim(deliveryId: string) {
  return createClient().rpc("rider_claim_delivery", { p_delivery_id: deliveryId });
}

// ── Guarded rider actions (SECURITY DEFINER RPCs, migration 011) ──
export async function riderAccept(id: string) {
  return createClient().rpc("rider_accept_delivery", { p_delivery_id: id });
}
export async function riderPickedUp(id: string) {
  return createClient().rpc("rider_mark_picked_up", { p_delivery_id: id });
}
export async function riderDelivered(id: string) {
  return createClient().rpc("rider_mark_delivered", { p_delivery_id: id });
}
export async function riderComplete(id: string) {
  return createClient().rpc("rider_complete_delivery", { p_delivery_id: id });
}
export async function riderSetAvailability(available: boolean) {
  return createClient().rpc("rider_set_availability", { p_available: available });
}
