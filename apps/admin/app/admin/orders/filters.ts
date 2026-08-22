/**
 * Filter vocabulary for the orders list, shared by the server query
 * (page.tsx), the tab counts, and the client's CSV export — which re-queries
 * every matching row rather than exporting the 25 on screen. One definition so
 * those three can never drift into disagreeing about what "Completed, unpaid,
 * matching 'sharma'" means.
 */
import type { OrderStatus } from '@fitxo/supabase/types';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'out_for_delivery',
  'try_window_active',
  'return_requested',
  'completed',
  'cancelled',
] as const;

export const PAYMENT_FILTERS = ['all', 'paid', 'partially_paid', 'pending', 'refunded'] as const;

/**
 * Only base-table columns. Sorting the list by customer name would mean
 * ordering parent rows by an embedded resource, which PostgREST does not do —
 * it orders the embed. Better to not offer the control than to offer one that
 * quietly sorts nothing.
 */
export const ORDER_SORTABLE = ['order_number', 'final_amount', 'created_at'] as const;

/** Cap on the customer-name lookup that feeds the search (see buildSearchClause). */
export const SEARCH_USER_LIMIT = 1000;

/**
 * The customer's name and phone live on `users`, not `orders`, and PostgREST
 * cannot OR across a base column and an embedded one in a single filter. So
 * the search resolves matching customers first and folds them in as
 * `user_id.in.(…)`.
 *
 * `q` MUST already be through `sanitizeSearch` — it is interpolated into the
 * filter expression.
 */
export function buildSearchClause(q: string, userIds: string[]): string {
  const clauses = [`order_number.ilike.%${q}%`];
  if (userIds.length > 0) clauses.push(`user_id.in.(${userIds.join(',')})`);
  return clauses.join(',');
}

/**
 * Ceiling on a CSV export. The export deliberately re-queries every matching
 * row rather than writing out the 25 on screen, so it needs a stop: an admin
 * who exports "All" on a 200k-row table should get a capped file and a warning,
 * not a dead tab.
 */
export const EXPORT_LIMIT = 5000;
