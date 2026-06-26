import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActivityEntry {
  /** Imperative verb phrase, e.g. "Blocked customer", "Updated store profile". */
  action: string;
  /** The kind of record acted on, e.g. "product", "order", "coupon". */
  entity_type: string;
  entity_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
}

/**
 * Best-effort admin audit log → `activity_logs` (read by Admin > Activity Log).
 *
 * Deliberately never throws: a logging failure must not break the underlying
 * admin mutation. Works with both the browser and SSR Supabase clients — the
 * admin session satisfies the `activity_logs_admin` RLS policy. For the
 * service-role client (which has no session) pass `actorId` explicitly.
 */
export async function logActivity(
  supabase: SupabaseClient,
  entry: ActivityEntry,
  actorId?: string | null,
): Promise<void> {
  try {
    let adminId = actorId ?? null;
    if (actorId === undefined) {
      const { data } = await supabase.auth.getUser();
      adminId = data.user?.id ?? null;
    }
    await supabase.from('activity_logs').insert({
      admin_id: adminId,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
    });
  } catch (err) {
    console.error('[activity] failed to log', entry.action, err);
  }
}
