"use client";

import { AgentShell } from "@/components/AgentShell";
import { SupportView } from "@/components/support/SupportView";

export default function SupportPage() {
  return (
    <AgentShell active="support">
      <SupportView />
    </AgentShell>
  );
}
