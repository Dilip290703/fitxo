'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@fitxo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import StatusBadge from '@/components/admin/StatusBadge';
import DataTable, { Column } from '@/components/admin/DataTable';
import { logActivity } from '@/lib/activity';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import { buildQuery, type PageInfo } from '@/lib/pagination';
import {
  ORDER_STATUSES,
  PAYMENT_FILTERS,
  SEARCH_USER_LIMIT,
  EXPORT_LIMIT,
  buildSearchClause,
} from './filters';
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

const STATUS_LABELS: Record<string, string> = {
  all: 'All',
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for Delivery',
  try_window_active: 'Try Window',
  return_requested: 'Return Requested',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface SavedView {
  name: string;
  status: string;
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

export default function OrdersClient({
  orders,
  pageInfo,
  counts,
  activeStatus,
  activePayment,
  activeSearch,
}: {
  /** Exactly one page of rows — the filtering and slicing happened in the query. */
  orders: OrderRow[];
  pageInfo: PageInfo;
  counts: Record<string, number>;
  activeStatus: string;
  activePayment: string;
  activeSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const [selectedRows, setSelectedRows] = useState<Map<string, OrderRow>>(new Map());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Live list (audit §2.4). `router.refresh()` re-runs the CURRENT url, so a
  // polled refresh keeps the page, filters and sort the admin chose.
  useLiveRefresh({ paused: bulkBusy || exporting });

  // Every filter change is a URL change, because the query that reads them runs
  // on the server. Anything but a page change also returns to page 1.
  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/orders${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  // ── Search (debounced — one query per pause, not per keystroke) ───────────
  const [searchInput, setSearchInput] = useState(activeSearch);
  useEffect(() => setSearchInput(activeSearch), [activeSearch]);
  useEffect(() => {
    if (searchInput === activeSearch) return;
    const t = setTimeout(() => push({ q: searchInput || null }), 350);
    return () => clearTimeout(t);
  }, [searchInput, activeSearch, push]);

  // ── Saved views (localStorage — 2 users, no need for a table) ─────────────
  const [views, setViews] = useState<SavedView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  useEffect(() => setViews(loadViews()), []);

  const applyView = (v: SavedView) =>
    push({ status: v.status, payment: v.payment, q: v.search || null });

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    const next = [
      ...views.filter((v) => v.name !== name),
      { name, status: activeStatus, payment: activePayment, search: activeSearch },
    ];
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

  // ── Selection ────────────────────────────────────────────────────────────
  // Rows, not just ids: a selection now spans pages, so "confirm the pending
  // ones" cannot look up a status in a list that no longer holds every row.
  const selected = useMemo(() => new Set(selectedRows.keys()), [selectedRows]);
  const selectedList = useMemo(() => [...selectedRows.values()], [selectedRows]);
  const selectedPending = selectedList.filter((o) => o.status === 'pending');

  // A held selection goes stale when the 4s poll brings a changed row — the
  // order someone else just confirmed must stop counting as pending here.
  useEffect(() => {
    setSelectedRows((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const o of orders) {
        const held = next.get(o.id);
        if (held && held.status !== o.status) {
          next.set(o.id, o);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [orders]);

  const toggleRow = (id: string) =>
    setSelectedRows((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else {
        const row = orders.find((o) => o.id === id);
        if (row) next.set(id, row);
      }
      return next;
    });

  const toggleRows = (ids: string[], select: boolean) =>
    setSelectedRows((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        if (!select) next.delete(id);
        else {
          const row = orders.find((o) => o.id === id);
          if (row) next.set(id, row);
        }
      }
      return next;
    });

  // ── Bulk actions ─────────────────────────────────────────────────────────
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
    setSelectedRows(new Map());
    router.refresh();
  };

  /**
   * Export what the filters MATCH, not what is on screen. With the list paged
   * server-side the visible 25 rows are an arbitrary window, so the export
   * re-runs the same query unpaged (capped at EXPORT_LIMIT) — otherwise
   * "Export CSV" under a filter reading "412 matching" would hand over 25.
   */
  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows: OrderRow[];

      if (selectedList.length > 0) {
        rows = selectedList;
      } else {
        let userIds: string[] = [];
        if (activeSearch) {
          const { data: matched } = await supabase
            .from('users')
            .select('id')
            .or(`name.ilike.%${activeSearch}%,phone.ilike.%${activeSearch}%`)
            .limit(SEARCH_USER_LIMIT);
          userIds = (matched ?? []).map((u) => u.id);
        }

        let qb = supabase
          .from('orders')
          .select(`
            id, order_number, status, final_amount, payment_status, created_at, try_deadline,
            users(name, email, phone),
            order_items(id)
          `)
          .order(pageInfo.sortKey, { ascending: pageInfo.sortDir === 'asc' })
          .limit(EXPORT_LIMIT);

        if (activeStatus !== 'all') qb = qb.eq('status', activeStatus);
        if (activePayment !== 'all') qb = qb.eq('payment_status', activePayment);
        if (activeSearch) qb = qb.or(buildSearchClause(activeSearch, userIds));

        const { data, error } = await qb;
        if (error) {
          toast(error.message, 'error');
          return;
        }
        rows = (data ?? []) as unknown as OrderRow[];
        if (rows.length >= EXPORT_LIMIT) {
          toast(`Export capped at ${EXPORT_LIMIT} rows — narrow the filters for the rest.`, 'error');
        }
      }

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
    } finally {
      setExporting(false);
    }
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

  const tabs = ['all', ...ORDER_STATUSES];

  return (
    <div className="space-y-3">
      {/* Status tabs — counts come from the query and honour the other filters */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => push({ status: tab })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeStatus === tab ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
            }`}
          >
            {STATUS_LABELS[tab] ?? tab}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeStatus === tab ? 'bg-ink-soft text-white' : 'bg-hairline text-soft'}`}>
              {counts[tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + payment filter + saved views */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search order #, name or phone…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="bg-white border border-line rounded-lg px-3 py-1.5 text-sm text-ink placeholder-faint w-72 focus:outline-none focus:border-ink"
        />
        <select
          value={activePayment}
          onChange={(e) => push({ payment: e.target.value })}
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
            disabled={exporting}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-body hover:border-ink hover:text-ink disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={() => setSelectedRows(new Map())} className="text-xs text-soft hover:text-ink">
            Clear
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-body hover:border-ink hover:text-ink disabled:opacity-40"
          >
            {exporting ? 'Exporting…' : `Export CSV (${pageInfo.total})`}
          </button>
        </div>
      )}

      <DataTable
        data={orders}
        columns={columns}
        keyField="id"
        emptyMessage="No orders found."
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
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
        selection={{ selected, onToggle: toggleRow, onToggleAll: toggleRows }}
      />
    </div>
  );
}
