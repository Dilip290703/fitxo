'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Pager from '@/components/admin/Pager';
import { buildQuery, type PageInfo } from '@/lib/pagination';

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

/**
 * The vocabulary `logActivity` writes. Derived from the loaded rows before,
 * which stops working the moment the list is one page: the chips would only
 * offer the entity types that happen to appear in the newest 25 actions.
 * Unioned with whatever is on screen, so an older or hand-written value still
 * shows up while you are looking at it.
 */
const KNOWN_ENTITY_TYPES = [
  'agent_payout', 'brand', 'category', 'complaint', 'content', 'coupon',
  'customer', 'delivery', 'notification', 'order', 'payment', 'payout',
  'product', 'report', 'rider', 'store', 'user',
];

export default function ActivityLogClient({
  logs,
  pageInfo,
  activeEntity,
  activeSearch,
}: {
  /** One page of rows — the entity filter and search ran in the query. */
  logs: ActivityRow[];
  pageInfo: PageInfo;
  activeEntity: string;
  activeSearch: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const push = useCallback(
    (patch: Record<string, string | number | null>) => {
      const qs = buildQuery(new URLSearchParams(searchParams.toString()), patch);
      router.push(`/admin/activity${qs}`, { scroll: false });
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

  const entityTypes = useMemo(
    () => Array.from(new Set([...KNOWN_ENTITY_TYPES, ...logs.map((l) => l.entity_type)])).sort(),
    [logs],
  );

  // No client-side filter: `logs` is already the filtered page.

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => push({ entity: 'all' })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeEntity === 'all' ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
            }`}
          >
            All
          </button>
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => push({ entity: t })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeEntity === t ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
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
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((row) => {
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

      <Pager
        page={pageInfo.page}
        pageSize={pageInfo.pageSize}
        total={pageInfo.total}
        onPage={(p) => push({ page: p === 0 ? null : p + 1 })}
      />
    </div>
  );
}
