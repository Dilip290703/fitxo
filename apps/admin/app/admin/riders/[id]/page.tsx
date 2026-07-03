import { createClient } from '@fitzo/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import RiderActions from './RiderActions';

export default async function RiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: rider }, { data: deliveries }] = await Promise.all([
    supabase.from('riders').select('*, users(*)').eq('id', id).single(),
    supabase.from('deliveries').select('*, orders(order_number, status)').eq('rider_id', id).order('assigned_at', { ascending: false }).limit(20),
  ]);

  if (!rider) notFound();

  const user = rider.users as { name: string; email: string; phone: string; created_at: string };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/riders" className="text-sm text-muted hover:text-ink">← Riders</Link>
        <span className="text-faint">/</span>
        <h2 className="text-xl font-bold text-ink">{user?.name ?? 'Rider'}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-white border border-line rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-xl text-white font-bold">
                {user?.name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-ink">{user?.name}</p>
                <p className="text-xs text-muted">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-soft">Phone</span><span className="text-body">{user?.phone ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-soft">Vehicle</span><span className="text-body capitalize">{rider.vehicle_type}</span></div>
              <div className="flex justify-between"><span className="text-soft">Vehicle #</span><span className="text-body">{rider.vehicle_number ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-soft">Total Deliveries</span><span className="text-ink font-medium">{rider.total_deliveries}</span></div>
              <div className="flex justify-between"><span className="text-soft">Rating</span><span className="text-warn">★ {rider.rating?.toFixed(1) ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-soft">Available</span><StatusBadge status={rider.is_available ? 'active' : 'inactive'} size="sm" /></div>
              <div className="flex justify-between"><span className="text-soft">Verified</span>{rider.is_verified ? <span className="text-success text-xs">✓ Yes</span> : <span className="text-muted text-xs">No</span>}</div>
              <div className="flex justify-between"><span className="text-soft">Member since</span><span className="text-muted text-xs">{new Date(user?.created_at).toLocaleDateString('en-IN')}</span></div>
            </div>
          </div>
          <RiderActions rider={rider} />
        </div>

        <div className="lg:col-span-2 bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Delivery History</h3>
          {deliveries && deliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-soft">
                    <th className="text-left pb-2 font-medium">Order</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-hairline">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/orders/${d.order_id}`} className="text-info hover:text-ink font-mono text-xs">
                          {(d.orders as {order_number: string; status: string})?.order_number}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-body capitalize text-xs">{d.type.replace('_', ' ')}</td>
                      <td className="py-2 pr-3"><StatusBadge status={d.status} size="sm" /></td>
                      <td className="py-2 text-muted text-xs">
                        {d.assigned_at ? new Date(d.assigned_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">No deliveries yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
