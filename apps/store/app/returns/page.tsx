"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { StoreShell } from "@/components/StoreShell";
import { ReturnsView } from "@/components/returns/ReturnsView";

export default function ReturnsPage() {
  const guard = useStoreGuard();

  if (guard.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">Loading…</p>
      </main>
    );
  }

  return (
    <StoreShell active="returns" storeName={guard.context.storeName}>
      <ReturnsView storeId={guard.context.storeId} />
    </StoreShell>
  );
}
