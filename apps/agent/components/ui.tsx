import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-body">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={["rounded-2xl border border-line bg-white p-4", className].join(" ")}>
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
      {children}
    </p>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "blue" | "green" | "amber" | "plain";
}) {
  const accentText = {
    blue: "text-info",
    green: "text-success",
    amber: "text-warn-accent",
    plain: "text-ink",
  }[accent];
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <Label>{label}</Label>
      <p className={["text-[24px] font-bold tabular-nums", accentText].join(" ")}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-soft">{hint}</p>}
    </div>
  );
}

export function Empty({
  icon,
  title,
  text,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center">
      {icon && (
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-sand text-soft">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 text-[14px] text-body">{text}</p>}
    </div>
  );
}

export function ContentWrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[820px] px-5 py-6">{children}</div>;
}

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/* Shared control styles — rider-sized (≥44px targets). */
export const inputCls =
  "h-12 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink";

export const btnPrimary =
  "flex h-14 w-full items-center justify-center rounded-2xl bg-ink px-4 text-[16px] font-semibold text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted";

export const btnSecondary =
  "flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink transition hover:bg-cream disabled:opacity-50";

export function Banner({ kind, children }: { kind: "ok" | "err"; children: ReactNode }) {
  return (
    <p
      className={[
        "rounded-xl border px-3 py-2.5 text-[14px]",
        kind === "ok"
          ? "border-success-line bg-success-bg text-success"
          : "border-danger-line bg-danger-bg text-danger",
      ].join(" ")}
    >
      {children}
    </p>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={["animate-pulse rounded-xl bg-sand", className].join(" ")} />;
}
