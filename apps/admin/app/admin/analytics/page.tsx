import { createClient } from '@fitzo/supabase/server';
import AnalyticsClient from './AnalyticsClient';

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    { data: revenueData },
    { data: topProducts },
    { data: returnData },
    { data: keepData },
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
    </div>
  );
}
