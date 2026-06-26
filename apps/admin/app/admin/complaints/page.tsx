import { createClient } from '@fitzo/supabase/server';
import ComplaintsClient, { type ComplaintRow } from './ComplaintsClient';

export default async function ComplaintsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('complaints')
    .select(
      `id, subject, message, status, priority, admin_response, created_at, resolved_at,
       user:users(name, email), order:orders(order_number)`,
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const complaints = (data ?? []) as unknown as ComplaintRow[];
  const open = complaints.filter((c) => c.status === 'open' || c.status === 'in_progress').length;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-white">Complaints & Support</h2>
        <p className="text-sm text-gray-500">{complaints.length} total · {open} open</p>
      </div>
      <ComplaintsClient complaints={complaints} />
    </div>
  );
}
