import { createClient } from '@fitzo/supabase/server';
import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';

export default async function StoresPage() {
  // RLS-bound read — `stores_admin_all` lets the admin session see every
  // store (incl. drafts); no service-role needed to render a page.
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from('stores')
    .select('*, products(id)')
    .order('created_at', { ascending: false });

  // Surface applications awaiting review first.
  const ordered = [...(stores ?? [])].sort(
    (a, b) => (b.onboarding_status === 'submitted' ? 1 : 0) - (a.onboarding_status === 'submitted' ? 1 : 0),
  );
  const pendingCount = ordered.filter((s) => s.onboarding_status === 'submitted').length;

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Stores</h2>
          <p className="text-sm text-gray-500">{stores?.length ?? 0} stores</p>
        </div>
        <Link href="/admin/stores/new" className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg">
          + Add Store
        </Link>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <span className="font-semibold">{pendingCount}</span> store{pendingCount > 1 ? 's are' : ' is'} awaiting onboarding review.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ordered.map((store) => (
          <Link key={store.id} href={`/admin/stores/${store.id}`} className={`block bg-gray-800 border rounded-xl p-5 transition-colors ${store.onboarding_status === 'submitted' ? 'border-amber-500/40 hover:border-amber-500/60' : 'border-gray-700 hover:border-gray-600'}`}>
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-xl overflow-hidden">
                {store.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                ) : '🏪'}
              </div>
              {store.onboarding_status === 'submitted' ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">Review</span>
              ) : store.onboarding_status === 'rejected' ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30">Rejected</span>
              ) : (
                <StatusBadge status={store.is_active ? 'active' : 'inactive'} size="sm" />
              )}
            </div>
            <h3 className="text-base font-semibold text-white mt-3">{store.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{store.city ?? 'City not set'}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span>{(store.products as {id:string}[])?.length ?? 0} products</span>
              {store.is_verified && <span className="text-green-400">✓ Verified</span>}
            </div>
          </Link>
        ))}

        {(!stores || stores.length === 0) && (
          <div className="col-span-3 py-20 text-center text-gray-500">
            No stores yet. <Link href="/admin/stores/new" className="text-indigo-400 hover:text-indigo-300">Add one →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
