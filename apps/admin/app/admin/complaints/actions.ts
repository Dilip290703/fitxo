'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitzo/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity';

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export async function updateComplaint(
  id: string,
  patch: { status: ComplaintStatus; admin_response: string },
): Promise<void> {
  const ssr = await createClient();
  const {
    data: { user: actor },
  } = await ssr.auth.getUser();

  const admin = createAdminClient();

  const update: Record<string, unknown> = {
    status: patch.status,
    admin_response: patch.admin_response.trim() || null,
    resolved_at: patch.status === 'resolved' || patch.status === 'closed' ? new Date().toISOString() : null,
  };

  const { error } = await admin.from('complaints').update(update).eq('id', id);
  if (error) throw new Error(error.message);

  await logActivity(
    admin,
    { action: `Complaint → ${patch.status}`, entity_type: 'complaint', entity_id: id, new_value: { status: patch.status } },
    actor?.id,
  );

  revalidatePath('/admin/complaints');
}
