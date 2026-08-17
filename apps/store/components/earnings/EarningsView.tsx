"use client";

import { useEffect, useState } from "react";
import { loadStoreEarnings, type EarningsData, type PayoutRow } from "@/lib/earnings";
import { formatCurrency, formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { CardsSkeleton } from "@/components/ui/Skeleton";

const PAYOUT_LABEL: Record<PayoutRow["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
};

const PAYOUT_TONE: Record<PayoutRow["status"], BadgeTone> = {
  pending: "amber",
  processing: "blue",
  paid: "green",
};

export function EarningsView() {
  const { storeId } = useStorePanel();
  const [data, setData] = useState<EarningsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadStoreEarnings(storeId)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("We couldn't load your earnings. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Earnings"
        title="Earnings & payouts"
        sub="What you earn from kept items after the Fitxo commission, and how it's paid out."
      />

      {error ? (
        <Banner variant="error" className="mt-6">{error}</Banner>
      ) : !data ? (
        <div className="mt-7">
          <CardsSkeleton count={3} cols="grid-cols-2 lg:grid-cols-3" />
        </div>
      ) : (
        <>
          <section className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Net earnings (yours)" value={formatCurrency(data.netEarnings)} accent />
            <StatCard label="Awaiting payout" value={formatCurrency(data.awaitingPayout)} />
            <StatCard label="Paid out to date" value={formatCurrency(data.paidOut)} />
          </section>

          {/* Gross → commission → net breakdown */}
          <section className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-white px-5 py-4">
            <Breakdown label="Kept-item revenue (gross)" value={formatCurrency(data.grossKeptRevenue)} />
            <span className="text-[15px] text-faint">−</span>
            <Breakdown
              label={`Fitxo commission (${data.commissionRate}%)`}
              value={formatCurrency(data.commissionAmount)}
            />
            {data.excludedGross > 0 && (
              <>
                <span className="text-[15px] text-faint">−</span>
                <Breakdown label="Refunded / unpaid (excluded)" value={formatCurrency(data.excludedGross)} />
              </>
            )}
            <span className="text-[15px] text-faint">=</span>
            <Breakdown label="Net earnings" value={formatCurrency(data.netEarnings)} strong />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-5">
            <div className="min-w-0 rounded-2xl border border-line bg-white p-5 lg:col-span-3">
              <h2 className="text-[14px] font-semibold text-ink">Payouts</h2>
              {data.payouts.length === 0 ? (
                <p className="mt-3 text-[13px] text-soft">
                  No payouts yet — they appear here once Fitxo settles your kept orders.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
                        <th className="pb-2 text-left font-semibold">Order</th>
                        <th className="pb-2 text-left font-semibold">Status</th>
                        <th className="pb-2 text-right font-semibold">Amount</th>
                        <th className="pb-2 text-right font-semibold">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((p) => (
                        <tr key={p.id} className="border-b border-hairline last:border-0">
                          <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-[12px] text-ink">{p.orderNumber}</td>
                          <td className="py-2.5 pr-3">
                            <StatusBadge tone={PAYOUT_TONE[p.status]}>{PAYOUT_LABEL[p.status]}</StatusBadge>
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-right font-semibold text-ink">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="whitespace-nowrap py-2.5 text-right text-muted">
                            {p.paidAt ? formatDate(p.paidAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-line bg-white p-5 lg:col-span-2">
              <h2 className="text-[14px] font-semibold text-ink">Recently kept items</h2>
              <p className="mt-0.5 text-[11px] text-faint">Item prices are gross (before commission).</p>
              {data.recentKept.length === 0 ? (
                <p className="mt-3 text-[13px] text-soft">No kept items yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.recentKept.slice(0, 8).map((i) => (
                    <li key={i.id} className="flex items-center justify-between border-b border-hairline py-1.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink">{i.productName}</p>
                        <p className="text-[11px] text-muted">
                          Size {i.size}
                          {i.decidedAt ? ` · kept ${formatDate(i.decidedAt)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-success">
                        {formatCurrency(i.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Breakdown({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className={`mt-0.5 text-[15px] tracking-[-0.01em] ${strong ? "font-bold text-success" : "font-semibold text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
