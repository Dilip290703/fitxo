import { createClient } from '@/lib/supabase/server';
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
        <Link href="/admin/riders" className="text-sm text-gray-500 hover:text-white">← Riders</Link>
        <span className="text-gray-700">/</span>
        <h2 className="text-xl font-bold text-white">{user?.name ?? 'Rider'}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl text-white font-bold">
                {user?.name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-white">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Phone</span><span className="text-gray-300">{user?.phone ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Vehicle</span><span className="text-gray-300 capitalize">{rider.vehicle_type}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Vehicle #</span><span className="text-gray-300">{rider.vehicle_number ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total Deliveries</span><span className="text-white font-medium">{rider.total_deliveries}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Rating</span><span className="text-amber-400">★ {rider.rating?.toFixed(1) ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Available</span><StatusBadge status={rider.is_available ? 'active' : 'inactive'} size="sm" /></div>
              <div className="flex justify-between"><span className="text-gray-400">Verified</span>{rider.is_verified ? <span className="text-green-400 text-xs">✓ Yes</span> : <span className="text-gray-500 text-xs">No</span>}</div>
              <div className="flex justify-between"><span className="text-gray-400">Member since</span><span className="text-gray-500 text-xs">{new Date(user?.created_at).toLocaleDateString('en-IN')}</span></div>
            </div>
          </div>
          <RiderActions rider={rider} />
        </div>

        <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Delivery History</h3>
          {deliveries && deliveries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400">
                    <th className="text-left pb-2 font-medium">Order</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-gray-700/50">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/orders/${d.order_id}`} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs">
                          {(d.orders as {order_number: string; status: string})?.order_number}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-gray-300 capitalize text-xs">{d.type.replace('_', ' ')}</td>
                      <td className="py-2 pr-3"><StatusBadge status={d.status} size="sm" /></td>
                      <td className="py-2 text-gray-500 text-xs">
                        {d.assigned_at ? new Date(d.assigned_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No deliveries yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
