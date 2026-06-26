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

interface ActionItem {
  prepared_at: string | null;
}

export default function OrderActions({ order, items }: { order: Order; items: ActionItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Store fulfillment — the rider can't be dispatched until the store has
  // marked every line item ready for pickup (set on the Store panel).
  const totalItems = items.length;
  const readyItems = items.filter((i) => i.prepared_at).length;
  const allReady = totalItems > 0 && readyItems === totalItems;

  const updateStatus = async (status: OrderStatus) => {
    setLoading(true);
    const patch: Record<string, unknown> = { status };
    if (status === 'try_window_active') {
      // Rider's try-on wait window (7 min). TODO: move to Admin settings.
      const TRY_WINDOW_MINUTES = 7;
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

  const actions: {
    label: string;
    status: OrderStatus;
    color: string;
    disabled?: boolean;
    blockedReason?: string;
  }[] = [];

  if (order.status === 'pending') actions.push({ label: 'Confirm Order', status: 'confirmed', color: 'bg-blue-600 hover:bg-blue-500' });
  if (order.status === 'confirmed') actions.push({
    label: 'Mark Out for Delivery',
    status: 'out_for_delivery',
    color: 'bg-purple-600 hover:bg-purple-500',
    disabled: !allReady,
    blockedReason: !allReady ? `Waiting for the store to mark all items ready (${readyItems}/${totalItems}).` : undefined,
  });
  if (order.status === 'out_for_delivery') actions.push({ label: 'Mark Delivered + Start Try Window', status: 'try_window_active', color: 'bg-teal-600 hover:bg-teal-500' });
  if (order.status === 'try_window_active') actions.push({ label: 'Request Return Pickup', status: 'return_requested', color: 'bg-amber-600 hover:bg-amber-500' });
  if (order.status === 'return_requested') actions.push({ label: 'Mark Return Picked', status: 'return_picked', color: 'bg-cyan-600 hover:bg-cyan-500' });
  if (order.status === 'return_picked') actions.push({ label: 'Mark Completed', status: 'completed', color: 'bg-green-600 hover:bg-green-500' });

  if (!['completed', 'cancelled'].includes(order.status)) {
    actions.push({ label: 'Cancel Order', status: 'cancelled', color: 'bg-red-900/40 hover:bg-red-800/60 border border-red-700 text-red-300' });
  }

  if (actions.length === 0) return null;

  const blockedReason = actions.find((a) => a.blockedReason)?.blockedReason;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            onClick={() => updateStatus(a.status)}
            disabled={loading || a.disabled}
            title={a.blockedReason}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 text-white ${a.color}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {blockedReason ? (
        <p className="mt-3 text-xs text-amber-400">⏳ {blockedReason}</p>
      ) : null}
    </div>
  );
}
