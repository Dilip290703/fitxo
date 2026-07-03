/** Shared display formatters — the single source for ₹/date rendering. */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "9 Jun 2026" */
export function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "9 Jun 2026, 02:41 pm" */
export function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "just now" / "8m ago" / "3h ago", falling back to the date beyond a day. */
export function timeAgo(ts: string | number): string {
  const at = typeof ts === "number" ? ts : new Date(ts).getTime();
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return formatDate(new Date(at).toISOString());
}

/** "9 Jun, 02:41 pm" — compact, for dense lists. */
export function formatShortDateTime(ts: string): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
