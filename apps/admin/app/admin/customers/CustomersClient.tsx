'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DataTable, { Column } from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';
import { buildQuery, type PageInfo } from '@/lib/pagination';

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_blocked: boolean;
  created_at: string;
  orders: { id: string; final_amount: number }[];
}

export default function CustomersClient({
  customers,
  pageInfo,
  activeFilter,
  activeSearch,
}: {
  /** One page of rows — filtering, sorting and slicing all happened in the query. */
  customers: Customer[];
  pageInfo: PageInfo;
  activeFilter: string;
  activeSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/customers${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Debounced so typing is one query per pause, not one per keystroke.
  const [search, setSearch] = useState(activeSearch);
  useEffect(() => setSearch(activeSearch), [activeSearch]);
  useEffect(() => {
    if (search === activeSearch) return;
    const t = setTimeout(() => push({ q: search || null }), 350);
    return () => clearTimeout(t);
  }, [search, activeSearch, push]);

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      label: 'Customer',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="text-sm font-medium text-ink">{row.name ?? '—'}</p>
          <p className="text-xs text-muted">{row.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-sm text-body">{String(v || '—')}</span> },
    {
      // Not sortable: this is the length of an embedded array, so the database
      // has nothing to ORDER BY. A header that sorted only the visible page
      // would be the same lie the paging fix removes.
      key: 'orders',
      label: 'Orders',
      render: (_, row) => <span className="text-sm text-body">{row.orders.length}</span>,
    },
    {
      key: 'orders',
      label: 'Total Spent',
      render: (_, row) => (
        <span className="text-sm text-body">
          ₹{new Intl.NumberFormat('en-IN').format(row.orders.reduce((s, o) => s + (o.final_amount ?? 0), 0))}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (v) => <span className="text-xs text-muted">{new Date(String(v)).toLocaleDateString('en-IN')}</span>,
    },
    {
      key: 'is_blocked',
      label: 'Status',
      render: (_, row) => (
        row.is_blocked
          ? <StatusBadge status="cancelled" size="sm" />
          : <StatusBadge status={row.is_active ? 'active' : 'inactive'} size="sm" />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-faint w-72"
        />
        {(['all', 'active', 'blocked'] as const).map((f) => (
          <button
            key={f}
            onClick={() => push({ filter: f })}
            className={`px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors ${
              activeFilter === f ? 'bg-ink text-white' : 'text-soft hover:text-ink border border-line'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <DataTable
        data={customers}
        columns={columns}
        keyField="id"
        emptyMessage="No customers found."
        onRowClick={(row) => router.push(`/admin/customers/${row.id}`)}
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
    </div>
  );
}
