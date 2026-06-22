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
              entityFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            All
          </button>
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => setEntityFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                entityFilter === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
          className="sm:ml-auto w-full sm:w-72 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">When</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Admin</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Entity</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Changes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
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
                      className={`border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors ${canExpand ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{row.admin?.name ?? 'System'}</p>
                        <p className="text-xs text-gray-500">{row.admin?.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">{row.action}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-300 capitalize">{row.entity_type}</span>
                        {row.entity_id && (
                          <span className="block font-mono text-[11px] text-gray-500">{row.entity_id.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {canExpand ? <span className="text-xs">{isOpen ? '▲ hide' : '▼ view'}</span> : <span className="text-xs text-gray-600">—</span>}
                      </td>
                    </tr>
                    {isOpen && canExpand && (
                      <tr className="bg-gray-900/60">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold text-gray-400 mb-1">Before</p>
                              <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64">
                                {row.old_value ? JSON.stringify(row.old_value, null, 2) : '—'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-400 mb-1">After</p>
                              <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto max-h-64">
                                {row.new_value ? JSON.stringify(row.new_value, null, 2) : '—'}
                              </pre>
                            </div>
                          </div>
                          {row.ip_address && <p className="mt-3 text-xs text-gray-500">IP: {row.ip_address}</p>}
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
