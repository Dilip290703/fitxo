import { redirect } from "next/navigation";
import { createClient } from "@fitzo/supabase/server";
import { OrderTrackingView } from "./OrderTrackingView";
import type { TrackingItem, TrackingSession, TrackingOrder } from "./OrderTrackingView";
import type { OrderStatus, ItemDecision } from "@fitzo/supabase/types";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: raw } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, final_amount, delivery_fee, created_at,
       order_items(id, product_name, color_name, size, price_at_order, image_url, decision),
       try_sessions(deadline_at, status)`
    )
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!raw) {
    redirect("/orders");
  }

  const order: TrackingOrder = {
    id:           raw.id,
    order_number: raw.order_number,
    status:       raw.status as OrderStatus,
    final_amount: raw.final_amount,
    created_at:   raw.created_at,
  };

  const rawItems = Array.isArray(raw.order_items) ? raw.order_items : [];
  const items: TrackingItem[] = (rawItems as {
    id: string;
    product_name: string;
    color_name: string;
    size: string;
    price_at_order: number;
    image_url: string | null;
    decision: string;
  }[]).map((i) => ({
    id:            i.id,
    product_name:  i.product_name,
    color_name:    i.color_name,
    size:          i.size,
    price_at_order: i.price_at_order,
    image_url:     i.image_url,
    decision:      i.decision as ItemDecision,
  }));

  const rawSession = Array.isArray(raw.try_sessions)
    ? raw.try_sessions[0]
    : raw.try_sessions;

  const trySession: TrackingSession = rawSession
    ? { deadline_at: rawSession.deadline_at, status: rawSession.status }
    : null;

  // Delivery-fee state (G9, migration 050 — with 040 as legacy fallback):
  //   pendingDeliveryFee > 0  → fee due, nothing collected yet
  //   feeRefunded             → the upfront fee came back (kept-value waiver)
  let pendingDeliveryFee = 0;
  let feeRefunded = false;
  if (Number(raw.delivery_fee ?? 0) > 0) {
    const { data: feeRows, error: feeError } = await supabase
      .from("payments")
      .select("id, status, order_item_id")
      .eq("order_id", orderId)
      .in("status", ["success", "refunded"])
      .gt("delivery_fee_component", 0);
    if (!feeError) {
      const rows = feeRows ?? [];
      if (!rows.some((r) => r.status === "success")) {
        pendingDeliveryFee = Number(raw.delivery_fee);
      }
      feeRefunded = rows.some((r) => r.status === "refunded" && r.order_item_id === null);
      // A refunded fee with no live success carrier is settled history, not a
      // new debt — don't re-ask for it.
      if (feeRefunded) pendingDeliveryFee = 0;
    }
  }

  // Try-window duration for display copy — one source of truth
  // (system_settings.try_window_minutes). Live timers still read deadline_at.
  // The same row probes migration 050: first_order_free resolving means the
  // upfront-fee flow (pay card + fee-only settle guard) is live.
  const { data: settings } = await supabase
    .from("system_settings")
    .select("try_window_minutes")
    .eq("id", 1)
    .maybeSingle();
  const tryWindowMinutes = Number(settings?.try_window_minutes ?? 7);
  const { error: probe050 } = await supabase
    .from("system_settings")
    .select("first_order_free")
    .eq("id", 1)
    .maybeSingle();
  const canPayFeeUpfront = !probe050;

  return (
    <OrderTrackingView
      order={order}
      items={items}
      trySession={trySession}
      pendingDeliveryFee={pendingDeliveryFee}
      canPayFeeUpfront={canPayFeeUpfront}
      feeRefunded={feeRefunded}
      tryWindowMinutes={tryWindowMinutes}
    />
  );
}
