import { createClient } from '@fitxo/supabase/server';
import ActivityLogClient, { type ActivityRow } from './ActivityLogClient';

export default async function ActivityLogPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('activity_logs')
    .select(
      `id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at,
       admin:users(name, email)`,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const logs = (data ?? []) as unknown as ActivityRow[];

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Activity Log</h2>
        <p className="text-sm text-muted">{logs.length} most recent admin actions</p>
      </div>
      <ActivityLogClient logs={logs} />
    </div>
  );
}
