'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitzo/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity';

export type ContentType = 'page' | 'banner' | 'faq' | 'announcement';

export interface ContentInput {
  id?: string;
  key: string;
  title: string;
  body: string;
  type: ContentType;
  is_published: boolean;
}

export async function saveContentBlock(input: ContentInput): Promise<void> {
  const key = input.key.trim();
  const title = input.title.trim();
  if (!key || !title) throw new Error('Key and title are required');

  const ssr = await createClient();
  const {
    data: { user: actor },
  } = await ssr.auth.getUser();

  const admin = createAdminClient();
  const payload = {
    key,
    title,
    body: input.body,
    type: input.type,
    is_published: input.is_published,
    updated_by: actor?.id ?? null,
  };

  let error;
  if (input.id) {
    ({ error } = await admin.from('content_blocks').update(payload).eq('id', input.id));
  } else {
    ({ error } = await admin.from('content_blocks').insert(payload));
  }
  if (error) throw new Error(error.message);

  await logActivity(
    admin,
    { action: input.id ? 'Updated content block' : 'Created content block', entity_type: 'content', entity_id: input.id, new_value: { key, type: input.type, is_published: input.is_published } },
    actor?.id,
  );

  revalidatePath('/admin/content');
}

export async function deleteContentBlock(id: string): Promise<void> {
  const ssr = await createClient();
  const {
    data: { user: actor },
  } = await ssr.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from('content_blocks').delete().eq('id', id);
  if (error) throw new Error(error.message);

  await logActivity(admin, { action: 'Deleted content block', entity_type: 'content', entity_id: id }, actor?.id);
  revalidatePath('/admin/content');
}
