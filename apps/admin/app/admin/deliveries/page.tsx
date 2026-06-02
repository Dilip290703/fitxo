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

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-white">Deliveries</h2>
        <p className="text-sm text-gray-500">{deliveries?.length ?? 0} deliveries</p>
      </div>
      <DeliveriesClient
        deliveries={(deliveries ?? []) as unknown as DeliveryRow[]}
        riders={(riders ?? []) as unknown as RiderRow[]}
      />
    </div>
  );
}
