"use client";

import { useEffect, useState } from "react";
import { createClient } from "@fitzo/supabase/client";
import { useAgent } from "@/components/AgentShell";
import {
  fetchPayoutDetails,
  riderUpdateProfile,
  savePayoutDetails,
  type PayoutDetails,
} from "@/lib/agent-data";
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

      {/* Payout details (migration 034) */}
      <PayoutDetailsCard riderId={rider.riderId} />

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

const EMPTY_PAYOUT: PayoutDetails = {
  legalName: "",
  panNumber: "",
  payoutMethod: "upi",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
};

/**
 * Bank/UPI + PAN so Admin > Agent Payouts has somewhere to pay (migration 034).
 * Saved through the guarded save_rider_payout_details RPC — formats are
 * validated in-DB, so this form just relays the server's message on error.
 */
function PayoutDetailsCard({ riderId }: { riderId: string }) {
  const [form, setForm] = useState<PayoutDetails>(EMPTY_PAYOUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    let on = true;
    fetchPayoutDetails(riderId).then((d) => {
      if (!on) return;
      if (d) {
        setForm(d);
        setHasSaved(true);
      }
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [riderId]);

  const set = (k: keyof PayoutDetails) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await savePayoutDetails(form);
    setSaving(false);
    if (error) {
      setMsg({
        kind: "err",
        text: error.message.includes("Could not find the function")
          ? "Payouts setup isn't live yet (migration 034 pending) — try again later."
          : error.message,
      });
      return;
    }
    setHasSaved(true);
    setMsg({ kind: "ok", text: "Payout details saved. Fitzo pays your earnings here." });
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between">
        <Label>Payout details</Label>
        {!loading && (
          <span
            className={[
              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              hasSaved
                ? "border-success-line bg-success-bg text-success"
                : "border-warn-bg bg-warn-bg text-warn",
            ].join(" ")}
          >
            {hasSaved ? "On file" : "Missing"}
          </span>
        )}
      </div>
      <p className="text-[13px] text-body">
        Where Fitzo sends your delivery earnings. Kept private — only you and Fitzo can see this.
      </p>

      {loading ? (
        <p className="mt-3 text-[13px] text-soft">Loading…</p>
      ) : (
        <form onSubmit={save} className="mt-3 space-y-3">
          <div>
            <span className="mb-1.5 block text-[13px] text-body">Full name (as on PAN / bank)</span>
            <input
              value={form.legalName}
              onChange={(e) => set("legalName")(e.target.value)}
              placeholder="Your legal name"
              className={inputCls}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[13px] text-body">PAN</span>
            <input
              value={form.panNumber}
              onChange={(e) => set("panNumber")(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="ABCDE1234F"
              className={inputCls}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] text-body">Get paid via</span>
            <div className="grid grid-cols-2 gap-2">
              {(["upi", "bank"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set("payoutMethod")(m)}
                  className={[
                    "h-11 rounded-xl border px-3 text-[13px] font-medium transition",
                    form.payoutMethod === m
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong bg-white text-body hover:border-ink",
                  ].join(" ")}
                >
                  {m === "upi" ? "UPI" : "Bank transfer"}
                </button>
              ))}
            </div>
          </div>

          {form.payoutMethod === "upi" ? (
            <div>
              <span className="mb-1.5 block text-[13px] text-body">UPI ID</span>
              <input
                value={form.upiId}
                onChange={(e) => set("upiId")(e.target.value.toLowerCase())}
                placeholder="name@bank"
                className={inputCls}
              />
            </div>
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-[13px] text-body">Account holder name</span>
                <input
                  value={form.bankAccountName}
                  onChange={(e) => set("bankAccountName")(e.target.value)}
                  placeholder="As per the bank"
                  className={inputCls}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] text-body">Account number</span>
                <input
                  inputMode="numeric"
                  value={form.bankAccountNumber}
                  onChange={(e) => set("bankAccountNumber")(e.target.value.replace(/\D/g, "").slice(0, 18))}
                  placeholder="9–18 digits"
                  className={inputCls}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-[13px] text-body">IFSC</span>
                <input
                  value={form.bankIfsc}
                  onChange={(e) => set("bankIfsc")(e.target.value.toUpperCase().slice(0, 11))}
                  placeholder="HDFC0001234"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : "Save payout details"}
          </button>
        </form>
      )}
    </Card>
  );
}
