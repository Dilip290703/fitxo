"use client";

import { useEffect, useRef } from "react";

/**
 * Destructive-action confirmation. Closes on Escape and backdrop click;
 * focuses the cancel button on open so Enter can't instantly destroy.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-pop">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <div className="mt-2 text-[13px] leading-6 text-body">{body}</div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line-strong px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-body transition hover:border-ink hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition disabled:opacity-60 ${
              danger ? "bg-danger hover:bg-danger-strong" : "bg-ink hover:bg-ink-soft"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
