"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadStoreOrders, type StoreOrderSummary } from "@/lib/orders";
import { formatOrderStatus, statusBadgeClass } from "@/lib/orderStatus";

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

export function OrdersView() {
  const [orders, setOrders] = useState<StoreOrderSummary[] | null>(null);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState<Bucket>("all");

  useEffect(() => {
    let active = true;
    loadStoreOrders()
      .then((rows) => {
        if (active) setOrders(rows);
      })
      .catch(() => {
        if (active) setError("We couldn't load your orders. Please try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => (orders ?? []).filter((o) => inBucket(o.status, bucket)),
    [orders, bucket],
  );

  const buckets: { key: Bucket; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "try", label: "Try window" },
    { key: "returns", label: "Returns" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Orders</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Order management
        </h1>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {buckets.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(b.key)}
            className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
              bucket === b.key
                ? "bg-[#171d2b] text-white"
                : "border border-[#ded3c6] text-[#5f574e] hover:border-[#171d2b] hover:text-[#171d2b]"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : null}

      <div className={`mt-5 overflow-hidden rounded-2xl border border-[#ece5da] bg-white ${error ? "hidden" : ""}`}>
        {!orders ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#f4efe7]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-[#7f7469]">
            {orders.length === 0 ? "No orders yet." : "No orders in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#ece5da] text-[11px] uppercase tracking-[0.1em] text-[#958675]">
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Items</th>
                  <th className="px-4 py-3 text-left font-semibold">Outcome</th>
                  <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                  <th className="px-4 py-3 text-right font-semibold">Placed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-[#f0ebe3] last:border-0 hover:bg-[#fbfaf7]">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-mono text-[12px] font-semibold text-[#171d2b] hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(o.status)}`}>
                        {formatOrderStatus(o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#171d2b]">
                      {o.preparedCount}/{o.itemCount} ready
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#5f574e]">
                      {o.keptCount === 0 && o.returnedCount === 0 ? (
                        <span className="text-[#a79e92]">—</span>
                      ) : (
                        <span>
                          {o.keptCount > 0 ? `${o.keptCount} kept` : ""}
                          {o.keptCount > 0 && o.returnedCount > 0 ? " · " : ""}
                          {o.returnedCount > 0 ? `${o.returnedCount} returned` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#171d2b]">
                      {formatCurrency(o.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-[#958675]">{formatDate(o.createdAt)}</td>
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
