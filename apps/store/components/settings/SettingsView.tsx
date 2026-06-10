"use client";

import { useEffect, useState } from "react";
import { loadStoreProfile, saveStoreProfile, type StoreProfile } from "@/lib/storeSettings";

export function SettingsView({ storeId }: { storeId: string }) {
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    loadStoreProfile(storeId)
      .then((p) => {
        if (!active) return;
        if (!p) setError("We couldn't load your store profile.");
        else setProfile(p);
      })
      .catch(() => {
        if (active) setError("We couldn't load your store profile.");
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  const setField = <K extends keyof StoreProfile>(key: K, value: StoreProfile[K]) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
    setError("");
  };

  const handleSave = async () => {
    if (!profile) return;
    if (profile.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contactEmail.trim())) {
      setError("Enter a valid contact email.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveStoreProfile(storeId, profile);
      setSaved(true);
    } catch {
      setError("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">Settings</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          Store profile
        </h1>
      </header>

      {!profile && !error ? (
        <div className="mt-7 h-64 animate-pulse rounded-2xl border border-[#ece5da] bg-white" aria-hidden />
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-[#e6c4bb] bg-[#fbeeea] px-4 py-3 text-[13px] font-medium text-[#b83c24]">
          {error}
        </p>
      ) : null}

      {profile ? (
        <>
          <section className="mt-7 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-[#171d2b]">{profile.name}</h2>
                <p className="mt-0.5 font-mono text-[12px] text-[#958675]">/{profile.slug}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  profile.isVerified ? "bg-[#e8f3ea] text-[#2f7d46]" : "bg-[#fbeed0] text-[#9a6a12]"
                }`}
              >
                {profile.isVerified ? "Verified" : "Pending verification"}
              </span>
            </div>
            <p className="mt-3 rounded-xl bg-[#f6f1e8] px-4 py-3 text-[12px] leading-5 text-[#6a6259]">
              Your store name and URL are managed by the Fitzo team — contact admin to change them.
            </p>
          </section>

          <section className="mt-5 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-[#171d2b]">Contact & address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Description" className="sm:col-span-2">
                <textarea
                  className={`${inputClass} min-h-[80px] py-2.5`}
                  value={profile.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </Field>
              <Field label="Contact email">
                <input
                  type="email"
                  className={inputClass}
                  value={profile.contactEmail}
                  onChange={(e) => setField("contactEmail", e.target.value)}
                />
              </Field>
              <Field label="Contact phone">
                <input
                  type="tel"
                  className={inputClass}
                  value={profile.contactPhone}
                  onChange={(e) => setField("contactPhone", e.target.value)}
                />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <input
                  className={inputClass}
                  value={profile.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </Field>
              <Field label="City">
                <input className={inputClass} value={profile.city} onChange={(e) => setField("city", e.target.value)} />
              </Field>
              <Field label="Pincode">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={profile.pincode}
                  onChange={(e) => setField("pincode", e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              {saved ? <span className="text-[12px] font-semibold text-[#2f7d46]">Saved ✓</span> : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-[#171d2b] px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1f2a3c] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-[#ded3c6] bg-white px-3 text-[14px] text-[#171d2b] outline-none transition focus:border-[#171d2b] focus:ring-4 focus:ring-[#ffd233]/25";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7f7469]">
        {label}
      </span>
      {children}
    </label>
  );
}
