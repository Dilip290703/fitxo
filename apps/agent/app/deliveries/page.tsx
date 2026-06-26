"use client";

import { AgentShell } from "@/components/AgentShell";
import { DeliveriesView } from "@/components/deliveries/DeliveriesView";

export default function DeliveriesPage() {
  return (
    <AgentShell active="deliveries">
      <DeliveriesView />
    </AgentShell>
  );
}
