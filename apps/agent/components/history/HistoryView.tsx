"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAgent } from "@/components/AgentShell";
import { fetchCompletedDeliveries, type CompletedDelivery } from "@/lib/agent-data";
import { ContentWrap, PageHeader, Empty, ErrorCard, Skeleton, inr } from "@/components/ui";
import { IconCheck, IconClock, IconX } from "@/components/icons";

function dayLabel(iso: string | null): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function HistoryView() {
  const { rider } = useAgent();
  const [rows, setRows] = useState<CompletedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");

  useEffect(() => {
    let on = true;
    fetchCompletedDeliveries(rider.riderId).then((r) => {
      if (!on) return;
      setRows(r.rows);
      setLoadError(r.error);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rider.riderId, reloadKey]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, CompletedDelivery[]>();
    for (const r of filtered) {
      const key = dayLabel(r.completedAt);
      const arr = map.get(key) ?? [];
      if (arr.length === 0) map.set(key, arr);
      arr.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <ContentWrap>
      <PageHeader
        title="Delivery history"
        subtitle="Every job you've completed, most recent first."
      />

      <div className="mb-5 flex gap-2">
        {(["all", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "h-10 rounded-full px-4 text-[13px] font-semibold capitalize transition",
              filter === f
                ? "bg-ink text-white"
                : "border border-line bg-white text-body hover:border-line-strong",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
      ) : loadError ? (
        <ErrorCard onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} />
      ) : filtered.length === 0 ? (
        <Empty
          icon={<IconClock size={22} />}
          title="No past deliveries yet"
          text="Completed jobs will be logged here."
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{day}</h2>
              <div className="space-y-2">
                {items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/deliveries/${r.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 transition hover:border-line-strong hover:shadow-float"
                  >
                    <div
                      className={[
                        "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                        r.status === "completed"
                          ? "bg-success-bg text-success"
                          : "bg-danger-bg text-danger",
                      ].join(" ")}
                    >
                      {r.status === "completed" ? <IconCheck size={16} /> : <IconX size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[14px] font-semibold text-ink">{r.orderNumber}</p>
                      <p className="truncate text-[12px] text-soft">
                        {[r.city, `${r.itemCount} item${r.itemCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-semibold text-success">
                        {r.status === "completed" ? `+${inr(r.riderFee)}` : "—"}
                      </p>
                      <p className="text-[11px] text-soft">
                        {r.completedAt
                          ? new Date(r.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                          : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </ContentWrap>
  );
}
