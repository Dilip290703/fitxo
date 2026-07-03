'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@fitzo/supabase/client';
import StatusBadge from '@/components/admin/StatusBadge';

export interface ActiveDelivery {
  id: string;
  status: string;
  orderId: string;
  orderNumber: string;
  riderName: string | null;
  riderPhone: string | null;
  customerName: string | null;
  customerPhone: string | null;
  area: string;
  mapsQuery: string;
}

const ACTIVE_STATUSES = ['assigned', 'accepted', 'picked_up', 'en_route', 'arrived'];

type Address = {
  line1?: string; line2?: string; landmark?: string;
  city?: string; state?: string; pincode?: string;
};

function shortArea(a: Address | null | undefined) {
  if (!a) return '—';
  return [a.landmark ?? a.line2 ?? a.line1, a.city, a.pincode].filter(Boolean).join(', ') || '—';
}

function fullAddress(a: Address | null | undefined) {
  if (!a) return '';
  return [a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRow(d: any): ActiveDelivery {
  const order = Array.isArray(d.orders) ? d.orders[0] : d.orders;
  const rider = Array.isArray(d.riders) ? d.riders[0] : d.riders;
  const riderUser = rider ? (Array.isArray(rider.users) ? rider.users[0] : rider.users) : null;
  const customer = order ? (Array.isArray(order.users) ? order.users[0] : order.users) : null;
  return {
    id: d.id,
    status: d.status,
    orderId: d.order_id,
    orderNumber: order?.order_number ?? 'Order',
    riderName: riderUser?.name ?? null,
    riderPhone: riderUser?.phone ?? null,
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    area: shortArea(d.drop_address),
    mapsQuery: fullAddress(d.drop_address),
  };
}

export const ACTIVE_DELIVERY_SELECT =
  'id, status, order_id, drop_address, orders(order_number, users(name, phone)), riders(users(name, phone))';

/**
 * The Live Map's replacement: a plain realtime list. With 1–2 riders a
 * multi-agent map is noise — a row per delivery with tap-to-call and a
 * "Map" link (opens Google Maps) covers the real need.
 */
export default function ActiveDeliveries({ initial }: { initial: ActiveDelivery[] }) {
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>(initial);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('deliveries')
      .select(ACTIVE_DELIVERY_SELECT)
      .in('status', ACTIVE_STATUSES)
      .order('assigned_at', { ascending: false })
      .limit(20);
    setDeliveries((data ?? []).map(mapRow));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-active-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-ink">Active deliveries</h3>
        <span className="text-[11px] text-muted">{deliveries.length} on the road</span>
      </div>
      {deliveries.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted">No deliveries on the road right now.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {deliveries.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
              <Link
                href={`/admin/orders/${d.orderId}`}
                className="w-[130px] shrink-0 font-mono text-[12px] font-semibold text-info hover:text-ink"
              >
                {d.orderNumber}
              </Link>
              <div className="w-[150px] min-w-0 shrink-0">
                <p className="truncate text-[12px] text-ink">{d.riderName ?? 'Unassigned'}</p>
                {d.riderPhone ? (
                  <a href={`tel:${d.riderPhone}`} className="text-[11px] text-info hover:text-ink">
                    {d.riderPhone}
                  </a>
                ) : (
                  <span className="text-[11px] text-faint">rider</span>
                )}
              </div>
              <div className="w-[150px] min-w-0 shrink-0">
                <p className="truncate text-[12px] text-ink">{d.customerName ?? '—'}</p>
                {d.customerPhone ? (
                  <a href={`tel:${d.customerPhone}`} className="text-[11px] text-info hover:text-ink">
                    {d.customerPhone}
                  </a>
                ) : (
                  <span className="text-[11px] text-faint">customer</span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-[12px] text-soft" title={d.mapsQuery}>
                {d.area}
              </p>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <StatusBadge status={d.status} size="sm" />
                {d.mapsQuery ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(d.mapsQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-soft hover:border-line-strong hover:text-ink"
                  >
                    Map ↗
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
