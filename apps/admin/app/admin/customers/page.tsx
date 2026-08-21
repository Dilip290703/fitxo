import { createClient } from '@fitxo/supabase/server';
import CustomersClient from './CustomersClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';

/** Base columns only — "Orders" and "Total Spent" are computed per row from the
 *  embed, so the database cannot order by them without an aggregate view. */
const CUSTOMER_SORTABLE = ['name', 'created_at'] as const;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const filter = readParam(sp, 'filter') ?? 'all';
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: CUSTOMER_SORTABLE,
    defaultSort: 'created_at',
    defaultDir: 'desc',
  });

  // The `orders(...)` embed is per parent row, so paging the customers bounds
  // it too — this page used to pull every customer AND every order each of
  // them ever placed, just to add up a column.
  const SELECT = 'id, name, email, phone, is_active, is_blocked, created_at, orders(id, final_amount)';
  const search = q ? `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%` : null;

  // Filters are applied twice rather than through a shared generic helper: a
  // `<T extends {eq,or}>` wrapper around a PostgREST builder makes the compiler
  // walk Supabase's recursive result types and it gives up (TS2589). Four
  // duplicated lines cost less than fighting that.
  let countQuery = supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'customer');
  if (filter === 'blocked') countQuery = countQuery.eq('is_blocked', true);
  if (filter === 'active') countQuery = countQuery.eq('is_blocked', false).eq('is_active', true);
  if (search) countQuery = countQuery.or(search);

  const { count } = await countQuery;
  const matching = count ?? 0;

  const page = Math.min(params.page, lastPage(matching, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  let rowsQuery = supabase
    .from('users')
    .select(SELECT)
    .eq('role', 'customer')
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);
  if (filter === 'blocked') rowsQuery = rowsQuery.eq('is_blocked', true);
  if (filter === 'active') rowsQuery = rowsQuery.eq('is_blocked', false).eq('is_active', true);
  if (search) rowsQuery = rowsQuery.or(search);

  const { data: customers } = await rowsQuery;

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Customers</h2>
        <p className="text-sm text-muted">{matching} customers{filter !== 'all' || q ? ' matching' : ''}</p>
      </div>
      <CustomersClient
        customers={customers ?? []}
        pageInfo={{ page, pageSize: params.pageSize, total: matching, sortKey: params.sortKey, sortDir: params.sortDir }}
        activeFilter={filter}
        activeSearch={q}
      />
    </div>
  );
}
