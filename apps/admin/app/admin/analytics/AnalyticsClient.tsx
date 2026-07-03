'use client';

import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import StatsCard from '@/components/admin/StatsCard';

interface DayData { date: string; orders: number; revenue: number; }
interface ProductData { name: string; orders: number; kept: number; }

interface Props {
  dailyData: DayData[];
  topProducts: ProductData[];
  keepRate: number;
  returnRate: number;
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  keptItems: number;
  returnedItems: number;
}

const CHART_COLORS = { orders: '#6366f1', revenue: '#10b981', returns: '#f59e0b' };
const PIE_COLORS = ['#10b981', '#f59e0b'];

type TimeRange = 'week' | 'month';

export default function AnalyticsClient({
  dailyData, topProducts, keepRate, returnRate, totalRevenue,
  totalOrders, completedOrders, keptItems, returnedItems,
}: Props) {
  const [range, setRange] = useState<TimeRange>('month');
  const [metric, setMetric] = useState<'orders' | 'revenue'>('revenue');

  const displayData = range === 'week' ? dailyData.slice(-7) : dailyData;

  const conversionPieData = [
    { name: `Kept (${keepRate}%)`, value: keptItems },
    { name: `Returned (${returnRate}%)`, value: returnedItems },
  ];

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="30-Day Revenue"
          value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalRevenue)}
          icon="₹" color="green"
        />
        <StatsCard title="Total Orders" value={totalOrders} icon="🛒" color="indigo" />
        <StatsCard title="Keep Rate" value={`${keepRate}%`} icon="✓" color="green" subtitle="Items kept after try-on" />
        <StatsCard title="Return Rate" value={`${returnRate}%`} icon="↩" color="amber" subtitle="Items returned after try-on" />
      </div>

      {/* Revenue/Orders chart */}
      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-ink">
            {metric === 'revenue' ? 'Revenue' : 'Orders'} Over Time
          </h3>
          <div className="flex gap-2">
            <div className="flex gap-1">
              {(['orders', 'revenue'] as const).map((m) => (
                <button key={m} onClick={() => setMetric(m)} className={`px-2.5 py-1 text-xs rounded capitalize ${metric === m ? 'bg-ink text-white' : 'text-soft hover:text-ink'}`}>{m}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['week', 'month'] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 text-xs rounded capitalize ${range === r ? 'bg-knob text-ink' : 'text-soft hover:text-ink'}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={displayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metric === 'revenue' ? CHART_COLORS.revenue : CHART_COLORS.orders} stopOpacity={0.25} />
                <stop offset="95%" stopColor={metric === 'revenue' ? CHART_COLORS.revenue : CHART_COLORS.orders} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={range === 'month' ? 4 : 0} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#f9fafb', fontSize: 12 }} itemStyle={{ color: '#d1d5db', fontSize: 12 }} />
            <Area type="monotone" dataKey={metric} stroke={metric === 'revenue' ? CHART_COLORS.revenue : CHART_COLORS.orders} strokeWidth={2} fill="url(#mainGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Top Products (by orders)</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="orders" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Keep vs Return */}
        <div className="bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Try-to-Buy Conversion</h3>
          {keptItems + returnedItems === 0 ? (
            <p className="text-sm text-muted">No decisions recorded yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={conversionPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={3}>
                    {conversionPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{keepRate}%</p>
                  <p className="text-xs text-muted">Keep Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warn">{returnRate}%</p>
                  <p className="text-xs text-muted">Return Rate</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
