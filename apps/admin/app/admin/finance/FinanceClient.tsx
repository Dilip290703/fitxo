'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';

// P&L screen (money plan M5): date-ranged statement + per-order contribution
// table + honest CSV export, all from the SAME order_economics rows — the
// statement, the table and the file can never disagree.

export type EcoRow = {
  order_id: string;
  order_number: string;
  created_at: string;
  status: string;
  item_count: number;
  kept_count: number;
  returned_count: number;
  captured_total: number;
  refunded_total: number;
  net_captured: number;
  delivery_fee_collected: number;
  gateway_cost: number;
  gateway_cost_incomplete: boolean;
  kept_paid_gross: number;
  kept_unpaid_gross: number;
  commission: number;
  store_net: number;
  rider_cost: number;
  margin: number;
  store_paid: number;
  rider_paid: number;
};

export type PnlTotals = {
  orders: number;
  capturedTotal: number;
  refundedTotal: number;
  netCaptured: number;
  keptPaidGross: number;
  keptUnpaidGross: number;
  commission: number;
  feesCollected: number;
  gatewayCost: number;
  riderCost: number;
  margin: number;
  storeNet: number;
  storePaid: number;
  riderPaid: number;
  gatewayIncomplete: boolean;
};

const PRESETS: { key: string; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

function inr(n: number) {
  const v = Math.round(n * 100) / 100;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** CSV cell: quote when needed, double internal quotes. */
function csvCell(v: string | number | boolean) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function FinanceClient({
  rows,
  totals,
  rangeKey,
  customFrom,
  customTo,
  truncated,
  loadError,
}: {
  rows: EcoRow[];
  totals: PnlTotals;
  rangeKey: string;
  customFrom: string;
  customTo: string;
  truncated: boolean;
  loadError: string | null;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(customFrom);
  const [to, setTo] = useState(customTo);

  const exportCsv = () => {
    const header = [
      'order_number', 'placed_at', 'status', 'items', 'kept', 'returned',
      'captured_total', 'refunded_total', 'net_captured', 'kept_paid_gross',
      'kept_unpaid_gross', 'commission', 'store_net', 'delivery_fee_collected',
      'gateway_cost', 'gateway_cost_incomplete', 'rider_cost', 'margin',
      'store_paid', 'rider_paid',
    ];
    const lines = rows.map((r) =>
      [
        r.order_number, r.created_at, r.status, r.item_count, r.kept_count, r.returned_count,
        r.captured_total, r.refunded_total, r.net_captured, r.kept_paid_gross,
        r.kept_unpaid_gross, r.commission, r.store_net, r.delivery_fee_collected,
        r.gateway_cost, r.gateway_cost_incomplete, r.rider_cost, r.margin,
        r.store_paid, r.rider_paid,
      ].map(csvCell).join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitxo-pnl-${rangeKey}${rangeKey === 'custom' ? `-${customFrom}-to-${customTo}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statement: { label: string; value: number; kind?: 'income' | 'cost' | 'total'; note?: string }[] = [
    { label: 'Commission earned', value: totals.commission, kind: 'income', note: 'On kept-and-paid items (stamped at settlement since 046)' },
    { label: 'Delivery fees collected', value: totals.feesCollected, kind: 'income', note: 'Net of auto-refunded fees' },
    { label: 'Gateway fees', value: -totals.gatewayCost, kind: 'cost', note: 'Razorpay MDR + GST — kept by Razorpay even on refunds' },
    { label: 'Rider pay (earned)', value: -totals.riderCost, kind: 'cost', note: 'Only counted once the delivery completed' },
    { label: 'Contribution margin', value: totals.margin, kind: 'total', note: 'Pre-tax — GST/TDS/TCS provisions land with M4' },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Finance — P&amp;L</h2>
          <p className="text-sm text-muted">
            Reads the order_economics money truth. Figures attach to the order&apos;s placement date.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Export CSV ({rows.length} orders)
        </button>
      </div>

      {/* Range controls */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => router.push(`/admin/finance?range=${p.key}`)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              rangeKey === p.key
                ? 'bg-ink text-white'
                : 'border border-line-strong text-body hover:border-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 text-xs text-muted">or</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-line-strong bg-white px-2 py-1.5 text-xs text-ink"
          aria-label="From date"
        />
        <span className="text-xs text-muted">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-line-strong bg-white px-2 py-1.5 text-xs text-ink"
          aria-label="To date"
        />
        <button
          onClick={() => from && to && router.push(`/admin/finance?range=custom&from=${from}&to=${to}`)}
          disabled={!from || !to}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            rangeKey === 'custom'
              ? 'bg-ink text-white'
              : 'border border-line-strong text-body hover:border-ink disabled:opacity-50'
          }`}
        >
          Apply
        </button>
      </div>

      {loadError && (
        <p className="rounded-lg border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
          Couldn&apos;t read order_economics: {loadError}. If this is a fresh environment, apply migration 044
          (and 045/046) first — this screen has no pre-044 fallback on purpose: a P&amp;L from the old
          checkout-GMV math would be the exact dishonesty M2 removed.
        </p>
      )}

      {totals.gatewayIncomplete && !loadError && (
        <p className="rounded-lg border border-warn-accent/40 bg-warn-bg px-4 py-3 text-sm text-warn">
          ⚠ Some captured payments in this range have no gateway-fee data yet — gateway cost and margin
          are overstated until you run <strong>Sync gateway fees</strong> on the Payments screen.
        </p>
      )}

      {truncated && (
        <p className="rounded-lg border border-warn-accent/40 bg-warn-bg px-4 py-3 text-sm text-warn">
          ⚠ This range hit the 1,000-order display cap — totals and the CSV cover only the latest 1,000
          orders shown. Narrow the range for exact figures.
        </p>
      )}

      {/* ——— The statement ——— */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white border border-line rounded-xl p-5 lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-soft">
            P&amp;L statement · {totals.orders} order{totals.orders === 1 ? '' : 's'}
          </h3>
          <dl className="mt-3 divide-y divide-hairline">
            {statement.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <dt className={`text-sm ${line.kind === 'total' ? 'font-bold text-ink' : 'text-body'}`}>
                    {line.label}
                  </dt>
                  {line.note && <p className="text-[11px] text-muted">{line.note}</p>}
                </div>
                <dd
                  className={`shrink-0 font-mono text-sm ${
                    line.kind === 'total'
                      ? `text-base font-bold ${line.value < 0 ? 'text-danger' : 'text-success'}`
                      : line.kind === 'cost'
                        ? 'text-danger'
                        : 'text-ink'
                  }`}
                >
                  {line.value < 0 ? `− ${inr(Math.abs(line.value))}` : inr(line.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ——— Context: cash + obligations ——— */}
        <div className="space-y-4">
          <div className="bg-white border border-line rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-soft">Cash collected</h3>
            <p className="mt-2 font-mono text-xl font-bold text-ink">{inr(totals.netCaptured)}</p>
            <p className="text-[11px] text-muted">
              Captured {inr(totals.capturedTotal)} − refunded {inr(totals.refundedTotal)}
            </p>
            <p className="mt-2 text-[11px] text-muted">
              of which kept-and-paid items {inr(totals.keptPaidGross)}
            </p>
          </div>
          <div className="bg-white border border-line rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-soft">Obligations</h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-body">Store share (owed basis)</dt>
                <dd className="font-mono text-ink">{inr(totals.storeNet)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Store payouts made</dt>
                <dd className="font-mono text-ink">{inr(totals.storePaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Rider payouts made</dt>
                <dd className="font-mono text-ink">{inr(totals.riderPaid)}</dd>
              </div>
              {totals.keptUnpaidGross > 0 && (
                <div className="flex justify-between">
                  <dt className="text-body">Kept but unpaid (exposure)</dt>
                  <dd className="font-mono text-warn">{inr(totals.keptUnpaidGross)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* ——— Per-order contribution ——— */}
      <div className="bg-white border border-line rounded-xl p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-soft mb-3">
          Per-order contribution
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No orders in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Placed</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Kept</th>
                  <th className="py-2 pr-3 text-right">Net captured</th>
                  <th className="py-2 pr-3 text-right">Commission</th>
                  <th className="py-2 pr-3 text-right">Fee coll.</th>
                  <th className="py-2 pr-3 text-right">Gateway</th>
                  <th className="py-2 pr-3 text-right">Rider</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.order_id} className="border-b border-hairline">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/admin/orders/${r.order_id}`}
                        className="font-mono text-xs text-info hover:text-ink"
                      >
                        {r.order_number}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td className="py-2 pr-3 text-right text-xs text-body">
                      {r.kept_count}/{r.item_count}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-ink">{inr(r.net_captured)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-ink">{inr(r.commission)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-ink">{inr(r.delivery_fee_collected)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-danger">
                      {r.gateway_cost > 0 ? `− ${inr(r.gateway_cost)}` : inr(0)}
                      {r.gateway_cost_incomplete && <span title="Gateway fee not yet synced"> ⚠</span>}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-danger">
                      {r.rider_cost > 0 ? `− ${inr(r.rider_cost)}` : inr(0)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono text-xs font-bold ${
                        r.margin < 0 ? 'text-danger' : 'text-ink'
                      }`}
                    >
                      {inr(r.margin)}
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
