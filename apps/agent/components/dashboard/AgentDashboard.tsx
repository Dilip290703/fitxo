"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgent } from "@/components/AgentShell";
import { fetchMyDeliveries, type DeliveryListItem } from "@/lib/deliveries";
import {
  fetchCompletedDeliveries,
  rollupEarnings,
  type EarningsSummary,
} from "@/lib/agent-data";
import { isActiveDelivery } from "@/components/status";
import { DeliveryCard } from "@/components/DeliveryCard";
import { ContentWrap, StatCard, Empty, inr } from "@/components/ui";

export function AgentDashboard() {
  const { rider, available, setAvailable } = useAgent();
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchMyDeliveries(rider.riderId),
      fetchCompletedDeliveries(rider.riderId),
    ]).then(([dels, completed]) => {
      if (!active) return;
      setDeliveries(dels);
      setEarnings(rollupEarnings(completed));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [rider.riderId]);

  const active = deliveries.filter((d) => isActiveDelivery(d.status));
  const newJobs = active.filter((d) => d.status === "assigned");
  const firstName = rider.name.split(" ")[0];

  return (
    <ContentWrap>
      {/* Greeting + availability banner */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] text-[#7c8aa5]">Welcome back,</p>
          <h1 className="text-[24px] font-semibold text-white">{firstName} 👋</h1>
        </div>
        <button
          onClick={() => setAvailable(!available)}
          className={[
            "rounded-[14px] border px-5 py-3 text-left transition",
            available
              ? "border-[#16322a] bg-[#0f2a20]"
              : "border-[#3a2d16] bg-[#241d10]",
          ].join(" ")}
        >
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span className={["h-2.5 w-2.5 rounded-full", available ? "bg-[#34d399]" : "bg-[#f59e0b]"].join(" ")} />
            {available ? "You're online" : "You're offline"}
          </span>
          <span className="mt-0.5 block text-[11px] text-[#7c8aa5]">
            {available ? "Tap to stop receiving jobs" : "Tap to start receiving jobs"}
          </span>
        </button>
      </div>

      {/* Today's snapshot */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active" value={loading ? "—" : String(active.length)} accent="blue" hint="in progress" />
        <StatCard label="Done today" value={loading ? "—" : String(earnings?.todayCount ?? 0)} accent="green" hint="deliveries" />
        <StatCard label="Earned today" value={loading ? "—" : inr(earnings?.today ?? 0)} accent="amber" hint="delivery fees" />
        <StatCard label="Rating" value={(rider.rating ?? 5).toFixed(2)} accent="plain" hint={`${rider.totalDeliveries} all-time`} />
      </div>

      {/* New jobs to accept */}
      {newJobs.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#ffd27f]">
              New jobs · accept now ({newJobs.length})
            </h2>
            <Link href="/deliveries" className="text-[12px] text-[#9fc0ff] hover:text-white">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {newJobs.map((d) => <DeliveryCard key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {/* Active deliveries */}
      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">
            Active deliveries ({active.length})
          </h2>
          <Link href="/deliveries" className="text-[12px] text-[#9fc0ff] hover:text-white">
            All deliveries →
          </Link>
        </div>
        {loading ? (
          <p className="text-[13px] text-[#7c8aa5]">Loading…</p>
        ) : active.length === 0 ? (
          <Empty
            icon="🛵"
            title={available ? "No active deliveries" : "You're offline"}
            text={
              available
                ? "New jobs assigned to you will appear here."
                : "Go online to start receiving delivery jobs."
            }
          />
        ) : (
          <div className="space-y-3">
            {active.filter((d) => d.status !== "assigned").map((d) => <DeliveryCard key={d.id} d={d} />)}
            {active.every((d) => d.status === "assigned") && newJobs.length > 0 && (
              <p className="text-[13px] text-[#7c8aa5]">Accept a new job above to get started.</p>
            )}
          </div>
        )}
      </section>

      {/* Earnings teaser */}
      <Link
        href="/earnings"
        className="flex items-center justify-between rounded-[16px] border border-[#22304a] bg-gradient-to-r from-[#161e2e] to-[#10203f] p-5 transition hover:border-[#3b82f6]"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">This week</p>
          <p className="text-[26px] font-bold text-white">{loading ? "—" : inr(earnings?.week ?? 0)}</p>
          <p className="text-[12px] text-[#7c8aa5]">{earnings?.weekCount ?? 0} deliveries</p>
        </div>
        <span className="text-[13px] font-medium text-[#9fc0ff]">View earnings →</span>
      </Link>
    </ContentWrap>
  );
}
