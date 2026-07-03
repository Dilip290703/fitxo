import { createClient } from '@fitzo/supabase/server';
import AnalyticsClient from './AnalyticsClient';
import TryReturnClient from './TryReturnClient';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    { data: revenueData },
    { data: topProducts },
    { data: returnData },
    { data: keepData },
    { data: sessions },
    { data: decisions },
    { data: returns },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('created_at, final_amount, status')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),
    supabase
      .from('order_items')
      .select('product_id, product_name, decision')
      .gte('decision_at', thirtyDaysAgo),
    supabase
      .from('order_items')
      .select('id')
      .eq('decision', 'return')
      .gte('decision_at', thirtyDaysAgo),
    supabase
      .from('order_items')
      .select('id')
      .eq('decision', 'keep')
      .gte('decision_at', thirtyDaysAgo),
    // Try & Return section (merged from the former standalone screen)
    supabase.from('try_sessions').select('status, started_at'),
    supabase.from('order_items').select('decision, decision_at'),
    supabase.from('returns').select('condition'),
  ]);

  // Build daily chart data (last 30 days)
  const dailyMap: Record<string, { date: string; orders: number; revenue: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), orders: 0, revenue: 0 };
  }
  revenueData?.forEach((o) => {
    const key = o.created_at.slice(0, 10);
    if (dailyMap[key]) {
      dailyMap[key].orders += 1;
      dailyMap[key].revenue += o.final_amount ?? 0;
    }
  });
  const dailyChartData = Object.values(dailyMap);

  // Top products
  const productMap: Record<string, { name: string; orders: number; kept: number }> = {};
  topProducts?.forEach((item) => {
    if (!productMap[item.product_id]) {
      productMap[item.product_id] = { name: item.product_name, orders: 0, kept: 0 };
    }
    productMap[item.product_id].orders += 1;
    if (item.decision === 'keep') productMap[item.product_id].kept += 1;
  });
  const topProductsList = Object.values(productMap)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  const totalDecided = (returnData?.length ?? 0) + (keepData?.length ?? 0);
  const keepRate = totalDecided > 0 ? Math.round(((keepData?.length ?? 0) / totalDecided) * 100) : 0;
  const returnRate = totalDecided > 0 ? Math.round(((returnData?.length ?? 0) / totalDecided) * 100) : 0;

  const totalRevenue = revenueData?.reduce((s, o) => s + (o.final_amount ?? 0), 0) ?? 0;
  const completedOrders = revenueData?.filter((o) => o.status === 'completed').length ?? 0;

  // ── Try & Return section (merged from the former /admin/try-analytics) ──
  const sessionCounts = { active: 0, completed: 0, expired: 0 };
  let sessions30 = 0;
  for (const s of sessions ?? []) {
    if (s.status in sessionCounts) sessionCounts[s.status as keyof typeof sessionCounts] += 1;
    if (s.started_at && s.started_at >= thirtyDaysAgo) sessions30 += 1;
  }
  const totalSessions = (sessions ?? []).length;

  const decisionCounts = { keep: 0, return: 0, pending: 0 };
  const tryDailyMap: Record<string, { date: string; keep: number; return: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    tryDailyMap[d.toISOString().slice(0, 10)] = {
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
      if (tryDailyMap[key]) tryDailyMap[key][it.decision as 'keep' | 'return'] += 1;
    }
  }
  const decidedAll = decisionCounts.keep + decisionCounts.return;
  const keepRateAll = decidedAll > 0 ? Math.round((decisionCounts.keep / decidedAll) * 100) : 0;
  const returnRateAll = decidedAll > 0 ? Math.round((decisionCounts.return / decidedAll) * 100) : 0;

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
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <p className="text-sm text-gray-500">Last 30 days</p>
      </div>
      <AnalyticsClient
        dailyData={dailyChartData}
        topProducts={topProductsList}
        keepRate={keepRate}
        returnRate={returnRate}
        totalRevenue={totalRevenue}
        totalOrders={revenueData?.length ?? 0}
        completedOrders={completedOrders}
        keptItems={keepData?.length ?? 0}
        returnedItems={returnData?.length ?? 0}
      />

      <div className="pt-2">
        <h3 className="text-base font-bold text-white">Try &amp; Return</h3>
        <p className="text-sm text-gray-500">Doorstep try-on outcomes across all orders</p>
      </div>
      <TryReturnClient
        totalSessions={totalSessions}
        sessions30={sessions30}
        sessionCounts={sessionCounts}
        decisionCounts={decisionCounts}
        keepRate={keepRateAll}
        returnRate={returnRateAll}
        dailyData={Object.values(tryDailyMap)}
        conditions={conditions}
      />
    </div>
  );
}
