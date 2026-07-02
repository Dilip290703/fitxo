/** Loading placeholders — one look for every pending fetch. */

export function CardsSkeleton({ count = 4, cols = "grid-cols-2 lg:grid-cols-4" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid gap-4 ${cols}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-line bg-white" />
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-sand" />
      ))}
    </div>
  );
}

export function BlockSkeleton({ className = "h-64" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl border border-line bg-white ${className}`} aria-hidden />;
}
