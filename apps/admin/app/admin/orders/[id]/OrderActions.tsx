'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import { logActivity } from '@/lib/activity';
import type { OrderStatus } from '@fitzo/supabase/types';

interface Order {
  id: string;
  status: OrderStatus;
  user_id: string;
}

export default function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (status: OrderStatus) => {
    setLoading(true);
    const patch: Record<string, unknown> = { status };
    if (status === 'try_window_active') {
      // Rider's try-on wait window (15–30 min). TODO: move to Admin settings.
      const TRY_WINDOW_MINUTES = 30;
      patch.try_deadline = new Date(Date.now() + TRY_WINDOW_MINUTES * 60 * 1000).toISOString();
    }
    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    if (error) toast('Failed to update order', 'error');
    else {
      await logActivity(supabase, {
        action: `Order status → ${status.replace(/_/g, ' ')}`,
        entity_type: 'order',
        entity_id: order.id,
        old_value: { status: order.status },
        new_value: patch,
      });
      toast(`Order updated to ${status.replace(/_/g, ' ')}`, 'success');
      router.refresh();
    }
    setLoading(false);
  };

  const actions: { label: string; status: OrderStatus; color: string }[] = [];

  if (order.status === 'pending') actions.push({ label: 'Confirm Order', status: 'confirmed', color: 'bg-blue-600 hover:bg-blue-500' });
  if (order.status === 'confirmed') actions.push({ label: 'Mark Out for Delivery', status: 'out_for_delivery', color: 'bg-purple-600 hover:bg-purple-500' });
  if (order.status === 'out_for_delivery') actions.push({ label: 'Mark Delivered + Start Try Window', status: 'try_window_active', color: 'bg-teal-600 hover:bg-teal-500' });
  if (order.status === 'try_window_active') actions.push({ label: 'Request Return Pickup', status: 'return_requested', color: 'bg-amber-600 hover:bg-amber-500' });
  if (order.status === 'return_requested') actions.push({ label: 'Mark Return Picked', status: 'return_picked', color: 'bg-cyan-600 hover:bg-cyan-500' });
  if (order.status === 'return_picked') actions.push({ label: 'Mark Completed', status: 'completed', color: 'bg-green-600 hover:bg-green-500' });

  if (!['completed', 'cancelled'].includes(order.status)) {
    actions.push({ label: 'Cancel Order', status: 'cancelled', color: 'bg-red-900/40 hover:bg-red-800/60 border border-red-700 text-red-300' });
  }

  if (actions.length === 0) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            onClick={() => updateStatus(a.status)}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-60 text-white ${a.color}`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
