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

interface PendingAction {
  label: string;
  status: OrderStatus;
}

export default function OrderActions({
  order,
  items,
  tryWindowMinutes,
}: {
  order: Order;
  items: ActionItem[];
  /** From Admin > System Settings — not a hardcoded constant. */
  tryWindowMinutes: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');

  // Store fulfillment — the rider can't be dispatched until the store has
  // marked every line item ready for pickup (set on the Store panel).
  const totalItems = items.length;
  const readyItems = items.filter((i) => i.prepared_at).length;
  const allReady = totalItems > 0 && readyItems === totalItems;

  const isCancel = pending?.status === 'cancelled';

  const confirmAction = async () => {
    if (!pending) return;
    if (isCancel && !reason.trim()) return;
    setLoading(true);
    const status = pending.status;

    const patch: Record<string, unknown> = { status };
    if (status === 'try_window_active') {
      patch.try_deadline = new Date(Date.now() + tryWindowMinutes * 60 * 1000).toISOString();
    }
    const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
    if (error) {
      toast('Failed to update order', 'error');
      setLoading(false);
      return;
    }

    // Cancelling mid-flow leaves live rows dangling — close them out so the
    // rider/customer apps don't keep acting on a dead order.
    if (status === 'cancelled') {
      const [{ error: delErr }, { error: tryErr }] = await Promise.all([
        supabase
          .from('deliveries')
          .update({ status: 'failed' })
          .eq('order_id', order.id)
          .not('status', 'in', '(completed,failed)'),
        supabase.from('try_sessions').update({ status: 'expired' }).eq('order_id', order.id).eq('status', 'active'),
      ]);
      if (delErr || tryErr) {
        toast('Order cancelled, but cleanup of delivery/try session failed — check them manually', 'error');
      }
    }

    await logActivity(supabase, {
      action: `Order status → ${status.replace(/_/g, ' ')}`,
      entity_type: 'order',
      entity_id: order.id,
      old_value: { status: order.status },
      new_value: { ...patch, ...(reason.trim() ? { reason: reason.trim() } : {}) },
    });
    toast(`Order updated to ${status.replace(/_/g, ' ')}`, 'success');
    setPending(null);
    setReason('');
    setLoading(false);
    router.refresh();
  };

  const actions: {
    label: string;
    status: OrderStatus;
    color: string;
    disabled?: boolean;
    blockedReason?: string;
  }[] = [];

  if (order.status === 'pending') actions.push({ label: 'Confirm Order', status: 'confirmed', color: 'bg-ink hover:bg-ink-soft text-white' });
  if (order.status === 'confirmed') actions.push({
    label: 'Mark Out for Delivery',
    status: 'out_for_delivery',
    color: 'bg-ink hover:bg-ink-soft text-white',
    disabled: !allReady,
    blockedReason: !allReady ? `Waiting for the store to mark all items ready (${readyItems}/${totalItems}).` : undefined,
  });
  if (order.status === 'out_for_delivery') actions.push({ label: 'Mark Delivered + Start Try Window', status: 'try_window_active', color: 'bg-ink hover:bg-ink-soft text-white' });
  if (order.status === 'try_window_active') actions.push({ label: 'Request Return Pickup', status: 'return_requested', color: 'bg-ink hover:bg-ink-soft text-white' });
  if (order.status === 'return_requested') actions.push({ label: 'Mark Return Picked', status: 'return_picked', color: 'bg-ink hover:bg-ink-soft text-white' });
  if (order.status === 'return_picked') actions.push({ label: 'Mark Completed', status: 'completed', color: 'bg-green-600 hover:bg-green-500 text-white' });

  if (!['completed', 'cancelled'].includes(order.status)) {
    actions.push({ label: 'Cancel Order', status: 'cancelled', color: 'bg-danger-bg hover:bg-danger-line border border-danger-line text-danger' });
  }

  if (actions.length === 0) return null;

  const blockedReason = actions.find((a) => a.blockedReason)?.blockedReason;

  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-3">Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            onClick={() => {
              setPending({ label: a.label, status: a.status });
              setReason('');
            }}
            disabled={loading || a.disabled}
            title={a.blockedReason}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${a.color}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {blockedReason ? (
        <p className="mt-3 text-xs text-warn">⏳ {blockedReason}</p>
      ) : null}

      {/* Confirm + reason modal — every override is deliberate and logged. */}
      {pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !loading && setPending(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-white p-6 space-y-4 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-ink">{pending.label}</h3>
            <p className="text-sm text-soft">
              Move this order from <span className="font-medium text-ink">{order.status.replace(/_/g, ' ')}</span> to{' '}
              <span className="font-medium text-ink">{pending.status.replace(/_/g, ' ')}</span>?
            </p>
            {isCancel ? (
              <p className="rounded-lg border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger">
                Cancelling also fails any live delivery and expires an active try session. This can&apos;t be undone.
              </p>
            ) : null}
            <div>
              <label className="mb-1 block text-xs font-medium text-body">
                Reason{' '}
                {isCancel ? (
                  <span className="text-danger">(required)</span>
                ) : (
                  <span className="text-faint">(optional — goes to the activity log)</span>
                )}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={isCancel ? 'Why is this order being cancelled?' : 'Why are you overriding the status?'}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder-faint focus:border-ink focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPending(null)}
                disabled={loading}
                className="rounded-lg border border-line-strong px-4 py-2 text-sm text-body hover:text-ink"
              >
                Back
              </button>
              <button
                onClick={confirmAction}
                disabled={loading || (isCancel && !reason.trim())}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCancel ? 'bg-danger hover:bg-danger-strong' : 'bg-ink hover:bg-ink-soft'
                }`}
              >
                {loading ? 'Updating…' : pending.label}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
