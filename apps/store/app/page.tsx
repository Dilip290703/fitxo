"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { StoreShell } from "@/components/StoreShell";
import { StoreDashboard } from "@/components/dashboard/StoreDashboard";

export default function StoreHome() {
  const guard = useStoreGuard();

  if (guard.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">
          Loading…
        </p>
      </main>
    );
  }

  return (
    <StoreShell active="dashboard" storeName={guard.context.storeName}>
      <StoreDashboard storeId={guard.context.storeId} />
    </StoreShell>
  );
}
