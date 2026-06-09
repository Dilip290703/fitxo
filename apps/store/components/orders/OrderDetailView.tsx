"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadStoreOrder,
  setItemPrepared,
  type StoreOrderDetail,
  type StoreOrderItem,
} from "@/lib/orders";
import { formatOrderStatus, statusBadgeClass } from "@/lib/orderStatus";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DECISION_LABEL: Record<StoreOrderItem["decision"], string> = {
  pending: "Awaiting decision",
  keep: "Kept",
  return: "Returned",
};

const DECISION_CLASS: Record<StoreOrderItem["decision"], string> = {
  pending: "bg-[#f0ebe3] text-[#8a8073]",
  keep: "bg-[#e8f3ea] text-[#2f7d46]",
  return: "bg-[#fbeeea] text-[#b83c24]",
};

export function OrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [busyItem, setBusyItem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadStoreOrder(orderId)
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
  }, [orderId]);

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
    } catch {
      setError("Couldn't update that item. Please try again.");
    } finally {
      setBusyItem(null);
    }
  };

  const markAllReady = async () => {
    if (!order) return;
    const pending = order.items.filter((it) => !it.preparedAt);
    for (const it of pending) {
      // sequential keeps the guarded RPC simple and surfaces the first failure
      // eslint-disable-next-line no-await-in-loop
      await togglePrepared(it);
    }
  };

  if (notFound) {
    return (
      <div className="px-6 py-10">
        <p className="text-[14px] text-[#b83c24]">Order not found in your store.</p>
        <Link href="/orders" className="mt-4 inline-block rounded-full border border-[#171d2b] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#171d2b]">
          Back to orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return <p className="px-6 py-10 text-[13px] uppercase tracking-[0.16em] text-[#958675]">Loading…</p>;
  }

  const allReady = order.items.length > 0 && order.items.every((it) => it.preparedAt);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 lg:py-10">
      <Link href="/orders" className="text-[12px] font-semibold text-[#806f5c] hover:text-[#171d2b]">
        ← Back to orders
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-[24px] font-semibold tracking-[-0.01em] text-[#171d2b]">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-[13px] text-[#958675]">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold ${statusBadgeClass(order.status)}`}>
          {formatOrderStatus(order.status)}
        </span>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Your items" value={String(order.itemCount)} />
        <Stat label="Your subtotal" value={formatCurrency(order.subtotal)} />
        <Stat label="Ready" value={`${order.preparedCount}/${order.itemCount}`} />
        <Stat label="Try deadline" value={order.tryDeadline ? formatDateTime(order.tryDeadline) : "—"} />
      </section>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : null}

      <section className="mt-6 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#171d2b]">Items to prepare</h2>
          {!allReady ? (
            <button
              type="button"
              onClick={markAllReady}
              disabled={busyItem !== null}
              className="rounded-full bg-[#171d2b] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#1f2a3c] disabled:opacity-60"
            >
              Mark all ready
            </button>
          ) : (
            <span className="text-[12px] font-semibold text-[#2f7d46]">All ready ✓</span>
          )}
        </div>

        <ul className="mt-4 divide-y divide-[#f0ebe3]">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[#171d2b]">{item.productName}</p>
                <p className="text-[12px] text-[#958675]">
                  {item.colorName} · Size {item.size}
                  {item.sku ? (
                    <>
                      {" · "}
                      <span className="font-mono">{item.sku}</span>
                    </>
                  ) : null}
                </p>
                {item.decision === "return" && item.returnReason ? (
                  <p className="mt-1 text-[12px] text-[#b83c24]">Return reason: {item.returnReason}</p>
                ) : null}
              </div>

              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${DECISION_CLASS[item.decision]}`}>
                {DECISION_LABEL[item.decision]}
              </span>

              <span className="w-16 text-right text-[13px] font-semibold text-[#171d2b]">
                {formatCurrency(item.price)}
              </span>

              <button
                type="button"
                onClick={() => togglePrepared(item)}
                disabled={busyItem === item.id}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
                  item.preparedAt
                    ? "border-[#2f7d46] bg-[#e8f3ea] text-[#2f7d46]"
                    : "border-[#ded3c6] text-[#5f574e] hover:border-[#171d2b] hover:text-[#171d2b]"
                }`}
              >
                {item.preparedAt ? "Ready ✓" : "Mark ready"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-[12px] leading-5 text-[#958675]">
        Customer and delivery details are handled by the Fitzo rider — your store only
        sees the items to prepare.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ece5da] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#958675]">{label}</p>
      <p className="mt-1.5 text-[15px] font-semibold text-[#171d2b]">{value}</p>
    </div>
  );
}
