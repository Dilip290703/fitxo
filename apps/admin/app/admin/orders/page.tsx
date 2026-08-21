import { createClient } from '@fitxo/supabase/server';
import OrdersClient from './OrdersClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';
import {
  ORDER_STATUSES,
  ORDER_SORTABLE,
  SEARCH_USER_LIMIT,
  buildSearchClause,
} from './filters';
import type { OrderStatus } from '@fitxo/supabase/types';

type OrderRow = {
  id: string; order_number: string; status: OrderStatus; final_amount: number;
  payment_status: string; created_at: string; try_deadline: string | null;
  users: { name: string; email: string; phone: string } | null;
  order_items: { id: string }[];
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const status = readParam(sp, 'status');
  const payment = readParam(sp, 'payment');
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: ORDER_SORTABLE,
    defaultSort: 'created_at',
    defaultDir: 'desc',
  });

  // Resolve customer matches ONCE — the page query and all eight tab counts
  // need the same set, and doing it per-query would be nine identical lookups.
  let userIds: string[] = [];
  if (q) {
    const { data: matched } = await supabase
      .from('users')
      .select('id')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(SEARCH_USER_LIMIT);
    userIds = (matched ?? []).map((u) => u.id);
  }
  const search = q ? buildSearchClause(q, userIds) : null;

  const statusFilter = status && status !== 'all' ? status : null;
  const paymentFilter = payment && payment !== 'all' ? payment : null;

  // Tab counts honour the OTHER active filters. A "Completed 412" badge next to
  // a payment filter that leaves 3 of them visible is a lie of the same family
  // as paging over a partial fetch.
  const countFor = async (s: string | null) => {
    let qb = supabase.from('orders').select('id', { count: 'exact', head: true });
    if (s) qb = qb.eq('status', s);
    if (paymentFilter) qb = qb.eq('payment_status', paymentFilter);
    if (search) qb = qb.or(search);
    const { count } = await qb;
    return count ?? 0;
  };

  const [allCount, ...statusCounts] = await Promise.all([
    countFor(null),
    ...ORDER_STATUSES.map((s) => countFor(s)),
  ]);

  const total = statusFilter
    ? statusCounts[ORDER_STATUSES.indexOf(statusFilter as OrderStatus)] ?? 0
    : allCount;

  // Deleting rows or narrowing a filter can leave ?page= pointing past the end;
  // land on the last real page instead of an empty table with no explanation.
  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, status, final_amount, payment_status, created_at, try_deadline,
      users(name, email, phone),
      order_items(id)
    `)
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);

  if (statusFilter) query = query.eq('status', statusFilter);
  if (paymentFilter) query = query.eq('payment_status', paymentFilter);
  if (search) query = query.or(search);

  const { data: orders } = await query;

  const counts: Record<string, number> = { all: allCount };
  ORDER_STATUSES.forEach((s, i) => {
    counts[s] = statusCounts[i];
  });

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Orders</h2>
        <p className="text-sm text-muted">
          {allCount} total orders
          {statusFilter || paymentFilter || q ? ` · ${total} matching` : ''}
        </p>
      </div>
      <OrdersClient
        orders={(orders ?? []) as unknown as OrderRow[]}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
        counts={counts}
        activeStatus={statusFilter ?? 'all'}
        activePayment={paymentFilter ?? 'all'}
        activeSearch={q}
      />
    </div>
  );
}
