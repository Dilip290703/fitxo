/**
 * FitXo serviceable-pincode list — the single source of truth.
 *
 * FitXo currently delivers ONLY in Pune. Two apps consume this:
 *   • apps/customer (lib/pincode.ts): address/checkout serviceability + ETA copy
 *   • apps/admin: store-onboarding approval gate (G6 — a store outside the
 *     delivery area can't be approved without an explicit override)
 * Never copy this list into an app — a drifted copy means the customer app
 * and the admin approval gate disagree about where FitXo delivers.
 */

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

/** Returns true only for 6-digit strings that belong to Pune. */
export function isPunePincode(pincode: string): boolean {
  return punePincodes.has(pincode.trim());
}
