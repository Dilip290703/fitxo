"use client";

import Link from "next/link";
import { useAgent } from "@/components/AgentShell";
import { ContentWrap, PageHeader, Card, Label } from "@/components/ui";
import { IconCheck } from "@/components/icons";

const VEHICLE_LABEL: Record<string, string> = {
  bike: "Motorbike",
  scooter: "Scooter",
  cycle: "Cycle",
};

const SHORT_VEHICLE: Record<string, string> = {
  bike: "Bike",
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
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-ink text-[22px] font-semibold text-accent">
          {initials || "R"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[18px] font-semibold text-ink">{rider.name}</p>
          <p className="truncate text-[13px] text-body">{rider.email}</p>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-success-line bg-success-bg px-2.5 py-0.5 text-[12px] font-semibold text-success">
            <IconCheck size={12} /> Verified rider
          </span>
        </div>
      </Card>

      {/* Rating deliberately not shown — nothing writes riders.rating yet, so
          every rider would see a fake 5.00. Bring it back with a real source. */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Deliveries" value={String(rider.totalDeliveries)} sub="all-time" />
        <Stat label="Status" value={rider.isAvailable ? "Online" : "Offline"} sub="now" />
        <Stat label="Vehicle" value={SHORT_VEHICLE[rider.vehicleType] ?? rider.vehicleType} sub="on file" />
      </div>

      <Card className="mb-5">
        <Label>Vehicle</Label>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-ink">
              {VEHICLE_LABEL[rider.vehicleType] ?? rider.vehicleType}
            </p>
            <p className="text-[13px] text-soft">{rider.vehicleNumber ?? "No number on file"}</p>
          </div>
          <Link
            href="/settings"
            className="flex h-10 items-center rounded-full px-3 text-[13px] font-medium text-info hover:bg-info-bg"
          >
            Edit →
          </Link>
        </div>
      </Card>

      <Card>
        <Label>Account</Label>
        <Row label="Email" value={rider.email} />
        <Row label="Role" value="Delivery partner" last />
      </Card>

      <div className="mt-5 flex gap-3">
        <Link
          href="/settings"
          className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-ink text-[14px] font-semibold text-white transition hover:bg-ink-soft"
        >
          Settings
        </Link>
        <Link
          href="/support"
          className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-line-strong bg-white text-[14px] font-semibold text-ink transition hover:bg-cream"
        >
          Get help
        </Link>
      </div>
    </ContentWrap>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3 text-center">
      <p className="truncate text-[17px] font-bold text-ink">{value}</p>
      <p className="text-[11px] text-soft">
        {label} <span className="text-faint">{sub}</span>
      </p>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={["flex items-center justify-between gap-3 py-2.5", last ? "" : "border-b border-hairline"].join(" ")}>
      <span className="text-[13px] text-soft">{label}</span>
      <span className="truncate text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}
