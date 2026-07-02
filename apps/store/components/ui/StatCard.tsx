import Link from "next/link";

/**
 * KPI card. Pass `href` to make the whole card a link to its filtered
 * destination (dashboard cards should always be doors, not posters).
 */
export function StatCard({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{label}</p>
      <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-faint">{hint}</p> : null}
    </>
  );
  const className = `block rounded-2xl border bg-white p-5 ${
    accent ? "border-accent-soft" : "border-line"
  }`;

  if (href) {
    return (
      <Link href={href} className={`${className} transition hover:border-ink`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
