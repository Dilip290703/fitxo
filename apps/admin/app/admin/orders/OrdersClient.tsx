'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';
import DataTable, { Column } from '@/components/admin/DataTable';
import type { OrderStatus } from '@fitzo/supabase/types';

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

export default function OrdersClient({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab !== 'all' && o.status !== activeTab) return false;
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
  }, [orders, activeTab, search]);

  const columns: Column<OrderRow>[] = [
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (v) => <span className="font-mono text-indigo-400 text-xs">{String(v)}</span>,
    },
    {
      key: 'users.name',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <p className="text-sm text-white">{row.users?.name ?? '—'}</p>
          <p className="text-xs text-gray-500">{row.users?.phone ?? row.users?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'order_items',
      label: 'Items',
      render: (_, row) => <span className="text-sm text-gray-300">{row.order_items.length}</span>,
    },
    {
      key: 'final_amount',
      label: 'Total',
      sortable: true,
      render: (v) => (
        <span className="text-sm font-medium text-white">
          ₹{new Intl.NumberFormat('en-IN').format(Number(v))}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={String(v)} size="sm" /> },
    { key: 'payment_status', label: 'Payment', render: (v) => <StatusBadge status={String(v)} size="sm" /> },
    {
      key: 'try_deadline',
      label: 'Try Deadline',
      render: (v) => {
        if (!v) return <span className="text-gray-600">—</span>;
        const deadline = new Date(String(v));
        const now = new Date();
        const hoursLeft = Math.round((deadline.getTime() - now.getTime()) / 3600000);
        return (
          <span className={`text-xs ${hoursLeft < 3 ? 'text-red-400' : hoursLeft < 8 ? 'text-amber-400' : 'text-gray-400'}`}>
            {hoursLeft > 0 ? `${hoursLeft}h left` : 'Expired'}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (v) => (
        <span className="text-xs text-gray-500">
          {new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'all' ? orders.length : orders.filter((o) => o.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.value ? 'bg-indigo-500' : 'bg-gray-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by order #, customer name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 w-80"
      />

      <DataTable
        data={filtered}
        columns={columns}
        keyField="id"
        pageSize={25}
        emptyMessage="No orders found."
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
      />
    </div>
  );
}
