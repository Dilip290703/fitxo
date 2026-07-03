'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataTable, { Column } from '@/components/admin/DataTable';
import StatusBadge from '@/components/admin/StatusBadge';

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

export default function CustomersClient({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (filter === 'blocked' && !c.is_blocked) return false;
      if (filter === 'active' && (c.is_blocked || !c.is_active)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(c.name ?? '').toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !(c.phone ?? '').includes(q)) return false;
      }
      return true;
    });
  }, [customers, search, filter]);

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
      key: 'orders',
      label: 'Orders',
      sortable: true,
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
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors ${
              filter === f ? 'bg-ink text-white' : 'text-soft hover:text-ink border border-line'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        keyField="id"
        pageSize={25}
        emptyMessage="No customers found."
        onRowClick={(row) => router.push(`/admin/customers/${row.id}`)}
      />
    </div>
  );
}
