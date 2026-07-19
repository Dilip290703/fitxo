/**
 * FitZo Pincode System — customer-app helpers.
 *
 * FitZo currently delivers ONLY in Pune.
 * All delivery logic across the app must use the helpers below.
 * Never hardcode ETA text or serviceability logic elsewhere.
 *
 * The pincode LIST itself lives in @fitzo/pincode (shared with the admin
 * panel's store-approval gate) — this module re-exports it and adds the
 * customer-facing delivery messaging.
 */

export { punePincodes, isPunePincode } from "@fitzo/pincode";
import { isPunePincode } from "@fitzo/pincode";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryStatus = {
  available: boolean;
  eta: string | null;
  /** Human-readable message shown in UI */
  message: string;
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * The ONE function all components call to determine delivery availability.
 * Pass a 6-digit string; returns a consistent DeliveryStatus object.
 */
export function getDeliveryStatus(pincode: string): DeliveryStatus {
  const clean = pincode.trim();

  if (!/^\d{6}$/.test(clean)) {
    return {
      available: false,
      eta: null,
      message: "Enter a valid 6-digit pincode to check delivery.",
    };
  }

  if (isPunePincode(clean)) {
    return {
      available: true,
      eta: "Book a slot",
      message: "Delivery available — book a slot for doorstep try-on.",
    };
  }

  return {
    available: false,
    eta: null,
    message: "FitZo is currently available only in Pune.",
  };
}
