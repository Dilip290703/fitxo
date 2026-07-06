import { createClient } from '@fitzo/supabase/server';
import Link from 'next/link';
import StatsCard from '@/components/admin/StatsCard';
import RevenueChart from '@/components/admin/RevenueChart';
import ActiveDeliveries from './ActiveDeliveries';
import { ACTIVE_DELIVERY_SELECT, ACTIVE_DELIVERY_STATUSES, mapRow } from './active-deliveries-lib';
import { computeStorePayables } from './payouts/compute';
import { computeAgentPayables } from './agent-payouts/compute';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
const STUCK_PENDING_MINUTES = 30;

type QueueTone = 'red' | 'amber' | 'blue';

interface QueueRow {
  key: string;
  tone: QueueTone;
  title: string;
  sub: string;
  href: string;
  count: number;
}

const TONE_DOT: Record<QueueTone, string> = {
  red: 'bg-danger',
  amber: 'bg-warn-accent',
  blue: 'bg-info',
};

export default async function AdminDashboard() {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const stuckBefore = new Date(Date.now() - STUCK_PENDING_MINUTES * 60000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    { data: stuckPending, count: stuckPendingCount },
    { data: tryWindows },
    { data: keptItems },
    { count: failedPayments },
    { count: unassignedDeliveries },
    { count: openComplaints },
    { count: storesToReview },
    storePayables,
    agentPayables,
    { count: todayOrders },
    { data: todayRevData },
    { data: todayDecisions },
    { data: activeDeliveryRows },
    { data: weeklyOrders },
    { data: lowStockData },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, created_at', { count: 'exact' })
      .eq('status', 'pending')
      .lt('created_at', stuckBefore)
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('orders')
      .select('id, order_number, try_deadline')
      .eq('status', 'try_window_active')
      .order('try_deadline', { ascending: true })
      .limit(20),
    supabase
      .from('order_items')
      .select('order_id, orders(id, order_number, payment_status, status)')
      .eq('decision', 'keep'),
    supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', weekAgo),
    supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .is('rider_id', null)
      .not('status', 'in', '(completed,failed)'),
    supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('stores').select('*', { count: 'exact', head: true }).eq('onboarding_status', 'submitted'),
    computeStorePayables(supabase),
    computeAgentPayables(supabase),
    supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    supabase.from('orders').select('final_amount').gte('created_at', todayStart).eq('payment_status', 'paid'),
    supabase.from('order_items').select('decision').gte('decision_at', todayStart).in('decision', ['keep', 'return']),
    supabase
      .from('deliveries')
      .select(ACTIVE_DELIVERY_SELECT)
      .in('status', ACTIVE_DELIVERY_STATUSES)
      .order('assigned_at', { ascending: false })
      .limit(20),
    supabase
      .from('orders')
      .select('created_at, final_amount')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: true }),
    supabase
      .from('product_variants')
      .select('id, sku, size, stock_qty')
      .lt('stock_qty', 3)
      .eq('is_available', true)
      .limit(5),
  ]);

  // ── Needs Attention queues ──────────────────────────────────────────────

  // Try windows: expired-but-stuck (deadline passed, order never finalized)
  // vs. still ticking.
  const expiredTry = (tryWindows ?? []).filter((o) => o.try_deadline && new Date(o.try_deadline) < now);
  const tickingTry = (tryWindows ?? []).filter((o) => !o.try_deadline || new Date(o.try_deadline) >= now);

  // Keep decided but order not paid — real money waiting on a retry/follow-up.
  const unpaidKeepOrders = new Map<string, { orderNumber: string }>();
  for (const it of (keptItems ?? []) as unknown as {
    order_id: string;
    orders: { id: string; order_number: string; payment_status: string; status: string } | null;
  }[]) {
    const o = it.orders;
    if (o && o.payment_status !== 'paid' && o.status !== 'cancelled') {
      unpaidKeepOrders.set(it.order_id, { orderNumber: o.order_number });
    }
  }

  const storesOwed = storePayables.filter((p) => p.netOutstanding > 0);
  const ridersOwed = agentPayables.filter((p) => p.netOutstanding > 0);
  const storeOwedTotal = storesOwed.reduce((s, p) => s + p.netOutstanding, 0);
  const riderOwedTotal = ridersOwed.reduce((s, p) => s + p.netOutstanding, 0);

  const allQueues: QueueRow[] = [
    {
      key: 'expired-try',
      tone: 'red',
      count: expiredTry.length,
      title: `${expiredTry.length} try window${expiredTry.length === 1 ? '' : 's'} expired without closing`,
      sub: expiredTry.slice(0, 3).map((o) => o.order_number).join(' · '),
      href: expiredTry.length === 1 ? `/admin/orders/${expiredTry[0].id}` : '/admin/orders?status=try_window_active',
    },
    {
      key: 'unpaid-keep',
      tone: 'red',
      count: unpaidKeepOrders.size,
      title: `${unpaidKeepOrders.size} order${unpaidKeepOrders.size === 1 ? '' : 's'} with kept items but no payment`,
      sub: [...unpaidKeepOrders.values()].slice(0, 3).map((o) => o.orderNumber).join(' · '),
      href:
        unpaidKeepOrders.size === 1
          ? `/admin/orders/${[...unpaidKeepOrders.keys()][0]}`
          : '/admin/orders',
    },
    {
      key: 'failed-payments',
      tone: 'red',
      count: failedPayments ?? 0,
      title: `${failedPayments ?? 0} failed payment${(failedPayments ?? 0) === 1 ? '' : 's'} this week`,
      sub: 'Razorpay attempts that never captured',
      href: '/admin/payments?status=failed',
    },
    {
      key: 'stuck-pending',
      tone: 'amber',
      count: stuckPendingCount ?? 0,
      title: `${stuckPendingCount ?? 0} order${(stuckPendingCount ?? 0) === 1 ? '' : 's'} pending over ${STUCK_PENDING_MINUTES} min`,
      sub: (stuckPending ?? []).map((o) => o.order_number).slice(0, 3).join(' · ') || 'Store hasn’t confirmed yet',
      href:
        (stuckPendingCount ?? 0) === 1 && stuckPending?.[0]
          ? `/admin/orders/${stuckPending[0].id}`
          : '/admin/orders?status=pending',
    },
    {
      key: 'unassigned',
      tone: 'amber',
      count: unassignedDeliveries ?? 0,
      title: `${unassignedDeliveries ?? 0} deliver${(unassignedDeliveries ?? 0) === 1 ? 'y' : 'ies'} waiting for a rider`,
      sub: 'No rider has claimed these yet — assign manually if it drags',
      href: '/admin/deliveries',
    },
    {
      key: 'complaints',
      tone: 'amber',
      count: openComplaints ?? 0,
      title: `${openComplaints ?? 0} open complaint${(openComplaints ?? 0) === 1 ? '' : 's'}`,
      sub: 'Unanswered — first response pending',
      href: '/admin/complaints?status=open',
    },
    {
      key: 'stores-review',
      tone: 'blue',
      count: storesToReview ?? 0,
      title: `${storesToReview ?? 0} store application${(storesToReview ?? 0) === 1 ? '' : 's'} awaiting review`,
      sub: 'Approve or reject on the store page',
      href: '/admin/stores',
    },
    {
      key: 'store-payouts',
      tone: 'blue',
      count: storesOwed.length,
      title: `${formatCurrency(storeOwedTotal)} owed to ${storesOwed.length} store${storesOwed.length === 1 ? '' : 's'}`,
      sub: storesOwed.slice(0, 3).map((p) => p.storeName).join(' · '),
      href: '/admin/payouts',
    },
    {
      key: 'agent-payouts',
      tone: 'blue',
      count: ridersOwed.length,
      title: `${formatCurrency(riderOwedTotal)} owed to ${ridersOwed.length} rider${ridersOwed.length === 1 ? '' : 's'}`,
      sub: ridersOwed.slice(0, 3).map((p) => p.riderName).join(' · '),
      href: '/admin/agent-payouts',
    },
  ];
  const queues = allQueues.filter((q) => q.count > 0);

  // ── Today's numbers ─────────────────────────────────────────────────────
  const todayRevenue = todayRevData?.reduce((sum, o) => sum + (o.final_amount ?? 0), 0) ?? 0;
  const keptToday = (todayDecisions ?? []).filter((d) => d.decision === 'keep').length;
  const decidedToday = todayDecisions?.length ?? 0;
  const keepRateToday = decidedToday > 0 ? Math.round((keptToday / decidedToday) * 100) : null;
  const activeDeliveries = (activeDeliveryRows ?? []).map(mapRow);

  // ── Charts (last, not first) ────────────────────────────────────────────
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
    <div className="max-w-6xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-ink">Dashboard</h2>
        <p className="text-sm text-muted mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── 1. Needs Attention ── */}
      <section className="rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h3 className="text-[13px] font-semibold text-ink">Needs attention</h3>
          <span className="text-[11px] text-muted">
            {queues.length === 0 ? 'nothing waiting' : `${queues.length} queue${queues.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {queues.length === 0 ? (
          <p className="px-4 py-6 text-[13px] font-medium text-success">✓ All clear — nothing needs you right now.</p>
        ) : (
          <div className="divide-y divide-hairline">
            {queues.map((q) => (
              <Link key={q.key} href={q.href} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-cream/70">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[q.tone]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{q.title}</span>
                  {q.sub ? <span className="block truncate text-[11px] text-muted">{q.sub}</span> : null}
                </span>
                <span className="shrink-0 text-[13px] text-faint">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Live try windows still ticking — glanceable, not a queue */}
      {tickingTry.length > 0 ? (
        <div className="rounded-xl border border-warn-accent/40 bg-warn-bg px-4 py-2.5 text-[12px] text-warn">
          ⏱ {tickingTry.length} try window{tickingTry.length === 1 ? '' : 's'} ticking now:{' '}
          {tickingTry.slice(0, 4).map((o, i) => {
            const minsLeft = o.try_deadline
              ? Math.max(0, Math.round((new Date(o.try_deadline).getTime() - now.getTime()) / 60000))
              : null;
            return (
              <span key={o.id}>
                {i > 0 ? ' · ' : ''}
                <Link href={`/admin/orders/${o.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {o.order_number}
                </Link>
                {minsLeft !== null ? ` (${minsLeft}m)` : ''}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ── 2. Today's numbers + live deliveries ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard title="Today's Orders" value={todayOrders ?? 0} href="/admin/orders" />
        <StatsCard title="Today's Revenue" value={formatCurrency(todayRevenue)} href="/admin/payments" />
        <StatsCard
          title="Keep Rate Today"
          value={keepRateToday === null ? '—' : `${keepRateToday}%`}
          subtitle={decidedToday > 0 ? `${keptToday}/${decidedToday} decisions` : 'no decisions yet'}
          href="/admin/analytics"
        />
        <StatsCard title="On the Road" value={activeDeliveries.length} subtitle="active deliveries" href="/admin/deliveries" />
      </div>

      <ActiveDeliveries initial={activeDeliveries} />

      {/* ── 3. Charts last ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-ink">Orders (last 7 days)</h3>
          <RevenueChart data={weeklyChartData} dataKey="orders" color="#1f2a3c" />
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-ink">Revenue (last 7 days)</h3>
          <RevenueChart data={weeklyChartData} dataKey="revenue" color="#2f7d46" />
        </div>
      </div>

      {lowStockData && lowStockData.length > 0 ? (
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Low stock</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {lowStockData.map((v) => (
              <span key={v.id} className="text-[12px] text-soft">
                <span className="font-mono text-ink">{v.sku}</span> ({v.size}) —{' '}
                <span className={v.stock_qty === 0 ? 'font-semibold text-danger' : 'font-semibold text-warn'}>
                  {v.stock_qty === 0 ? 'out' : `${v.stock_qty} left`}
                </span>
              </span>
            ))}
            <Link href="/admin/inventory" className="text-[12px] text-info hover:text-ink">
              Inventory →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
