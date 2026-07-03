"use client";

import { createContext, useContext } from "react";
import type { StoreContext } from "@/lib/store-auth";

const PanelContext = createContext<StoreContext | null>(null);

/**
 * The resolved store-manager context, provided once by the panel layout.
 * Every authed screen reads storeId/userId/storeName from here instead of
 * running its own guard.
 */
export function PanelProvider({ value, children }: { value: StoreContext; children: React.ReactNode }) {
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function useStorePanel(): StoreContext {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("useStorePanel must be used inside the (panel) layout");
  return ctx;
}
