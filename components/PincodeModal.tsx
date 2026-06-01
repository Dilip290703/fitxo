"use client";

import { FormEvent, useEffect, useState } from "react";
import { getDeliveryStatus, MOCK_DETECTED_PINCODE } from "@/lib/pincode";

type PincodeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
  currentValue: string;
};

export function PincodeModal({
  isOpen,
  onClose,
  onSave,
  currentValue,
}: PincodeModalProps) {
  const [manualPincode, setManualPincode] = useState(currentValue);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setManualPincode(currentValue);
      setError("");
    }
  }, [currentValue, isOpen]);

  if (!isOpen) return null;

  // Live status as the user types — shown when exactly 6 digits entered
  const liveStatus =
    /^\d{6}$/.test(manualPincode.trim())
      ? getDeliveryStatus(manualPincode.trim())
      : null;

  // Detect location — mocks a Pune pincode (real geo-detection deferred)
  const handleDetect = async () => {
    setLoading(true);
    setError("");
    await new Promise((resolve) => setTimeout(resolve, 800));
    onSave(MOCK_DETECTED_PINCODE);
    setLoading(false);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = manualPincode.trim();
    if (!/^\d{6}$/.test(clean)) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    setError("");
    onSave(clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-[28px] bg-[#fffdf9] p-7 shadow-[0_30px_70px_rgba(17,17,17,0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
              Delivery area
            </p>
            <h2 className="mt-3 font-display text-[34px] leading-none text-[#181818]">
              Set your pincode
            </h2>
            <p className="mt-2 text-[13px] text-[#706961]">
              FitZo currently delivers across Pune.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#6f6a63] transition duration-200 hover:bg-[#f4ede4] hover:text-black"
            aria-label="Close pincode modal"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {/* Detect location */}
          <button
            type="button"
            onClick={handleDetect}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-[18px] border border-[#e7ddd1] bg-white px-5 py-4 text-left transition duration-200 hover:border-[#d7cab9] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span>
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
                Quick option
              </span>
              <span className="mt-1 block text-[15px] text-[#232323]">
                Detect current location
              </span>
            </span>
            <span className="text-[13px] font-semibold text-[#1d1d1d]">
              {loading ? "Detecting…" : "Use"}
            </span>
          </button>

          {/* Manual entry */}
          <form onSubmit={handleSubmit} className="rounded-[18px] border border-[#e7ddd1] bg-white p-5">
            <label className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
              Enter manually
            </label>
            <input
              value={manualPincode}
              onChange={(e) =>
                setManualPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6-digit pincode"
              className="mt-3 h-12 w-full rounded-[12px] border border-[#d9cfc4] bg-[#fffdf9] px-4 text-[14px] text-[#1f1f1f] outline-none transition duration-200 focus:border-[#161616]"
            />

            {/* Live serviceability feedback */}
            {liveStatus && (
              <p
                className={`mt-2 text-[12px] font-medium ${
                  liveStatus.available ? "text-[#2e7d32]" : "text-[#c0392b]"
                }`}
              >
                {liveStatus.available ? "✓ " : "✗ "}
                {liveStatus.message}
              </p>
            )}

            {error && (
              <p className="mt-2 text-[12px] text-[#c0392b]">{error}</p>
            )}

            <button
              type="submit"
              className="mt-4 inline-flex h-11 items-center rounded-full bg-[#1f2a3c] px-6 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition duration-200 hover:bg-[#141d2b]"
            >
              Save pincode
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
