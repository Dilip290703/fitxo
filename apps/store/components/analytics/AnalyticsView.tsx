"use client";

import { useEffect, useState } from "react";
import { loadStoreAnalytics, type AnalyticsData, type DayBucket } from "@/lib/analytics";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function AnalyticsView({ storeId }: { storeId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadStoreAnalytics(storeId)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError("We couldn't load your analytics. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const decided = data ? data.keptCount + data.returnedCount : 0;
  const keepRate = data && decided > 0 ? Math.round((data.keptCount / decided) * 100) : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Analytics</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Last 30 days
        </h1>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : !data ? (
        <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-[#ece5da] bg-white" />
          ))}
        </div>
      ) : (
        <>
          <section className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Orders" value={String(data.totalOrders)} accent />
            <StatCard label="Item revenue" value={formatCurrency(data.totalItemRevenue)} accent />
            <StatCard label="Keep rate" value={keepRate === null ? "—" : `${keepRate}%`} />
            <StatCard label="Awaiting decision" value={String(data.pendingCount)} />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <BarChart title="Orders per day" days={data.days} metric="orders" />
            <BarChart title="Revenue per day" days={data.days} metric="revenue" />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#ece5da] bg-white p-5">
              <h2 className="text-[14px] font-semibold text-[#171d2b]">Keep vs return</h2>
              {decided === 0 ? (
                <p className="mt-3 text-[13px] text-[#7f7469]">No decided items yet.</p>
              ) : (
                <div className="mt-4">
                  <div className="flex h-3 overflow-hidden rounded-full bg-[#f0ebe3]">
                    <div
                      className="bg-[#2f7d46]"
                      style={{ width: `${(data.keptCount / decided) * 100}%` }}
                    />
                    <div
                      className="bg-[#b83c24]"
                      style={{ width: `${(data.returnedCount / decided) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-[12px] text-[#5f574e]">
                    <span>
                      <span className="font-semibold text-[#2f7d46]">{data.keptCount}</span> kept
                    </span>
                    <span>
                      <span className="font-semibold text-[#b83c24]">{data.returnedCount}</span> returned
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#ece5da] bg-white p-5">
              <h2 className="text-[14px] font-semibold text-[#171d2b]">Top products (by kept revenue)</h2>
              {data.topProducts.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#7f7469]">No kept items yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.topProducts.map((p, i) => (
                    <li key={p.productName} className="flex items-center justify-between border-b border-[#f0ebe3] py-1.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[#171d2b]">
                          <span className="mr-2 text-[11px] font-semibold text-[#958675]">#{i + 1}</span>
                          {p.productName}
                        </p>
                        <p className="text-[11px] text-[#958675]">{p.keptCount} kept</p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-[#171d2b]">
                        {formatCurrency(p.keptRevenue)}
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 ${accent ? "border-[#f2e2a8]" : "border-[#ece5da]"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#958675]">{label}</p>
      <p className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#171d2b]">{value}</p>
    </div>
  );
}

function BarChart({
  title,
  days,
  metric,
}: {
  title: string;
  days: DayBucket[];
  metric: "orders" | "revenue";
}) {
  const max = Math.max(...days.map((d) => d[metric]), 1);
  const total = days.reduce((s, d) => s + d[metric], 0);

  return (
    <div className="rounded-2xl border border-[#ece5da] bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-[#171d2b]">{title}</h2>
        <span className="text-[12px] text-[#958675]">
          {metric === "revenue" ? formatCurrency(total) : `${total} total`}
        </span>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-[13px] text-[#7f7469]">Nothing in this window yet.</p>
      ) : (
        <div className="mt-4 flex h-28 items-end gap-[2px]" role="img" aria-label={title}>
          {days.map((d) => (
            <div
              key={d.label}
              title={`${d.label}: ${metric === "revenue" ? formatCurrency(d.revenue) : d.orders}`}
              className="flex-1 rounded-t bg-[#171d2b]/85 transition hover:bg-[#171d2b]"
              style={{
                height: `${Math.max((d[metric] / max) * 100, d[metric] > 0 ? 6 : 2)}%`,
                opacity: d[metric] > 0 ? 1 : 0.15,
              }}
            />
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.08em] text-[#a79e92]">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}
