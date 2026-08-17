"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { PanelProvider } from "@/components/panel/PanelContext";
import { OrderAlertsProvider } from "@/components/alerts/OrderAlertsProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { StoreShell } from "@/components/StoreShell";

/**
 * The one place the store panel authenticates. Every route in (panel) renders
 * inside this layout, so the guard runs once per session — client-side
 * navigation swaps only the page content and never unmounts the shell, the
 * alert stream, or the toast stack.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const guard = useStoreGuard();

  if (guard.status === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-6">
        <div className="w-full max-w-[360px] rounded-2xl border border-danger-line bg-danger-bg p-6 text-center">
          <p className="text-[14px] font-medium text-danger">
            We couldn&apos;t reach Fitxo — check your connection.
          </p>
          <button
            type="button"
            onClick={guard.retry}
            className="mt-4 h-11 rounded-full border border-danger/40 px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-danger transition hover:bg-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (guard.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-paper">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <PanelProvider value={guard.context}>
      <ToastProvider>
        <OrderAlertsProvider>
          <StoreShell>{children}</StoreShell>
        </OrderAlertsProvider>
      </ToastProvider>
    </PanelProvider>
  );
}
