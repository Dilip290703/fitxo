import { createClient } from '@fitzo/supabase/server';
import TryReturnClient from './TryReturnClient';

export default async function TryAnalyticsPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ data: sessions }, { data: decisions }, { data: returns }] = await Promise.all([
    supabase.from('try_sessions').select('status, started_at'),
    supabase.from('order_items').select('decision, decision_at'),
    supabase.from('returns').select('condition'),
  ]);

  // Try-session status breakdown
  const sessionCounts = { active: 0, completed: 0, expired: 0 };
  let sessions30 = 0;
  for (const s of sessions ?? []) {
    if (s.status in sessionCounts) sessionCounts[s.status as keyof typeof sessionCounts] += 1;
    if (s.started_at && s.started_at >= thirtyDaysAgo) sessions30 += 1;
  }
  const totalSessions = (sessions ?? []).length;

  // Keep / return / pending decisions
  const decisionCounts = { keep: 0, return: 0, pending: 0 };
  const dailyMap: Record<string, { date: string; keep: number; return: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dailyMap[d.toISOString().slice(0, 10)] = {
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      keep: 0,
      return: 0,
    };
  }
  for (const it of decisions ?? []) {
    const dec = (it.decision ?? 'pending') as keyof typeof decisionCounts;
    if (dec in decisionCounts) decisionCounts[dec] += 1;
    if (it.decision_at && (it.decision === 'keep' || it.decision === 'return')) {
      const key = it.decision_at.slice(0, 10);
      if (dailyMap[key]) dailyMap[key][it.decision as 'keep' | 'return'] += 1;
    }
  }
  const decided = decisionCounts.keep + decisionCounts.return;
  const keepRate = decided > 0 ? Math.round((decisionCounts.keep / decided) * 100) : 0;
  const returnRate = decided > 0 ? Math.round((decisionCounts.return / decided) * 100) : 0;

  // Returns by condition
  const conditionMap: Record<string, number> = {};
  for (const r of returns ?? []) {
    const c = r.condition ?? 'good';
    conditionMap[c] = (conditionMap[c] ?? 0) + 1;
  }
  const conditions = Object.entries(conditionMap)
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-white">Try &amp; Return Analytics</h2>
        <p className="text-sm text-gray-500">Doorstep try-on outcomes across all orders</p>
      </div>
      <TryReturnClient
        totalSessions={totalSessions}
        sessions30={sessions30}
        sessionCounts={sessionCounts}
        decisionCounts={decisionCounts}
        keepRate={keepRate}
        returnRate={returnRate}
        dailyData={Object.values(dailyMap)}
        conditions={conditions}
      />
    </div>
  );
}
