/** Standard page header: eyebrow label, title, optional sub-line and action. */
export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className={action ? "flex flex-wrap items-end justify-between gap-4" : undefined}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          {title}
        </h1>
        {sub ? <p className="mt-1 max-w-[560px] text-[13px] leading-6 text-muted">{sub}</p> : null}
      </div>
      {action}
    </header>
  );
}
