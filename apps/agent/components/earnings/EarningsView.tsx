"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@/components/AgentShell";
import {
  fetchCompletedDeliveries,
  rollupEarnings,
  type EarningsSummary,
} from "@/lib/agent-data";
import { ContentWrap, PageHeader, StatCard, Card, Empty, inr } from "@/components/ui";

export function EarningsView() {
  const { rider } = useAgent();
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetchCompletedDeliveries(rider.riderId).then((rows) => {
      if (!on) return;
      setData(rollupEarnings(rows));
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rider.riderId]);

  if (loading || !data) {
    return (
      <ContentWrap>
        <PageHeader title="Earnings" />
        <p className="text-[13px] text-[#7c8aa5]">Loading…</p>
      </ContentWrap>
    );
  }

  const completed = data.rows.filter((r) => r.status === "completed");
  const maxDay = Math.max(1, ...weeklyBars(completed).map((b) => b.amount));

  return (
    <ContentWrap>
      <PageHeader
        title="Earnings"
        subtitle="Your pay is the delivery fee on each completed job."
      />

      {/* This-week hero */}
      <Card className="mb-5 bg-gradient-to-br from-[#10203f] to-[#161e2e]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">This week</p>
        <p className="mt-1 text-[40px] font-bold leading-none text-white">{inr(data.week)}</p>
        <p className="mt-1 text-[12px] text-[#9fb0cc]">{data.weekCount} deliveries completed</p>

        <div className="mt-5 flex items-end justify-between gap-2">
          {weeklyBars(completed).map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className="w-full max-w-[28px] rounded-t-[6px] bg-[#3b82f6]"
                  style={{ height: `${Math.max(4, (b.amount / maxDay) * 100)}%` }}
                  title={inr(b.amount)}
                />
              </div>
              <span className="text-[10px] text-[#7c8aa5]">{b.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Rollups */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Today" value={inr(data.today)} accent="green" hint={`${data.todayCount} jobs`} />
        <StatCard label="This month" value={inr(data.month)} accent="blue" />
        <StatCard label="All time" value={inr(data.allTime)} accent="amber" hint={`${data.totalCount} jobs`} />
        <StatCard label="Avg / job" value={inr(data.avgPerJob)} accent="plain" />
      </div>

      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">
        Recent payouts
      </h2>
      {completed.length === 0 ? (
        <Empty icon="💰" title="No earnings yet" text="Complete a delivery to start earning." />
      ) : (
        <Card className="divide-y divide-[#22304a] p-0">
          {completed.slice(0, 25).map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px] font-medium">{r.orderNumber}</p>
                <p className="text-[11px] text-[#7c8aa5]">
                  {r.completedAt
                    ? new Date(r.completedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                  {r.city ? ` · ${r.city}` : ""}
                </p>
              </div>
              <span className="text-[14px] font-semibold text-[#7fe0b0]">+{inr(r.deliveryFee)}</span>
            </div>
          ))}
        </Card>
      )}

      <p className="mt-4 text-[11px] leading-5 text-[#54627d]">
        Payouts are settled through Razorpay (coming soon). Amounts shown reflect the
        delivery fee earned on each completed order.
      </p>
    </ContentWrap>
  );
}

// Last 7 days, oldest → newest, summed by completion day.
function weeklyBars(rows: { deliveryFee: number; completedAt: string | null }[]) {
  const days: { label: string; key: string; amount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      label: d.toLocaleDateString("en-IN", { weekday: "narrow" }),
      key: d.toDateString(),
      amount: 0,
    });
  }
  for (const r of rows) {
    if (!r.completedAt) continue;
    const key = new Date(r.completedAt).toDateString();
    const slot = days.find((x) => x.key === key);
    if (slot) slot.amount += r.deliveryFee;
  }
  return days;
}
