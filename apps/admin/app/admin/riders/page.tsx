import { createClient } from '@fitzo/supabase/server';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';

export default async function RidersPage() {
  const supabase = await createClient();

  const { data: riders } = await supabase
    .from('riders')
    .select('*, users(name, email, phone)')
    .order('total_deliveries', { ascending: false });

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-white">Riders</h2>
        <p className="text-sm text-gray-500">{riders?.length ?? 0} riders</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              {['Rider', 'Phone', 'Vehicle', 'Deliveries', 'Rating', 'Available', 'Verified', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riders?.map((rider) => (
              <tr key={rider.id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{(rider.users as {name:string; email:string; phone:string})?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{(rider.users as {name:string; email:string; phone:string})?.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{(rider.users as {name:string; email:string; phone:string})?.phone ?? '—'}</td>
                <td className="px-4 py-3 text-gray-300 capitalize">{rider.vehicle_type}</td>
                <td className="px-4 py-3 text-gray-300">{rider.total_deliveries}</td>
                <td className="px-4 py-3 text-amber-400">★ {rider.rating?.toFixed(1) ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={rider.is_available ? 'active' : 'inactive'} size="sm" />
                </td>
                <td className="px-4 py-3">
                  {rider.is_verified
                    ? <span className="text-green-400 text-xs">✓ Verified</span>
                    : <span className="text-gray-500 text-xs">Pending</span>}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/riders/${rider.id}`} className="text-xs text-indigo-400 hover:text-indigo-300">View</Link>
                </td>
              </tr>
            ))}
            {(!riders || riders.length === 0) && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No riders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
