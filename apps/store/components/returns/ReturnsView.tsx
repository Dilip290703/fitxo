"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStoreReturns, type StoreReturn } from "@/lib/returns";

type StatusFilter = "all" | StoreReturn["status"];

const STATUS_LABEL: Record<StoreReturn["status"], string> = {
  requested: "Requested",
  scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  completed: "Completed",
};

const STATUS_CLASS: Record<StoreReturn["status"], string> = {
  requested: "bg-[#fbeed0] text-[#9a6a12]",
  scheduled: "bg-[#fbeed0] text-[#9a6a12]",
  picked_up: "bg-[#e3ecf6] text-[#2d5e8f]",
  completed: "bg-[#e8f3ea] text-[#2f7d46]",
};

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

export function ReturnsView({ storeId }: { storeId: string }) {
  const [returns, setReturns] = useState<StoreReturn[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;
    loadStoreReturns(storeId)
      .then((rows) => {
        if (active) setReturns(rows);
      })
      .catch(() => {
        if (active) setError("We couldn't load your returns. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const filtered = useMemo(
    () => (returns ?? []).filter((r) => filter === "all" || r.status === filter),
    [returns, filter],
  );

  const chips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "requested", label: "Requested" },
    { key: "scheduled", label: "Scheduled" },
    { key: "picked_up", label: "Picked up" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Returns</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Returns management
        </h1>
        <p className="mt-1 text-[13px] text-[#958675]">
          Items customers chose to return — pickups are handled by Fitzo riders.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
              filter === c.key
                ? "bg-[#171d2b] text-white"
                : "border border-[#ded3c6] text-[#5f574e] hover:border-[#171d2b] hover:text-[#171d2b]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : null}

      <div className={`mt-5 overflow-hidden rounded-2xl border border-[#ece5da] bg-white ${error ? "hidden" : ""}`}>
        {!returns ? (
          <div className="space-y-3 p-5" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-[#f4efe7]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-[#7f7469]">
            {returns.length === 0 ? "No returns yet — that's a good sign." : "No returns in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#ece5da] text-[11px] uppercase tracking-[0.1em] text-[#958675]">
                  <th className="px-4 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Reason</th>
                  <th className="px-4 py-3 text-left font-semibold">Condition</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Value</th>
                  <th className="px-4 py-3 text-right font-semibold">Requested</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-[#f0ebe3] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#171d2b]">{r.productName}</p>
                      <p className="text-[11px] text-[#958675]">
                        {r.colorName} · Size {r.size}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#5f574e]">{r.orderNumber}</td>
                    <td className="max-w-[200px] px-4 py-3 text-[12px] text-[#5f574e]">
                      {r.reason ?? <span className="text-[#a79e92]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          r.condition === "damaged"
                            ? "bg-[#fbeeea] text-[#b83c24]"
                            : "bg-[#e8f3ea] text-[#2f7d46]"
                        }`}
                      >
                        {r.condition === "damaged" ? "Damaged" : "Good"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#171d2b]">{formatCurrency(r.price)}</td>
                    <td className="px-4 py-3 text-right text-[#958675]">{formatDate(r.requestedAt)}</td>
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
