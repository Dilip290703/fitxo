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
        <h2 className="text-xl font-bold text-ink">Riders</h2>
        <p className="text-sm text-muted">{riders?.length ?? 0} riders</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              {['Rider', 'Phone', 'Vehicle', 'Deliveries', 'Rating', 'Available', 'Verified', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riders?.map((rider) => (
              <tr key={rider.id} className="border-b border-hairline hover:bg-cream">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-ink">{(rider.users as {name:string; email:string; phone:string})?.name ?? '—'}</p>
                    <p className="text-xs text-muted">{(rider.users as {name:string; email:string; phone:string})?.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-body">{(rider.users as {name:string; email:string; phone:string})?.phone ?? '—'}</td>
                <td className="px-4 py-3 text-body capitalize">{rider.vehicle_type}</td>
                <td className="px-4 py-3 text-body">{rider.total_deliveries}</td>
                <td className="px-4 py-3 text-warn">★ {rider.rating?.toFixed(1) ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={rider.is_available ? 'active' : 'inactive'} size="sm" />
                </td>
                <td className="px-4 py-3">
                  {rider.is_verified
                    ? <span className="text-success text-xs">✓ Verified</span>
                    : <span className="text-muted text-xs">Pending</span>}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/riders/${rider.id}`} className="text-xs text-info hover:text-ink">View</Link>
                </td>
              </tr>
            ))}
            {(!riders || riders.length === 0) && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">No riders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
