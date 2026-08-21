'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Pager from '@/components/admin/Pager';
import { buildQuery, type PageInfo } from '@/lib/pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/components/admin/Toast';
import { sendNotification, type NotifType, type SegmentRole, type Target } from './actions';

export interface NotificationRow {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  user: { name: string | null; email: string } | null;
}

const TYPE_TABS: { label: string; value: NotifType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'System', value: 'system' },
  { label: 'Promo', value: 'promo' },
  { label: 'Order Update', value: 'order_update' },
];

const inputClass = 'w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink';

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsClient({
  notifications,
  pageInfo,
  activeType,
  activeSearch,
}: {
  /** One page of rows — the type filter and search ran in the query. */
  notifications: NotificationRow[];
  pageInfo: PageInfo;
  activeType: string;
  activeSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/notifications${qs}`, { scroll: false });
    },
    [router, searchParams],
  );

  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Compose form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotifType>('system');
  const [audience, setAudience] = useState<'all' | 'role' | 'user'>('all');
  const [role, setRole] = useState<SegmentRole>('customer');
  const [email, setEmail] = useState('');

  // List filters
  const [search, setSearch] = useState(activeSearch);
  useEffect(() => setSearch(activeSearch), [activeSearch]);
  useEffect(() => {
    if (search === activeSearch) return;
    const t = setTimeout(() => push({ q: search || null }), 350);
    return () => clearTimeout(t);
  }, [search, activeSearch, push]);

  // No client-side filter: `notifications` is already the filtered page.

  const send = () => {
    const target: Target =
      audience === 'all' ? { kind: 'all' } : audience === 'role' ? { kind: 'role', role } : { kind: 'user', email };
    startTransition(async () => {
      try {
        const { count } = await sendNotification({ title, body, type, target });
        toast(`Sent to ${count} user${count === 1 ? '' : 's'}`, 'success');
        setTitle('');
        setBody('');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not send', 'error');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Compose */}
      <section className="bg-white border border-line rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink">Send a notification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-soft mb-1.5">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Weekend sale is live" />
          </div>
          <div>
            <label className="block text-xs font-medium text-soft mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as NotifType)} className={inputClass}>
              <option value="system">System</option>
              <option value="promo">Promo</option>
              <option value="order_update">Order update</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-soft mb-1.5">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputClass} placeholder="Notification body…" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-soft mb-1.5">Audience</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={inputClass}>
              <option value="all">All users</option>
              <option value="role">By role</option>
              <option value="user">Single user</option>
            </select>
          </div>
          {audience === 'role' && (
            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as SegmentRole)} className={inputClass}>
                <option value="customer">Customers</option>
                <option value="store_manager">Store managers</option>
                <option value="rider">Riders</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          )}
          {audience === 'user' && (
            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">User email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="user@example.com" />
            </div>
          )}
        </div>
        <button
          onClick={send}
          disabled={isPending || !title.trim() || !body.trim() || (audience === 'user' && !email.trim())}
          className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg"
        >
          {isPending ? 'Sending…' : 'Send notification'}
        </button>
      </section>

      {/* Sent / history */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => push({ type: t.value })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeType === t.value ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search title, message, recipient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:ml-auto w-full sm:w-72 bg-white border border-line rounded-xl px-4 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-cream/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Read</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">When</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted">No notifications yet.</td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className="border-b border-hairline hover:bg-cream transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm text-ink">{n.user?.name ?? '—'}</p>
                      <p className="text-xs text-muted">{n.user?.email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={n.type} size="sm" /></td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-body">{n.title}</p>
                      <p className="text-xs text-muted line-clamp-1 max-w-md">{n.body}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${n.is_read ? 'text-muted' : 'text-warn'}`}>{n.is_read ? 'Read' : 'Unread'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-soft">{formatDateTime(n.created_at)}</td>
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
      </div>
    </div>
  );
}
