'use client';

import { useState, useMemo, useTransition } from 'react';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/components/admin/Toast';
import { updateComplaint, type ComplaintStatus } from './actions';

export interface ComplaintRow {
  id: string;
  subject: string;
  message: string;
  status: ComplaintStatus;
  priority: 'low' | 'normal' | 'high';
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  user: { name: string | null; email: string } | null;
  order: { order_number: string } | null;
}

const STATUS_TABS: { label: string; value: ComplaintStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

const STATUSES: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ComplaintsClient({
  complaints,
  initialTab,
}: {
  complaints: ComplaintRow[];
  initialTab?: string;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<ComplaintStatus | 'all'>(
    STATUS_TABS.some((t) => t.value === initialTab) ? (initialTab as ComplaintStatus | 'all') : 'all',
  );
  const [search, setSearch] = useState('');

  const [active, setActive] = useState<ComplaintRow | null>(null);
  const [status, setStatus] = useState<ComplaintStatus>('open');
  const [response, setResponse] = useState('');

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (tab !== 'all' && c.status !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.subject.toLowerCase().includes(q) &&
          !c.message.toLowerCase().includes(q) &&
          !(c.user?.email ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, tab, search]);

  const open = (c: ComplaintRow) => {
    setActive(c);
    setStatus(c.status);
    setResponse(c.admin_response ?? '');
  };

  const save = () => {
    if (!active) return;
    startTransition(async () => {
      try {
        await updateComplaint(active.id, { status, admin_response: response });
        toast('Complaint updated', 'success');
        setActive(null);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not update', 'error');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.value ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search subject, message, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:ml-auto w-full sm:w-72 bg-white border border-line rounded-xl px-4 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">From</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">When</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">No complaints.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-hairline hover:bg-cream transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm text-ink">{c.subject}</p>
                    <p className="text-xs text-muted line-clamp-1 max-w-sm">{c.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-body">{c.user?.name ?? '—'}</p>
                    <p className="text-xs text-muted">{c.user?.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} size="sm" /></td>
                  <td className="px-4 py-3 text-xs text-soft">{formatDateTime(c.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => open(c)} className="text-xs text-info hover:text-ink font-medium">Manage</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !isPending && setActive(null)}>
          <div className="w-full max-w-lg bg-white border border-line rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-ink">{active.subject}</h3>
              <p className="text-xs text-muted mt-0.5">
                {active.user?.email ?? '—'}{active.order ? ` · order ${active.order.order_number}` : ''}
              </p>
            </div>
            <p className="text-sm text-body bg-white/60 rounded-lg p-3 max-h-40 overflow-y-auto">{active.message}</p>

            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)} className="w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink capitalize focus:outline-none focus:border-ink">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">Response (internal/notes)</label>
              <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} className="w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" placeholder="How was this handled…" />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setActive(null)} disabled={isPending} className="px-4 py-2 text-sm border border-line-strong text-body rounded-lg hover:border-line-strong">Cancel</button>
              <button onClick={save} disabled={isPending} className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 text-white font-medium rounded-lg">
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
