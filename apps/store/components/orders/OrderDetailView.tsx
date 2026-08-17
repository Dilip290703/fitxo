"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  confirmOrder,
  loadStoreOrder,
  markAllItemsPrepared,
  setItemPrepared,
  type StoreOrderDetail,
  type StoreOrderItem,
} from "@/lib/orders";
import { formatOrderStatus, statusTone } from "@/lib/orderStatus";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { useOrderAlerts } from "@/components/alerts/OrderAlertsProvider";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";

const DECISION_LABEL: Record<StoreOrderItem["decision"], string> = {
  pending: "Awaiting decision",
  keep: "Kept",
  return: "Returned",
};

const DECISION_CLASS: Record<StoreOrderItem["decision"], string> = {
  pending: "bg-hairline text-soft",
  keep: "bg-success-bg text-success",
  return: "bg-danger-bg text-danger",
};

export function OrderDetailView({ orderId }: { orderId: string }) {
  const { storeId } = useStorePanel();
  const { refreshPending } = useOrderAlerts();
  const toast = useToast();
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    loadStoreOrder(orderId, storeId)
      .then((data) => {
        if (!active) return;
        if (!data) setNotFound(true);
        else setOrder(data);
      })
      .catch(() => {
        if (active) setError("We couldn't load this order. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [orderId, storeId]);

  const togglePrepared = async (item: StoreOrderItem) => {
    if (!order) return;
    const ready = !item.preparedAt;
    setBusyItem(item.id);
    setError("");
    try {
      await setItemPrepared(item.id, ready);
      setOrder((o) =>
        o
          ? {
              ...o,
              items: o.items.map((it) =>
                it.id === item.id
                  ? { ...it, preparedAt: ready ? new Date().toISOString() : null }
                  : it,
              ),
              preparedCount: o.items.filter((it) =>
                it.id === item.id ? ready : it.preparedAt,
              ).length,
            }
          : o,
      );
    } catch (e) {
      // Surface the real reason (e.g. a Postgres/RLS message) instead of a
      // generic string, so failures are diagnosable.
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `Couldn't update that item: ${msg}` : "Couldn't update that item. Please try again.");
      throw e;
    } finally {
      setBusyItem(null);
    }
  };

  const markAllReady = async () => {
    if (!order) return;
    const pending = order.items.filter((it) => !it.preparedAt);
    if (pending.length === 0) return;
    setBusyItem("__all__");
    setError("");
    try {
      // one bulk RPC (migration 031); falls back per-item pre-migration
      await markAllItemsPrepared(order.id, pending.map((it) => it.id));
      const now = new Date().toISOString();
      setOrder((o) =>
        o
          ? {
              ...o,
              items: o.items.map((it) => (it.preparedAt ? it : { ...it, preparedAt: now })),
              preparedCount: o.items.length,
            }
          : o,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `Couldn't mark items ready: ${msg}` : "Couldn't mark items ready. Please try again.");
    } finally {
      setBusyItem(null);
    }
  };

  const confirm = async () => {
    if (!order) return;
    setConfirming(true);
    setError("");
    try {
      await confirmOrder(order.id);
      setOrder((o) => (o ? { ...o, status: "confirmed" } : o));
      refreshPending();
      toast(`Order ${order.orderNumber} confirmed`);
    } catch (e) {
      // Surface the real Postgres/RPC error so failures are diagnosable.
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Couldn't confirm: ${msg || "unknown error"}`);
    } finally {
      setConfirming(false);
    }
  };

  if (notFound) {
    return (
      <div className="px-6 py-10">
        <p className="text-[14px] text-danger">Order not found in your store.</p>
        <Link href="/orders" className="mt-4 inline-block rounded-full border border-ink px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
          Back to orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 lg:py-10">
        {error ? (
          <Banner variant="error">{error}</Banner>
        ) : (
          <div className="rounded-2xl border border-line bg-white">
            <RowsSkeleton rows={4} />
          </div>
        )}
      </div>
    );
  }

  const allReady = order.items.length > 0 && order.items.every((it) => it.preparedAt);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/orders" className="text-[12px] font-semibold text-soft hover:text-ink">
        ← Back to orders
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-[24px] font-semibold tracking-[-0.01em] text-ink">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-[13px] text-muted">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge tone={statusTone(order.status)}>{formatOrderStatus(order.status)}</StatusBadge>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Your items" value={String(order.itemCount)} />
        <Stat label="Your subtotal" value={formatCurrency(order.subtotal)} />
        <Stat label="Ready" value={`${order.preparedCount}/${order.itemCount}`} />
        <Stat label="Try deadline" value={order.tryDeadline ? formatDateTime(order.tryDeadline) : "—"} />
      </section>

      {error ? (
        <Banner variant="error" className="mt-4">{error}</Banner>
      ) : null}

      {order.status === "pending" ? (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-strong bg-cream p-5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Confirm this order</h2>
            <p className="mt-1 text-[12px] text-soft">
              {allReady
                ? "All your items are ready. Confirm to send it to a Fitxo rider."
                : "Mark every item ready, then confirm to send it to a Fitxo rider."}
            </p>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={!allReady || confirming}
            className="rounded-full bg-ink px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirming ? "Confirming…" : "Confirm order"}
          </button>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-success-line bg-success-bg px-5 py-3.5">
          <p className="text-[13px] font-medium text-success">
            Order confirmed — a Fitxo rider will be assigned for pickup.
          </p>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">Items to prepare</h2>
          {!allReady ? (
            <button
              type="button"
              onClick={markAllReady}
              disabled={busyItem !== null}
              className="rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-ink-soft disabled:opacity-60"
            >
              Mark all ready
            </button>
          ) : (
            <span className="text-[12px] font-semibold text-success">All ready ✓</span>
          )}
        </div>

        <ul className="mt-4 divide-y divide-hairline">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-[180px] flex-1">
                <p className="text-[14px] font-medium text-ink">{item.productName}</p>
                <p className="text-[12px] text-muted">
                  {item.colorName} · Size {item.size}
                  {item.sku ? (
                    <>
                      {" · "}
                      <span className="font-mono">{item.sku}</span>
                    </>
                  ) : null}
                </p>
                {item.decision === "return" && item.returnReason ? (
                  <p className="mt-1 text-[12px] text-danger">Return reason: {item.returnReason}</p>
                ) : null}
              </div>

              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${DECISION_CLASS[item.decision]}`}>
                {DECISION_LABEL[item.decision]}
              </span>

              <span className="w-16 text-right text-[13px] font-semibold text-ink">
                {formatCurrency(item.price)}
              </span>

              <button
                type="button"
                onClick={() => togglePrepared(item).catch(() => {})}
                disabled={busyItem === item.id}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
                  item.preparedAt
                    ? "border-success bg-success-bg text-success"
                    : "border-line-strong text-body hover:border-ink hover:text-ink"
                }`}
              >
                {item.preparedAt ? "Ready ✓" : "Mark ready"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-[12px] leading-5 text-muted">
        Customer and delivery details are handled by the Fitxo rider — your store only
        sees the items to prepare.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1.5 text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}
