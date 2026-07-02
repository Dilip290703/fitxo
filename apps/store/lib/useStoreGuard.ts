"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoreContext, type StoreContext } from "@/lib/store-auth";

export type StoreGuard =
  | { status: "loading"; context: null; retry: () => void }
  | { status: "error"; context: null; retry: () => void }
  | { status: "ready"; context: StoreContext; retry: () => void };

/**
 * Auth gate for the store panel. Resolves the store-manager context and
 * redirects to /login when there is no session or the user is not a store
 * manager. A transient failure (network, Supabase hiccup) is NOT treated as
 * "not a manager" — it surfaces as `status: "error"` with a `retry`, so a bad
 * connection never bounces a signed-in owner to the login screen.
 *
 * By default a screen also requires an APPROVED store — a draft/submitted/
 * rejected store is redirected to `/onboarding`. The onboarding flow itself
 * opts out with `{ requireApproved: false }`.
 *
 * Mounted ONCE in the panel layout (not per page), so navigating between
 * screens never re-runs the gate or unmounts the shell.
 */
export function useStoreGuard(
  { requireApproved = true }: { requireApproved?: boolean } = {},
): StoreGuard {
  const router = useRouter();
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; context: StoreContext | null }>({
    status: "loading",
    context: null,
  });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading", context: null });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    getStoreContext()
      .then((ctx) => {
        if (!active) return;
        if (!ctx) {
          router.replace("/login");
          return;
        }
        if (requireApproved && ctx.onboardingStatus !== "approved") {
          router.replace("/onboarding");
          return;
        }
        setState({ status: "ready", context: ctx });
      })
      .catch(() => {
        if (active) setState({ status: "error", context: null });
      });
    return () => {
      active = false;
    };
  }, [router, requireApproved, attempt]);

  return { ...state, retry } as StoreGuard;
}
