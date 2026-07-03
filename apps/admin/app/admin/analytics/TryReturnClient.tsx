'use client';

import StatsCard from '@/components/admin/StatsCard';

interface Props {
  totalSessions: number;
  sessions30: number;
  sessionCounts: { active: number; completed: number; expired: number };
  decisionCounts: { keep: number; return: number; pending: number };
  keepRate: number;
  returnRate: number;
  dailyData: { date: string; keep: number; return: number }[];
  conditions: { condition: string; count: number }[];
}

const CONDITION_COLOR: Record<string, string> = {
  good: 'bg-green-500',
  damaged: 'bg-red-500',
  used: 'bg-amber-500',
  defective: 'bg-orange-500',
};

export default function TryReturnClient({
  totalSessions,
  sessions30,
  sessionCounts,
  decisionCounts,
  keepRate,
  returnRate,
  dailyData,
  conditions,
}: Props) {
  const maxDaily = Math.max(1, ...dailyData.map((d) => d.keep + d.return));
  const totalReturns = conditions.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Try sessions" value={totalSessions} subtitle={`${sessions30} in last 30 days`} icon="👕" color="indigo" />
        <StatsCard title="Active now" value={sessionCounts.active} subtitle="Customers trying on" icon="⏱" color="blue" />
        <StatsCard title="Keep rate" value={`${keepRate}%`} subtitle={`${decisionCounts.keep} items kept`} icon="✅" color="green" />
        <StatsCard title="Return rate" value={`${returnRate}%`} subtitle={`${decisionCounts.return} items returned`} icon="↩️" color="amber" />
      </div>

      {/* Keep vs return split */}
      <div className="bg-white border border-line rounded-xl p-5">
        <h3 className="text-sm font-semibold text-ink mb-3">Keep vs Return</h3>
        {decisionCounts.keep + decisionCounts.return === 0 ? (
          <p className="text-sm text-muted">No decided items yet.</p>
        ) : (
          <>
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              <div className="bg-green-500" style={{ width: `${keepRate}%` }} />
              <div className="bg-amber-500" style={{ width: `${returnRate}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-soft">
              <span>✅ Kept {decisionCounts.keep} ({keepRate}%)</span>
              <span>↩️ Returned {decisionCounts.return} ({returnRate}%)</span>
            </div>
            {decisionCounts.pending > 0 && (
              <p className="mt-2 text-xs text-muted">{decisionCounts.pending} item(s) still pending a decision.</p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily decisions */}
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Decisions · last 30 days</h3>
          <div className="flex items-end gap-1 h-40">
            {dailyData.map((d, i) => {
              const total = d.keep + d.return;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-0.5 group relative" title={`${d.date}: ${d.keep} kept, ${d.return} returned`}>
                  <div className="w-full flex flex-col justify-end" style={{ height: `${(total / maxDaily) * 100}%` }}>
                    <div className="w-full bg-amber-500 rounded-t-sm" style={{ height: `${total ? (d.return / total) * 100 : 0}%` }} />
                    <div className="w-full bg-green-500" style={{ height: `${total ? (d.keep / total) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-soft">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Kept</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Returned</span>
          </div>
        </div>

        {/* Returns by condition */}
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Returns by condition</h3>
          {conditions.length === 0 ? (
            <p className="text-sm text-muted">No returns recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {conditions.map((c) => {
                const pct = totalReturns > 0 ? Math.round((c.count / totalReturns) * 100) : 0;
                return (
                  <div key={c.condition}>
                    <div className="flex justify-between text-xs text-body mb-1">
                      <span className="capitalize">{c.condition}</span>
                      <span className="text-muted">{c.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-sand overflow-hidden">
                      <div className={`h-full rounded-full ${CONDITION_COLOR[c.condition] ?? 'bg-ink-soft'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Session lifecycle */}
      <div className="grid grid-cols-3 gap-4">
        <StatsCard title="Completed" value={sessionCounts.completed} subtitle="All items decided" icon="✓" color="green" />
        <StatsCard title="Active" value={sessionCounts.active} subtitle="In the try window" icon="⏱" color="blue" />
        <StatsCard title="Expired" value={sessionCounts.expired} subtitle="Window ran out" icon="⌛" color="red" />
      </div>
    </div>
  );
}
