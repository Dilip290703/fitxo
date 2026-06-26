import { createClient } from '@fitzo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import { computeStorePayables } from './compute';
import PayoutsClient, { type StorePayableRow } from './PayoutsClient';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default async function PayoutsPage() {
  const supabase = await createClient();
  const payables = await computeStorePayables(supabase);

  const totalOutstanding = payables.reduce((s, p) => s + p.netOutstanding, 0);
  const totalPaid = payables.reduce((s, p) => s + p.totalPaid, 0);
  const commissionRate = payables[0]?.commissionRate ?? 15;

  // Strip the internal unpaid order list before passing to the client.
  const rows: StorePayableRow[] = payables.map(({ unpaid, ...rest }) => ({ ...rest, unpaidCount: unpaid.length }));

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-white">Store Payouts</h2>
        <p className="text-sm text-gray-500">Commission {commissionRate}% · settle kept-order revenue to stores</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Outstanding" value={formatINR(totalOutstanding)} subtitle="Net owed to stores" icon="₹" color="amber" />
        <StatsCard title="Paid to date" value={formatINR(totalPaid)} icon="✓" color="green" />
      </div>

      <PayoutsClient rows={rows} />
    </div>
  );
}
