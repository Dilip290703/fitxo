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

type Tone = "neutral" | "amber" | "green" | "red";

const STATUS_TONE: Record<string, Tone> = {
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

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-[#f0ebe3] text-[#8a8073]",
  amber: "bg-[#fbeed0] text-[#9a6a12]",
  green: "bg-[#e8f3ea] text-[#2f7d46]",
  red: "bg-[#fbeeea] text-[#b83c24]",
};

export function statusBadgeClass(status: string): string {
  return TONE_CLASS[STATUS_TONE[status] ?? "neutral"];
}
