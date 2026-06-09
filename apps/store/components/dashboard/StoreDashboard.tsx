"use client";

import { useEffect, useState } from "react";
import {
  loadStoreDashboard,
  type DashboardData,
  type LowStockVariant,
  type RecentOrder,
} from "@/lib/dashboard";
import { formatOrderStatus } from "@/lib/orderStatus";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StoreDashboard({ storeId }: { storeId: string }) {
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          {today}
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Dashboard
        </h1>
      </header>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]"
        >
          {error}
        </p>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Today's orders" value={data.stats.todayOrders} accent />
            <StatCard label="Active try windows" value={data.stats.activeTryWindows} accent />
            <StatCard label="Returns requested" value={data.stats.returnsRequested} />
            <StatCard label="Pending payout" value={formatCurrency(data.stats.pendingPayout)} />
          </section>

          <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Live products" value={data.stats.liveProducts} />
            <StatCard label="Low stock" value={data.stats.lowStockCount} />
            <StatCard label="Total orders" value={data.stats.totalOrders} />
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        accent ? "border-[#f2e2a8]" : "border-[#ece5da]"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#958675]">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-[#171d2b]">
        {value}
      </p>
    </div>
  );
}

function LowStockPanel({ items }: { items: LowStockVariant[] }) {
  return (
    <div className="rounded-2xl border border-[#ece5da] bg-white p-5">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#171d2b]">
        <span className="text-[#d9890f]">⚠</span> Low stock
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#7f7469]">Everything is well stocked.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between border-b border-[#f0ebe3] py-1.5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[#171d2b]">{v.productName}</p>
                <p className="text-[11px] text-[#958675]">
                  <span className="font-mono">{v.sku}</span> · {v.size}
                </p>
              </div>
              <span
                className={`shrink-0 text-[12px] font-bold ${
                  v.stockQty === 0 ? "text-[#b83c24]" : "text-[#d9890f]"
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
    <div className="rounded-2xl border border-[#ece5da] bg-white p-5 lg:col-span-2">
      <h2 className="text-[14px] font-semibold text-[#171d2b]">Recent orders</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#7f7469]">No orders yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#ece5da] text-[11px] uppercase tracking-[0.1em] text-[#958675]">
                <th className="pb-2 text-left font-semibold">Order</th>
                <th className="pb-2 text-left font-semibold">Status</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
                <th className="pb-2 text-right font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[#f0ebe3] last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-[12px] text-[#171d2b]">
                    {o.orderNumber}
                  </td>
                  <td className="py-2.5 pr-3 text-[#5f574e]">{formatOrderStatus(o.status)}</td>
                  <td className="py-2.5 pr-3 text-right text-[#171d2b]">
                    {formatCurrency(o.amount)}
                  </td>
                  <td className="py-2.5 text-right text-[#958675]">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[92px] animate-pulse rounded-2xl border border-[#ece5da] bg-white"
        />
      ))}
    </div>
  );
}
