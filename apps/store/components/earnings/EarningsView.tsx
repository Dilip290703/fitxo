"use client";

import { useEffect, useState } from "react";
import { loadStoreEarnings, type EarningsData, type PayoutRow } from "@/lib/earnings";

const PAYOUT_LABEL: Record<PayoutRow["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
};

const PAYOUT_CLASS: Record<PayoutRow["status"], string> = {
  pending: "bg-[#fbeed0] text-[#9a6a12]",
  processing: "bg-[#e3ecf6] text-[#2d5e8f]",
  paid: "bg-[#e8f3ea] text-[#2f7d46]",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function EarningsView({ storeId }: { storeId: string }) {
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
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Earnings</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Earnings & payouts
        </h1>
        <p className="mt-1 text-[13px] text-[#958675]">
          What you earn from kept items after the Fitzo commission, and how it&apos;s paid out.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : !data ? (
        <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-[#ece5da] bg-white" />
          ))}
        </div>
      ) : (
        <>
          <section className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Net earnings (yours)" value={formatCurrency(data.netEarnings)} accent />
            <StatCard label="Awaiting payout" value={formatCurrency(data.awaitingPayout)} />
            <StatCard label="Paid out to date" value={formatCurrency(data.paidOut)} />
          </section>

          {/* Gross → commission → net breakdown */}
          <section className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[#ece5da] bg-white px-5 py-4">
            <Breakdown label="Kept-item revenue (gross)" value={formatCurrency(data.grossKeptRevenue)} />
            <span className="text-[15px] text-[#b6ab9c]">−</span>
            <Breakdown
              label={`Fitzo commission (${data.commissionRate}%)`}
              value={formatCurrency(data.commissionAmount)}
            />
            <span className="text-[15px] text-[#b6ab9c]">=</span>
            <Breakdown label="Net earnings" value={formatCurrency(data.netEarnings)} strong />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-[#ece5da] bg-white p-5 lg:col-span-3">
              <h2 className="text-[14px] font-semibold text-[#171d2b]">Payouts</h2>
              {data.payouts.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#7f7469]">
                  No payouts yet — they appear here once Fitzo settles your kept orders.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#ece5da] text-[11px] uppercase tracking-[0.1em] text-[#958675]">
                        <th className="pb-2 text-left font-semibold">Order</th>
                        <th className="pb-2 text-left font-semibold">Status</th>
                        <th className="pb-2 text-right font-semibold">Amount</th>
                        <th className="pb-2 text-right font-semibold">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((p) => (
                        <tr key={p.id} className="border-b border-[#f0ebe3] last:border-0">
                          <td className="py-2.5 pr-3 font-mono text-[12px] text-[#171d2b]">{p.orderNumber}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${PAYOUT_CLASS[p.status]}`}>
                              {PAYOUT_LABEL[p.status]}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold text-[#171d2b]">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="py-2.5 text-right text-[#958675]">
                            {p.paidAt ? formatDate(p.paidAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#ece5da] bg-white p-5 lg:col-span-2">
              <h2 className="text-[14px] font-semibold text-[#171d2b]">Recently kept items</h2>
              <p className="mt-0.5 text-[11px] text-[#a0968a]">Item prices are gross (before commission).</p>
              {data.recentKept.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#7f7469]">No kept items yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.recentKept.slice(0, 8).map((i) => (
                    <li key={i.id} className="flex items-center justify-between border-b border-[#f0ebe3] py-1.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[#171d2b]">{i.productName}</p>
                        <p className="text-[11px] text-[#958675]">
                          Size {i.size}
                          {i.decidedAt ? ` · kept ${formatDate(i.decidedAt)}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-[#2f7d46]">
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0968a]">{label}</p>
      <p className={`mt-0.5 text-[15px] tracking-[-0.01em] ${strong ? "font-bold text-[#2f7d46]" : "font-semibold text-[#171d2b]"}`}>
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 ${accent ? "border-[#f2e2a8]" : "border-[#ece5da]"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#958675]">{label}</p>
      <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#171d2b]">{value}</p>
    </div>
  );
}
