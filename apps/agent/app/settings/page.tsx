"use client";

import { AgentShell } from "@/components/AgentShell";
import { SettingsView } from "@/components/settings/SettingsView";

export default function SettingsPage() {
  return (
    <AgentShell active="settings">
      <SettingsView />
    </AgentShell>
  );
}
