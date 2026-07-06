'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartDataPoint {
  day: string;
  [key: string]: string | number;
}

interface RevenueChartProps {
  data: ChartDataPoint[];
  dataKey: string;
  color?: string;
}

export default function RevenueChart({ data, dataKey, color = '#6366f1' }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece5da" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#958675' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#958675' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #ece5da', borderRadius: 8 }}
          labelStyle={{ color: '#171d2b', fontSize: 12 }}
          itemStyle={{ color: '#5f574e', fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${dataKey})`}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
