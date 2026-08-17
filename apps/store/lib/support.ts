import { createClient } from "@fitxo/supabase/client";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  adminResponse: string | null;
  orderNumber: string | null;
  createdAt: string;
};

/**
 * Store support tickets ride the existing `complaints` table (migration 012):
 * a store manager is a `users` row, so `complaints_insert_own` / `_select_own`
 * (user_id = auth.uid()) cover this with NO new migration. Admin already
 * triages/responds via Admin > Complaints (#13).
 */
export async function loadMyTickets(): Promise<Ticket[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("complaints")
    .select("id, subject, message, status, admin_response, created_at, orders(order_number)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((t: any) => {
    const order = Array.isArray(t.orders) ? t.orders[0] : t.orders;
    return {
      id: t.id,
      subject: t.subject ?? "",
      message: t.message ?? "",
      status: (t.status ?? "open") as TicketStatus,
      adminResponse: t.admin_response ?? null,
      orderNumber: order?.order_number ?? null,
      createdAt: t.created_at,
    };
  });
}

/**
 * File a ticket. `orderNumber` is optional — when given, it's resolved to an
 * order the store can see under its own RLS (orders containing its products);
 * an unknown number throws so typos don't silently detach the ticket.
 */
export async function fileTicket(
  storeName: string,
  subject: string,
  message: string,
  orderNumber?: string,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("You're signed out — reload and try again.");

  let orderId: string | null = null;
  const trimmedOrderNo = orderNumber?.trim();
  if (trimmedOrderNo) {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", trimmedOrderNo)
      .maybeSingle();
    if (!order) {
      throw new Error(
        `Order "${trimmedOrderNo}" wasn't found among your store's orders — check the number.`,
      );
    }
    orderId = order.id;
  }

  const { error } = await supabase.from("complaints").insert({
    user_id: session.user.id,
    order_id: orderId,
    // Prefix the store name so admins can triage store tickets at a glance
    // (the complaints table has no store_id column).
    subject: `[Store: ${storeName}] ${subject.trim()}`,
    message: message.trim(),
  });
  if (error) throw new Error(error.message);
}
