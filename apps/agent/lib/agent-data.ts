import { createClient } from "@fitzo/supabase/client";
import type { DeliveryStatus, DropAddress, OrderStatus } from "./deliveries";

// ── Completed/earnings rows ──────────────────────────────────────────────
// A rider's pay for a job is the order's delivery_fee (the only rider-facing
// money the DB models today — there is no separate rider-commission config, so
// per the no-hardcoding rule we treat the delivery fee as the rider's earning).

export type CompletedDelivery = {
  id: string;
  status: DeliveryStatus;
  orderId: string;
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
): Promise<{ rows: CompletedDelivery[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select(
      "id, status, completed_at, drop_address, order_id, order:orders(order_number, status, final_amount, delivery_fee, order_items(id))",
    )
    .eq("rider_id", riderId)
    .in("status", ["completed", "failed"])
    .order("completed_at", { ascending: false, nullsFirst: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((d: any) => {
    const order = single(d.order) as OrderRel & { order_items?: unknown[] };
    const addr = (d.drop_address ?? {}) as DropAddress;
    return {
      id: d.id,
      status: d.status as DeliveryStatus,
      orderId: d.order_id,
      orderNumber: order?.order_number ?? "Order",
      orderStatus: (order?.status ?? "completed") as OrderStatus,
      finalAmount: Number(order?.final_amount ?? 0),
      deliveryFee: Number(order?.delivery_fee ?? 0),
      completedAt: d.completed_at,
      city: addr.city ?? null,
      itemCount: Array.isArray(order?.order_items) ? order!.order_items.length : 0,
    };
  });
  return { rows, error: error?.message ?? null };
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
): Promise<{ rows: RiderNotification[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: (data ?? []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
    error: error?.message ?? null,
  };
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

// ── Support tickets — ride the existing complaints table (migration 012). ──
// A rider is a users row, so complaints_insert_own / _select_own already cover
// filing + reading; admin triages in Admin > Complaints. Same pattern the
// store panel uses; subjects are prefixed for triage (no rider_id column).

export type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
};

export async function fileSupportTicket(input: {
  userId: string;
  riderName: string;
  subject: string;
  message: string;
}) {
  return createClient().from("complaints").insert({
    user_id: input.userId,
    subject: `[Rider: ${input.riderName}] ${input.subject}`.slice(0, 255),
    message: input.message,
  });
}

export async function fetchMyTickets(
  userId: string,
): Promise<{ rows: SupportTicket[]; error: string | null }> {
  const { data, error } = await createClient()
    .from("complaints")
    .select("id, subject, message, status, admin_response, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: (data ?? []).map((c: any) => ({
      id: c.id,
      subject: c.subject,
      message: c.message,
      status: c.status,
      adminResponse: c.admin_response,
      createdAt: c.created_at,
    })),
    error: error?.message ?? null,
  };
}

// ── Payout ledger (agent_payouts, migration 020 — rider reads own rows) ──

export type AgentPayoutRow = {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export async function fetchAgentPayouts(
  riderId: string,
): Promise<{ rows: AgentPayoutRow[]; error: string | null }> {
  const { data, error } = await createClient()
    .from("agent_payouts")
    .select("id, order_id, amount, status, paid_at, created_at")
    .eq("rider_id", riderId)
    .order("created_at", { ascending: false });
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: (data ?? []).map((p: any) => ({
      id: p.id,
      orderId: p.order_id,
      amount: Number(p.amount),
      status: p.status,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })),
    error: error?.message ?? null,
  };
}

// ── Payout details (rider_payout_details, migration 034) ─────────────────

export type PayoutDetails = {
  legalName: string;
  panNumber: string;
  payoutMethod: "upi" | "bank";
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
};

/** null = none saved yet (or migration 034 not applied — treat the same). */
export async function fetchPayoutDetails(riderId: string): Promise<PayoutDetails | null> {
  const { data, error } = await createClient()
    .from("rider_payout_details")
    .select("legal_name, pan_number, payout_method, bank_account_name, bank_account_number, bank_ifsc, upi_id")
    .eq("rider_id", riderId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    legalName: data.legal_name ?? "",
    panNumber: data.pan_number ?? "",
    payoutMethod: data.payout_method === "bank" ? "bank" : "upi",
    bankAccountName: data.bank_account_name ?? "",
    bankAccountNumber: data.bank_account_number ?? "",
    bankIfsc: data.bank_ifsc ?? "",
    upiId: data.upi_id ?? "",
  };
}

export async function savePayoutDetails(d: PayoutDetails) {
  return createClient().rpc("save_rider_payout_details", {
    p_legal_name: d.legalName,
    p_pan_number: d.panNumber,
    p_payout_method: d.payoutMethod,
    p_bank_account_name: d.bankAccountName,
    p_bank_account_number: d.bankAccountNumber,
    p_bank_ifsc: d.bankIfsc,
    p_upi_id: d.upiId,
  });
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
