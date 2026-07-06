/**
 * Shared (server-safe) helpers for the Active Deliveries list. Deliberately
 * NOT in the 'use client' component file: the dashboard server component
 * calls mapRow() during SSR, and functions exported from a client module
 * can't be invoked on the server.
 */

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

export const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'en_route', 'arrived'];

export const ACTIVE_DELIVERY_SELECT =
  'id, status, order_id, drop_address, orders(order_number, users(name, phone)), riders(users(name, phone))';

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
