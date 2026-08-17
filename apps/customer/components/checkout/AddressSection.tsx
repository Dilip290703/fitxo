"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@fitxo/supabase/client";
import {
  type AddressDraft,
  type AddressFieldErrors,
  type DeliveryAddress,
  emptyDraft,
  formatAddressLine,
  loadAddresses,
  saveNewAddress,
  validateAddressDraft,
} from "@/lib/addresses";

const LABELS = ["Home", "Work", "Other"] as const;

type Props = {
  /** Pre-fill for the pincode field when adding the first address (navbar pill). */
  fallbackPincode?: string;
  selected: DeliveryAddress | null;
  onSelect: (address: DeliveryAddress | null) => void;
};

/**
 * Blinkit/Zepto-style delivery-address block for checkout:
 *  - saved default address shown as a card,
 *  - "Change" → quick-switch between saved addresses,
 *  - "+ Add new address" → inline detailed form (house, street, landmark,
 *    city, pincode, phone), saved to the `addresses` table.
 * Selection is reported up; the page blocks ordering until one is chosen.
 */
export function AddressSection({ fallbackPincode = "", selected, onSelect }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(
    async (uid: string) => {
      const rows = await loadAddresses(uid);
      setAddresses(rows);
      return rows;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setCheckedAuth(true);
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const rows = await refresh(user.id);
      if (cancelled) return;
      // Auto-select the default (list is default-first); open the form when
      // the account has no address yet — the order can't go out without one.
      if (rows.length > 0) {
        onSelect(rows[0]);
      } else {
        setAdding(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAdd = () => {
    setDraft({ ...emptyDraft, pincode: /^\d{6}$/.test(fallbackPincode) ? fallbackPincode : "" });
    setFieldErrors({});
    setSaveError(null);
    setAdding(true);
    setSwitching(false);
  };

  const handleSave = async () => {
    if (!userId || saving) return;
    const errors = validateAddressDraft(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    const { address, error } = await saveNewAddress(userId, draft, addresses.length === 0);
    setSaving(false);
    if (error || !address) {
      setSaveError(error ?? "Could not save the address.");
      return;
    }
    setAddresses((prev) => [address, ...prev.filter((a) => a.id !== address.id)]);
    onSelect(address);
    setAdding(false);
  };

  const inputClass = (invalid: boolean) =>
    [
      "w-full rounded-[12px] border bg-[#fbfaf7] px-3.5 py-2.5 text-[14px] text-[#171717] outline-none transition",
      invalid ? "border-[#c0392b]" : "border-[#ddd4c9] focus:border-[#171d2b]",
    ].join(" ");

  const fieldError = (key: keyof AddressFieldErrors) =>
    fieldErrors[key] ? (
      <p className="mt-1 text-[12px] text-[#c0392b]">{fieldErrors[key]}</p>
    ) : null;

  return (
    <section className="rounded-[22px] border border-[#ece4da] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-medium text-[#171717]">Delivery address</h2>
        {userId && !adding && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd4c9] px-3.5 py-1.5 text-[13px] font-medium text-[#171717] transition hover:border-[#171d2b]"
          >
            <span className="text-[16px] leading-none">+</span> Add new
          </button>
        )}
      </div>

      {/* Loading / logged out */}
      {loading && (
        <p className="mt-4 text-[14px] text-[#8b7058]">Loading your addresses…</p>
      )}
      {!loading && checkedAuth && !userId && (
        <p className="mt-4 rounded-[12px] bg-[#fff8e1] px-4 py-3 text-[13px] text-[#856d00]">
          Log in to add your delivery address — you&apos;ll be asked when you place the order.
        </p>
      )}

      {/* Selected address card + Change */}
      {!loading && userId && selected && !adding && !switching && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-[16px] border border-[#ddd4c9] bg-[#fbfaf7] px-4 py-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#171717]">
              <span className="mr-2 rounded-full bg-[#f4ede4] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b7058]">
                {selected.label}
              </span>
              {selected.fullName} · {selected.phone}
            </p>
            <p className="mt-1.5 text-[14px] leading-6 text-[#5f5851]">
              {formatAddressLine(selected)}
            </p>
          </div>
          {addresses.length > 1 && (
            <button
              type="button"
              onClick={() => setSwitching(true)}
              className="shrink-0 text-[13px] font-semibold text-[#171d2b] underline underline-offset-4"
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* Quick-switch list */}
      {!loading && userId && switching && !adding && (
        <div className="mt-4 space-y-2.5">
          {addresses.map((a) => {
            const isSelected = selected?.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSelect(a);
                  setSwitching(false);
                }}
                className={[
                  "flex w-full items-start gap-3 rounded-[16px] border px-4 py-3.5 text-left transition",
                  isSelected
                    ? "border-[#171d2b] bg-[#171d2b]/[0.03]"
                    : "border-[#ddd4c9] bg-[#fbfaf7] hover:border-[#171d2b]",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                    isSelected ? "border-[#171d2b] bg-[#171d2b]" : "border-[#ddd4c9]",
                  ].join(" ")}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#171717]">
                    {a.label} · {a.fullName}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-[#5f5851]">
                    {formatAddressLine(a)}
                  </span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={startAdd}
            className="w-full rounded-[16px] border border-dashed border-[#ddd4c9] px-4 py-3 text-[13px] font-semibold text-[#171d2b] transition hover:border-[#171d2b]"
          >
            + Add new address
          </button>
        </div>
      )}

      {/* No address yet → nudge (form opens automatically) */}
      {!loading && userId && !selected && !adding && (
        <button
          type="button"
          onClick={startAdd}
          className="mt-4 w-full rounded-[16px] border border-dashed border-[#ddd4c9] px-4 py-4 text-[14px] font-semibold text-[#171d2b] transition hover:border-[#171d2b]"
        >
          + Add your delivery address
        </button>
      )}

      {/* Add-new form */}
      {!loading && userId && adding && (
        <div className="mt-5 space-y-4">
          <div className="flex gap-2">
            {LABELS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, label }))}
                className={[
                  "rounded-full border px-4 py-1.5 text-[13px] font-medium transition",
                  draft.label === label
                    ? "border-[#171d2b] bg-[#171d2b] text-white"
                    : "border-[#ddd4c9] bg-[#fbfaf7] text-[#171717] hover:border-[#171d2b]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <input
                value={draft.fullName}
                onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
                placeholder="Receiver's full name"
                className={inputClass(!!fieldErrors.fullName)}
              />
              {fieldError("fullName")}
            </div>
            <div>
              <input
                value={draft.phone}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                }
                placeholder="10-digit mobile number"
                inputMode="numeric"
                className={inputClass(!!fieldErrors.phone)}
              />
              {fieldError("phone")}
            </div>
          </div>

          <div>
            <input
              value={draft.line1}
              onChange={(e) => setDraft((d) => ({ ...d, line1: e.target.value }))}
              placeholder="House / flat no. & building"
              className={inputClass(!!fieldErrors.line1)}
            />
            {fieldError("line1")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={draft.line2}
              onChange={(e) => setDraft((d) => ({ ...d, line2: e.target.value }))}
              placeholder="Street / area / colony (optional)"
              className={inputClass(false)}
            />
            <input
              value={draft.landmark}
              onChange={(e) => setDraft((d) => ({ ...d, landmark: e.target.value }))}
              placeholder="Landmark (optional)"
              className={inputClass(false)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <input
                value={draft.city}
                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                placeholder="City"
                className={inputClass(!!fieldErrors.city)}
              />
              {fieldError("city")}
            </div>
            <div>
              <input
                value={draft.pincode}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))
                }
                placeholder="Pincode (Pune)"
                inputMode="numeric"
                className={inputClass(!!fieldErrors.pincode)}
              />
              {fieldError("pincode")}
            </div>
          </div>

          {saveError && (
            <p className="rounded-[12px] bg-[#fdecea] px-4 py-3 text-[13px] text-[#c0392b]">{saveError}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-[14px] bg-[#171d2b] px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save & deliver here"}
            </button>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setSwitching(false);
                }}
                className="text-[13px] font-medium text-[#8b7058] underline underline-offset-4"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
