import { createClient } from '@fitxo/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import CustomerActions from './CustomerActions';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: orders }, { data: addresses }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('orders').select('id, order_number, status, final_amount, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    supabase.from('addresses').select('*').eq('user_id', id),
  ]);

  if (!customer) notFound();

  const totalSpent = orders?.reduce((s, o) => s + (o.final_amount ?? 0), 0) ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="text-sm text-muted hover:text-ink">← Customers</Link>
        <span className="text-faint">/</span>
        <h2 className="text-xl font-bold text-ink">{customer.name ?? customer.email}</h2>
        {customer.is_blocked && <StatusBadge status="cancelled" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          {/* Profile */}
          <div className="bg-white border border-line rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-xl text-white font-bold">
                {customer.name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-ink">{customer.name ?? '—'}</p>
                <p className="text-xs text-muted">{customer.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-soft">Phone</span><span className="text-body">{customer.phone ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-soft">Gender</span><span className="text-body capitalize">{customer.gender ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-soft">Total Orders</span><span className="text-ink font-medium">{orders?.length ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-soft">Total Spent</span><span className="text-ink font-medium">₹{new Intl.NumberFormat('en-IN').format(totalSpent)}</span></div>
              <div className="flex justify-between"><span className="text-soft">Joined</span><span className="text-muted text-xs">{new Date(customer.created_at).toLocaleDateString('en-IN')}</span></div>
              {customer.last_seen_at && <div className="flex justify-between"><span className="text-soft">Last Seen</span><span className="text-muted text-xs">{new Date(customer.last_seen_at).toLocaleDateString('en-IN')}</span></div>}
            </div>
          </div>

          {/* Style prefs */}
          {customer.skin_tone && (
            <div className="bg-white border border-line rounded-xl p-5">
              <h3 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Style Profile</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-soft">Skin Tone</span><span className="text-body">{customer.skin_tone}</span></div>
                <div className="flex justify-between"><span className="text-soft">Undertone</span><span className="text-body">{customer.skin_undertone ?? '—'}</span></div>
                {customer.preferred_sizes && typeof customer.preferred_sizes === 'object' && (
                  <div className="mt-2">
                    <p className="text-xs text-muted mb-1">Preferred Sizes</p>
                    <pre className="text-xs text-body bg-sand rounded p-2">
                      {JSON.stringify(customer.preferred_sizes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          <CustomerActions customer={customer} />

          {/* Addresses */}
          <div className="bg-white border border-line rounded-xl p-5">
            <h3 className="text-xs font-semibold text-soft uppercase tracking-wide mb-3">Addresses</h3>
            {addresses && addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className="text-xs text-body pb-3 border-b border-hairline last:border-0">
                    <p className="font-medium text-ink capitalize">{addr.label} {addr.is_default && '(default)'}</p>
                    <p>{addr.line1}</p>
                    {addr.line2 && <p>{addr.line2}</p>}
                    <p>{addr.city}, {addr.pincode}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">No addresses</p>}
          </div>
        </div>

        {/* Orders */}
        <div className="lg:col-span-2 bg-white border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Order History ({orders?.length ?? 0})</h3>
          {orders && orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-soft">
                    <th className="text-left pb-2 font-medium">Order #</th>
                    <th className="text-left pb-2 font-medium">Status</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                    <th className="text-right pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-hairline">
                      <td className="py-2.5 pr-3">
                        <Link href={`/admin/orders/${o.id}`} className="text-info hover:text-ink font-mono text-xs">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3"><StatusBadge status={o.status} size="sm" /></td>
                      <td className="py-2.5 text-right text-body">₹{new Intl.NumberFormat('en-IN').format(o.final_amount)}</td>
                      <td className="py-2.5 text-right text-muted text-xs">
                        {new Date(o.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No orders yet</p>}
        </div>
      </div>
    </div>
  );
}
