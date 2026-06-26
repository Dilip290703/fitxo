import { createClient } from '@fitzo/supabase/server';
import LiveMapClient, { type LiveDelivery } from './LiveMapClient';

const ACTIVE_STATUSES = ['assigned', 'accepted', 'picked_up', 'en_route', 'arrived'];

export default async function LiveMapPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('deliveries')
    .select('id, status, order_id, drop_address, orders(order_number, status, users(name, phone)), riders(users(name, phone))')
    .in('status', ACTIVE_STATUSES)
    .order('assigned_at', { ascending: false })
    .limit(60);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deliveries: LiveDelivery[] = (data ?? []).map((d: any) => {
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

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-white">Live Deliveries Map</h2>
        <p className="text-sm text-gray-500">Active deliveries on the road, updating in real time</p>
      </div>
      <LiveMapClient initial={deliveries} />
    </div>
  );
}
