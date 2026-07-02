"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  // The onboarding flow is the one screen that must be reachable BEFORE approval,
  // so it opts out of the approved-only gate. (An already-approved store loading
  // this route is redirected to the dashboard from inside the wizard.)
  const guard = useStoreGuard({ requireApproved: false });

  if (guard.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">Loading…</p>
      </main>
    );
  }

  return <OnboardingWizard storeId={guard.context.storeId} email={guard.context.email} />;
}
