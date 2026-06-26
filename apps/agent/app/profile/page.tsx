"use client";

import { AgentShell } from "@/components/AgentShell";
import { ProfileView } from "@/components/profile/ProfileView";

export default function ProfilePage() {
  return (
    <AgentShell active="profile">
      <ProfileView />
    </AgentShell>
  );
}
