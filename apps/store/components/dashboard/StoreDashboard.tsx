"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadStoreDashboard,
  type DashboardData,
  type LowStockVariant,
  type RecentOrder,
} from "@/lib/dashboard";
import { formatOrderStatus, statusTone } from "@/lib/orderStatus";
import { formatCurrency, formatShortDateTime } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { CardsSkeleton } from "@/components/ui/Skeleton";

export function StoreDashboard() {
  const { storeId } = useStorePanel();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadStoreDashboard(storeId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("We couldn't load your dashboard. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {today}
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          Dashboard
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
          {/* Every card is a door — it opens the screen that explains it. */}
          <section className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Today's orders" value={data.stats.todayOrders} accent href="/orders" />
            <StatCard label="Active try windows" value={data.stats.activeTryWindows} accent href="/orders" />
            <StatCard label="Returns requested" value={data.stats.returnsRequested} href="/returns" />
            <StatCard
              label="Awaiting payout"
              value={formatCurrency(data.stats.awaitingPayout)}
              hint="Matches your Earnings page"
              href="/earnings"
            />
          </section>

          <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Live products" value={data.stats.liveProducts} href="/catalogue" />
            <StatCard label="Low stock" value={data.stats.lowStockCount} href="/catalogue" />
            <StatCard label="Total orders" value={data.stats.totalOrders} href="/orders" />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <LowStockPanel items={data.lowStock} />
            <RecentOrdersPanel orders={data.recentOrders} />
          </section>
        </>
      )}
    </div>
  );
}

function LowStockPanel({ items }: { items: LowStockVariant[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <span className="text-warn-accent">⚠</span> Low stock
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-soft">Everything is well stocked.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between border-b border-hairline py-1.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-ink">{v.productName}</p>
                <p className="text-[11px] text-muted">
                  <span className="font-mono">{v.sku}</span> · {v.size}
                </p>
              </div>
              <span
                className={`shrink-0 text-[12px] font-bold ${
                  v.stockQty === 0 ? "text-danger" : "text-warn-accent"
                }`}
              >
                {v.stockQty === 0 ? "OUT" : `${v.stockQty} left`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentOrdersPanel({ orders }: { orders: RecentOrder[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold text-ink">Recent orders</h2>
        <Link href="/orders" className="text-[12px] font-semibold text-soft hover:text-ink">
          View all →
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="mt-3 text-[13px] text-soft">No orders yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-hairline">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 py-2.5 transition hover:bg-paper"
              >
                <span className="w-[110px] shrink-0 truncate font-mono text-[12px] font-semibold text-ink">
                  {o.orderNumber}
                </span>
                <StatusBadge tone={statusTone(o.status)}>{formatOrderStatus(o.status)}</StatusBadge>
                <span className="ml-auto shrink-0 text-[13px] font-semibold text-ink">
                  {formatCurrency(o.amount)}
                </span>
                <span className="hidden w-[110px] shrink-0 text-right text-[12px] text-muted sm:block">
                  {formatShortDateTime(o.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
