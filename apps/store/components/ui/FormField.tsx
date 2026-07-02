/** Shared input styling — one look for every text control in the panel. */
export const inputClass =
  "h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[14px] text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-accent/25";

/**
 * Labelled form field. Pass `error` for inline per-field validation — it
 * renders under the control and flips the label to the danger color.
 */
export function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span
        className={`mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] ${
          error ? "text-danger" : "text-soft"
        }`}
      >
        {label}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-[12px] font-medium text-danger">{error}</span> : null}
    </label>
  );
}
