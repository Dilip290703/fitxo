"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStoreOrders, type StoreOrderSummary } from "@/lib/orders";
import { formatOrderStatus, statusTone } from "@/lib/orderStatus";
import { formatCurrency, formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";

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
  const router = useRouter();
  const [orders, setOrders] = useState<StoreOrderSummary[] | null>(null);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState<Bucket>("all");

  useEffect(() => {
    let active = true;
    loadStoreOrders(storeId)
      .then((rows) => {
        if (active) setOrders(rows);
      })
      .catch(() => {
        if (active) setError("We couldn't load your orders. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const filtered = useMemo(
    () => (orders ?? []).filter((o) => inBucket(o.status, bucket)),
    [orders, bucket],
  );

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

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Orders</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          Order management
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Select an order to see its items and mark them ready for pickup.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
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
      </div>

      {error ? (
        <Banner variant="error" className="mt-4">{error}</Banner>
      ) : null}

      <div className={`mt-5 overflow-hidden rounded-2xl border border-line bg-white ${error ? "hidden" : ""}`}>
        {!orders ? (
          <RowsSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-soft">
            {orders.length === 0 ? "No orders yet." : "No orders in this view."}
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
                  <th className="px-2 py-3" />
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
                    <td className="px-2 py-3 text-right text-[16px] leading-none text-faint">›</td>
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
