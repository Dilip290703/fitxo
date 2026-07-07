"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgent } from "@/components/AgentShell";
import {
  fetchAgentPayouts,
  fetchCompletedDeliveries,
  fetchPayoutDetails,
  rollupEarnings,
  type AgentPayoutRow,
  type EarningsSummary,
} from "@/lib/agent-data";
import { ContentWrap, PageHeader, StatCard, Card, Empty, ErrorCard, Skeleton, inr } from "@/components/ui";
import { IconWallet } from "@/components/icons";

export function EarningsView() {
  const { rider } = useAgent();
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<AgentPayoutRow[]>([]);
  const [hasPayoutDetails, setHasPayoutDetails] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let on = true;
    Promise.all([
      fetchCompletedDeliveries(rider.riderId),
      fetchAgentPayouts(rider.riderId),
      fetchPayoutDetails(rider.riderId),
    ]).then(([completed, payoutRes, details]) => {
      if (!on) return;
      setData(rollupEarnings(completed.rows));
      setPayouts(payoutRes.rows);
      setHasPayoutDetails(!!details);
      // The payout ledger predates migration 020 in some envs — a missing
      // table shouldn't brick the whole earnings screen, jobs data should.
      setLoadError(completed.error);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [rider.riderId, reloadKey]);

  if (loading || (!data && !loadError)) {
    return (
      <ContentWrap>
        <PageHeader title="Earnings" />
        <Skeleton className="mb-5 h-[220px]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-[96px]" />
          <Skeleton className="h-[96px]" />
          <Skeleton className="h-[96px]" />
          <Skeleton className="h-[96px]" />
        </div>
      </ContentWrap>
    );
  }

  if (loadError || !data) {
    return (
      <ContentWrap>
        <PageHeader title="Earnings" />
        <ErrorCard onRetry={() => { setLoading(true); setLoadError(null); setReloadKey((k) => k + 1); }} />
      </ContentWrap>
    );
  }

  const completed = data.rows.filter((r) => r.status === "completed");
  const maxDay = Math.max(1, ...weeklyBars(completed).map((b) => b.amount));

  // Settled money: what Admin has recorded into the agent_payouts ledger.
  const paidTotal = payouts.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, Math.round((data.allTime - paidTotal) * 100) / 100);
  const paidOrderIds = new Set(payouts.map((p) => p.orderId));

  return (
    <ContentWrap>
      <PageHeader
        title="Earnings"
        subtitle="Your pay is the delivery fee on each completed job."
      />

      {hasPayoutDetails === false && (
        <Link
          href="/settings"
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-warn-accent/50 bg-warn-bg p-4"
        >
          <div>
            <p className="text-[14px] font-semibold text-warn">Add your bank / UPI details</p>
            <p className="text-[13px] text-body">
              Fitzo has nowhere to send your money yet — add payout details in Settings.
            </p>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-warn">Add →</span>
        </Link>
      )}

      {/* This-week hero */}
      <div className="mb-5 rounded-2xl bg-ink p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">This week</p>
        <p className="mt-1 text-[40px] font-bold leading-none text-white">{inr(data.week)}</p>
        <p className="mt-1 text-[13px] text-white/60">{data.weekCount} deliveries completed</p>

        <div className="mt-5 flex items-end justify-between gap-2">
          {weeklyBars(completed).map((b) => (
            <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className="w-full max-w-[28px] rounded-t-[6px] bg-accent"
                  style={{ height: `${Math.max(4, (b.amount / maxDay) * 100)}%` }}
                  title={inr(b.amount)}
                />
              </div>
              <span className="text-[11px] text-white/50">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rollups */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Today" value={inr(data.today)} accent="green" hint={`${data.todayCount} jobs`} />
        <StatCard label="All time" value={inr(data.allTime)} accent="blue" hint={`${data.totalCount} jobs`} />
        <StatCard label="Paid out" value={inr(paidTotal)} accent="plain" hint={`${payouts.length} payout${payouts.length === 1 ? "" : "s"}`} />
        <StatCard label="To be paid" value={inr(outstanding)} accent="amber" hint="earned − paid" />
      </div>

      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
        Completed jobs
      </h2>
      {completed.length === 0 ? (
        <Empty
          icon={<IconWallet size={22} />}
          title="No earnings yet"
          text="Complete a delivery to start earning."
        />
      ) : (
        <Card className="divide-y divide-hairline p-0">
          {completed.slice(0, 25).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-mono text-[14px] font-medium text-ink">{r.orderNumber}</p>
                <p className="text-[12px] text-soft">
                  {r.completedAt
                    ? new Date(r.completedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                  {r.city ? ` · ${r.city}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    paidOrderIds.has(r.orderId)
                      ? "border-success-line bg-success-bg text-success"
                      : "border-warn-bg bg-warn-bg text-warn",
                  ].join(" ")}
                >
                  {paidOrderIds.has(r.orderId) ? "Paid" : "Due"}
                </span>
                <span className="text-[15px] font-semibold text-success">+{inr(r.deliveryFee)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Payout history — what actually landed in your account */}
      <h2 className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
        Payout history
      </h2>
      {payouts.length === 0 ? (
        <Card>
          <p className="text-[14px] text-body">
            No payouts yet. Fitzo settles your earned delivery fees to your bank/UPI —
            each settlement shows up here.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-hairline p-0">
          {payouts.slice(0, 25).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div>
                <p className="text-[14px] font-medium text-ink">Payout · {p.status}</p>
                <p className="text-[12px] text-soft">
                  {new Date(p.paidAt ?? p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className="text-[15px] font-semibold text-ink">{inr(p.amount)}</span>
            </div>
          ))}
        </Card>
      )}

      <p className="mt-4 text-[12px] leading-5 text-faint">
        Payouts are recorded by Fitzo per completed order; Razorpay bank disbursement is
        being wired. &ldquo;To be paid&rdquo; = everything you&rsquo;ve earned minus what&rsquo;s
        already been settled.
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
