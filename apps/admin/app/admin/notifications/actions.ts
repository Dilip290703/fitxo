'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitzo/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity';

export type NotifType = 'order_update' | 'promo' | 'system';
export type SegmentRole = 'customer' | 'store_manager' | 'rider' | 'admin';

export type Target =
  | { kind: 'user'; email: string }
  | { kind: 'all' }
  | { kind: 'role'; role: SegmentRole };

export interface SendNotificationInput {
  title: string;
  body: string;
  type: NotifType;
  target: Target;
}

export async function sendNotification(input: SendNotificationInput): Promise<{ count: number }> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error('Title and message are required');

  const ssr = await createClient();
  const {
    data: { user: actor },
  } = await ssr.auth.getUser();

  const admin = createAdminClient();

  // Resolve recipient user ids based on the chosen target.
  let recipients: string[] = [];
  if (input.target.kind === 'user') {
    const email = input.target.email.trim();
    if (!email) throw new Error('Enter the recipient email');
    const { data, error } = await admin.from('users').select('id').eq('email', email).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No user found with email ${email}`);
    recipients = [data.id as string];
  } else if (input.target.kind === 'role') {
    const { data, error } = await admin.from('users').select('id').eq('role', input.target.role);
    if (error) throw new Error(error.message);
    recipients = (data ?? []).map((u) => u.id as string);
  } else {
    const { data, error } = await admin.from('users').select('id');
    if (error) throw new Error(error.message);
    recipients = (data ?? []).map((u) => u.id as string);
  }

  if (recipients.length === 0) throw new Error('No matching recipients');

  const rows = recipients.map((uid) => ({ user_id: uid, type: input.type, title, body }));
  const { error: insErr } = await admin.from('notifications').insert(rows);
  if (insErr) throw new Error(insErr.message);

  await logActivity(
    admin,
    {
      action: `Sent "${input.type}" notification to ${recipients.length} user(s)`,
      entity_type: 'notification',
      new_value: { title, type: input.type, target: input.target, count: recipients.length },
    },
    actor?.id,
  );

  revalidatePath('/admin/notifications');
  return { count: recipients.length };
}
