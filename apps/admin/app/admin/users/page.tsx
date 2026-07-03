import { createClient } from '@fitzo/supabase/server';
import UsersClient, { type UserRow, type StoreOption } from './UsersClient';

export default async function UsersPage() {
  const supabase = await createClient();

  const [{ data: users }, { data: stores }] = await Promise.all([
    supabase
      .from('users')
      .select(
        `id, name, email, phone, role, is_blocked, created_at,
         store_managers(store_id, is_active, stores(name)),
         riders(id, is_verified)`,
      )
      .order('created_at', { ascending: false }),
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">User Roles</h2>
        <p className="text-sm text-muted">{users?.length ?? 0} users</p>
      </div>
      <UsersClient
        users={(users ?? []) as unknown as UserRow[]}
        stores={(stores ?? []) as unknown as StoreOption[]}
      />
    </div>
  );
}
