"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoreContext, type StoreContext } from "@/lib/store-auth";

type StoreGuard =
  | { loading: true; context: null }
  | { loading: false; context: StoreContext };

/**
 * Auth-gate every store screen reuses: resolves the store-manager context and
 * redirects to /login when there is no session or the user is not a store
 * manager. While resolving, `loading` is true and `context` is null; once
 * resolved with a valid manager, `loading` is false and `context` is set.
 * (On redirect the component unmounts, so consumers only ever see those states.)
 */
export function useStoreGuard(): StoreGuard {
  const router = useRouter();
  const [context, setContext] = useState<StoreContext | null>(null);

  useEffect(() => {
    let active = true;
    getStoreContext().then((ctx) => {
      if (!active) return;
      if (!ctx) {
        router.replace("/login");
        return;
      }
      setContext(ctx);
    });
    return () => {
      active = false;
    };
  }, [router]);

  return context
    ? { loading: false, context }
    : { loading: true, context: null };
}
