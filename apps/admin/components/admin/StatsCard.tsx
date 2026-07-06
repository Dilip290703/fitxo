import Link from 'next/link';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; positive: boolean };
  icon?: string;
  color?: 'indigo' | 'green' | 'amber' | 'red' | 'blue';
  /** Make the whole card a door into its filtered destination. */
  href?: string;
}

const colorMap = {
  indigo: 'bg-info-bg text-info',
  green: 'bg-success-bg text-success',
  amber: 'bg-warn-bg text-warn',
  red: 'bg-danger-bg text-danger',
  blue: 'bg-info-bg text-info',
};

export default function StatsCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'indigo',
  href,
}: StatsCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-soft font-medium uppercase tracking-wide">{title}</p>
          <p className="text-[22px] font-semibold tracking-[-0.02em] text-ink mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${colorMap[color]}`}>
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-muted">vs last week</span>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block bg-white border border-line rounded-xl p-4 transition hover:border-ink">
        {inner}
      </Link>
    );
  }
  return <div className="bg-white border border-line rounded-xl p-4">{inner}</div>;
}
