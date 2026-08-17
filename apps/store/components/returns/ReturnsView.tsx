"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStoreReturns, type StoreReturn } from "@/lib/returns";
import { formatCurrency, formatDate } from "@/lib/format";
import { useStorePanel } from "@/components/panel/PanelContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { RowsSkeleton } from "@/components/ui/Skeleton";

type StatusFilter = "all" | StoreReturn["status"];

const STATUS_LABEL: Record<StoreReturn["status"], string> = {
  requested: "Requested",
  scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  completed: "Completed",
};

const STATUS_TONE: Record<StoreReturn["status"], BadgeTone> = {
  requested: "amber",
  scheduled: "amber",
  picked_up: "blue",
  completed: "green",
};

export function ReturnsView() {
  const { storeId } = useStorePanel();
  const [returns, setReturns] = useState<StoreReturn[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const reload = useCallback(
    () =>
      loadStoreReturns(storeId)
        .then((rows) => {
          setReturns(rows);
          setError("");
        })
        .catch(() => setError("We couldn't load your returns. Please try again.")),
    [storeId],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  // Live refresh (migration 060 / audit 2.3). This screen is the one a customer's
  // "Return" tap lands on, and it used to render exactly once — the item the
  // rider is already carrying back would not appear until a manual reload. 4s
  // matches the agent app's proven cadence; paused while the tab is hidden.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") reload();
    };
    const id = setInterval(tick, 4000);
    window.addEventListener("focus", reload);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);

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
      <PageHeader
        eyebrow="Returns"
        title="Returns management"
        sub="Items customers chose to return — pickups are handled by Fitxo riders."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {chips.map((c) => {
          const n = (returns ?? []).filter((r) => c.key === "all" || r.status === c.key).length;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                filter === c.key
                  ? "bg-ink text-white"
                  : "border border-line-strong text-body hover:border-ink hover:text-ink"
              }`}
            >
              {c.label}
              {returns ? (
                <span className={filter === c.key ? "ml-1.5 text-white/60" : "ml-1.5 text-faint"}>{n}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <Banner variant="error" className="mt-4">{error}</Banner>
      ) : null}

      <div className={`mt-5 overflow-hidden rounded-2xl border border-line bg-white ${error ? "hidden" : ""}`}>
        {!returns ? (
          <RowsSkeleton rows={3} />
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-soft">
            {returns.length === 0 ? "No returns yet — that's a good sign." : "No returns in this view."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
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
                  <tr key={r.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{r.productName}</p>
                      <p className="text-[11px] text-muted">
                        {r.colorName} · Size {r.size}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-body">{r.orderNumber}</td>
                    <td className="max-w-[200px] px-4 py-3 text-[12px] text-body">
                      {r.reason ?? <span className="text-faint">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={r.condition === "damaged" ? "red" : "green"}>
                        {r.condition === "damaged" ? "Damaged" : "Good"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{formatCurrency(r.price)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{formatDate(r.requestedAt)}</td>
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
