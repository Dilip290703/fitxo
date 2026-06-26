"use client";

import { AgentShell } from "@/components/AgentShell";
import { AgentDashboard } from "@/components/dashboard/AgentDashboard";

export default function DashboardPage() {
  return (
    <AgentShell active="dashboard">
      <AgentDashboard />
    </AgentShell>
  );
}
