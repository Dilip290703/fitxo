'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import StatusBadge from '@/components/admin/StatusBadge';
import { logActivity } from '@/lib/activity';

interface Rider {
  id: string;
  is_available: boolean;
  users: { name: string; phone: string } | null;
}

interface Delivery {
  id: string;
  order_id: string;
  rider_id: string | null;
  type: string;
  status: string;
  assigned_at: string | null;
  distance_km: number | null;
  estimated_minutes: number | null;
  orders: { order_number: string; status: string; users: { name: string; phone: string } | null } | null;
  riders: { id: string; users: { name: string; phone: string } | null } | null;
}

export default function DeliveriesClient({ deliveries, riders }: { deliveries: Delivery[]; riders: Rider[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});

  const activeDeliveries = deliveries.filter((d) => !['completed', 'failed'].includes(d.status));
  const unassigned = activeDeliveries.filter((d) => !d.rider_id);
  const assigned = activeDeliveries.filter((d) => d.rider_id);

  const assignRider = async (deliveryId: string) => {
    const riderId = selectedRiders[deliveryId];
    if (!riderId) return;
    setAssigning(deliveryId);
    const { error } = await supabase.from('deliveries').update({ rider_id: riderId }).eq('id', deliveryId);
    setAssigning(null);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Assigned rider to delivery', entity_type: 'delivery', entity_id: deliveryId, new_value: { rider_id: riderId } });
      toast('Rider assigned!', 'success'); router.refresh();
    }
  };

  const availableRiders = riders.filter((r) => r.is_available);

  return (
    <div className="space-y-6">
      {/* Unassigned */}
      <div>
        <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full" />
          Unassigned Deliveries ({unassigned.length})
        </h3>
        {unassigned.length === 0 ? (
          <p className="text-sm text-gray-500 pl-4">All deliveries are assigned ✓</p>
        ) : (
          <div className="space-y-2">
            {unassigned.map((d) => (
              <div key={d.id} className="bg-gray-800 border border-amber-700/40 rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/orders/${d.order_id}`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                    {d.orders?.order_number ?? d.order_id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{d.orders?.users?.name ?? '—'} · {d.type.replace('_', ' ')}</p>
                </div>
                <StatusBadge status={d.status} size="sm" />
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRiders[d.id] ?? ''}
                    onChange={(e) => setSelectedRiders((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white"
                  >
                    <option value="">Select rider…</option>
                    {availableRiders.map((r) => (
                      <option key={r.id} value={r.id}>{r.users?.name ?? r.id.slice(0, 8)}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignRider(d.id)}
                    disabled={!selectedRiders[d.id] || assigning === d.id}
                    className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg"
                  >
                    {assigning === d.id ? '…' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active/assigned */}
      <div>
        <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Active Deliveries ({assigned.length})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50 text-xs text-gray-400">
                <th className="px-4 py-3 text-left font-medium">Order</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Rider</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Distance</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((d) => (
                <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${d.order_id}`} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs">
                      {d.orders?.order_number ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{d.orders?.users?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300 capitalize text-xs">{d.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-gray-300">{d.riders?.users?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} size="sm" /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {d.distance_km ? `${d.distance_km} km` : '—'}
                    {d.estimated_minutes ? ` · ~${d.estimated_minutes}m` : ''}
                  </td>
                </tr>
              ))}
              {assigned.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No active deliveries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
