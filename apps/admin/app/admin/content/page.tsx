import { createClient } from '@fitxo/supabase/server';
import ContentClient, { type ContentRow } from './ContentClient';

export default async function ContentPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('content_blocks')
    .select('id, key, title, body, type, is_published, updated_at')
    .order('updated_at', { ascending: false });

  const blocks = (data ?? []) as unknown as ContentRow[];

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Content Management</h2>
        <p className="text-sm text-muted">{blocks.length} content blocks</p>
      </div>
      <ContentClient blocks={blocks} />
    </div>
  );
}
