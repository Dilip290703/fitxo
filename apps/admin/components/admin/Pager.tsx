'use client';

/**
 * Page controls for a server-paged list.
 *
 * Split out of DataTable because not every admin list uses DataTable —
 * /admin/users renders its own table (it has a per-row action button), and
 * before this it had no paging UI whatsoever: every user in the database, one
 * table, one page. A shared control means the two cannot drift into
 * disagreeing about what "Showing 26–50 of 312" means.
 */
export default function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  /** 0-based. */
  page: number;
  pageSize: number;
  /** Rows matching the current filters, not rows in the table. */
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-soft">
      <span>
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(Math.max(0, page - 1))}
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
              onClick={() => onPage(p)}
              className={`px-3 py-1.5 rounded border ${p === page ? 'border-ink bg-ink text-white' : 'border-line hover:border-line-strong'}`}
            >
              {p + 1}
            </button>
          );
        })}
        <button
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-1.5 rounded border border-line hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>
    </div>
  );
}
