import { createClient } from '@fitxo/supabase/server';
import DeliveriesClient from './DeliveriesClient';
import { parsePageParams, rangeFor, lastPage, type RawParams } from '@/lib/pagination';

type RiderRow = { id: string; is_available: boolean; users: { name: string; phone: string } | null };
type DeliveryRow = {
  id: string; order_id: string; rider_id: string | null; type: string; status: string;
  assigned_at: string | null; distance_km: number | null; estimated_minutes: number | null;
  orders: { order_number: string; status: string; users: { name: string; phone: string } | null } | null;
  riders: { id: string; users: { name: string; phone: string } | null } | null;
};

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const params = parsePageParams(sp, {
    sortable: ['assigned_at', 'status'],
    defaultSort: 'assigned_at',
    defaultDir: 'desc',
  });

  const { count } = await supabase.from('deliveries').select('id', { count: 'exact', head: true });
  const total = count ?? 0;

  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  const [{ data: deliveries }, { data: riders }, { count: waiting }] = await Promise.all([
    // Was `.limit(100)` with no page control — delivery 101 was unreachable.
    supabase
      .from('deliveries')
      .select(`
        *,
        orders(order_number, status, users(name, phone)),
        riders(id, users(name, phone))
      `)
      .order(params.sortKey, { ascending: params.sortDir === 'asc' })
      .range(from, to),
    supabase
      .from('riders')
      .select('id, is_available, users(name, phone)')
      .eq('is_verified', true),
    // The "waiting for a rider" badge is an operational alarm — it has to count
    // the whole queue, not the page. `!inner` makes the embedded filter narrow
    // the parent rows instead of the embed.
    supabase
      .from('deliveries')
      .select('id, orders!inner(status)', { count: 'exact', head: true })
      .is('rider_id', null)
      .eq('orders.status', 'confirmed'),
  ]);

  const riderRows = (riders ?? []) as unknown as RiderRow[];

  const ridersOnline = riderRows.filter((r) => r.is_available).length;
  const waitingForRider = waiting ?? 0;

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Deliveries</h2>
          <p className="text-sm text-muted">{total} deliveries</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-success-line bg-success-bg px-3 py-1.5 text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            {ridersOnline} rider{ridersOnline === 1 ? '' : 's'} online
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
              waitingForRider > 0
                ? 'border-warn-accent/40 bg-warn-bg text-warn'
                : 'border-line bg-white text-soft'
            }`}
          >
            🛵 {waitingForRider} waiting for a rider
          </span>
        </div>
      </div>
      <DeliveriesClient
        deliveries={(deliveries ?? []) as unknown as DeliveryRow[]}
        riders={riderRows}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
      />
    </div>
  );
}
