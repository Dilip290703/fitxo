import { createClient } from '@fitzo/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import StoreEditClient from './StoreEditClient';
import OnboardingReviewClient from './OnboardingReviewClient';

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: store }, { data: products }, { data: orders }, { data: managers }, { data: business }] = await Promise.all([
    supabase.from('stores').select('*').eq('id', id).single(),
    supabase.from('products').select('id, name, is_active, base_price').eq('store_id', id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
    supabase.from('orders').select('id, order_number, status, final_amount, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('store_managers').select('*, users(name, email)').eq('store_id', id),
    supabase.from('store_business_details').select('*').eq('store_id', id).maybeSingle(),
  ]);

  if (!store) notFound();

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/stores" className="text-sm text-muted hover:text-ink">← Stores</Link>
        <span className="text-faint">/</span>
        <h2 className="text-xl font-bold text-ink">{store.name}</h2>
        <StatusBadge status={store.is_active ? 'active' : 'inactive'} />
        {store.is_verified && <StatusBadge status="completed" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <StoreEditClient store={store} />

          <OnboardingReviewClient
            storeId={store.id}
            storeName={store.name}
            status={store.onboarding_status}
            submittedAt={store.submitted_at}
            rejectionReason={store.rejection_reason}
            business={business ?? null}
          />

          {/* Managers */}
          <div className="bg-white border border-line rounded-xl p-5 mt-4">
            <h3 className="text-xs font-semibold text-soft uppercase tracking-wide mb-3">Store Managers</h3>
            {managers && managers.length > 0 ? (
              <div className="space-y-2">
                {managers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-ink">{(m.users as {name:string; email:string})?.name}</p>
                      <p className="text-xs text-muted">{(m.users as {name:string; email:string})?.email}</p>
                    </div>
                    <StatusBadge status={m.is_active ? 'active' : 'inactive'} size="sm" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No managers assigned</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Products */}
          <div className="bg-white border border-line rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">Products</h3>
              <Link href={`/admin/inventory?store=${id}`} className="text-xs text-info hover:text-ink">View all →</Link>
            </div>
            {products && products.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-hairline">
                      <td className="py-2 text-body">{p.name}</td>
                      <td className="py-2 text-right text-soft">₹{p.base_price}</td>
                      <td className="py-2 pl-3">
                        <StatusBadge status={p.is_active ? 'active' : 'inactive'} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted">No products</p>}
          </div>

          {/* Orders */}
          <div className="bg-white border border-line rounded-xl p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Recent Orders</h3>
            {orders && orders.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-hairline">
                      <td className="py-2">
                        <Link href={`/admin/orders/${o.id}`} className="text-info hover:text-ink font-mono text-xs">{o.order_number}</Link>
                      </td>
                      <td className="py-2"><StatusBadge status={o.status} size="sm" /></td>
                      <td className="py-2 text-right text-soft">₹{o.final_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted">No orders</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
