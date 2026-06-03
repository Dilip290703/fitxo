import { createClient } from '@fitzo/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import OrderActions from './OrderActions';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      users(id, name, email, phone, avatar_url),
      addresses(*),
      order_items(*),
      deliveries(*, riders(*, users(name, phone)))
    `)
    .eq('id', id)
    .single();

  if (!order) notFound();

  const tryDeadline = order.try_deadline ? new Date(order.try_deadline) : null;
  const now = new Date();
  const hoursLeft = tryDeadline ? Math.round((tryDeadline.getTime() - now.getTime()) / 3600000) : null;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-white">← Orders</Link>
        <span className="text-gray-700">/</span>
        <h2 className="text-xl font-bold text-white font-mono">{order.order_number}</h2>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Customer + Address */}
        <div className="space-y-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Customer</h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                {order.users?.name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{order.users?.name ?? '—'}</p>
                <p className="text-xs text-gray-500">{order.users?.email}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">{order.users?.phone ?? '—'}</p>
            <Link href={`/admin/customers/${order.users?.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
              View profile →
            </Link>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Delivery Address</h3>
            {order.addresses ? (
              <div className="text-sm text-gray-300 space-y-0.5">
                <p className="font-medium text-white">{order.addresses.full_name}</p>
                <p>{order.addresses.line1}</p>
                {order.addresses.line2 && <p>{order.addresses.line2}</p>}
                {order.addresses.landmark && <p className="text-gray-500">Near {order.addresses.landmark}</p>}
                <p>{order.addresses.city}, {order.addresses.state} — {order.addresses.pincode}</p>
                <p className="text-gray-500 mt-1">{order.addresses.phone}</p>
              </div>
            ) : <p className="text-sm text-gray-500">No address</p>}
          </div>

          {/* Payment */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <StatusBadge status={order.payment_status} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Method</span>
                <span className="text-gray-300 capitalize">{order.payment_method ?? '—'}</span>
              </div>
              {order.razorpay_payment_id && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Razorpay ID</span>
                  <span className="text-gray-300 font-mono text-xs">{order.razorpay_payment_id}</span>
                </div>
              )}
              <div className="border-t border-gray-700 pt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-gray-300">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Delivery Fee</span>
                  <span className="text-gray-300">{formatCurrency(order.delivery_fee)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Discount</span>
                    <span className="text-green-400">−{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-300">Total</span>
                  <span className="text-white">{formatCurrency(order.final_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Items + Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Try window */}
          {tryDeadline && (
            <div className={`rounded-xl px-5 py-4 border ${hoursLeft !== null && hoursLeft < 4 ? 'bg-red-900/20 border-red-700' : 'bg-amber-900/20 border-amber-700'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱</span>
                <div>
                  <p className="text-sm font-semibold text-white">Try Window</p>
                  <p className="text-xs text-gray-400">
                    Deadline: {tryDeadline.toLocaleString('en-IN')}
                    {hoursLeft !== null && (
                      <span className={`ml-2 font-medium ${hoursLeft < 4 ? 'text-red-400' : 'text-amber-400'}`}>
                        ({hoursLeft > 0 ? `${hoursLeft}h remaining` : 'EXPIRED'})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Order items */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Order Items</h3>
            <div className="space-y-3">
              {order.order_items?.map((item: {
                id: string;
                product_name: string;
                color_name: string;
                size: string;
                image_url: string | null;
                price_at_order: number;
                deposit_at_order: number;
                decision: string;
                return_reason: string | null;
              }) => (
                <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-gray-700/50 last:border-0">
                  <div className="w-14 h-14 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No img</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.color_name} · Size {item.size}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-300">{formatCurrency(item.price_at_order)}</span>
                      {item.deposit_at_order > 0 && (
                        <span className="text-xs text-gray-500">+ ₹{item.deposit_at_order} deposit</span>
                      )}
                    </div>
                    {item.return_reason && (
                      <p className="text-xs text-amber-400 mt-1">Return reason: {item.return_reason}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <StatusBadge
                      status={item.decision === 'keep' ? 'completed' : item.decision === 'return' ? 'return_requested' : 'pending'}
                      size="sm"
                    />
                    <p className="text-xs text-gray-600 mt-1 capitalize">{item.decision}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <OrderActions order={order} />

          {/* Delivery info */}
          {order.deliveries && order.deliveries.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Delivery</h3>
              {order.deliveries.map((delivery: {
                id: string;
                type: string;
                status: string;
                distance_km: number | null;
                estimated_minutes: number | null;
                riders: { users: { name: string; phone: string } } | null;
              }) => (
                <div key={delivery.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 capitalize">{delivery.type.replace('_', ' ')}</span>
                    <StatusBadge status={delivery.status} size="sm" />
                  </div>
                  {delivery.riders?.users && (
                    <div>
                      <p className="text-xs text-gray-500">Rider: <span className="text-gray-300">{delivery.riders.users.name}</span></p>
                      <p className="text-xs text-gray-500">{delivery.riders.users.phone}</p>
                    </div>
                  )}
                  {delivery.distance_km && (
                    <p className="text-xs text-gray-500">{delivery.distance_km} km · ~{delivery.estimated_minutes} mins</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Customer Notes</h3>
              <p className="text-sm text-gray-300">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
