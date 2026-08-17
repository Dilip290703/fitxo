/**
 * @fitxo/ui — shared UI primitives across FitXo apps.
 *
 * Today the customer and admin panels share NO components (their UIs are
 * fully domain-specific), so this package is intentionally thin. It is the
 * home for genuinely cross-app primitives as they emerge, and the `cn`
 * helper used for conditional Tailwind class names.
 */

/** Join truthy class-name fragments into a single string. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
