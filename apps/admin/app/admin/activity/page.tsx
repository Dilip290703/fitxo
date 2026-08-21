import { createClient } from '@fitxo/supabase/server';
import ActivityLogClient, { type ActivityRow } from './ActivityLogClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const entity = readParam(sp, 'entity');
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: ['created_at', 'action', 'entity_type'],
    defaultSort: 'created_at',
    defaultDir: 'desc',
  });

  let search: string | null = null;
  if (q) {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(1000);
    const clauses = [`action.ilike.%${q}%`, `entity_type.ilike.%${q}%`];
    // entity_id is a UUID column — Postgres has no ILIKE for uuid, so a partial
    // match is impossible. An exact id is still worth supporting: pasting one
    // in is how you answer "who touched this order?".
    if (UUID_RE.test(q)) clauses.push(`entity_id.eq.${q}`);
    const adminIds = (admins ?? []).map((u) => u.id);
    if (adminIds.length) clauses.push(`admin_id.in.(${adminIds.join(',')})`);
    search = clauses.join(',');
  }

  let countQuery = supabase.from('activity_logs').select('id', { count: 'exact', head: true });
  if (entity) countQuery = countQuery.eq('entity_type', entity);
  if (search) countQuery = countQuery.or(search);
  const { count } = await countQuery;
  const total = count ?? 0;

  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  // Was `.limit(200)` with no way to reach row 201 — the log grows with every
  // admin action, so the oldest entries silently fell off the end of a screen
  // whose whole purpose is the audit trail.
  let rowsQuery = supabase
    .from('activity_logs')
    .select(
      `id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at,
       admin:users(name, email)`,
    )
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);
  if (entity) rowsQuery = rowsQuery.eq('entity_type', entity);
  if (search) rowsQuery = rowsQuery.or(search);

  const { data } = await rowsQuery;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Activity Log</h2>
        <p className="text-sm text-muted">{total} admin actions{entity || q ? ' matching' : ''}</p>
      </div>
      <ActivityLogClient
        logs={(data ?? []) as unknown as ActivityRow[]}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
        activeEntity={entity ?? 'all'}
        activeSearch={q}
      />
    </div>
  );
}
