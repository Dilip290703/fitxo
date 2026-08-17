"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getDeliveryStatus } from "@/lib/pincode";
import { backdropVariants, panelVariants } from "@/components/motion";

function CloseGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** Promisified geolocation — the callback API doesn't compose with async/await. */
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

function geoErrorMessage(error: unknown) {
  if (typeof GeolocationPositionError !== "undefined" && error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) {
      return "Location permission denied. Allow it in your browser, or enter your pincode below.";
    }
    if (error.code === error.POSITION_UNAVAILABLE) {
      return "Your location isn't available right now. Enter your pincode below.";
    }
    if (error.code === error.TIMEOUT) {
      return "Locating took too long. Try again, or enter your pincode below.";
    }
  }
  return "Couldn't detect your location. Enter your pincode below.";
}

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
  const reduce = useReducedMotion();

  useEffect(() => {
    if (isOpen) {
      setManualPincode(currentValue);
      setError("");
    }
  }, [currentValue, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Live status as the user types — shown when exactly 6 digits entered
  const liveStatus =
    /^\d{6}$/.test(manualPincode.trim())
      ? getDeliveryStatus(manualPincode.trim())
      : null;

  /**
   * Real detection: browser geolocation -> our reverse-geocode route -> pincode.
   * A detected pincode we don't serve is NOT saved silently — we drop it into
   * the field so the red serviceability line explains why nothing happened.
   */
  const handleDetect = async () => {
    setError("");

    if (!("geolocation" in navigator)) {
      setError("This browser can't share your location. Enter your pincode below.");
      return;
    }

    setLoading(true);
    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      const response = await fetch(
        `/api/reverse-geocode?lat=${latitude}&lon=${longitude}`,
      );
      const payload = (await response.json()) as {
        pincode?: string;
        error?: string;
      };

      if (!response.ok || !payload.pincode) {
        setError(payload.error ?? "Couldn't find your pincode. Enter it below.");
        return;
      }

      setManualPincode(payload.pincode);

      if (!getDeliveryStatus(payload.pincode).available) {
        // Serviceability message renders under the field; keep the modal open.
        return;
      }

      onSave(payload.pincode);
      onClose();
    } catch (caught) {
      setError(geoErrorMessage(caught));
    } finally {
      setLoading(false);
    }
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
    <motion.div
      initial={false}
      animate={isOpen ? "open" : "closed"}
      variants={backdropVariants}
      inert={!isOpen}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Set your delivery pincode"
        variants={panelVariants(reduce)}
        className="w-full max-w-md rounded-[28px] bg-[#faf9f6] p-7 shadow-[0_30px_70px_rgba(17,17,17,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
              Delivery area
            </p>
            <h2 className="mt-3 font-display text-[34px] leading-none text-[#181818]">
              Set your pincode
            </h2>
            <p className="mt-2 text-[13px] text-[#706961]">
              FitXo currently delivers across Pune.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-2.5 text-[#6f6050] transition duration-200 hover:bg-[#f4f1ea] hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/50"
            aria-label="Close pincode modal"
          >
            <CloseGlyph />
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
              className="mt-4 inline-flex h-11 cursor-pointer items-center rounded-full bg-[#221b13] px-6 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition duration-200 hover:bg-[#3a2f22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/50"
            >
              Save pincode
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
