'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';

export type Role = 'customer' | 'admin' | 'store_manager' | 'rider';

export async function changeUserRole(userId: string, newRole: Role, storeId?: string): Promise<void> {
  // Role changes are privilege-sensitive — only a signed-in admin may call this.
  const actorId = await requireAdmin();

  if (actorId === userId) throw new Error("You can't change your own role");
  if (newRole === 'store_manager' && !storeId) throw new Error('Select a store for the store manager');

  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin.from('users').select('role').eq('id', userId).single();
  if (readErr) throw new Error(readErr.message);
  const oldRole = (existing?.role ?? null) as Role | null;

  if (oldRole === newRole && newRole !== 'store_manager') return; // no-op

  const { error } = await admin.from('users').update({ role: newRole }).eq('id', userId);
  if (error) throw new Error(error.message);

  // Provision / clean up the role-linked rows.
  if (newRole === 'store_manager' && storeId) {
    await admin
      .from('store_managers')
      .upsert({ user_id: userId, store_id: storeId, is_active: true }, { onConflict: 'user_id,store_id' });
  }
  if (newRole === 'rider') {
    const { data: existingRider } = await admin.from('riders').select('id').eq('user_id', userId).maybeSingle();
    if (!existingRider) await admin.from('riders').insert({ user_id: userId });
  }
  if (oldRole === 'store_manager' && newRole !== 'store_manager') {
    // Demoted out of store_manager → revoke their store assignments.
    await admin.from('store_managers').update({ is_active: false }).eq('user_id', userId);
  }

  await logActivity(
    admin,
    {
      action: `Role changed: ${oldRole ?? '—'} → ${newRole}`,
      entity_type: 'user',
      entity_id: userId,
      old_value: { role: oldRole },
      new_value: { role: newRole, ...(storeId ? { store_id: storeId } : {}) },
    },
    actorId,
  );

  revalidatePath('/admin/users');
}
