'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';
import DataTable, { Column } from '@/components/admin/DataTable';
import RefundDialog from './RefundDialog';
import { syncGatewayFees } from './actions';

export interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  paid_at: string | null;
  created_at: string;
  order_id: string;
  /** Razorpay's total deduction incl. GST, rupees (migration 043). NULL = not yet reported. */
  gateway_fee: number | null;
  orders: { order_number: string } | null;
  users: { name: string; email: string } | null;
}

import { buildQuery, type PageInfo } from '@/lib/pagination';

const STATUS_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Success', value: 'success' },
  { label: 'Initiated', value: 'initiated' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Refunded', value: 'refunded' },
] as const;

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PaymentsClient({
  payments,
  pageInfo,
  activeStatus,
  activeSearch,
}: {
  /** One page of rows — the status filter and search ran in the query. */
  payments: PaymentRow[];
  pageInfo: PageInfo;
  activeStatus: string;
  activeSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/payments${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [search, setSearch] = useState(activeSearch);
  useEffect(() => setSearch(activeSearch), [activeSearch]);
  useEffect(() => {
    if (search === activeSearch) return;
    const t = setTimeout(() => push({ q: search || null }), 350);
    return () => clearTimeout(t);
  }, [search, activeSearch, push]);
  const [refunding, setRefunding] = useState<PaymentRow | null>(null);
  const [syncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSyncFees = () => {
    setSyncMessage(null);
    startSync(async () => {
      const res = await syncGatewayFees();
      if (!res.success) {
        setSyncMessage(res.error);
        return;
      }
      setSyncMessage(
        res.updated === 0 && res.failed === 0
          ? 'All Razorpay rows already have their gateway fee.'
          : `Synced ${res.updated} payment${res.updated === 1 ? '' : 's'}` +
            (res.failed > 0 ? `, ${res.failed} failed` : '') +
            (res.remaining ? ' — run again for older rows.' : '.'),
      );
      router.refresh();
    });
  };

  // No client-side filter: `payments` is already the filtered page.

  const columns: Column<PaymentRow>[] = [
    {
      key: 'razorpay_payment_id',
      label: 'Payment ID',
      render: (v) => <span className="font-mono text-xs text-info">{v ? String(v) : '—'}</span>,
    },
    {
      key: 'orders.order_number',
      label: 'Order #',
      render: (_, row) => <span className="font-mono text-xs text-body">{row.orders?.order_number ?? '—'}</span>,
    },
    {
      key: 'users.name',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="text-sm text-ink">{row.users?.name ?? '—'}</p>
          <p className="text-xs text-muted">{row.users?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (v, row) => (
        <div>
          <span className="text-sm font-medium text-ink">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.currency || 'INR' }).format(Number(v))}
          </span>
          {row.gateway_fee !== null && (
            <p className="text-[11px] text-muted" title="Razorpay's deduction for this capture, incl. GST (not returned on refund)">
              fee −{new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.currency || 'INR' }).format(Number(row.gateway_fee))}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'payment_method',
      label: 'Method',
      render: (v) => <span className="text-sm text-body capitalize">{String(v)}</span>,
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v)} size="sm" /> },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (_, row) => <span className="text-xs text-soft">{formatDateTime(row.paid_at ?? row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) =>
        row.status === 'success' && row.payment_method === 'razorpay' && row.razorpay_payment_id ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // row click navigates to the order
              setRefunding(row);
            }}
            className="text-xs font-medium text-danger hover:underline"
          >
            Refund
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => push({ status: tab.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeStatus === tab.value ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search payment ID, order #, customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto w-full sm:w-72 bg-white border border-line rounded-xl px-4 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={handleSyncFees}
          disabled={syncing}
          title="Fetch Razorpay's fee + GST for rows that don't have it yet (backfill; the webhook stamps new captures automatically)"
          className="shrink-0 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink hover:bg-cream disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync gateway fees'}
        </button>
      </div>
      {syncMessage && <p className="text-xs text-muted">{syncMessage}</p>}

      <DataTable
        data={payments}
        columns={columns}
        keyField="id"
        emptyMessage="No payment records found."
        onRowClick={(row) => router.push(`/admin/orders/${row.order_id}`)}
        server={{
          page: pageInfo.page,
          pageSize: pageInfo.pageSize,
          total: pageInfo.total,
          sortKey: pageInfo.sortKey,
          sortDir: pageInfo.sortDir,
          onPage: (p) => push({ page: p === 0 ? null : p + 1 }),
          onSort: (key) =>
            push({
              sort: key,
              dir: pageInfo.sortKey === key && pageInfo.sortDir === 'asc' ? 'desc' : 'asc',
            }),
        }}
      />

      {refunding && <RefundDialog payment={refunding} onClose={() => setRefunding(null)} />}
    </div>
  );
}
