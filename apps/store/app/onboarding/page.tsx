"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  // The onboarding flow is the one screen that must be reachable BEFORE approval,
  // so it opts out of the approved-only gate. (An already-approved store loading
  // this route is redirected to the dashboard from inside the wizard.)
  const guard = useStoreGuard({ requireApproved: false });

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

  return <OnboardingWizard storeId={guard.context.storeId} email={guard.context.email} />;
}
