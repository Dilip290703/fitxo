/**
 * Customer delivery addresses — shared types + helpers.
 *
 * The `addresses` table (schema.sql §9) is the single store; RLS restricts
 * every row to its owner. Checkout and Profile both read through here so the
 * two screens can never disagree about what an address looks like.
 */

import { createClient } from "@fitxo/supabase/client";
import { getDeliveryStatus } from "./pincode";

export type DeliveryAddress = {
  id: string;
  label: string; // Home / Work / Other
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type AddressDraft = Omit<DeliveryAddress, "id" | "isDefault">;

export const emptyDraft: AddressDraft = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "Pune",
  state: "Maharashtra",
  pincode: "",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDeliveryAddress(row: any): DeliveryAddress {
  return {
    id: row.id,
    label: row.label || "Home",
    fullName: row.full_name ?? "",
    phone: row.phone ?? "",
    line1: row.line1 ?? "",
    line2: row.line2 ?? "",
    landmark: row.landmark ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    pincode: row.pincode ?? "",
    isDefault: row.is_default ?? false,
  };
}

/** One display line: "12 Rose Villa, MG Road, near Café X, Pune — 411001". */
export function formatAddressLine(a: DeliveryAddress): string {
  return [a.line1, a.line2, a.landmark && `near ${a.landmark}`, a.city]
    .filter(Boolean)
    .join(", ") + ` — ${a.pincode}`;
}

/** Loads the user's addresses, default first, then newest first. */
export async function loadAddresses(userId: string): Promise<DeliveryAddress[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });
  if (error || !data) return [];
  return data.map(toDeliveryAddress);
}

export type AddressFieldErrors = Partial<Record<keyof AddressDraft, string>>;

/**
 * Per-field validation shared by the checkout form (and any future address
 * form). Pincode must be a serviceable Pune pincode — Fitxo delivers only
 * where a rider can actually go.
 */
export function validateAddressDraft(d: AddressDraft): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  if (!d.fullName.trim()) errors.fullName = "Please enter the receiver's name.";
  if (!/^[6-9]\d{9}$/.test(d.phone.trim())) {
    errors.phone = "Enter a valid 10-digit mobile number.";
  }
  if (!d.line1.trim()) errors.line1 = "House / flat / building is required.";
  if (!d.city.trim()) errors.city = "City is required.";
  const pin = d.pincode.trim();
  if (!/^\d{6}$/.test(pin)) {
    errors.pincode = "Enter a valid 6-digit pincode.";
  } else if (!getDeliveryStatus(pin).available) {
    errors.pincode = "Fitxo currently delivers only in Pune. This pincode isn't serviceable yet.";
  }
  return errors;
}

/** Inserts a new address (first one becomes the default). Returns the saved row. */
export async function saveNewAddress(
  userId: string,
  draft: AddressDraft,
  makeDefault: boolean,
): Promise<{ address?: DeliveryAddress; error?: string }> {
  const supabase = createClient();

  if (makeDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: userId,
      label: draft.label || "Home",
      full_name: draft.fullName.trim(),
      phone: draft.phone.trim(),
      line1: draft.line1.trim(),
      line2: draft.line2.trim() || null,
      landmark: draft.landmark.trim() || null,
      city: draft.city.trim(),
      state: draft.state.trim() || "Maharashtra",
      pincode: draft.pincode.trim(),
      is_default: makeDefault,
    })
    .select("id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not save the address." };
  return { address: toDeliveryAddress(data) };
}
