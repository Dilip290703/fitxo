import { createClient } from "@fitzo/supabase/client";
import type { DeliveryStatus, DropAddress, OrderStatus } from "./deliveries";

// ── Completed/earnings rows ──────────────────────────────────────────────
// A rider's pay for a job is the order's delivery_fee (the only rider-facing
// money the DB models today — there is no separate rider-commission config, so
// per the no-hardcoding rule we treat the delivery fee as the rider's earning).

export type CompletedDelivery = {
  id: string;
  status: DeliveryStatus;
  orderNumber: string;
  orderStatus: OrderStatus;
  finalAmount: number;
  deliveryFee: number;
  completedAt: string | null;
  city: string | null;
  itemCount: number;
};

function single<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

type OrderRel = {
  order_number: string;
  status: OrderStatus;
  final_amount: number;
  delivery_fee: number;
} | null;

export async function fetchCompletedDeliveries(
  riderId: string,
): Promise<CompletedDelivery[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("deliveries")
    .select(
      "id, status, completed_at, drop_address, order:orders(order_number, status, final_amount, delivery_fee, order_items(id))",
    )
    .eq("rider_id", riderId)
    .in("status", ["completed", "failed"])
    .order("completed_at", { ascending: false, nullsFirst: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((d: any) => {
    const order = single(d.order) as OrderRel & { order_items?: unknown[] };
    const addr = (d.drop_address ?? {}) as DropAddress;
    return {
      id: d.id,
      status: d.status as DeliveryStatus,
      orderNumber: order?.order_number ?? "Order",
      orderStatus: (order?.status ?? "completed") as OrderStatus,
      finalAmount: Number(order?.final_amount ?? 0),
      deliveryFee: Number(order?.delivery_fee ?? 0),
      completedAt: d.completed_at,
      city: addr.city ?? null,
      itemCount: Array.isArray(order?.order_items) ? order!.order_items.length : 0,
    };
  });
}

// ── Earnings rollups ─────────────────────────────────────────────────────

export type EarningsSummary = {
  today: number;
  week: number;
  month: number;
  allTime: number;
  todayCount: number;
  weekCount: number;
  totalCount: number;
  avgPerJob: number;
  rows: CompletedDelivery[];
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function rollupEarnings(rows: CompletedDelivery[]): EarningsSummary {
  const paid = rows.filter((r) => r.status === "completed");
  const dayCut = startOfDay().getTime();
  const weekCut = startOfWeek().getTime();
  const monthCut = startOfMonth().getTime();

  let today = 0,
    week = 0,
    month = 0,
    allTime = 0,
    todayCount = 0,
    weekCount = 0;

  for (const r of paid) {
    const t = r.completedAt ? new Date(r.completedAt).getTime() : 0;
    allTime += r.deliveryFee;
    if (t >= monthCut) month += r.deliveryFee;
    if (t >= weekCut) {
      week += r.deliveryFee;
      weekCount += 1;
    }
    if (t >= dayCut) {
      today += r.deliveryFee;
      todayCount += 1;
    }
  }

  return {
    today,
    week,
    month,
    allTime,
    todayCount,
    weekCount,
    totalCount: paid.length,
    avgPerJob: paid.length ? allTime / paid.length : 0,
    rows,
  };
}

// ── Notifications ────────────────────────────────────────────────────────

export type RiderNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export async function fetchNotifications(
  userId: string,
): Promise<RiderNotification[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

export async function markNotificationRead(id: string) {
  return createClient().from("notifications").update({ is_read: true }).eq("id", id);
}

export async function markAllNotificationsRead(userId: string) {
  return createClient()
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

// ── Profile update (guarded RPC, migration 014) ──────────────────────────

export async function riderUpdateProfile(input: {
  vehicleType: string;
  vehicleNumber: string | null;
}) {
  return createClient().rpc("rider_update_profile", {
    p_vehicle_type: input.vehicleType,
    p_vehicle_number: input.vehicleNumber,
  });
}
