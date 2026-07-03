"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  loadActivityFeed,
  loadStoreDashboard,
  type ActivityEvent,
  type DashboardData,
  type LowStockVariant,
} from "@/lib/dashboard";
import {
  confirmOrder,
  loadPendingStoreOrders,
  markAllItemsPrepared,
  type StoreOrderDetail,
} from "@/lib/orders";
import { formatCurrency, timeAgo } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { useOrderAlerts } from "@/components/alerts/OrderAlertsProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Banner } from "@/components/ui/Banner";
import { CardsSkeleton, RowsSkeleton } from "@/components/ui/Skeleton";
import { Icon, type IconName } from "@/components/icons";

export function StoreDashboard() {
  const { storeId } = useStorePanel();
  const { pendingCount, refreshPending } = useOrderAlerts();
  const toast = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [queue, setQueue] = useState<StoreOrderDetail[] | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const reload = useCallback(async () => {
    try {
      const [d, q, a] = await Promise.all([
        loadStoreDashboard(storeId),
        loadPendingStoreOrders(storeId),
        loadActivityFeed(storeId),
      ]);
      setData(d);
      setQueue(q);
      setActivity(a);
      setError("");
    } catch {
      setError("We couldn't load your dashboard. Please try again.");
    }
  }, [storeId]);

  // Reload on mount AND whenever the pending-order count changes — that's the
  // signal from the alerts provider that a new order arrived (or one was
  // confirmed elsewhere), so the queue stays live without its own poll.
  // Existing data stays on screen during a refresh (no skeleton flash).
  const lastPending = useRef<number | null>(null);
  useEffect(() => {
    if (lastPending.current === pendingCount && data) return;
    lastPending.current = pendingCount;
    reload();
  }, [reload, pendingCount, data]);

  const readyAndConfirm = async (order: StoreOrderDetail) => {
    setBusyOrder(order.id);
    setError("");
    try {
      const unprepared = order.items.filter((it) => !it.preparedAt);
      if (unprepared.length > 0) {
        setProgress("Preparing…");
        // one bulk RPC (migration 031); falls back per-item pre-migration
        await markAllItemsPrepared(order.id, unprepared.map((it) => it.id));
      }
      setProgress("Confirming…");
      await confirmOrder(order.id);
      setQueue((q) => (q ?? []).filter((o) => o.id !== order.id));
      toast(`Order ${order.orderNumber} confirmed — a rider will be offered the pickup`);
      refreshPending();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `Couldn't confirm ${order.orderNumber}: ${msg}` : `Couldn't confirm ${order.orderNumber}. Please try again.`);
    } finally {
      setBusyOrder(null);
      setProgress("");
    }
  };

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader eyebrow={today} title="Dashboard" />

      {error ? (
        <Banner variant="error" className="mt-6">{error}</Banner>
      ) : null}

      {/* ——— Needs your action: the reason the owner opens this app ——— */}
      <section className="mt-7">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Needs your action</h2>
          {queue && queue.length > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-ink">
              {queue.length}
            </span>
          ) : null}
        </div>

        {!queue ? (
          <div className="mt-3 rounded-2xl border border-line bg-white">
            <RowsSkeleton rows={2} />
          </div>
        ) : queue.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-success-line bg-success-bg px-5 py-4">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-success text-[14px] font-bold text-white">✓</span>
            <p className="text-[13px] font-medium text-success">
              All caught up — no orders waiting to be confirmed.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {queue.map((o) => {
              const preview = o.items
                .slice(0, 3)
                .map((it) => it.productName)
                .join(", ");
              const more = o.items.length - 3;
              const busy = busyOrder === o.id;
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent-soft bg-white p-4 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-[14px] font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      <span className="text-[12px] text-muted">placed {timeAgo(o.createdAt)}</span>
                    </div>
                    <p className="mt-1 truncate text-[13px] text-body">
                      {preview}
                      {more > 0 ? ` +${more} more` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {formatCurrency(o.subtotal)} ·{" "}
                      {o.preparedCount}/{o.itemCount} ready
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/orders/${o.id}`}
                      className="rounded-full border border-line-strong px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-body transition hover:border-ink hover:text-ink"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => readyAndConfirm(o)}
                      disabled={busyOrder !== null}
                      className="rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-ink-soft disabled:opacity-50"
                    >
                      {busy ? progress || "Working…" : "Ready & confirm"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ——— KPI cards (every card is a door) ——— */}
      {!data ? (
        <div className="mt-7">
          <CardsSkeleton />
        </div>
      ) : (
        <>
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
            <ActivityPanel events={activity} />
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

const EVENT_STYLE: Record<ActivityEvent["kind"], { icon: IconName; className: string }> = {
  order_placed: { icon: "orders", className: "bg-accent/25 text-ink" },
  item_kept: { icon: "catalogue", className: "bg-success-bg text-success" },
  item_returned: { icon: "returns", className: "bg-danger-bg text-danger" },
  payout: { icon: "earnings", className: "bg-info-bg text-info" },
};

function ActivityPanel({ events }: { events: ActivityEvent[] | null }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
      <h2 className="text-[14px] font-semibold text-ink">Activity</h2>
      {!events ? (
        <RowsSkeleton rows={3} />
      ) : events.length === 0 ? (
        <p className="mt-3 text-[13px] text-soft">
          New orders, keep/return decisions and payouts show up here as they happen.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline">
          {events.map((e) => {
            const style = EVENT_STYLE[e.kind];
            return (
              <li key={e.id}>
                <Link href={e.href} className="flex items-center gap-3 py-2.5 transition hover:bg-paper">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.className}`}>
                    <Icon name={style.icon} className="h-[15px] w-[15px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{e.title}</p>
                    <p className="truncate text-[11px] text-muted">{e.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-faint">{timeAgo(e.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
