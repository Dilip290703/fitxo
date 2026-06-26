"use client";

import { AgentShell } from "@/components/AgentShell";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export default function NotificationsPage() {
  return (
    <AgentShell active="notifications">
      <NotificationsView />
    </AgentShell>
  );
}
