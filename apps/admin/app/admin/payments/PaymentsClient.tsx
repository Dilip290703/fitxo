'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';
import DataTable, { Column } from '@/components/admin/DataTable';

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
  orders: { order_number: string } | null;
  users: { name: string; email: string } | null;
}

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

export default function PaymentsClient({ payments, initialTab }: { payments: PaymentRow[]; initialTab?: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(
    STATUS_TABS.some((t) => t.value === initialTab) ? (initialTab as string) : 'all',
  );
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (activeTab !== 'all' && p.status !== activeTab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(p.razorpay_payment_id ?? '').toLowerCase().includes(q) &&
          !(p.orders?.order_number ?? '').toLowerCase().includes(q) &&
          !(p.users?.name ?? '').toLowerCase().includes(q) &&
          !(p.users?.email ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [payments, activeTab, search]);

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
        <span className="text-sm font-medium text-ink">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.currency || 'INR' }).format(Number(v))}
        </span>
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
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
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
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyField="id"
        emptyMessage="No payment records found."
        onRowClick={(row) => router.push(`/admin/orders/${row.order_id}`)}
      />
    </div>
  );
}
