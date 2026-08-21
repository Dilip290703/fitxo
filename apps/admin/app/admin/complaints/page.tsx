import { createClient } from '@fitxo/supabase/server';
import ComplaintsClient, { type ComplaintRow } from './ComplaintsClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';

const COMPLAINT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const statusParam = readParam(sp, 'status');
  const status = statusParam && COMPLAINT_STATUSES.includes(statusParam) ? statusParam : null;
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: ['created_at', 'priority', 'status'],
    defaultSort: 'created_at',
    defaultDir: 'desc',
  });

  let search: string | null = null;
  if (q) {
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('id')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(1000);
    const clauses = [`subject.ilike.%${q}%`, `message.ilike.%${q}%`];
    const userIds = (matchedUsers ?? []).map((u) => u.id);
    if (userIds.length) clauses.push(`user_id.in.(${userIds.join(',')})`);
    search = clauses.join(',');
  }

  let countQuery = supabase.from('complaints').select('id', { count: 'exact', head: true });
  if (status) countQuery = countQuery.eq('status', status);
  if (search) countQuery = countQuery.or(search);

  // "open" describes the queue, not the page — it is the number a person is
  // deciding whether to act on.
  const [{ count }, { count: totalAll }, { count: openCount }] = await Promise.all([
    countQuery,
    supabase.from('complaints').select('id', { count: 'exact', head: true }),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
  ]);
  const total = count ?? 0;

  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  let rowsQuery = supabase
    .from('complaints')
    .select(
      `id, subject, message, status, priority, admin_response, created_at, resolved_at,
       user:users(name, email), order:orders(order_number)`,
    )
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);
  if (status) rowsQuery = rowsQuery.eq('status', status);
  if (search) rowsQuery = rowsQuery.or(search);

  const { data } = await rowsQuery;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Complaints &amp; Support</h2>
        <p className="text-sm text-muted">{totalAll ?? 0} total · {openCount ?? 0} open</p>
      </div>
      <ComplaintsClient
        complaints={(data ?? []) as unknown as ComplaintRow[]}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
        activeStatus={status ?? 'all'}
        activeSearch={q}
      />
    </div>
  );
}
