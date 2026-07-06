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

/** Stamped by store_confirm_order (033): where the rider collects the order. */
export type PickupAddress = {
  store_name?: string; address?: string; city?: string;
  pincode?: string; phone?: string; store_count?: number;
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
  pickup_address: PickupAddress;
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
    .select("id, status, order_id, drop_address, pickup_address, order:orders(order_number, status, final_amount)")
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
    pickup_address: (d.pickup_address ?? {}) as PickupAddress,
    order: single(d.order) as DeliveryDetail["order"],
    trySession: session ?? null,
    items: (items ?? []) as DeliveryItem[],
  };
}

// ── Self-serve offers (migrations 024/025, reworked in 033) ───────────────
export type AvailableJob = {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  /** Redacted pre-claim: city / pincode / landmark only (033). */
  dropArea: DropAddress;
  itemCount: number;
  deliveryFee: number;
  /** Pickup store (033); null until the migration is applied. */
  storeName: string | null;
  storeArea: string | null;
  storeCount: number;
  createdAt: string;
};

/** The live offer feed: unclaimed deliveries for store-confirmed orders. */
export async function fetchAvailableJobs(): Promise<{ jobs: AvailableJob[]; error: string | null }> {
  const { data, error } = await createClient().rpc("available_deliveries");
  if (error) {
    // Surface it (e.g. missing RPC = migration 024 not applied) instead of silently
    // showing "no offers".
    console.error("available_deliveries failed:", error.message);
    return { jobs: [], error: error.message };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs = ((data as any[]) ?? []).map((d) => ({
    deliveryId: d.delivery_id,
    orderId: d.order_id,
    orderNumber: d.order_number ?? "Order",
    // 033 returns the redacted drop_area; pre-033 returns full drop_address —
    // read both so the panel works either way.
    dropArea: (d.drop_area ?? d.drop_address ?? {}) as DropAddress,
    itemCount: Number(d.item_count ?? 0),
    deliveryFee: Number(d.delivery_fee ?? 0),
    storeName: d.store_name ?? null,
    storeArea: d.store_area ?? null,
    storeCount: Number(d.store_count ?? 1),
    createdAt: d.created_at,
  }));
  return { jobs, error: null };
}

/** Atomically claim an offered delivery. Resolves to the order id on success. */
export async function riderClaim(deliveryId: string) {
  return createClient().rpc("rider_claim_delivery", { p_delivery_id: deliveryId });
}

/** Record a decline so this job stops re-offering to this rider (10-min cooldown). */
export async function riderDecline(deliveryId: string) {
  return createClient().rpc("rider_decline_delivery", { p_delivery_id: deliveryId });
}

/** Hand an accepted (not-yet-picked-up) job back to the pool for other riders. */
export async function riderRelease(deliveryId: string) {
  return createClient().rpc("rider_release_delivery", { p_delivery_id: deliveryId });
}

/** Self-heal an order whose try window has expired (auto-return + complete). */
export async function expireOrderIfDue(orderId: string) {
  return createClient().rpc("expire_order_if_due", { p_order_id: orderId });
}

// ── Guarded rider actions (SECURITY DEFINER RPCs, migrations 014/027/033) ──
export async function riderAccept(id: string) {
  return createClient().rpc("rider_accept_delivery", { p_delivery_id: id });
}
export async function riderPickedUp(id: string) {
  return createClient().rpc("rider_mark_picked_up", { p_delivery_id: id });
}

/** At the door, before handover (033). Delivery → arrived; order unchanged. */
export async function riderArrived(id: string) {
  return createClient().rpc("rider_mark_arrived", { p_delivery_id: id });
}

/**
 * Handover: verifies the customer's 4-digit code (033). Falls back to the
 * pre-033 no-OTP signature when the migration isn't applied yet (PGRST202 =
 * no function matches these args).
 */
export async function riderDelivered(id: string, otp: string) {
  const supabase = createClient();
  const res = await supabase.rpc("rider_mark_delivered", { p_delivery_id: id, p_otp: otp });
  if (res.error?.code === "PGRST202") {
    return supabase.rpc("rider_mark_delivered", { p_delivery_id: id });
  }
  return res;
}

export async function riderComplete(id: string) {
  return createClient().rpc("rider_complete_delivery", { p_delivery_id: id });
}

/** Terminal bad-day exit (033): fails the delivery + files into Admin > Complaints. */
export async function riderFail(id: string, reason: string) {
  return createClient().rpc("rider_fail_delivery", { p_delivery_id: id, p_reason: reason });
}

/** Non-terminal issue report — rides the existing complaints table (RLS: own user). */
export async function fileDeliveryIssue(input: {
  userId: string;
  orderId: string;
  orderNumber: string;
  subject: string;
  message: string;
}) {
  return createClient().from("complaints").insert({
    user_id: input.userId,
    order_id: input.orderId,
    subject: `[Rider issue] ${input.subject} — ${input.orderNumber}`.slice(0, 255),
    message: input.message,
  });
}

export async function riderSetAvailability(available: boolean) {
  return createClient().rpc("rider_set_availability", { p_available: available });
}
