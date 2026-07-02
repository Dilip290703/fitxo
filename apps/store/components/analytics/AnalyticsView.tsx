"use client";

import { useEffect, useState } from "react";
import { loadStoreAnalytics, type AnalyticsData, type DayBucket } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { StatCard } from "@/components/ui/StatCard";
import { Banner } from "@/components/ui/Banner";
import { CardsSkeleton } from "@/components/ui/Skeleton";

export function AnalyticsView() {
  const { storeId } = useStorePanel();
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Analytics</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          Last 30 days
        </h1>
      </header>

      {error ? (
        <Banner variant="error" className="mt-6">{error}</Banner>
      ) : !data ? (
        <div className="mt-7">
          <CardsSkeleton />
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
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-[14px] font-semibold text-ink">Keep vs return</h2>
              {decided === 0 ? (
                <p className="mt-3 text-[13px] text-soft">No decided items yet.</p>
              ) : (
                <div className="mt-4">
                  <div className="flex h-3 overflow-hidden rounded-full bg-hairline">
                    <div
                      className="bg-success"
                      style={{ width: `${(data.keptCount / decided) * 100}%` }}
                    />
                    <div
                      className="bg-danger"
                      style={{ width: `${(data.returnedCount / decided) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-[12px] text-body">
                    <span>
                      <span className="font-semibold text-success">{data.keptCount}</span> kept
                    </span>
                    <span>
                      <span className="font-semibold text-danger">{data.returnedCount}</span> returned
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-[14px] font-semibold text-ink">Top products (by kept revenue)</h2>
              {data.topProducts.length === 0 ? (
                <p className="mt-3 text-[13px] text-soft">No kept items yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.topProducts.map((p, i) => (
                    <li key={p.productName} className="flex items-center justify-between border-b border-hairline py-1.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink">
                          <span className="mr-2 text-[11px] font-semibold text-muted">#{i + 1}</span>
                          {p.productName}
                        </p>
                        <p className="text-[11px] text-muted">{p.keptCount} kept</p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-ink">
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
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        <span className="text-[12px] text-muted">
          {metric === "revenue" ? formatCurrency(total) : `${total} total`}
        </span>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-[13px] text-soft">Nothing in this window yet.</p>
      ) : (
        <div className="mt-4 flex h-28 items-end gap-[2px]" role="img" aria-label={title}>
          {days.map((d) => (
            <div
              key={d.label}
              title={`${d.label}: ${metric === "revenue" ? formatCurrency(d.revenue) : d.orders}`}
              className="flex-1 rounded-t bg-ink/85 transition hover:bg-ink"
              style={{
                height: `${Math.max((d[metric] / max) * 100, d[metric] > 0 ? 6 : 2)}%`,
                opacity: d[metric] > 0 ? 1 : 0.15,
              }}
            />
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.08em] text-faint">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>
    </div>
  );
}
