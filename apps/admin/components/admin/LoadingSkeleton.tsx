interface LoadingSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 5 }: LoadingSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="bg-white rounded-xl overflow-hidden border border-line">
        {/* Header */}
        <div className="grid gap-4 px-4 py-3 border-b border-line" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 bg-sand rounded" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid gap-4 px-4 py-3 border-b border-hairline" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-4 bg-sand rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-line rounded-xl p-5">
          <div className="h-3 bg-sand rounded w-24 mb-3" />
          <div className="h-7 bg-sand rounded w-16 mb-2" />
          <div className="h-3 bg-sand rounded w-32" />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <CardSkeleton />
      <TableSkeleton />
    </div>
  );
}
