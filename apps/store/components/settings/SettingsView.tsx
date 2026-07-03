"use client";

import { useEffect, useState } from "react";
import { loadStoreProfile, saveStoreProfile, type StoreProfile } from "@/lib/storeSettings";
import { PHONE_RE, PINCODE_RE } from "@/lib/onboarding";
import { useStorePanel } from "@/components/panel/PanelContext";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Banner } from "@/components/ui/Banner";
import { BlockSkeleton } from "@/components/ui/Skeleton";
import { Field, inputClass } from "@/components/ui/FormField";

type ProfileErrors = Partial<Record<"contactEmail" | "contactPhone" | "pincode", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateProfile(p: StoreProfile): ProfileErrors {
  const errors: ProfileErrors = {};
  if (p.contactEmail.trim() && !EMAIL_RE.test(p.contactEmail.trim()))
    errors.contactEmail = "Enter a valid email.";
  if (p.contactPhone.trim() && !PHONE_RE.test(p.contactPhone.trim()))
    errors.contactPhone = "Enter a valid 10-digit mobile number.";
  if (p.pincode.trim() && !PINCODE_RE.test(p.pincode.trim()))
    errors.pincode = "Enter a valid 6-digit pincode.";
  return errors;
}

export function SettingsView() {
  const { storeId } = useStorePanel();
  const toast = useToast();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

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
    setError("");
    setFieldErrors({});
  };

  const handleSave = async () => {
    if (!profile) return;
    const errs = validateProfile(profile);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveStoreProfile(storeId, profile);
      toast("Profile saved");
    } catch {
      setError("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader eyebrow="Settings" title="Store profile" />

      {!profile && !error ? <BlockSkeleton className="mt-7 h-64" /> : null}

      {error ? (
        <Banner variant="error" className="mt-6">{error}</Banner>
      ) : null}

      {profile ? (
        <>
          <section className="mt-7 rounded-2xl border border-line bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-ink">{profile.name}</h2>
                <p className="mt-0.5 font-mono text-[12px] text-muted">/{profile.slug}</p>
              </div>
              <StatusBadge tone={profile.isVerified ? "green" : "amber"}>
                {profile.isVerified ? "Verified" : "Pending verification"}
              </StatusBadge>
            </div>
            <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[12px] leading-5 text-body">
              Your store name and URL are managed by the Fitzo team — contact admin to change them.
            </p>
          </section>

          <section className="mt-5 rounded-2xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-ink">Contact & address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Description" className="sm:col-span-2">
                <textarea
                  className={`${inputClass} min-h-[80px] py-2.5`}
                  value={profile.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </Field>
              <Field label="Contact email" error={fieldErrors.contactEmail}>
                <input
                  type="email"
                  className={inputClass}
                  value={profile.contactEmail}
                  onChange={(e) => setField("contactEmail", e.target.value)}
                />
              </Field>
              <Field label="Contact phone" error={fieldErrors.contactPhone}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputClass}
                  value={profile.contactPhone}
                  onChange={(e) => setField("contactPhone", e.target.value.replace(/\D/g, ""))}
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
              <Field label="Pincode" error={fieldErrors.pincode}>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={6}
                  value={profile.pincode}
                  onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft disabled:opacity-60"
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
