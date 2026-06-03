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
      `id, order_number, status, final_amount, created_at,
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

  return (
    <OrderTrackingView order={order} items={items} trySession={trySession} />
  );
}
