import { createClient } from '@fitxo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import NotificationsClient, { type NotificationRow } from './NotificationsClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const type = readParam(sp, 'type');
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: ['created_at', 'title'],
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
    const clauses = [`title.ilike.%${q}%`, `body.ilike.%${q}%`];
    const userIds = (matchedUsers ?? []).map((u) => u.id);
    if (userIds.length) clauses.push(`user_id.in.(${userIds.join(',')})`);
    search = clauses.join(',');
  }

  let countQuery = supabase.from('notifications').select('id', { count: 'exact', head: true });
  if (type) countQuery = countQuery.eq('type', type);
  if (search) countQuery = countQuery.or(search);

  const [{ count }, { count: totalAll }, { count: unread }] = await Promise.all([
    countQuery,
    supabase.from('notifications').select('id', { count: 'exact', head: true }),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
  ]);
  const total = count ?? 0;

  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  // Was `.limit(200)`. The cards below counted that window too, so "Unread"
  // meant "unread among the newest 200" — a number that stops growing while
  // the backlog does.
  let rowsQuery = supabase
    .from('notifications')
    .select(`id, type, title, body, is_read, created_at, user:users(name, email)`)
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);
  if (type) rowsQuery = rowsQuery.eq('type', type);
  if (search) rowsQuery = rowsQuery.or(search);

  const { data } = await rowsQuery;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Notifications &amp; Alerts</h2>
        <p className="text-sm text-muted">{total}{type || q ? ' matching' : ' total'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Total" value={totalAll ?? 0} icon="🔔" color="indigo" />
        <StatsCard title="Unread" value={unread ?? 0} icon="●" color="amber" />
      </div>

      <NotificationsClient
        notifications={(data ?? []) as unknown as NotificationRow[]}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
        activeType={type ?? 'all'}
        activeSearch={q}
      />
    </div>
  );
}
