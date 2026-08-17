'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitxo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import StatusBadge from '@/components/admin/StatusBadge';
import DataTable, { Column } from '@/components/admin/DataTable';
import { logActivity } from '@/lib/activity';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import type { OrderStatus } from '@fitxo/supabase/types';

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  final_amount: number;
  payment_status: string;
  created_at: string;
  try_deadline: string | null;
  users: { name: string; email: string; phone: string } | null;
  order_items: { id: string }[];
}

const STATUS_TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Out for Delivery', value: 'out_for_delivery' },
  { label: 'Try Window', value: 'try_window_active' },
  { label: 'Return Requested', value: 'return_requested' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const PAYMENT_FILTERS = ['all', 'paid', 'partially_paid', 'pending', 'refunded'] as const;

interface SavedView {
  name: string;
  status: OrderStatus | 'all';
  payment: string;
  search: string;
}

const VIEWS_KEY = 'fitxo-admin-order-views';

function loadViews(): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '[]') as SavedView[];
  } catch {
    return [];
  }
}

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function OrdersClient({ orders, initialTab }: { orders: OrderRow[]; initialTab?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>(
    STATUS_TABS.some((t) => t.value === initialTab) ? (initialTab as OrderStatus | 'all') : 'all',
  );
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Live list (audit §2.4). Until now the only thing that redrew this screen
  // was `router.refresh()` after the admin's own bulk-confirm — so every change
  // made anywhere else (customer cancels, store confirms, rider delivers, the
  // try-window cron completes an order) left the list stale until someone
  // reloaded by hand. Paused during a bulk write so a tick can't repaint the
  // rows mid-update. Filters, search and the checkbox selection are client
  // state and survive each refresh.
  useLiveRefresh({ paused: bulkBusy });

  // Saved views (localStorage — 2 users, no need for a table).
  const [views, setViews] = useState<SavedView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  useEffect(() => setViews(loadViews()), []);

  const setTab = (tab: OrderStatus | 'all') => {
    setActiveTab(tab);
    // Keep the URL shareable without a server round-trip.
    const url = tab === 'all' ? '/admin/orders' : `/admin/orders?status=${tab}`;
    window.history.replaceState(null, '', url);
  };

  const applyView = (v: SavedView) => {
    setTab(v.status);
    setPaymentFilter(v.payment);
    setSearch(v.search);
  };

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    const next = [...views.filter((v) => v.name !== name), { name, status: activeTab, payment: paymentFilter, search }];
    setViews(next);
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setViewName('');
    setSavingView(false);
  };

  const deleteView = (name: string) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab !== 'all' && o.status !== activeTab) return false;
      if (paymentFilter !== 'all' && o.payment_status !== paymentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !o.order_number.toLowerCase().includes(q) &&
          !(o.users?.name ?? '').toLowerCase().includes(q) &&
          !(o.users?.phone ?? '').includes(q)
        )
          return false;
      }
      return true;
    });
  }, [orders, activeTab, paymentFilter, search]);

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const selectedRows = orders.filter((o) => selected.has(o.id));
  const selectedPending = selectedRows.filter((o) => o.status === 'pending');

  const bulkConfirm = async () => {
    if (selectedPending.length === 0) return;
    setBulkBusy(true);
    const ids = selectedPending.map((o) => o.id);
    const { error } = await supabase.from('orders').update({ status: 'confirmed' }).in('id', ids);
    setBulkBusy(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    await logActivity(supabase, {
      action: `Bulk-confirmed ${ids.length} pending order(s)`,
      entity_type: 'order',
      new_value: { order_ids: ids },
    });
    toast(`Confirmed ${ids.length} order(s)`, 'success');
    setSelected(new Set());
    router.refresh();
  };

  const exportCsv = () => {
    const rows = selectedRows.length > 0 ? selectedRows : filtered;
    const header = ['Order #', 'Customer', 'Phone', 'Items', 'Total', 'Status', 'Payment', 'Created'];
    const lines = [
      header.join(','),
      ...rows.map((o) =>
        [
          csvEscape(o.order_number),
          csvEscape(o.users?.name ?? ''),
          csvEscape(o.users?.phone ?? ''),
          o.order_items.length,
          o.final_amount,
          o.status,
          o.payment_status,
          csvEscape(new Date(o.created_at).toLocaleString('en-IN')),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitxo-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<OrderRow>[] = [
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (v) => <span className="font-mono text-info text-xs">{String(v)}</span>,
    },
    {
      key: 'users.name',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="text-sm text-ink">{row.users?.name ?? '—'}</p>
          <p className="text-xs text-muted">{row.users?.phone ?? row.users?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'order_items',
      label: 'Items',
      render: (_, row) => <span className="text-sm text-body">{row.order_items.length}</span>,
    },
    {
      key: 'final_amount',
      label: 'Total',
      sortable: true,
      render: (v) => (
        <span className="text-sm font-medium text-ink">
          ₹{new Intl.NumberFormat('en-IN').format(Number(v))}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v)} size="sm" /> },
    { key: 'payment_status', label: 'Payment', render: (v) => <StatusBadge status={String(v)} size="sm" /> },
    {
      key: 'try_deadline',
      label: 'Try Window',
      render: (v, row) => {
        // The window is a minutes-scale rider wait — only meaningful while active.
        if (row.status !== 'try_window_active' || !v) return <span className="text-faint">—</span>;
        const minsLeft = Math.round((new Date(String(v)).getTime() - Date.now()) / 60000);
        return (
          <span className={`text-xs font-medium ${minsLeft <= 0 ? 'text-danger' : minsLeft <= 3 ? 'text-warn' : 'text-soft'}`}>
            {minsLeft > 0 ? `${minsLeft}m left` : 'Expired'}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (v) => (
        <span className="text-xs text-muted">
          {new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'all' ? orders.length : orders.filter((o) => o.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? 'bg-ink text-white'
                  : 'text-soft hover:text-ink hover:bg-cream'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.value ? 'bg-ink-soft text-white' : 'bg-hairline text-soft'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + payment filter + saved views */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search order #, name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-line rounded-lg px-3 py-1.5 text-sm text-ink placeholder-faint w-72 focus:outline-none focus:border-ink"
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs text-body focus:outline-none focus:border-ink"
        >
          {PAYMENT_FILTERS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'Payment: all' : `Payment: ${p.replace('_', ' ')}`}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          {views.map((v) => (
            <span key={v.name} className="group inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-body">
              <button onClick={() => applyView(v)} className="hover:text-ink">{v.name}</button>
              <button
                onClick={() => deleteView(v.name)}
                aria-label={`Delete view ${v.name}`}
                className="text-faint hover:text-danger"
              >
                ×
              </button>
            </span>
          ))}
          {savingView ? (
            <span className="inline-flex items-center gap-1">
              <input
                autoFocus
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCurrentView();
                  if (e.key === 'Escape') setSavingView(false);
                }}
                placeholder="View name…"
                className="w-28 rounded-lg border border-line bg-white px-2 py-1 text-[11px] text-ink focus:outline-none focus:border-ink"
              />
              <button onClick={saveCurrentView} className="rounded-lg bg-ink px-2 py-1 text-[11px] font-medium text-white">
                Save
              </button>
            </span>
          ) : (
            <button
              onClick={() => setSavingView(true)}
              className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[11px] font-medium text-soft hover:border-ink hover:text-ink"
            >
              + Save view
            </button>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-cream/60 px-3 py-2">
          <span className="text-xs font-semibold text-ink">{selected.size} selected</span>
          <button
            onClick={bulkConfirm}
            disabled={selectedPending.length === 0 || bulkBusy}
            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {bulkBusy ? 'Confirming…' : `Confirm pending (${selectedPending.length})`}
          </button>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-body hover:border-ink hover:text-ink"
          >
            Export CSV
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-soft hover:text-ink">
            Clear
          </button>
        </div>
      ) : null}

      <DataTable
        data={filtered}
        columns={columns}
        keyField="id"
        pageSize={25}
        emptyMessage="No orders found."
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
        selection={{
          selected,
          onToggle: (id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            }),
          onToggleAll: (ids, select) =>
            setSelected((prev) => {
              const next = new Set(prev);
              for (const id of ids) {
                if (select) next.add(id);
                else next.delete(id);
              }
              return next;
            }),
        }}
      />
    </div>
  );
}
