"use client";

import { useState } from "react";
import { createClient } from "@fitzo/supabase/client";
import { useAgent } from "@/components/AgentShell";
import { riderUpdateProfile } from "@/lib/agent-data";
import { ContentWrap, PageHeader, Card, Label } from "@/components/ui";

// Must match the `vehicle_type` enum in schema.sql: ('bike', 'cycle', 'scooter').
const VEHICLES = [
  { value: "bike", label: "Motorbike" },
  { value: "scooter", label: "Scooter" },
  { value: "cycle", label: "Cycle" },
];

type Banner = { kind: "ok" | "err"; text: string } | null;

export function SettingsView() {
  const { rider, available, setAvailable } = useAgent();

  // Vehicle form
  const [vehicleType, setVehicleType] = useState(rider.vehicleType);
  const [vehicleNumber, setVehicleNumber] = useState(rider.vehicleNumber ?? "");
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleMsg, setVehicleMsg] = useState<Banner>(null);

  // Password form
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<Banner>(null);

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
        <div className="flex items-center justify-between">
          <div>
            <Label>Availability</Label>
            <p className="text-[14px] font-semibold">{available ? "Online — receiving jobs" : "Offline"}</p>
            <p className="text-[12px] text-[#7c8aa5]">
              You only get assigned new deliveries while you're online.
            </p>
          </div>
          <button
            onClick={() => setAvailable(!available)}
            role="switch"
            aria-checked={available}
            className={[
              "relative h-7 w-12 shrink-0 rounded-full transition",
              available ? "bg-[#34d399]" : "bg-[#3a4358]",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-1 h-5 w-5 rounded-full bg-white transition",
                available ? "left-6" : "left-1",
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
            <span className="mb-1.5 block text-[12px] text-[#9fb0cc]">Vehicle type</span>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVehicleType(v.value)}
                  className={[
                    "rounded-[10px] border px-3 py-2 text-[12px] font-medium transition",
                    vehicleType === v.value
                      ? "border-[#3b82f6] bg-[#10203f] text-white"
                      : "border-[#243049] text-[#9fb0cc] hover:border-[#3b82f6]/50",
                  ].join(" ")}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] text-[#9fb0cc]">Vehicle number</span>
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="MH 12 AB 1234"
              className="agent-field"
            />
          </div>
          {vehicleMsg && <Note banner={vehicleMsg} />}
          <button type="submit" disabled={savingVehicle} className="agent-btn">
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
            className="agent-field"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            minLength={6}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="agent-field"
          />
          {pwMsg && <Note banner={pwMsg} />}
          <button type="submit" disabled={savingPw} className="agent-btn">
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </Card>

      <style>{`
        .agent-field {
          width: 100%;
          border-radius: 10px;
          border: 1px solid #2c3a55;
          background: #0f1522;
          padding: 11px 13px;
          font-size: 14px;
          color: #fff;
          outline: none;
        }
        .agent-field:focus { border-color: #3b82f6; }
        .agent-field::placeholder { color: #54627d; }
        .agent-btn {
          width: 100%;
          border-radius: 12px;
          background: #3b82f6;
          padding: 11px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          transition: background .15s;
        }
        .agent-btn:hover { background: #2f6fdc; }
        .agent-btn:disabled { opacity: .6; }
      `}</style>
    </ContentWrap>
  );
}

function Note({ banner }: { banner: { kind: "ok" | "err"; text: string } }) {
  return (
    <p
      className={[
        "rounded-[10px] px-3 py-2 text-[13px]",
        banner.kind === "ok" ? "bg-[#16322a] text-[#7fe0b0]" : "bg-[#3a1d1d] text-[#ff9b9b]",
      ].join(" ")}
    >
      {banner.text}
    </p>
  );
}
