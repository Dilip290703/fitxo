"use client";

import { AgentShell } from "@/components/AgentShell";
import { EarningsView } from "@/components/earnings/EarningsView";

export default function EarningsPage() {
  return (
    <AgentShell active="earnings">
      <EarningsView />
    </AgentShell>
  );
}
