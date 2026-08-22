'use client';

import { useCallback, useState } from 'react';
import Pager from '@/components/admin/Pager';
import { buildQuery, type PageInfo } from '@/lib/pagination';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@fitxo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import StatusBadge from '@/components/admin/StatusBadge';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { logActivity } from '@/lib/activity';

interface Rider {
  id: string;
  is_available: boolean;
  users: { name: string; phone: string } | null;
}

interface Delivery {
  id: string;
  order_id: string;
  rider_id: string | null;
  type: string;
  status: string;
  assigned_at: string | null;
  distance_km: number | null;
  estimated_minutes: number | null;
  orders: { order_number: string; status: string; users: { name: string; phone: string } | null } | null;
  riders: { id: string; users: { name: string; phone: string } | null } | null;
}

export default function DeliveriesClient({
  deliveries,
  riders,
  pageInfo,
}: {
  /** One page of rows. */
  deliveries: Delivery[];
  riders: Rider[];
  pageInfo: PageInfo;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/deliveries${qs}`, { scroll: false });
    },
    [router, searchParams],
  );
  const { toast } = useToast();
  const supabase = createClient();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{ kind: 'release' | 'fail'; delivery: Delivery } | null>(null);

  const activeDeliveries = deliveries.filter((d) => !['completed', 'failed'].includes(d.status));
  const unassigned = activeDeliveries.filter((d) => !d.rider_id);
  const assigned = activeDeliveries.filter((d) => d.rider_id);

  const assignRider = async (deliveryId: string) => {
    const riderId = selectedRiders[deliveryId];
    if (!riderId) return;
    setAssigning(deliveryId);
    const { error } = await supabase.from('deliveries').update({ rider_id: riderId }).eq('id', deliveryId);
    setAssigning(null);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Assigned rider to delivery', entity_type: 'delivery', entity_id: deliveryId, new_value: { rider_id: riderId } });
      toast('Rider assigned!', 'success'); router.refresh();
    }
  };

  const releaseDelivery = async (deliveryId: string) => {
    setReleasing(deliveryId);
    const { error } = await supabase
      .from('deliveries')
      .update({ rider_id: null, status: 'assigned', accepted_at: null })
      .eq('id', deliveryId);
    setReleasing(null);
    setConfirmAction(null);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Released delivery back to pool', entity_type: 'delivery', entity_id: deliveryId });
      toast('Delivery released back to the pool', 'success'); router.refresh();
    }
  };

  // The terminal "this delivery isn't happening" path — customer unreachable,
  // rider gave up, etc. Before this, `failed` existed in the enum with no
  // admin UI able to set it (loops of Release were the only option).
  const failDelivery = async (delivery: Delivery) => {
    setReleasing(delivery.id);
    const { error } = await supabase.from('deliveries').update({ status: 'failed' }).eq('id', delivery.id);
    setReleasing(null);
    setConfirmAction(null);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, {
        action: 'Marked delivery failed',
        entity_type: 'delivery',
        entity_id: delivery.id,
        old_value: { status: delivery.status },
        new_value: { status: 'failed' },
      });
      toast('Delivery marked failed — handle the order from its detail page', 'success');
      router.refresh();
    }
  };

  const availableRiders = riders.filter((r) => r.is_available);

  return (
    <div className="space-y-6">
      {/* Unassigned */}
      <div>
        <h3 className="text-sm font-semibold text-warn mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-warn-accent rounded-full" />
          Unassigned Deliveries ({unassigned.length})
        </h3>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted pl-4">All deliveries are assigned ✓</p>
        ) : (
          <div className="space-y-2">
            {unassigned.map((d) => (
              <div key={d.id} className="bg-white border border-warn-accent/40 rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/orders/${d.order_id}`} className="text-sm font-medium text-info hover:text-ink">
                    {d.orders?.order_number ?? d.order_id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">{d.orders?.users?.name ?? '—'} · {d.type.replace('_', ' ')}</p>
                </div>
                <StatusBadge status={d.status} size="sm" />
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRiders[d.id] ?? ''}
                    onChange={(e) => setSelectedRiders((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="bg-sand border border-line-strong rounded-lg px-2 py-1.5 text-sm text-ink"
                  >
                    <option value="">Select rider…</option>
                    {availableRiders.map((r) => (
                      <option key={r.id} value={r.id}>{r.users?.name ?? r.id.slice(0, 8)}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignRider(d.id)}
                    disabled={!selectedRiders[d.id] || assigning === d.id}
                    className="px-3 py-1.5 text-sm bg-ink hover:bg-ink-soft disabled:opacity-60 text-white rounded-lg"
                  >
                    {assigning === d.id ? '…' : 'Assign'}
                  </button>
                  <button
                    onClick={() => setConfirmAction({ kind: 'fail', delivery: d })}
                    disabled={releasing === d.id}
                    title="Give up on this delivery"
                    className="px-2.5 py-1.5 text-xs border border-danger-line text-danger rounded-lg hover:bg-danger-bg disabled:opacity-50"
                  >
                    Fail
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active/assigned */}
      <div>
        <h3 className="text-sm font-semibold text-success mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          Active Deliveries ({assigned.length})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-cream/60 text-xs text-soft">
                <th className="px-4 py-3 text-left font-medium">Order</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Rider</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Distance</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((d) => (
                <tr key={d.id} className="border-b border-hairline hover:bg-cream/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${d.order_id}`} className="text-info hover:text-ink font-mono text-xs">
                      {d.orders?.order_number ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-body">{d.orders?.users?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-body capitalize text-xs">{d.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-body">{d.riders?.users?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} size="sm" /></td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {d.distance_km ? `${d.distance_km} km` : '—'}
                    {d.estimated_minutes ? ` · ~${d.estimated_minutes}m` : ''}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmAction({ kind: 'release', delivery: d })}
                        disabled={releasing === d.id}
                        title="Return this delivery to the rider pool"
                        className="px-2.5 py-1 text-xs border border-line-strong text-body rounded-lg hover:border-warn-accent hover:text-warn disabled:opacity-50"
                      >
                        {releasing === d.id ? '…' : 'Release'}
                      </button>
                      <button
                        onClick={() => setConfirmAction({ kind: 'fail', delivery: d })}
                        disabled={releasing === d.id}
                        title="Give up on this delivery (customer unreachable, rider no-show…)"
                        className="px-2.5 py-1 text-xs border border-danger-line text-danger rounded-lg hover:bg-danger-bg disabled:opacity-50"
                      >
                        Fail
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {assigned.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No active deliveries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pager
        page={pageInfo.page}
        pageSize={pageInfo.pageSize}
        total={pageInfo.total}
        onPage={(p) => push({ page: p === 0 ? null : p + 1 })}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.kind === 'fail' ? 'Mark delivery failed' : 'Release delivery'}
        message={
          confirmAction?.kind === 'fail'
            ? `Give up on ${confirmAction.delivery.orders?.order_number ?? 'this delivery'}? It leaves the rider pool for good — then cancel or re-dispatch the order from its detail page.`
            : `Return ${confirmAction?.delivery.orders?.order_number ?? 'this delivery'} to the pool? The current rider loses it and any online rider can claim it.`
        }
        confirmLabel={confirmAction?.kind === 'fail' ? 'Mark failed' : 'Release'}
        destructive={confirmAction?.kind === 'fail'}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.kind === 'fail') failDelivery(confirmAction.delivery);
          else releaseDelivery(confirmAction.delivery.id);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
