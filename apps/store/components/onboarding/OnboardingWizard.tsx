"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import {
  ENTITY_TYPES,
  GST_RE,
  IFSC_RE,
  PAN_RE,
  PHONE_RE,
  PINCODE_RE,
  STORE_CATEGORIES,
  loadOnboarding,
  saveOnboarding,
  submitOnboarding,
  type OnboardingData,
} from "@/lib/onboarding";
import type { StoreOnboardingStatus } from "@fitzo/supabase/types";

const inputClass =
  "h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[14px] text-ink outline-none transition focus:border-ink focus:ring-4 focus:ring-accent/25";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-body";

type StepDef = {
  title: string;
  hint: string;
  validate: (d: OnboardingData) => string | null;
};

const STEPS: StepDef[] = [
  {
    title: "Store details",
    hint: "How your store appears to customers.",
    validate: (d) => {
      if (!d.name.trim()) return "Store name is required.";
      if (!d.category) return "Pick a category.";
      if (!PHONE_RE.test(d.contactPhone.trim())) return "Enter a valid 10-digit contact phone.";
      return null;
    },
  },
  {
    title: "Pickup address",
    hint: "Where riders collect orders from.",
    validate: (d) => {
      if (!d.address.trim()) return "Pickup address is required.";
      if (!d.city.trim()) return "City is required.";
      if (!PINCODE_RE.test(d.pincode.trim())) return "Enter a valid 6-digit pincode.";
      return null;
    },
  },
  {
    title: "Business & tax",
    hint: "Used for verification. GST is optional if you're not registered.",
    validate: (d) => {
      if (!d.legalName.trim()) return "Legal name is required.";
      if (!d.entityType) return "Select your entity type.";
      if (!PAN_RE.test(d.panNumber.trim().toUpperCase())) return "Enter a valid PAN (e.g. ABCDE1234F).";
      if (d.gstNumber.trim() && !GST_RE.test(d.gstNumber.trim().toUpperCase()))
        return "GST number looks invalid. Leave it blank if not registered.";
      return null;
    },
  },
  {
    title: "Payout",
    hint: "Where Fitzo sends your earnings. Add a bank account or a UPI ID.",
    validate: (d) => {
      const hasUpi = !!d.upiId.trim();
      const hasBank =
        !!d.bankAccountNumber.trim() && !!d.bankIfsc.trim() && !!d.bankAccountName.trim();
      if (!hasUpi && !hasBank) return "Add either full bank details or a UPI ID.";
      if (d.bankIfsc.trim() && !IFSC_RE.test(d.bankIfsc.trim().toUpperCase()))
        return "Enter a valid IFSC (e.g. HDFC0001234).";
      return null;
    },
  },
  { title: "Review & submit", hint: "Check everything, then send it for review.", validate: () => null },
];

export function OnboardingWizard({ storeId, email }: { storeId: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<StoreOnboardingStatus>("draft");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadFailed(false);
    loadOnboarding(storeId)
      .then((state) => {
        if (!active) return;
        if (state.status === "approved") {
          router.replace("/");
          return;
        }
        setStatus(state.status);
        setRejectionReason(state.rejectionReason);
        setData(state.data);
        setLoading(false);
      })
      .catch(() => {
        // Network failure — this is the one screen a pending store is forced
        // onto, so never leave it stuck on "Loading…".
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [storeId, router]);

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((d) => (d ? { ...d, [key]: value } : d));
    setError("");
  };

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  };

  const next = async () => {
    if (!data) return;
    const problem = STEPS[step].validate(data);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveOnboarding(storeId, data); // persist progress on every step
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await saveOnboarding(storeId, data);
      await submitOnboarding(storeId);
      setStatus("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loadFailed) {
    return (
      <Frame email={email} onLogout={handleLogout}>
        <div className="rounded-2xl border border-danger-line bg-danger-bg p-6 text-center">
          <p className="text-[14px] font-medium text-danger">
            We couldn&apos;t load your application — check your connection.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 h-11 rounded-full border border-danger/40 px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-danger transition hover:bg-white"
          >
            Retry
          </button>
        </div>
      </Frame>
    );
  }

  if (loading || !data) {
    return (
      <Frame email={email} onLogout={handleLogout}>
        <p className="py-16 text-center text-[13px] uppercase tracking-[0.16em] text-muted">Loading…</p>
      </Frame>
    );
  }

  if (status === "submitted") {
    return (
      <Frame email={email} onLogout={handleLogout}>
        <UnderReview onRefresh={() => router.refresh()} />
      </Frame>
    );
  }

  return (
    <Frame email={email} onLogout={handleLogout}>
      {status === "rejected" && rejectionReason ? (
        <div className="mb-6 rounded-2xl border border-danger-line bg-danger-bg p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-danger">
            Application needs changes
          </p>
          <p className="mt-1.5 text-[13px] leading-6 text-danger">{rejectionReason}</p>
          <p className="mt-1.5 text-[12px] text-danger">Update the details below and resubmit.</p>
        </div>
      ) : null}

      <Stepper step={step} />

      <div className="mt-6 rounded-2xl border border-line bg-white p-6 sm:p-7">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{STEPS[step].title}</h2>
        <p className="mt-1 text-[13px] leading-6 text-soft">{STEPS[step].hint}</p>

        <div className="mt-6 space-y-4">
          {step === 0 && (
            <>
              <Field label="Store name">
                <input className={inputClass} value={data.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Category">
                <select
                  className={inputClass}
                  value={data.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="">Select a category…</option>
                  {STORE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contact phone">
                <input
                  className={inputClass}
                  value={data.contactPhone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => set("contactPhone", e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit mobile"
                />
              </Field>
              <Field label="Contact email (optional)">
                <input
                  className={inputClass}
                  value={data.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                  placeholder={email}
                />
              </Field>
              <Field label="Short description (optional)">
                <textarea
                  className={`${inputClass} h-auto py-2.5`}
                  rows={3}
                  value={data.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What your store sells."
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Pickup address">
                <textarea
                  className={`${inputClass} h-auto py-2.5`}
                  rows={2}
                  value={data.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Shop no., street, area"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={inputClass} value={data.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="Pincode">
                  <input
                    className={inputClass}
                    value={data.pincode}
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Legal / registered name">
                <input
                  className={inputClass}
                  value={data.legalName}
                  onChange={(e) => set("legalName", e.target.value)}
                  placeholder="As on PAN / GST"
                />
              </Field>
              <Field label="Entity type">
                <select
                  className={inputClass}
                  value={data.entityType}
                  onChange={(e) => set("entityType", e.target.value as OnboardingData["entityType"])}
                >
                  <option value="">Select…</option>
                  {ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="PAN">
                  <input
                    className={`${inputClass} uppercase`}
                    value={data.panNumber}
                    maxLength={10}
                    onChange={(e) => set("panNumber", e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                  />
                </Field>
                <Field label="GST (optional)">
                  <input
                    className={`${inputClass} uppercase`}
                    value={data.gstNumber}
                    maxLength={15}
                    onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
                    placeholder="22ABCDE1234F1Z5"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-xl border border-line bg-cream p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-soft">Bank account</p>
                <div className="mt-3 space-y-3">
                  <Field label="Account holder name">
                    <input
                      className={inputClass}
                      value={data.bankAccountName}
                      onChange={(e) => set("bankAccountName", e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Account number">
                      <input
                        className={inputClass}
                        value={data.bankAccountNumber}
                        inputMode="numeric"
                        onChange={(e) => set("bankAccountNumber", e.target.value.replace(/\s/g, ""))}
                      />
                    </Field>
                    <Field label="IFSC">
                      <input
                        className={`${inputClass} uppercase`}
                        value={data.bankIfsc}
                        maxLength={11}
                        onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())}
                        placeholder="HDFC0001234"
                      />
                    </Field>
                  </div>
                </div>
              </div>
              <div className="relative text-center">
                <span className="bg-paper px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                  or
                </span>
              </div>
              <Field label="UPI ID">
                <input
                  className={inputClass}
                  value={data.upiId}
                  onChange={(e) => set("upiId", e.target.value)}
                  placeholder="name@bank"
                />
              </Field>
            </>
          )}

          {step === 4 && <Review data={data} />}
        </div>

        {error ? (
          <p className="mt-5 rounded-xl border border-danger-line bg-danger-bg px-4 py-3 text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0 || busy}
            className="h-11 rounded-full border border-line-strong px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-body transition hover:bg-white disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={busy}
              className="h-11 rounded-full bg-ink px-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save & continue"}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="h-11 rounded-full bg-ink px-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
}

function Frame({
  email,
  onLogout,
  children,
}: {
  email: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="font-serif text-[18px] font-semibold tracking-[0.18em] text-ink">FITZO</span>
          <span className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-ink/70">
            Store
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-[12px] text-soft sm:inline">{email}</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-[12px] font-semibold uppercase tracking-[0.12em] text-soft hover:text-ink"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[640px] px-5 py-8 sm:px-8 lg:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Get set up</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          Store onboarding
        </h1>
        <p className="mt-2 max-w-[480px] text-[14px] leading-6 text-body">
          Tell us about your store. Once you submit, the Fitzo team reviews and activates your
          account — usually within a business day.
        </p>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const state = i < step ? "done" : i === step ? "active" : "todo";
        return (
          <li key={s.title} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                state === "done"
                  ? "bg-ink text-white"
                  : state === "active"
                    ? "bg-accent text-ink"
                    : "bg-line text-faint"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            {i < STEPS.length - 1 ? (
              <span className={`h-0.5 flex-1 rounded ${i < step ? "bg-ink" : "bg-line"}`} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Review({ data }: { data: OnboardingData }) {
  const entity = ENTITY_TYPES.find((t) => t.value === data.entityType)?.label ?? "—";
  const payout = data.upiId.trim()
    ? `UPI · ${data.upiId.trim()}`
    : data.bankAccountNumber.trim()
      ? `A/C ••••${data.bankAccountNumber.trim().slice(-4)} · ${data.bankIfsc.trim().toUpperCase()}`
      : "—";
  const rows: [string, string][] = [
    ["Store", data.name || "—"],
    ["Category", data.category || "—"],
    ["Phone", data.contactPhone || "—"],
    ["Pickup", [data.address, data.city, data.pincode].filter(Boolean).join(", ") || "—"],
    ["Legal name", data.legalName || "—"],
    ["Entity", entity],
    ["PAN", data.panNumber.toUpperCase() || "—"],
    ["GST", data.gstNumber.toUpperCase() || "Not registered"],
    ["Payout", payout],
  ];
  return (
    <dl className="divide-y divide-hairline rounded-xl border border-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-4 px-4 py-2.5">
          <dt className="w-28 shrink-0 text-[12px] font-semibold uppercase tracking-[0.1em] text-faint">{k}</dt>
          <dd className="min-w-0 flex-1 break-words text-[13px] text-body">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function UnderReview({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-pale text-[26px]">⏳</div>
      <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.01em] text-ink">Application under review</h2>
      <p className="mx-auto mt-2 max-w-[400px] text-[14px] leading-6 text-body">
        Thanks — your store is with the Fitzo team. We&apos;ll email you once it&apos;s approved, and your
        full dashboard unlocks automatically. This usually takes under a business day.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-6 h-11 rounded-full border border-line-strong px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-body transition hover:bg-cream"
      >
        Check status
      </button>
    </div>
  );
}
