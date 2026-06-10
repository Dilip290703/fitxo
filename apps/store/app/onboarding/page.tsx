"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { StoreShell } from "@/components/StoreShell";
import { OnboardingView } from "@/components/onboarding/OnboardingView";

export default function OnboardingPage() {
  const guard = useStoreGuard();

  if (guard.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">Loading…</p>
      </main>
    );
  }

  return (
    <StoreShell active="onboarding" storeName={guard.context.storeName}>
      <OnboardingView />
    </StoreShell>
  );
}
