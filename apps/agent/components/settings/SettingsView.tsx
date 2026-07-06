"use client";

import { useState } from "react";
import { createClient } from "@fitzo/supabase/client";
import { useAgent } from "@/components/AgentShell";
import { riderUpdateProfile } from "@/lib/agent-data";
import { Banner, Card, ContentWrap, Label, PageHeader, btnPrimary, inputCls } from "@/components/ui";

// Must match the `vehicle_type` enum in schema.sql: ('bike', 'cycle', 'scooter').
const VEHICLES = [
  { value: "bike", label: "Motorbike" },
  { value: "scooter", label: "Scooter" },
  { value: "cycle", label: "Cycle" },
];

type Msg = { kind: "ok" | "err"; text: string } | null;

export function SettingsView() {
  const { rider, available, setAvailable } = useAgent();

  // Vehicle form
  const [vehicleType, setVehicleType] = useState(rider.vehicleType);
  const [vehicleNumber, setVehicleNumber] = useState(rider.vehicleNumber ?? "");
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleMsg, setVehicleMsg] = useState<Msg>(null);

  // Password form
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault();
    setSavingVehicle(true);
    setVehicleMsg(null);
    const { error } = await riderUpdateProfile({
      vehicleType,
      vehicleNumber: vehicleNumber.trim() || null,
    });
    setSavingVehicle(false);
    setVehicleMsg(
      error
        ? { kind: "err", text: error.message }
        : { kind: "ok", text: "Vehicle details saved." },
    );
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) {
      setPwMsg({ kind: "err", text: "Passwords don't match." });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setSavingPw(false);
    if (error) {
      setPwMsg({ kind: "err", text: error.message });
    } else {
      setPw("");
      setPw2("");
      setPwMsg({ kind: "ok", text: "Password updated." });
    }
  }

  return (
    <ContentWrap>
      <PageHeader title="Settings" subtitle="Manage your availability, vehicle and password." />

      {/* Availability */}
      <Card className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Availability</Label>
            <p className="text-[15px] font-semibold text-ink">
              {available ? "Online — receiving jobs" : "Offline"}
            </p>
            <p className="text-[13px] text-body">
              You only receive new delivery offers while you're online.
            </p>
          </div>
          <button
            onClick={() => setAvailable(!available)}
            role="switch"
            aria-checked={available}
            className={[
              "relative h-8 w-14 shrink-0 rounded-full transition",
              available ? "bg-success" : "bg-knob",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
                available ? "left-7" : "left-1",
              ].join(" ")}
            />
          </button>
        </div>
      </Card>

      {/* Vehicle */}
      <Card className="mb-5">
        <Label>Vehicle details</Label>
        <form onSubmit={saveVehicle} className="mt-2 space-y-3">
          <div>
            <span className="mb-1.5 block text-[13px] text-body">Vehicle type</span>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVehicleType(v.value)}
                  className={[
                    "h-11 rounded-xl border px-3 text-[13px] font-medium transition",
                    vehicleType === v.value
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong bg-white text-body hover:border-ink",
                  ].join(" ")}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] text-body">Vehicle number</span>
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="MH 12 AB 1234"
              className={inputCls}
            />
          </div>
          {vehicleMsg && <Banner kind={vehicleMsg.kind}>{vehicleMsg.text}</Banner>}
          <button type="submit" disabled={savingVehicle} className={btnPrimary}>
            {savingVehicle ? "Saving…" : "Save vehicle details"}
          </button>
        </form>
      </Card>

      {/* Password */}
      <Card>
        <Label>Change password</Label>
        <form onSubmit={changePassword} className="mt-2 space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            minLength={6}
            placeholder="New password"
            autoComplete="new-password"
            className={inputCls}
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            minLength={6}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className={inputCls}
          />
          {pwMsg && <Banner kind={pwMsg.kind}>{pwMsg.text}</Banner>}
          <button type="submit" disabled={savingPw} className={btnPrimary}>
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>
    </ContentWrap>
  );
}
