"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAgent } from "@/components/AgentShell";
import { fetchCompletedDeliveries, type CompletedDelivery } from "@/lib/agent-data";
import { ContentWrap, PageHeader, Empty, inr } from "@/components/ui";

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
  const [filter, setFilter] = useState<"all" | "completed" | "failed">("all");

  useEffect(() => {
    let on = true;
    fetchCompletedDeliveries(rider.riderId).then((r) => {
      if (!on) return;
      setRows(r);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rider.riderId]);

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
              "rounded-full px-4 py-1.5 text-[12px] font-semibold capitalize transition",
              filter === f ? "bg-[#3b82f6] text-white" : "bg-[#161e2e] text-[#9fb0cc] hover:text-white",
            ].join(" ")}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#7c8aa5]">Loading…</p>
      ) : filtered.length === 0 ? (
        <Empty icon="🕘" title="No past deliveries yet" text="Completed jobs will be logged here." />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">{day}</h2>
              <div className="space-y-2">
                {items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/deliveries/${r.id}`}
                    className="flex items-center gap-3 rounded-[14px] border border-[#22304a] bg-[#161e2e] p-3.5 transition hover:border-[#3b82f6]"
                  >
                    <div
                      className={[
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px]",
                        r.status === "completed" ? "bg-[#16322a] text-[#7fe0b0]" : "bg-[#3a1d1d] text-[#ff9b9b]",
                      ].join(" ")}
                    >
                      {r.status === "completed" ? "✓" : "✕"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{r.orderNumber}</p>
                      <p className="truncate text-[11px] text-[#7c8aa5]">
                        {[r.city, `${r.itemCount} item${r.itemCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-[#7fe0b0]">
                        {r.status === "completed" ? `+${inr(r.deliveryFee)}` : "—"}
                      </p>
                      <p className="text-[10px] text-[#7c8aa5]">
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
