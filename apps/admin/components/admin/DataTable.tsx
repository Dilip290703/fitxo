'use client';

import { useState } from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Optional row selection (adds a leading checkbox column) for bulk actions. */
  selection?: {
    selected: Set<string>;
    onToggle: (id: string) => void;
    /** Called with the visible page's ids when the header checkbox flips. */
    onToggleAll: (ids: string[], select: boolean) => void;
  };
}

function getNestedValue<T>(obj: T, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export default function DataTable<T>({
  data,
  columns,
  keyField,
  pageSize = 20,
  emptyMessage = 'No results found.',
  onRowClick,
  selection,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = getNestedValue(a, sortKey);
    const bv = getNestedValue(b, sortKey);
    const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const pagedIds = paged.map((row) => String(row[keyField]));
  const allPagedSelected = selection ? pagedIds.length > 0 && pagedIds.every((id) => selection.selected.has(id)) : false;

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              {selection ? (
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allPagedSelected}
                    onChange={() => selection.onToggleAll(pagedIds, !allPagedSelected)}
                    className="accent-ink"
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-3 py-2 text-left text-[11px] font-semibold text-soft uppercase tracking-wide whitespace-nowrap ${col.className ?? ''} ${col.sortable ? 'cursor-pointer select-none hover:text-ink' : ''}`}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  {col.label}
                  {col.sortable && sortKey === String(col.key) && (
                    <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="px-4 py-12 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-hairline hover:bg-cream transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {selection ? (
                    <td className="w-8 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selection.selected.has(String(row[keyField]))}
                        onChange={() => selection.onToggle(String(row[keyField]))}
                        className="accent-ink"
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => {
                    const value = getNestedValue(row, String(col.key));
                    return (
                      <td key={String(col.key)} className={`px-3 py-2 text-body ${col.className ?? ''}`}>
                        {col.render ? col.render(value, row) : String(value ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-soft">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-line hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page < 3 ? i : page - 2 + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 rounded border ${p === page ? 'border-ink bg-ink text-white' : 'border-line hover:border-line-strong'}`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded border border-line hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
