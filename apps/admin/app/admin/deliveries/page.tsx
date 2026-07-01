import { createClient } from '@fitzo/supabase/server';
import DeliveriesClient from './DeliveriesClient';

type RiderRow = { id: string; is_available: boolean; users: { name: string; phone: string } | null };
type DeliveryRow = {
  id: string; order_id: string; rider_id: string | null; type: string; status: string;
  assigned_at: string | null; distance_km: number | null; estimated_minutes: number | null;
  orders: { order_number: string; status: string; users: { name: string; phone: string } | null } | null;
  riders: { id: string; users: { name: string; phone: string } | null } | null;
};

export default async function DeliveriesPage() {
  const supabase = await createClient();

  const [{ data: deliveries }, { data: riders }] = await Promise.all([
    supabase
      .from('deliveries')
      .select(`
        *,
        orders(order_number, status, users(name, phone)),
        riders(id, users(name, phone))
      `)
      .order('assigned_at', { ascending: false })
      .limit(100),
    supabase
      .from('riders')
      .select('id, is_available, users(name, phone)')
      .eq('is_verified', true),
  ]);

  const deliveryRows = (deliveries ?? []) as unknown as DeliveryRow[];
  const riderRows = (riders ?? []) as unknown as RiderRow[];

  const ridersOnline = riderRows.filter((r) => r.is_available).length;
  const waitingForRider = deliveryRows.filter(
    (d) => !d.rider_id && d.orders?.status === 'confirmed',
  ).length;

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Deliveries</h2>
          <p className="text-sm text-gray-500">{deliveries?.length ?? 0} deliveries</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            {ridersOnline} rider{ridersOnline === 1 ? '' : 's'} online
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
              waitingForRider > 0
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-gray-700 bg-gray-800 text-gray-400'
            }`}
          >
            🛵 {waitingForRider} waiting for a rider
          </span>
        </div>
      </div>
      <DeliveriesClient deliveries={deliveryRows} riders={riderRows} />
    </div>
  );
}
