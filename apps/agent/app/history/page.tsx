"use client";

import { AgentShell } from "@/components/AgentShell";
import { HistoryView } from "@/components/history/HistoryView";

export default function HistoryPage() {
  return (
    <AgentShell active="history">
      <HistoryView />
    </AgentShell>
  );
}
