import { createClient } from '@fitzo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import NotificationsClient, { type NotificationRow } from './NotificationsClient';

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('notifications')
    .select(`id, type, title, body, is_read, created_at, user:users(name, email)`)
    .order('created_at', { ascending: false })
    .limit(200);

  const notifications = (data ?? []) as unknown as NotificationRow[];
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Notifications & Alerts</h2>
        <p className="text-sm text-muted">{notifications.length} recent</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard title="Total (recent)" value={notifications.length} icon="🔔" color="indigo" />
        <StatsCard title="Unread" value={unread} icon="●" color="amber" />
      </div>

      <NotificationsClient notifications={notifications} />
    </div>
  );
}
