/**
 * Server-side list pagination for the admin panel (audit PHASE 5, [D]).
 *
 * THE BUG THIS FIXES IS NOT "there is no pagination" — it is worse than that.
 * `DataTable` has always had page buttons, a page size and a
 * "Showing 1–25 of N" line, so every admin list LOOKS paginated. What it
 * actually did was fetch every row in the table, ship them all to the browser,
 * then sort and slice in memory. At 60 orders that is invisible. At 5,000 it
 * is a multi-megabyte payload on every render — and since audit §2.4 those
 * renders now repeat every 4 seconds.
 *
 * A page control that pages over an incomplete fetch is the same class of
 * mistake as a discount you show but never charge: the UI states something the
 * data does not support. So when a list pages on the server, its filters, its
 * search and its sort must move to the server too — otherwise "Completed" or a
 * name search silently means "…among the 25 rows that happen to be loaded".
 *
 * State lives in the URL rather than React state, for three reasons: the list
 * pages are server components, so the URL is the only thing that can re-run
 * the query; an admin can link a colleague to exactly what they are looking
 * at; and the §2.4 poll's `router.refresh()` re-runs the current URL, so a
 * polled refresh keeps the page, filters and sort the admin chose.
 */

export const DEFAULT_PAGE_SIZE = 25;

export type SortDir = 'asc' | 'desc';

export interface PageParams {
  /** 0-based, as the range maths wants it. The URL carries 1-based. */
  page: number;
  pageSize: number;
  sortKey: string;
  sortDir: SortDir;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  /** Total rows MATCHING THE CURRENT FILTERS, not total in the table. */
  total: number;
  sortKey: string;
  sortDir: SortDir;
}

/** Raw `searchParams` as Next hands them over. */
export type RawParams = Record<string, string | string[] | undefined>;

export function readParam(sp: RawParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

/**
 * @param sortable whitelist of DB column names this list may sort by. A
 *   whitelist, not free text: the value goes into `.order()`, so anything the
 *   caller has not explicitly allowed must not reach PostgREST.
 */
export function parsePageParams(
  sp: RawParams,
  opts: { sortable: readonly string[]; defaultSort: string; defaultDir?: SortDir; pageSize?: number },
): PageParams {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const rawPage = Number.parseInt(readParam(sp, 'page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage - 1 : 0;

  const rawSort = readParam(sp, 'sort');
  const sortKey = rawSort && opts.sortable.includes(rawSort) ? rawSort : opts.defaultSort;

  const rawDir = readParam(sp, 'dir');
  const sortDir: SortDir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : (opts.defaultDir ?? 'desc');

  return { page, pageSize, sortKey, sortDir };
}

/** Inclusive [from, to] for PostgREST's `.range()`. */
export function rangeFor(p: PageParams): [number, number] {
  const from = p.page * p.pageSize;
  return [from, from + p.pageSize - 1];
}

/**
 * Clamp a page that has run off the end — deleting rows, or narrowing a
 * filter, can leave `?page=9` pointing past the result set, which would
 * otherwise render an empty table with no hint why.
 */
export function lastPage(total: number, pageSize: number): number {
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}

/**
 * Merge changes into the current query string, dropping empties so the URL
 * stays readable. Any change other than the page itself resets to page 1:
 * staying on page 7 while switching to a filter with two matches is the
 * off-the-end case above, self-inflicted.
 */
export function buildQuery(current: URLSearchParams, patch: Record<string, string | number | null>): string {
  const next = new URLSearchParams(current.toString());
  const touchesFilters = Object.keys(patch).some((k) => k !== 'page');

  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '' || v === 'all') next.delete(k);
    else next.set(k, String(v));
  }
  if (touchesFilters && !('page' in patch)) next.delete('page');

  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Make a user's search string safe to embed in a PostgREST filter.
 *
 * NOT cosmetic. These strings are interpolated into `or=(...)` expressions, so
 * a raw comma or parenthesis does not just break the query — it appends
 * conditions to it. Admin search boxes are a low-privilege door onto a
 * service-role-adjacent surface, so this is a whitelist (letters, digits,
 * space, and the handful of punctuation marks that appear in order numbers,
 * names, emails and phone numbers), not a blacklist of things to strip.
 * `%` and `*` are dropped too: a user-supplied wildcard turns a prefix search
 * into a full scan.
 */
export function sanitizeSearch(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/[^\p{L}\p{N} @._+-]/gu, '').trim().slice(0, 80);
}
