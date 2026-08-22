'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/components/admin/Toast';
import { changeUserRole, type Role } from './actions';

export interface StoreOption {
  id: string;
  name: string;
}

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: Role;
  is_blocked: boolean;
  created_at: string;
  store_managers: { store_id: string; is_active: boolean; stores: { name: string } | null }[];
  riders: { id: string; is_verified: boolean }[];
}

import Pager from '@/components/admin/Pager';
import { buildQuery, type PageInfo } from '@/lib/pagination';

const ROLES: Role[] = ['customer', 'store_manager', 'rider', 'admin'];

const ROLE_TABS: { label: string; value: Role | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Customers', value: 'customer' },
  { label: 'Store Managers', value: 'store_manager' },
  { label: 'Riders', value: 'rider' },
  { label: 'Admins', value: 'admin' },
];

function linkedLabel(u: UserRow): string {
  if (u.role === 'store_manager') {
    const active = u.store_managers.filter((m) => m.is_active);
    if (active.length) return active.map((m) => m.stores?.name ?? '—').join(', ');
  }
  if (u.role === 'rider' && u.riders.length) return 'Rider profile';
  return '—';
}

export default function UsersClient({
  users,
  stores,
  pageInfo,
  activeRole,
  activeSearch,
}: {
  /** One page of rows — the role filter and search ran in the query. */
  users: UserRow[];
  stores: StoreOption[];
  pageInfo: PageInfo;
  activeRole: string;
  activeSearch: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/users${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [search, setSearch] = useState(activeSearch);
  useEffect(() => setSearch(activeSearch), [activeSearch]);
  useEffect(() => {
    if (search === activeSearch) return;
    const t = setTimeout(() => push({ q: search || null }), 350);
    return () => clearTimeout(t);
  }, [search, activeSearch, push]);

  // Change-role modal state
  const [target, setTarget] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<Role>('customer');
  const [storeId, setStoreId] = useState('');

  // No client-side filter: `users` is already the filtered page.

  const openModal = (u: UserRow) => {
    setTarget(u);
    setNewRole(u.role);
    setStoreId(u.store_managers.find((m) => m.is_active)?.store_id ?? '');
  };

  const closeModal = () => setTarget(null);

  const submit = () => {
    if (!target) return;
    startTransition(async () => {
      try {
        await changeUserRole(target.id, newRole, newRole === 'store_manager' ? storeId : undefined);
        toast('Role updated', 'success');
        closeModal();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not change role', 'error');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {ROLE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => push({ role: t.value })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeRole === t.value ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto w-full sm:w-72 bg-white border border-line rounded-xl px-4 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Assigned</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">No users found.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-hairline hover:bg-cream transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm text-ink">{u.name ?? '—'}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-body">{u.phone ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.role} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-soft">{linkedLabel(u)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openModal(u)} className="text-xs text-info hover:text-ink font-medium">
                      Change role
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager
        page={pageInfo.page}
        pageSize={pageInfo.pageSize}
        total={pageInfo.total}
        onPage={(p) => push({ page: p === 0 ? null : p + 1 })}
      />

      {/* Change-role modal */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeModal}>
          <div className="w-full max-w-md bg-white border border-line rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-ink">Change role</h3>
              <p className="text-xs text-muted mt-0.5">{target.name ?? target.email}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink capitalize focus:outline-none focus:border-ink"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {newRole === 'store_manager' && (
              <div>
                <label className="block text-xs font-medium text-soft mb-1.5">Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
                >
                  <option value="">Select a store…</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {newRole === 'admin' && (
              <p className="text-xs text-warn bg-warn-bg border border-warn-accent/40 rounded-lg px-3 py-2">
                ⚠ Grants full admin access to the entire platform.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeModal} className="px-4 py-2 text-sm border border-line-strong text-body rounded-lg hover:border-line-strong">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || (newRole === 'store_manager' && !storeId)}
                className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
