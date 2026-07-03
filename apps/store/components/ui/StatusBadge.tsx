export type BadgeTone = "neutral" | "amber" | "green" | "red" | "blue";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-hairline text-soft",
  amber: "bg-warn-bg text-warn",
  green: "bg-success-bg text-success",
  red: "bg-danger-bg text-danger",
  blue: "bg-info-bg text-info",
};

/** Small status pill. All status colors flow through the 5 tones. */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
