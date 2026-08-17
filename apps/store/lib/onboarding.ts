import { createClient } from "@fitxo/supabase/client";
import type { StoreEntityType, StoreOnboardingStatus } from "@fitxo/supabase/types";

/**
 * The full onboarding application: the safe `stores` profile columns plus the
 * private business/KYC/payout details (store_business_details). Everything the
 * store fills before submitting for admin review.
 */
export type OnboardingData = {
  // Store profile (public-facing)
  name: string;
  category: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  pincode: string;
  // Business / KYC (private)
  legalName: string;
  entityType: StoreEntityType | "";
  gstNumber: string;
  panNumber: string;
  // Payout (private)
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
};

export type OnboardingState = {
  status: StoreOnboardingStatus;
  rejectionReason: string | null;
  data: OnboardingData;
};

const EMPTY: OnboardingData = {
  name: "",
  category: "",
  description: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  city: "",
  pincode: "",
  legalName: "",
  entityType: "",
  gstNumber: "",
  panNumber: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
};

export async function loadOnboarding(storeId: string): Promise<OnboardingState> {
  const supabase = createClient();

  const [{ data: store }, { data: biz }] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "name, category, description, contact_email, contact_phone, address, city, pincode, onboarding_status, rejection_reason",
      )
      .eq("id", storeId)
      .maybeSingle(),
    supabase
      .from("store_business_details")
      .select(
        "legal_name, entity_type, gst_number, pan_number, bank_account_name, bank_account_number, bank_ifsc, upi_id",
      )
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);

  return {
    status: store?.onboarding_status ?? "draft",
    rejectionReason: store?.rejection_reason ?? null,
    data: {
      ...EMPTY,
      name: store?.name ?? "",
      category: store?.category ?? "",
      description: store?.description ?? "",
      contactEmail: store?.contact_email ?? "",
      contactPhone: store?.contact_phone ?? "",
      address: store?.address ?? "",
      city: store?.city ?? "",
      pincode: store?.pincode ?? "",
      legalName: biz?.legal_name ?? "",
      entityType: (biz?.entity_type as StoreEntityType | null) ?? "",
      gstNumber: biz?.gst_number ?? "",
      panNumber: biz?.pan_number ?? "",
      bankAccountName: biz?.bank_account_name ?? "",
      bankAccountNumber: biz?.bank_account_number ?? "",
      bankIfsc: biz?.bank_ifsc ?? "",
      upiId: biz?.upi_id ?? "",
    },
  };
}

/** Persist the draft (profile + business details) via the guarded RPC. */
export async function saveOnboarding(storeId: string, d: OnboardingData): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("save_store_onboarding", {
    p_store_id: storeId,
    p_name: d.name.trim(),
    p_category: d.category.trim() || null,
    p_description: d.description.trim() || null,
    p_contact_email: d.contactEmail.trim() || null,
    p_contact_phone: d.contactPhone.trim() || null,
    p_address: d.address.trim() || null,
    p_city: d.city.trim() || null,
    p_pincode: d.pincode.trim() || null,
    p_legal_name: d.legalName.trim() || null,
    p_entity_type: d.entityType || null,
    p_gst_number: d.gstNumber.trim() || null,
    p_pan_number: d.panNumber.trim() || null,
    p_bank_account_name: d.bankAccountName.trim() || null,
    p_bank_account_number: d.bankAccountNumber.trim() || null,
    p_bank_ifsc: d.bankIfsc.trim() || null,
    p_upi_id: d.upiId.trim() || null,
  });
  if (error) throw error;
}

/** Submit the draft for admin review. Throws with the missing-fields message on failure. */
export async function submitOnboarding(storeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("submit_store_onboarding", { p_store_id: storeId });
  if (error) throw error;
}

export const ENTITY_TYPES: { value: StoreEntityType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "proprietorship", label: "Sole proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "pvt_ltd", label: "Private limited" },
  { value: "llp", label: "LLP" },
];

export const STORE_CATEGORIES = [
  "Menswear",
  "Womenswear",
  "Kidswear",
  "Footwear",
  "Ethnic wear",
  "Activewear",
  "Accessories",
  "Multi-category",
];

// ---- Client-side validators (mirror the server-side checks in migration 029) ----
export const PHONE_RE = /^[6-9][0-9]{9}$/;
export const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_RE = /^[1-9][0-9]{5}$/;
