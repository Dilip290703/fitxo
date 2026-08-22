import { createClient } from '@fitxo/supabase/server';
import UsersClient, { type UserRow, type StoreOption } from './UsersClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';

const USER_SORTABLE = ['created_at', 'name', 'email'] as const;
const ROLES = ['customer', 'store_manager', 'rider', 'admin'];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const roleParam = readParam(sp, 'role');
  const role = roleParam && ROLES.includes(roleParam) ? roleParam : null;
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: USER_SORTABLE,
    defaultSort: 'created_at',
    defaultDir: 'desc',
  });

  const search = q ? `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%` : null;

  let countQuery = supabase.from('users').select('id', { count: 'exact', head: true });
  if (role) countQuery = countQuery.eq('role', role);
  if (search) countQuery = countQuery.or(search);
  const { count } = await countQuery;
  const total = count ?? 0;

  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  // The store_managers / riders embeds are per parent row, so paging the users
  // bounds them too — this page used to pull every user in the database plus
  // every store assignment and rider profile, into a table with no page
  // controls at all.
  let rowsQuery = supabase
    .from('users')
    .select(
      `id, name, email, phone, role, is_blocked, created_at,
       store_managers(store_id, is_active, stores(name)),
       riders(id, is_verified)`,
    )
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);
  if (role) rowsQuery = rowsQuery.eq('role', role);
  if (search) rowsQuery = rowsQuery.or(search);

  const [{ data: users }, { data: stores }] = await Promise.all([
    rowsQuery,
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">User Roles</h2>
        <p className="text-sm text-muted">{total} users{role || q ? ' matching' : ''}</p>
      </div>
      <UsersClient
        users={(users ?? []) as unknown as UserRow[]}
        stores={(stores ?? []) as unknown as StoreOption[]}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
        activeRole={role ?? 'all'}
        activeSearch={q}
      />
    </div>
  );
}
