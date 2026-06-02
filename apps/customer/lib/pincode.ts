/**
 * FitZo Pincode System — single source of truth.
 *
 * FitZo currently delivers ONLY in Pune.
 * All delivery logic across the app must use the helpers below.
 * Never hardcode ETA text or serviceability logic elsewhere.
 */

// ─── Pune pincode list ────────────────────────────────────────────────────────

export const punePincodes: ReadonlySet<string> = new Set([
  // Pune city core
  "411001", "411002", "411003", "411004", "411005", "411006",
  "411007", "411008", "411009", "411010", "411011", "411012",
  "411013", "411014", "411015", "411016", "411017", "411018",
  "411019", "411020", "411021", "411022", "411023", "411024",
  "411025", "411026", "411027", "411028", "411029", "411030",
  "411031", "411032", "411033", "411034", "411035", "411036",
  "411037", "411038", "411039", "411040", "411041", "411042",
  "411043", "411044", "411045", "411046", "411047", "411048",
  "411049", "411050", "411051", "411052", "411053", "411054",
  "411055", "411056", "411057", "411058", "411059", "411060",
  "411061", "411062", "411063", "411064", "411065", "411066",
  "411067", "411068",
  // Pimpri-Chinchwad (PCMC) — part of Pune metro
  "411078", "411109", "411110", "411111", "411112", "411113",
  // Pune cantonment / NIBM / Hadapsar extension
  "411070", "411076",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryStatus = {
  available: boolean;
  eta: string | null;
  /** Human-readable message shown in UI */
  message: string;
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

/** Returns true only for 6-digit strings that belong to Pune. */
export function isPunePincode(pincode: string): boolean {
  return punePincodes.has(pincode.trim());
}

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
      eta: "60 Minutes",
      message: "Delivery available — 60-minute doorstep try-on.",
    };
  }

  return {
    available: false,
    eta: null,
    message: "FitZo is currently available only in Pune.",
  };
}

/** A pincode to use when the user clicks "Detect my location" (Pune mock). */
export const MOCK_DETECTED_PINCODE = "411021";
