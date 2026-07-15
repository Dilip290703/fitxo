import { createClient } from '@fitzo/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import OrderActions from './OrderActions';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatWhen(ts: string) {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface TimelineEvent {
  at: string;
  label: string;
  detail?: string;
  tone: 'neutral' | 'green' | 'red' | 'amber';
}

const EVENT_DOT: Record<TimelineEvent['tone'], string> = {
  neutral: 'bg-knob',
  green: 'bg-success',
  red: 'bg-danger',
  amber: 'bg-warn-accent',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: order },
    { data: payments },
    { data: trySession },
    { data: storePayoutRows },
    { data: agentPayoutRows },
    { data: settings },
    { data: logs },
    { data: ecoRow },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(
        `
      *,
      users(id, name, email, phone, avatar_url),
      addresses(*),
      order_items(*, products(store_id, stores(id, name))),
      deliveries(*, riders(*, users(name, phone)))
    `,
      )
      .eq('id', id)
      .single(),
    supabase
      .from('payments')
      .select('id, amount, status, payment_method, razorpay_payment_id, paid_at, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('try_sessions').select('started_at, deadline_at, status').eq('order_id', id).maybeSingle(),
    supabase.from('payouts').select('amount, status, paid_at, store_id').eq('order_id', id),
    supabase.from('agent_payouts').select('amount, status, paid_at, rider_id').eq('order_id', id),
    supabase.from('system_settings').select('commission_rate, try_window_minutes').eq('id', 1).maybeSingle(),
    supabase
      .from('activity_logs')
      .select('action, created_at, new_value')
      .eq('entity_type', 'order')
      .eq('entity_id', id)
      .order('created_at', { ascending: true })
      .limit(30),
    // ONE money truth (migration 044): refund-aware revenue, gateway fees,
    // earned-gated rider cost. Errors pre-044 → data null → inline fallback below.
    supabase.from('order_economics').select('*').eq('order_id', id).maybeSingle(),
  ]);

  if (!order) notFound();

  const tryDeadline = order.try_deadline ? new Date(order.try_deadline) : null;
  const now = new Date();
  // Try window is the rider's 15–30 min wait — measured in minutes, not hours.
  const minutesLeft = tryDeadline ? Math.round((tryDeadline.getTime() - now.getTime()) / 60000) : null;

  // Store fulfillment: how many line items the store has marked ready for pickup.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = order.order_items ?? [];
  const readyCount = items.filter((i) => i.prepared_at).length;
  const allReady = items.length > 0 && readyCount === items.length;

  // ── Stores on this order (via each item's product) ──────────────────────
  const storeMap = new Map<string, { name: string; count: number }>();
  for (const it of items) {
    const store = it.products?.stores;
    if (store?.id) {
      const cur = storeMap.get(store.id) ?? { name: store.name, count: 0 };
      cur.count += 1;
      storeMap.set(store.id, cur);
    }
  }

  // ── Money reconciliation ────────────────────────────────────────────────
  // Since migration 044 the card reads the order_economics view — refund-aware
  // (revenue keys on live success payments, not item decisions), gateway-fee-
  // aware, rider cost gated on delivery completion. Pre-044 the inline math
  // below fills in (old behavior: no refund/gateway lines).
  const eco = ecoRow as null | {
    net_captured: number;
    refunded_total: number;
    kept_gross: number;
    kept_paid_gross: number;
    kept_unpaid_gross: number;
    commission_rate: number;
    commission: number;
    store_net: number;
    delivery_fee_collected: number;
    gateway_cost: number;
    gateway_cost_incomplete: boolean;
    delivery_completed: boolean;
    rider_cost: number;
    margin: number;
    store_paid: number;
    rider_paid: number;
  };
  const tryWindowMinutes = Number(settings?.try_window_minutes ?? 7);
  const inlineCaptured = (payments ?? []).filter((p) => p.status === 'success').reduce((s, p) => s + Number(p.amount), 0);
  const inlineKeptGross = items
    .filter((i) => i.decision === 'keep')
    .reduce((s, i) => s + Number(i.price_at_order ?? 0), 0);
  // Effective rate: since 046 commission is stamped per item (store overrides
  // possible), so derive the displayed percent from the amounts; the view's
  // commission_rate column is only the platform default.
  const commissionRate = eco
    ? Number(eco.kept_paid_gross) > 0
      ? Math.round((Number(eco.commission) / Number(eco.kept_paid_gross)) * 1000) / 10
      : Number(eco.commission_rate)
    : Number(settings?.commission_rate ?? 15);
  const captured = eco ? Number(eco.net_captured) : inlineCaptured;
  const refundedTotal = eco ? Number(eco.refunded_total) : 0;
  const keptGross = eco ? Number(eco.kept_gross) : inlineKeptGross;
  const keptUnpaidGross = eco ? Number(eco.kept_unpaid_gross) : 0;
  const commission = eco
    ? Number(eco.commission)
    : Math.round(inlineKeptGross * (commissionRate / 100) * 100) / 100;
  const storeNet = eco ? Number(eco.store_net) : Math.round((inlineKeptGross - commission) * 100) / 100;
  const storePaid = eco ? Number(eco.store_paid) : (storePayoutRows ?? []).reduce((s, p) => s + Number(p.amount), 0);
  // Rider pay decoupled from the customer delivery charge (migrations 037/038):
  // orders.rider_fee is what the rider earns; orders.delivery_fee is what the customer is charged.
  const riderFee = Number(order.rider_fee ?? 0);
  const deliveryFee = Number(order.delivery_fee ?? 0);
  const deliveryFeeCollected = eco ? Number(eco.delivery_fee_collected) : null; // null = unknown pre-044
  const gatewayCost = eco ? Number(eco.gateway_cost) : null;
  const gatewayIncomplete = eco ? Boolean(eco.gateway_cost_incomplete) : false;
  const margin = eco
    ? Number(eco.margin)
    : Math.round((commission + deliveryFee - riderFee) * 100) / 100;
  const deliveryCompleted = eco
    ? Boolean(eco.delivery_completed)
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (order.deliveries ?? []).some((d: any) => d.status === 'completed');
  const agentPaid = eco ? Number(eco.rider_paid) : (agentPayoutRows ?? []).reduce((s, p) => s + Number(p.amount), 0);

  // ── Timeline: one merged history from every table that touches the order ─
  const events: TimelineEvent[] = [{ at: order.created_at, label: 'Order placed', tone: 'neutral' }];
  const latestPrepared = items
    .map((i) => i.prepared_at)
    .filter(Boolean)
    .sort()
    .pop();
  if (latestPrepared) {
    events.push({
      at: latestPrepared,
      label: `Store marked items ready (${readyCount}/${items.length})`,
      tone: 'neutral',
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (order.deliveries ?? []) as any[]) {
    const rider = d.riders?.users?.name;
    if (d.assigned_at) events.push({ at: d.assigned_at, label: 'Delivery created', tone: 'neutral' });
    if (d.accepted_at) events.push({ at: d.accepted_at, label: `Rider accepted${rider ? ` — ${rider}` : ''}`, tone: 'neutral' });
    if (d.picked_up_at) events.push({ at: d.picked_up_at, label: 'Picked up from store', tone: 'neutral' });
    if (d.completed_at && d.status === 'completed') events.push({ at: d.completed_at, label: 'Delivery completed', tone: 'green' });
    if (d.status === 'failed') {
      events.push({ at: d.completed_at ?? d.assigned_at ?? order.created_at, label: 'Delivery failed', tone: 'red' });
    }
  }
  if (trySession?.started_at) {
    events.push({
      at: trySession.started_at,
      label: 'Try window started',
      detail: `deadline ${formatWhen(trySession.deadline_at)}`,
      tone: 'amber',
    });
    if (trySession.status === 'expired') {
      events.push({ at: trySession.deadline_at, label: 'Try window expired', tone: 'red' });
    }
  }
  for (const it of items) {
    if (it.decision_at && (it.decision === 'keep' || it.decision === 'return')) {
      events.push({
        at: it.decision_at,
        label: it.decision === 'keep' ? `Kept — ${it.product_name}` : `Returned — ${it.product_name}`,
        detail: it.decision === 'keep' ? formatCurrency(Number(it.price_at_order)) : (it.return_reason ?? undefined),
        tone: it.decision === 'keep' ? 'green' : 'amber',
      });
    }
  }
  for (const p of payments ?? []) {
    if (p.status === 'success') {
      events.push({ at: p.paid_at ?? p.created_at, label: `Payment captured — ${formatCurrency(Number(p.amount))}`, tone: 'green' });
    } else if (p.status === 'failed') {
      events.push({ at: p.created_at, label: `Payment failed — ${formatCurrency(Number(p.amount))}`, tone: 'red' });
    }
  }
  for (const l of logs ?? []) {
    const reason = (l.new_value as { reason?: string } | null)?.reason;
    events.push({
      at: l.created_at,
      label: `Admin: ${l.action}`,
      detail: reason ? `reason: ${reason}` : undefined,
      tone: l.action.includes('cancelled') ? 'red' : 'neutral',
    });
  }
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">← Orders</Link>
        <span className="text-faint">/</span>
        <h2 className="text-xl font-bold text-ink font-mono">{order.order_number}</h2>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Customer + Stores + Address + Money + Payment */}
        <div className="space-y-4">
          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-3">Customer</h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-white text-sm font-bold">
                {order.users?.name?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{order.users?.name ?? '—'}</p>
                <p className="text-xs text-muted truncate">{order.users?.email}</p>
              </div>
            </div>
            {order.users?.phone ? (
              <a href={`tel:${order.users.phone}`} className="text-xs text-info hover:text-ink">{order.users.phone}</a>
            ) : (
              <p className="text-xs text-soft">—</p>
            )}
            <Link href={`/admin/customers/${order.users?.id}`} className="text-xs text-info hover:text-ink mt-2 block">
              View profile →
            </Link>
          </div>

          {/* Stores on this order */}
          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-3">
              Store{storeMap.size === 1 ? '' : 's'}
            </h3>
            {storeMap.size === 0 ? (
              <p className="text-sm text-muted">No store linked</p>
            ) : (
              <div className="space-y-1.5">
                {[...storeMap.entries()].map(([storeId, s]) => (
                  <div key={storeId} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/stores/${storeId}`} className="text-sm text-info hover:text-ink truncate">
                      {s.name} →
                    </Link>
                    <span className="text-xs text-muted shrink-0">{s.count} item{s.count === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-3">Delivery Address</h3>
            {order.addresses ? (
              <div className="text-sm text-body space-y-0.5">
                <p className="font-medium text-ink">{order.addresses.full_name}</p>
                <p>{order.addresses.line1}</p>
                {order.addresses.line2 && <p>{order.addresses.line2}</p>}
                {order.addresses.landmark && <p className="text-muted">Near {order.addresses.landmark}</p>}
                <p>{order.addresses.city}, {order.addresses.state} — {order.addresses.pincode}</p>
                <p className="text-muted mt-1">{order.addresses.phone}</p>
              </div>
            ) : <p className="text-sm text-muted">No address</p>}
          </div>

          {/* Money — this order, end to end */}
          <div className="bg-white border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide">Money</h3>
              <Link href="/admin/payments" className="text-[11px] text-info hover:text-ink">Payments →</Link>
            </div>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-soft">Customer paid (captured)</span>
                <span className={captured > 0 ? 'font-medium text-success' : 'text-muted'}>{formatCurrency(captured)}</span>
              </div>
              {refundedTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-soft">Refunded</span>
                  <span className="font-medium text-danger">−{formatCurrency(refundedTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-soft">Kept items (gross)</span>
                <span className="text-ink">{formatCurrency(keptGross)}</span>
              </div>
              {keptUnpaidGross > 0 && (
                <div className="flex justify-between">
                  <span className="text-soft pl-3">of which unpaid / refunded</span>
                  <span className="text-[11px] text-warn font-medium" title="Kept items without a live successful payment — excluded from commission, store payout and margin">
                    {formatCurrency(keptUnpaidGross)} excluded
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-soft">Fitzo commission ({commissionRate}%)</span>
                <span className="text-ink">{formatCurrency(commission)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-soft">Store payout (net)</span>
                <span className="text-ink">
                  {formatCurrency(storeNet)}{' '}
                  {keptGross > 0 ? (
                    <span className={`text-[11px] font-semibold ${storePaid >= storeNet && storeNet > 0 ? 'text-success' : 'text-warn'}`}>
                      {storePaid >= storeNet && storeNet > 0 ? '· paid' : '· owed'}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-soft">Delivery fee {deliveryFeeCollected !== null ? '(collected)' : '(customer)'}</span>
                <span className="text-ink">
                  {formatCurrency(deliveryFeeCollected ?? deliveryFee)}
                  {deliveryFeeCollected !== null && deliveryFeeCollected < deliveryFee ? (
                    <span className="text-[11px] text-faint"> · of {formatCurrency(deliveryFee)} charged</span>
                  ) : null}
                </span>
              </div>
              {gatewayCost !== null && (
                <div className="flex justify-between">
                  <span className="text-soft">Gateway fees (Razorpay)</span>
                  <span className="text-ink">
                    −{formatCurrency(gatewayCost)}
                    {gatewayIncomplete ? (
                      <span className="text-[11px] text-warn" title="Some captured payments have no fee data yet — run Sync gateway fees on the Payments screen"> · partial</span>
                    ) : null}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-soft">Rider pay</span>
                <span className="text-ink">
                  {formatCurrency(riderFee)}{' '}
                  {deliveryCompleted ? (
                    <span className={`text-[11px] font-semibold ${agentPaid >= riderFee && riderFee > 0 ? 'text-success' : 'text-warn'}`}>
                      {agentPaid >= riderFee && riderFee > 0 ? '· paid' : '· owed'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-faint">· not earned yet</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-hairline pt-1.5">
                <span className="font-medium text-ink">Fitzo margin</span>
                <span className={`font-semibold ${margin < 0 ? 'text-danger' : 'text-ink'}`}>{formatCurrency(margin)}</span>
              </div>
            </div>
            <p className="mt-2 text-[10.5px] leading-4 text-faint">
              {eco ? (
                <>Margin = commission + delivery fee collected − rider pay (only once delivered) − gateway fees.
                Refund-aware: refunded payments drop out of revenue, commission and store payout (order_economics, 044).</>
              ) : (
                <>Margin = commission + delivery charge − rider pay. Apply migration 044 for refund-aware,
                gateway-fee-aware numbers from the order_economics view.</>
              )}
            </p>
          </div>

          {/* Payment */}
          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-soft">Status</span>
                <StatusBadge status={order.payment_status} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-soft">Method</span>
                <span className="text-body capitalize">{order.payment_method ?? '—'}</span>
              </div>
              {(payments ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-t border-hairline pt-1.5 text-xs">
                  <span className="font-mono text-muted truncate">{p.razorpay_payment_id ?? p.payment_method}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-body">{formatCurrency(Number(p.amount))}</span>
                    <StatusBadge status={p.status} size="sm" />
                  </span>
                </div>
              ))}
              <div className="border-t border-hairline pt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-soft">Subtotal</span>
                  <span className="text-body">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-soft">Delivery Fee</span>
                  <span className="text-body">{formatCurrency(order.delivery_fee)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-soft">Discount</span>
                    <span className="text-success">−{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span className="text-body">Total</span>
                  <span className="text-ink">{formatCurrency(order.final_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Try window + Items + Actions + Delivery + Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {tryDeadline && order.status === 'try_window_active' && (
            <div className={`rounded-xl px-4 py-3 border ${minutesLeft !== null && minutesLeft < 3 ? 'bg-danger-bg border-danger-line' : 'bg-warn-bg border-warn-accent/50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱</span>
                <div>
                  <p className="text-sm font-semibold text-ink">Try Window</p>
                  <p className="text-xs text-soft">
                    Deadline: {tryDeadline.toLocaleString('en-IN')}
                    {minutesLeft !== null && (
                      <span className={`ml-2 font-medium ${minutesLeft < 3 ? 'text-danger' : 'text-warn'}`}>
                        ({minutesLeft > 0 ? `${minutesLeft}m remaining` : 'EXPIRED'})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Order items */}
          <div className="bg-white border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide">Order Items</h3>
              {items.length > 0 && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    allReady ? 'bg-success-bg text-success' : 'bg-warn-bg text-warn'
                  }`}
                  title="Items the store has packed and marked ready for pickup"
                >
                  {allReady ? '✓ Store ready' : `Store prep: ${readyCount}/${items.length} ready`}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-hairline last:border-0 last:pb-0">
                  <div className="w-12 h-12 bg-sand rounded-lg overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-faint text-xs">No img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{item.product_name}</p>
                    <p className="text-xs text-muted">{item.color_name} · Size {item.size}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-body">{formatCurrency(item.price_at_order)}</span>
                      {item.deposit_at_order > 0 && (
                        <span className="text-xs text-muted">+ ₹{item.deposit_at_order} deposit</span>
                      )}
                    </div>
                    {item.return_reason && (
                      <p className="text-xs text-warn mt-1">Return reason: {item.return_reason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <StatusBadge
                      status={item.decision === 'keep' ? 'completed' : item.decision === 'return' ? 'return_requested' : 'pending'}
                      size="sm"
                    />
                    <p className="text-xs text-faint mt-1 capitalize">{item.decision}</p>
                    <p className={`text-[11px] mt-1 ${item.prepared_at ? 'text-success' : 'text-muted'}`}>
                      {item.prepared_at ? '✓ Ready' : 'Not ready'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <OrderActions order={order} items={items} tryWindowMinutes={tryWindowMinutes} />

          {/* Delivery info */}
          {order.deliveries && order.deliveries.length > 0 && (
            <div className="bg-white border border-line rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide">Delivery</h3>
                <Link href="/admin/deliveries" className="text-[11px] text-info hover:text-ink">Deliveries →</Link>
              </div>
              {order.deliveries.map((delivery: {
                id: string;
                type: string;
                status: string;
                distance_km: number | null;
                estimated_minutes: number | null;
                riders: { id: string; users: { name: string; phone: string } } | null;
              }) => (
                <div key={delivery.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-body capitalize">{delivery.type.replace('_', ' ')}</span>
                    <StatusBadge status={delivery.status} size="sm" />
                  </div>
                  {delivery.riders?.users && (
                    <div>
                      <p className="text-xs text-muted">
                        Rider:{' '}
                        <Link href={`/admin/riders/${delivery.riders.id}`} className="text-info hover:text-ink">
                          {delivery.riders.users.name} →
                        </Link>
                      </p>
                      {delivery.riders.users.phone ? (
                        <a href={`tel:${delivery.riders.users.phone}`} className="text-xs text-info hover:text-ink">
                          {delivery.riders.users.phone}
                        </a>
                      ) : null}
                    </div>
                  )}
                  {delivery.distance_km && (
                    <p className="text-xs text-muted">{delivery.distance_km} km · ~{delivery.estimated_minutes} mins</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white border border-line rounded-xl p-4">
            <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-3">Timeline</h3>
            <ol>
              {events.map((e, i) => (
                <li key={`${e.at}-${e.label}`} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < events.length - 1 ? (
                    <span className="absolute left-[3.5px] top-3 h-full w-px bg-hairline" aria-hidden />
                  ) : null}
                  <span className={`relative mt-1.5 h-2 w-2 shrink-0 rounded-full ${EVENT_DOT[e.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">{e.label}</p>
                    {e.detail ? <p className="text-[11px] text-muted">{e.detail}</p> : null}
                  </div>
                  <span className="shrink-0 text-[11px] text-faint">{formatWhen(e.at)}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white border border-line rounded-xl p-4">
              <h3 className="text-[11px] font-semibold text-soft uppercase tracking-wide mb-2">Customer Notes</h3>
              <p className="text-sm text-body">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
