'use client';

import { useState, useMemo, useTransition } from 'react';
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

export default function UsersClient({ users, stores }: { users: UserRow[]; stores: StoreOption[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');

  // Change-role modal state
  const [target, setTarget] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState<Role>('customer');
  const [storeId, setStoreId] = useState('');

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (tab !== 'all' && u.role !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(u.name ?? '').toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.phone ?? '').includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, tab, search]);

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
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
          className="sm:ml-auto w-full sm:w-72 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Assigned</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">No users found.</td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm text-white">{u.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{u.phone ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.role} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-gray-400">{linkedLabel(u)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openModal(u)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                      Change role
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Change-role modal */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeModal}>
          <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-white">Change role</h3>
              <p className="text-xs text-gray-500 mt-0.5">{target.name ?? target.email}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white capitalize focus:outline-none focus:border-indigo-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {newRole === 'store_manager' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select a store…</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {newRole === 'admin' && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚠ Grants full admin access to the entire platform.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeModal} className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isPending || (newRole === 'store_manager' && !storeId)}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg"
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
