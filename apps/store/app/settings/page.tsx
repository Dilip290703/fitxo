"use client";

import { useStoreGuard } from "@/lib/useStoreGuard";
import { StoreShell } from "@/components/StoreShell";
import { SettingsView } from "@/components/settings/SettingsView";

export default function SettingsPage() {
  const guard = useStoreGuard();

  if (guard.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf7]">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#958675]">Loading…</p>
      </main>
    );
  }

  return (
    <StoreShell active="settings" storeName={guard.context.storeName}>
      <SettingsView storeId={guard.context.storeId} />
    </StoreShell>
  );
}
