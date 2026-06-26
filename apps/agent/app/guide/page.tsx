"use client";

import { AgentShell } from "@/components/AgentShell";
import { GuideView } from "@/components/guide/GuideView";

export default function GuidePage() {
  return (
    <AgentShell active="guide">
      <GuideView />
    </AgentShell>
  );
}
