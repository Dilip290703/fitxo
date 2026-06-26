import { createClient } from '@fitzo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import { computeAgentPayables } from './compute';
import AgentPayoutsClient, { type AgentPayableRow } from './AgentPayoutsClient';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default async function AgentPayoutsPage() {
  const supabase = await createClient();
  const payables = await computeAgentPayables(supabase);

  const totalOutstanding = payables.reduce((s, p) => s + p.netOutstanding, 0);
  const totalPaid = payables.reduce((s, p) => s + p.totalPaid, 0);

  // Strip the internal unpaid order list before passing to the client.
  const rows: AgentPayableRow[] = payables.map(({ unpaid, ...rest }) => ({ ...rest, unpaidCount: unpaid.length }));

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-white">Agent Payouts</h2>
        <p className="text-sm text-gray-500">Settle rider earnings — the delivery fee per completed job</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Outstanding" value={formatINR(totalOutstanding)} subtitle="Net owed to riders" icon="₹" color="amber" />
        <StatsCard title="Paid to date" value={formatINR(totalPaid)} icon="✓" color="green" />
      </div>

      <AgentPayoutsClient rows={rows} />
    </div>
  );
}
