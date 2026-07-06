'use client';

import { useState, useMemo, Fragment } from 'react';

export interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin: { name: string; email: string } | null;
}

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hasDiff(row: ActivityRow) {
  return Boolean(row.old_value || row.new_value);
}

export default function ActivityLogClient({ logs }: { logs: ActivityRow[] }) {
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entity_type))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (entityFilter !== 'all' && l.entity_type !== entityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.action.toLowerCase().includes(q) &&
          !l.entity_type.toLowerCase().includes(q) &&
          !(l.entity_id ?? '').toLowerCase().includes(q) &&
          !(l.admin?.name ?? '').toLowerCase().includes(q) &&
          !(l.admin?.email ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, entityFilter, search]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setEntityFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              entityFilter === 'all' ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
            }`}
          >
            All
          </button>
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => setEntityFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                entityFilter === t ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search action, admin, entity…"
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide whitespace-nowrap">When</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide whitespace-nowrap">Admin</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide whitespace-nowrap">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide whitespace-nowrap">Entity</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide whitespace-nowrap">Changes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isOpen = expanded === row.id;
                const canExpand = hasDiff(row);
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => canExpand && setExpanded(isOpen ? null : row.id)}
                      className={`border-b border-hairline hover:bg-cream transition-colors ${canExpand ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-3 text-xs text-soft whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-ink">{row.admin?.name ?? 'System'}</p>
                        <p className="text-xs text-muted">{row.admin?.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-body">{row.action}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-body capitalize">{row.entity_type}</span>
                        {row.entity_id && (
                          <span className="block font-mono text-[11px] text-muted">{row.entity_id.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-soft">
                        {canExpand ? <span className="text-xs">{isOpen ? '▲ hide' : '▼ view'}</span> : <span className="text-xs text-faint">—</span>}
                      </td>
                    </tr>
                    {isOpen && canExpand && (
                      <tr className="bg-white/60">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-soft mb-1">Before</p>
                              <pre className="bg-paper rounded-lg p-3 text-xs text-body font-mono overflow-x-auto max-h-64">
                                {row.old_value ? JSON.stringify(row.old_value, null, 2) : '—'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-soft mb-1">After</p>
                              <pre className="bg-paper rounded-lg p-3 text-xs text-body font-mono overflow-x-auto max-h-64">
                                {row.new_value ? JSON.stringify(row.new_value, null, 2) : '—'}
                              </pre>
                            </div>
                          </div>
                          {row.ip_address && <p className="mt-3 text-xs text-muted">IP: {row.ip_address}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
