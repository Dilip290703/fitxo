"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAgentContext, type AgentContext, type AgentStatus } from "@/lib/agent-auth";

export type AgentGuard =
  | { state: "loading"; context: null; refresh: () => void }
  | { state: "not-rider"; context: null; refresh: () => void }
  | { state: "unverified"; context: AgentContext | null; refresh: () => void }
  | { state: "ok"; context: AgentContext; refresh: () => void };

/**
 * Auth-gate every agent screen reuses: resolves the rider context and redirects
 * to /login when there's no session. A rider can only WORK once verified, so
 * "not-rider" / "unverified" surface gate screens (handled by AgentShell).
 */
export function useAgentGuard(): AgentGuard {
  const router = useRouter();
  const [status, setStatus] = useState<AgentStatus | "loading">("loading");
  const [context, setContext] = useState<AgentContext | null>(null);

  const refresh = useCallback(async () => {
    const { status, context } = await getAgentContext();
    if (status === "no-session") {
      router.replace("/login");
      return;
    }
    setStatus(status);
    setContext(context);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (status === "loading") return { state: "loading", context: null, refresh };
  if (status === "not-rider") return { state: "not-rider", context: null, refresh };
  if (status === "unverified") return { state: "unverified", context, refresh };
  return { state: "ok", context: context as AgentContext, refresh };
}
