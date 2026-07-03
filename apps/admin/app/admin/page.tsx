import { createClient } from '@fitzo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import StatusBadge from '@/components/admin/StatusBadge';
import RevenueChart from '@/components/admin/RevenueChart';
import Link from 'next/link';
import type { Order } from '@fitzo/supabase/types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();

  const [
    { count: todayOrders },
    { data: todayRevData },
    { count: pendingDeliveries },
    { count: tryWindowActive },
    { count: returnsToday },
    { data: lowStockData },
    { data: recentOrders },
    { count: totalProducts },
    { count: totalStores },
    { count: totalRiders },
    { data: weeklyOrders },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('orders').select('final_amount').gte('created_at', todayStart).eq('payment_status', 'paid'),
    supabase.from('deliveries').select('*', { count: 'exact', head: true }).in('status', ['assigned', 'accepted', 'picked_up', 'en_route', 'arrived']),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'try_window_active'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'return_requested'),
    supabase.from('product_variants').select('id, sku, product_id, size, stock_qty').lt('stock_qty', 3).eq('is_available', true).limit(5),
    supabase.from('orders').select('id, order_number, status, final_amount, created_at, users(name, email)').order('created_at', { ascending: false }).limit(10),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('stores').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('riders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('created_at, final_amount').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: true }),
  ]);

  const todayRevenue = todayRevData?.reduce((sum, o) => sum + (o.final_amount ?? 0), 0) ?? 0;

  // Group weekly data by day
  const weeklyChartData = (() => {
    const days: Record<string, { orders: number; revenue: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toLocaleDateString('en-IN', { weekday: 'short' });
      days[key] = { orders: 0, revenue: 0 };
    }
    weeklyOrders?.forEach((o) => {
      const key = new Date(o.created_at).toLocaleDateString('en-IN', { weekday: 'short' });
      if (days[key]) {
        days[key].orders += 1;
        days[key].revenue += o.final_amount ?? 0;
      }
    });
    return Object.entries(days).map(([day, data]) => ({ day, ...data }));
  })();

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Dashboard</h2>
        <p className="text-sm text-muted mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Today's Orders" value={todayOrders ?? 0} icon="🛒" color="indigo" />
        <StatsCard title="Today's Revenue" value={formatCurrency(todayRevenue)} icon="₹" color="green" />
        <StatsCard title="Active Deliveries" value={pendingDeliveries ?? 0} icon="🚚" color="amber" />
        <StatsCard title="Try Windows Active" value={tryWindowActive ?? 0} icon="⏱" color="blue" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Returns Requested" value={returnsToday ?? 0} icon="↩" color="red" />
        <StatsCard title="Total Products" value={totalProducts ?? 0} icon="📦" color="indigo" />
        <StatsCard title="Active Stores" value={totalStores ?? 0} icon="🏪" color="green" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Orders (Last 7 Days)</h3>
          <RevenueChart data={weeklyChartData} dataKey="orders" color="#1f2a3c" />
        </div>
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Revenue (Last 7 Days)</h3>
          <RevenueChart data={weeklyChartData} dataKey="revenue" color="#2f7d46" />
        </div>
      </div>

      {/* Low Stock + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Low Stock Alert */}
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="text-warn">⚠</span> Low Stock Alerts
          </h3>
          {!lowStockData || lowStockData.length === 0 ? (
            <p className="text-sm text-muted">All variants well stocked</p>
          ) : (
            <div className="space-y-2">
              {lowStockData.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-hairline last:border-0">
                  <div>
                    <p className="text-xs font-mono text-body">{v.sku}</p>
                    <p className="text-xs text-muted">Size: {v.size}</p>
                  </div>
                  <span className={`text-xs font-bold ${v.stock_qty === 0 ? 'text-danger' : 'text-warn'}`}>
                    {v.stock_qty === 0 ? 'OUT' : `${v.stock_qty} left`}
                  </span>
                </div>
              ))}
              <Link href="/admin/inventory" className="block text-xs text-info hover:text-ink mt-2">
                View all inventory →
              </Link>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white border border-line rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink">Recent Orders</h3>
            <Link href="/admin/orders" className="text-xs text-info hover:text-ink">
              View all →
            </Link>
          </div>

          {!recentOrders || recentOrders.length === 0 ? (
            <p className="text-sm text-muted">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted border-b border-line">
                    <th className="text-left pb-2 font-medium">Order</th>
                    <th className="text-left pb-2 font-medium">Customer</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                    <th className="text-right pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentOrders as unknown as (Order & { users?: { name: string; email: string } })[]).map((order) => (
                    <tr key={order.id} className="border-b border-hairline hover:bg-cream/70">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/orders/${order.id}`} className="text-info hover:text-ink font-mono text-xs">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-body text-xs">
                        {order.users?.name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="py-2.5 pr-3 text-right text-body text-xs">
                        {formatCurrency(order.final_amount)}
                      </td>
                      <td className="py-2.5 text-right text-muted text-xs">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
