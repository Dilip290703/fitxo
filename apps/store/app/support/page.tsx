"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { StoreShell } from "@/components/StoreShell";
import { SupportView } from "@/components/support/SupportView";

export default function SupportPage() {
  const guard = useStoreGuard();

  if (guard.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">Loading…</p>
      </main>
    );
  }

  return (
    <StoreShell active="support" storeName={guard.context.storeName}>
      <SupportView storeName={guard.context.storeName} />
    </StoreShell>
  );
}
