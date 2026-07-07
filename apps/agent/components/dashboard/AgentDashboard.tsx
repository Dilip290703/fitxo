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
import { ContentWrap, StatCard, Empty, ErrorCard, Skeleton, inr } from "@/components/ui";
import { IconChevronRight, IconScooter } from "@/components/icons";

export function AgentDashboard() {
  const { rider, available, setAvailable } = useAgent();
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchMyDeliveries(rider.riderId),
      fetchCompletedDeliveries(rider.riderId),
    ]).then(([dels, completed]) => {
      if (!active) return;
      setDeliveries(dels.rows);
      setEarnings(rollupEarnings(completed.rows));
      setLoadError(dels.error ?? completed.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [rider.riderId, reloadKey]);

  const active = deliveries.filter((d) => isActiveDelivery(d.status));
  const newJobs = active.filter((d) => d.status === "assigned");
  const firstName = rider.name.split(" ")[0];

  return (
    <ContentWrap>
      {/* Greeting + availability banner */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] text-soft">Welcome back,</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">{firstName}</h1>
        </div>
        <button
          onClick={() => setAvailable(!available)}
          className={[
            "rounded-2xl border px-5 py-3.5 text-left transition",
            available ? "border-success-line bg-success-bg" : "border-line-strong bg-warn-bg",
          ].join(" ")}
        >
          <span
            className={[
              "flex items-center gap-2 text-[14px] font-bold",
              available ? "text-success" : "text-warn",
            ].join(" ")}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                available ? "animate-pulse bg-success" : "bg-warn-accent",
              ].join(" ")}
            />
            {available ? "You're online" : "You're offline"}
          </span>
          <span className="mt-0.5 block text-[12px] text-body">
            {available ? "Tap to stop receiving jobs" : "Tap to start receiving jobs"}
          </span>
        </button>
      </div>

      {/* Today's snapshot */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active" value={loading ? "—" : String(active.length)} accent="blue" hint="in progress" />
        <StatCard label="Done today" value={loading ? "—" : String(earnings?.todayCount ?? 0)} accent="green" hint="deliveries" />
        <StatCard label="Earned today" value={loading ? "—" : inr(earnings?.today ?? 0)} accent="amber" hint="delivery fees" />
        <StatCard label="All-time" value={String(rider.totalDeliveries)} accent="plain" hint="deliveries" />
      </div>

      {/* New jobs to accept */}
      {newJobs.length > 0 && (
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-warn">
              New jobs · accept now ({newJobs.length})
            </h2>
            <Link href="/deliveries" className="flex h-9 items-center text-[13px] font-medium text-info">
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
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            Active deliveries ({active.length})
          </h2>
          <Link href="/deliveries" className="flex h-9 items-center text-[13px] font-medium text-info">
            All deliveries →
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[104px]" />
            <Skeleton className="h-[104px]" />
          </div>
        ) : loadError ? (
          <ErrorCard onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} />
        ) : active.length === 0 ? (
          <Empty
            icon={<IconScooter size={22} />}
            title={available ? "No active deliveries" : "You're offline"}
            text={
              available
                ? "New delivery offers pop up here while you're online."
                : "Go online to start receiving delivery offers."
            }
          />
        ) : (
          <div className="space-y-3">
            {active.filter((d) => d.status !== "assigned").map((d) => <DeliveryCard key={d.id} d={d} />)}
            {active.every((d) => d.status === "assigned") && newJobs.length > 0 && (
              <p className="text-[14px] text-soft">Accept a new job above to get started.</p>
            )}
          </div>
        )}
      </section>

      {/* Earnings teaser */}
      <Link
        href="/earnings"
        className="flex items-center justify-between rounded-2xl border border-line bg-ink p-5 transition hover:bg-ink-soft"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">This week</p>
          <p className="text-[28px] font-bold text-white">{loading ? "—" : inr(earnings?.week ?? 0)}</p>
          <p className="text-[13px] text-white/60">{earnings?.weekCount ?? 0} deliveries</p>
        </div>
        <span className="flex items-center gap-1 text-[13px] font-medium text-accent">
          View earnings <IconChevronRight size={15} />
        </span>
      </Link>
    </ContentWrap>
  );
}
