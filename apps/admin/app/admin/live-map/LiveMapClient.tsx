'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@fitzo/supabase/client';

export interface LiveDelivery {
  id: string;
  status: string;
  orderNumber: string;
  address: {
    line1?: string; line2?: string; landmark?: string;
    city?: string; state?: string; pincode?: string;
  };
  riderName: string | null;
  customerName: string | null;
}

const ACTIVE_STATUSES = ['assigned', 'accepted', 'picked_up', 'en_route', 'arrived'];

const STATUS_STYLE: Record<string, string> = {
  assigned: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  accepted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  picked_up: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  en_route: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  arrived: 'bg-green-500/15 text-green-300 border-green-500/30',
};

function addressLine(a: LiveDelivery['address']) {
  return [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}

// Keyless Google Maps embed — accepts a free-text query (no API key required).
function mapSrc(a: LiveDelivery['address']) {
  const q = addressLine(a) || 'India';
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=13&output=embed`;
}

export default function LiveMapClient({ initial }: { initial: LiveDelivery[] }) {
  const [deliveries, setDeliveries] = useState<LiveDelivery[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('deliveries')
      .select('id, status, order_id, drop_address, orders(order_number, status, users(name, phone)), riders(users(name, phone))')
      .in('status', ACTIVE_STATUSES)
      .order('assigned_at', { ascending: false })
      .limit(60);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: LiveDelivery[] = (data ?? []).map((d: any) => {
      const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
      const rider = Array.isArray(d.riders) ? d.riders[0] : d.riders;
      const riderUser = rider ? (Array.isArray(rider.users) ? rider.users[0] : rider.users) : null;
      const customer = order ? (Array.isArray(order.users) ? order.users[0] : order.users) : null;
      return {
        id: d.id,
        status: d.status,
        orderNumber: order?.order_number ?? 'Order',
        address: d.drop_address ?? {},
        riderName: riderUser?.name ?? null,
        customerName: customer?.name ?? null,
      };
    });
    setDeliveries(rows);
    setSelectedId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? null));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-live-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const selected = deliveries.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
      {/* List */}
      <div className="rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">On the road</span>
          <span className="text-xs text-gray-500">{deliveries.length} active</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-700/50">
          {deliveries.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-gray-500">No active deliveries right now.</p>
          ) : (
            deliveries.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  d.id === selectedId ? 'bg-indigo-600/15' : 'hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] font-semibold text-white truncate">{d.orderNumber}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLE[d.status] ?? 'bg-gray-500/15 text-gray-300 border-gray-500/30'}`}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-400 truncate">
                  🛵 {d.riderName ?? 'Unassigned'} → {d.customerName ?? 'Customer'}
                </p>
                <p className="text-[11px] text-gray-500 truncate">{addressLine(d.address) || 'No address'}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Map */}
      <div className="rounded-xl border border-gray-700 overflow-hidden bg-gray-800 min-h-[60vh] flex flex-col">
        {selected ? (
          <>
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[13px] font-semibold text-white truncate">{selected.orderNumber}</p>
                <p className="text-[11px] text-gray-400 truncate">{addressLine(selected.address) || 'No address on file'}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize ${STATUS_STYLE[selected.status] ?? ''}`}>
                {selected.status.replace('_', ' ')}
              </span>
            </div>
            <iframe
              key={selected.id}
              title="Delivery location"
              src={mapSrc(selected.address)}
              className="flex-1 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-gray-500">
            Select a delivery to see it on the map.
          </div>
        )}
      </div>
    </div>
  );
}
