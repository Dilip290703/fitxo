/** Catalogue sort options — shared by the sort dropdown and the ?sort= URL param. */
export const SORT_OPTIONS = [
  "new-arrivals",
  "popular",
  "price-low",
  "price-high",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * Maps a raw ?sort= query value to a valid SortOption.
 * Unknown or missing values fall back to the default catalogue order
 * rather than erroring — the URL is user-editable input.
 */
export function normalizeSort(sort?: string): SortOption {
  return SORT_OPTIONS.includes(sort as SortOption)
    ? (sort as SortOption)
    : "new-arrivals";
}
