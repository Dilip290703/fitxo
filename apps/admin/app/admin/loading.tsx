import { CardSkeleton, TableSkeleton } from '@/components/admin/LoadingSkeleton';

/** Route-transition skeleton for every admin screen — one look for every pending fetch. */
export default function AdminLoading() {
  return (
    <div className="max-w-6xl space-y-5" aria-busy>
      <div className="animate-pulse space-y-2">
        <div className="h-6 w-40 rounded bg-sand" />
        <div className="h-3 w-64 rounded bg-hairline" />
      </div>
      <CardSkeleton />
      <TableSkeleton />
    </div>
  );
}
