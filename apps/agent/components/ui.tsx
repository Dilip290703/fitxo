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
        <h1 className="text-[22px] font-semibold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-[#9fb0cc]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={["rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4", className].join(" ")}>
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">
      {children}
    </p>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "blue",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "blue" | "green" | "amber" | "plain";
}) {
  const accentText = {
    blue: "text-[#9fc0ff]",
    green: "text-[#7fe0b0]",
    amber: "text-[#ffd27f]",
    plain: "text-white",
  }[accent];
  return (
    <div className="rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4">
      <Label>{label}</Label>
      <p className={["text-[24px] font-bold tabular-nums", accentText].join(" ")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#7c8aa5]">{hint}</p>}
    </div>
  );
}

export function Empty({ icon = "📭", title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[#22304a] p-8 text-center">
      <div className="mb-2 text-[28px]">{icon}</div>
      <p className="text-[14px] font-semibold text-white">{title}</p>
      {text && <p className="mt-1 text-[13px] text-[#7c8aa5]">{text}</p>}
    </div>
  );
}

export function ContentWrap({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[820px] px-5 py-7">{children}</div>;
}

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
