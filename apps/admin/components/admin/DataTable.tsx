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
  /**
   * Server-driven paging. When present the component STOPS slicing and sorting
   * locally: `data` is already exactly one page, `total` counts every row
   * matching the current filters, and sorting is a server round-trip. Without
   * this the page buttons would page over whatever subset happened to be
   * fetched, which is the bug this prop exists to remove — see lib/pagination.
   */
  server?: {
    page: number;
    pageSize: number;
    total: number;
    sortKey: string;
    sortDir: 'asc' | 'desc';
    onPage: (page: number) => void;
    onSort: (key: string) => void;
  };
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
  server,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const handleSort = (key: string) => {
    // Server mode: sorting 25 of 5,000 rows in the browser would order the
    // page, not the list. Hand it to the query instead.
    if (server) {
      server.onSort(key);
      return;
    }
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const sorted = server ? data : [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = getNestedValue(a, sortKey);
    const bv = getNestedValue(b, sortKey);
    const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // In server mode every one of these comes from the query, not from `data`.
  const currentPage = server ? server.page : page;
  const rowsPerPage = server ? server.pageSize : pageSize;
  const totalRows = server ? server.total : sorted.length;
  const activeSortKey = server ? server.sortKey : sortKey;
  const activeSortDir = server ? server.sortDir : sortDir;
  const goToPage = (p: number) => (server ? server.onPage(p) : setPage(p));

  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paged = server ? data : sorted.slice(page * pageSize, (page + 1) * pageSize);
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
                  {col.sortable && activeSortKey === String(col.key) && (
                    <span className="ml-1">{activeSortDir === 'asc' ? '↑' : '↓'}</span>
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
            Showing {currentPage * rowsPerPage + 1}–{Math.min((currentPage + 1) * rowsPerPage, totalRows)} of {totalRows}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1.5 rounded border border-line hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = currentPage < 3 ? i : currentPage - 2 + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`px-3 py-1.5 rounded border ${p === currentPage ? 'border-ink bg-ink text-white' : 'border-line hover:border-line-strong'}`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => goToPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
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
