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
 *
 * By default a screen also requires an APPROVED store — a draft/submitted/rejected
 * store is redirected to `/onboarding`, so the whole live panel is locked until the
 * Fitzo team approves the application. The onboarding flow itself opts out with
 * `{ requireApproved: false }`.
 */
export function useStoreGuard(
  { requireApproved = true }: { requireApproved?: boolean } = {},
): StoreGuard {
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
      if (requireApproved && ctx.onboardingStatus !== "approved") {
        router.replace("/onboarding");
        return;
      }
      setContext(ctx);
    });
    return () => {
      active = false;
    };
  }, [router, requireApproved]);

  return context
    ? { loading: false, context }
    : { loading: true, context: null };
}
