"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmOrder,
  loadStoreOrders,
  markAllItemsPrepared,
  type StoreOrderSummary,
} from "@/lib/orders";
import { formatOrderStatus, statusTone } from "@/lib/orderStatus";
import { formatCurrency, formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { useOrderAlerts } from "@/components/alerts/OrderAlertsProvider";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";
import { inputClass } from "@/components/ui/FormField";

type Bucket = "all" | "active" | "try" | "returns" | "completed";

const ACTIVE_STATUSES = ["pending", "confirmed", "assigned", "out_for_delivery", "delivered"];
const RETURN_STATUSES = ["return_requested", "return_picked"];

function inBucket(status: string, bucket: Bucket): boolean {
  switch (bucket) {
    case "active":
      return ACTIVE_STATUSES.includes(status);
    case "try":
      return status === "try_window_active";
    case "returns":
      return RETURN_STATUSES.includes(status);
    case "completed":
      return status === "completed" || status === "cancelled";
    default:
      return true;
  }
}

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "try", label: "Try window" },
  { key: "returns", label: "Returns" },
  { key: "completed", label: "Completed" },
];

export function OrdersView() {
  const { storeId } = useStorePanel();
  const { pendingCount, refreshPending } = useOrderAlerts();
  const toast = useToast();
  const router = useRouter();
  const [orders, setOrders] = useState<StoreOrderSummary[] | null>(null);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState<Bucket>("all");
  const [search, setSearch] = useState("");
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadStoreOrders(storeId)
      .then((rows) => {
        setOrders(rows);
        setError("");
      })
      .catch(() => setError("We couldn't load your orders. Please try again."));
  }, [storeId]);

  // Live list without a dedicated subscription: the alerts provider's
  // pendingCount is the reliable "orders changed" signal (its notifications
  // poll is the mechanism Realtime couldn't provide for store sessions — see
  // OrderAlertsProvider). Also refetch when the tab regains focus.
  const lastPending = useRef<number | null>(null);
  useEffect(() => {
    if (lastPending.current === pendingCount && orders) return;
    lastPending.current = pendingCount;
    reload();
  }, [reload, pendingCount, orders]);

  useEffect(() => {
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders ?? []).filter(
      (o) => inBucket(o.status, bucket) && (!q || o.orderNumber.toLowerCase().includes(q)),
    );
  }, [orders, bucket, search]);

  // Chip counts — the owner should see how much work each view holds
  // without clicking into it.
  const counts = useMemo(() => {
    const c = new Map<Bucket, number>();
    for (const b of BUCKETS) {
      c.set(b.key, (orders ?? []).filter((o) => inBucket(o.status, b.key)).length);
    }
    return c;
  }, [orders]);

  const openOrder = (id: string) => router.push(`/orders/${id}`);

  const readyAndConfirm = async (o: StoreOrderSummary) => {
    setBusyOrder(o.id);
    setError("");
    try {
      if (o.unpreparedItemIds.length > 0) {
        await markAllItemsPrepared(o.id, o.unpreparedItemIds);
      }
      await confirmOrder(o.id);
      toast(`Order ${o.orderNumber} confirmed`);
      refreshPending();
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `Couldn't confirm ${o.orderNumber}: ${msg}` : `Couldn't confirm ${o.orderNumber}. Please try again.`);
    } finally {
      setBusyOrder(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Orders</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          Order management
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Confirm pending orders right here, or open one to prepare item by item.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {BUCKETS.map((b) => {
          const n = counts.get(b.key) ?? 0;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setBucket(b.key)}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                bucket === b.key
                  ? "bg-ink text-white"
                  : "border border-line-strong text-body hover:border-ink hover:text-ink"
              }`}
            >
              {b.label}
              {orders ? <span className={bucket === b.key ? "ml-1.5 text-white/60" : "ml-1.5 text-faint"}>{n}</span> : null}
            </button>
          );
        })}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order no…"
          aria-label="Search by order number"
          className={`${inputClass} ml-auto h-10 w-full font-mono sm:w-[200px]`}
        />
      </div>

      {error ? (
        <Banner variant="error" className="mt-4">{error}</Banner>
      ) : null}

      <div className={`mt-5 overflow-hidden rounded-2xl border border-line bg-white ${error ? "hidden" : ""}`}>
        {!orders ? (
          <RowsSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-soft">
            {orders.length === 0
              ? "No orders yet."
              : search.trim()
                ? "No orders match that number."
                : "No orders in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Items</th>
                  <th className="px-4 py-3 text-left font-semibold">Outcome</th>
                  <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                  <th className="px-4 py-3 text-right font-semibold">Placed</th>
                  <th className="px-3 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openOrder(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openOrder(o.id);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open order ${o.orderNumber}`}
                    className="cursor-pointer border-b border-hairline last:border-0 hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] font-semibold text-ink">
                        {o.orderNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={statusTone(o.status)}>{formatOrderStatus(o.status)}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right text-ink">
                      {o.preparedCount}/{o.itemCount} ready
                    </td>
                    <td className="px-4 py-3 text-[12px] text-body">
                      {o.keptCount === 0 && o.returnedCount === 0 ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <span>
                          {o.keptCount > 0 ? `${o.keptCount} kept` : ""}
                          {o.keptCount > 0 && o.returnedCount > 0 ? " · " : ""}
                          {o.returnedCount > 0 ? `${o.returnedCount} returned` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatCurrency(o.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      {o.status === "pending" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            readyAndConfirm(o);
                          }}
                          disabled={busyOrder !== null}
                          className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-ink-soft disabled:opacity-50"
                        >
                          {busyOrder === o.id ? "Confirming…" : "Ready & confirm"}
                        </button>
                      ) : (
                        <span className="text-[16px] leading-none text-faint">›</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
