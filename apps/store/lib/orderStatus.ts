import type { BadgeTone } from "@/components/ui/StatusBadge";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  assigned: "Rider assigned",
  out_for_delivery: "Out for try-on",
  delivered: "Delivered",
  try_window_active: "Try window open",
  return_requested: "Return requested",
  return_picked: "Return picked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "neutral",
  confirmed: "neutral",
  assigned: "amber",
  out_for_delivery: "amber",
  delivered: "amber",
  try_window_active: "amber",
  return_requested: "red",
  return_picked: "red",
  completed: "green",
  cancelled: "red",
};

/** Tone for the shared <StatusBadge>. */
export function statusTone(status: string): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}
