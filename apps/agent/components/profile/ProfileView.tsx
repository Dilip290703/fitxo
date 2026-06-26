"use client";

import Link from "next/link";
import { useAgent } from "@/components/AgentShell";
import { ContentWrap, PageHeader, Card, Label } from "@/components/ui";

const VEHICLE_LABEL: Record<string, string> = {
  bike: "Motorbike",
  scooter: "Scooter",
  cycle: "Cycle",
};

export function ProfileView() {
  const { rider } = useAgent();
  const initials = rider.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ContentWrap>
      <PageHeader title="Profile" subtitle="Your rider account at a glance." />

      <Card className="mb-5 flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#1e2a45] text-[22px] font-semibold text-[#9fc0ff]">
          {initials || "🛵"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[18px] font-semibold">{rider.name}</p>
          <p className="truncate text-[13px] text-[#9fb0cc]">{rider.email}</p>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#16322a] px-2.5 py-0.5 text-[11px] font-semibold text-[#7fe0b0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" /> Verified rider
          </span>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Rating" value={(rider.rating ?? 5).toFixed(2)} sub="★" />
        <Stat label="Deliveries" value={String(rider.totalDeliveries)} sub="all-time" />
        <Stat label="Status" value={rider.isAvailable ? "Online" : "Offline"} sub="now" />
      </div>

      <Card className="mb-5">
        <Label>Vehicle</Label>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold">{VEHICLE_LABEL[rider.vehicleType] ?? rider.vehicleType}</p>
            <p className="text-[12px] text-[#7c8aa5]">{rider.vehicleNumber ?? "No number on file"}</p>
          </div>
          <Link href="/settings" className="text-[12px] font-medium text-[#9fc0ff] hover:text-white">
            Edit →
          </Link>
        </div>
      </Card>

      <Card>
        <Label>Account</Label>
        <Row label="Email" value={rider.email} />
        <Row label="Role" value="Delivery partner" />
        <Row label="Rider ID" value={rider.riderId.slice(0, 8) + "…"} last />
      </Card>

      <div className="mt-5 flex gap-3">
        <Link
          href="/settings"
          className="flex-1 rounded-[12px] bg-[#1e2a45] py-3 text-center text-[13px] font-semibold text-[#9fc0ff] transition hover:bg-[#243b66]"
        >
          Settings
        </Link>
        <Link
          href="/support"
          className="flex-1 rounded-[12px] border border-[#243049] py-3 text-center text-[13px] font-semibold text-white transition hover:bg-[#161e2e]"
        >
          Get help
        </Link>
      </div>
    </ContentWrap>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-[#22304a] bg-[#161e2e] p-3 text-center">
      <p className="text-[20px] font-bold">{value}</p>
      <p className="text-[11px] text-[#7c8aa5]">
        {label} <span className="text-[#54627d]">{sub}</span>
      </p>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={["flex items-center justify-between py-2.5", last ? "" : "border-b border-[#22304a]"].join(" ")}>
      <span className="text-[13px] text-[#7c8aa5]">{label}</span>
      <span className="text-[13px] font-medium">{value}</span>
    </div>
  );
}
