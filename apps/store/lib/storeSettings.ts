import { createClient } from "@fitzo/supabase/client";

export type StoreProfile = {
  name: string;
  slug: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  pincode: string;
  isVerified: boolean;
};

export type StaffMember = {
  userId: string;
  name: string | null;
  email: string;
  isActive: boolean;
  assignedAt: string;
};

export async function loadStoreProfile(storeId: string): Promise<StoreProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("name, slug, description, contact_email, contact_phone, address, city, pincode, is_verified")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    name: data.name ?? "",
    slug: data.slug ?? "",
    description: data.description ?? "",
    contactEmail: data.contact_email ?? "",
    contactPhone: data.contact_phone ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    pincode: data.pincode ?? "",
    isVerified: data.is_verified ?? false,
  };
}

/**
 * Saves only the safe contact/profile fields via the guarded RPC from
 * migration 008 — name/slug/is_active/is_verified stay admin-owned.
 */
export async function saveStoreProfile(storeId: string, p: StoreProfile): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_store_profile", {
    p_store_id: storeId,
    p_description: p.description.trim() || null,
    p_contact_email: p.contactEmail.trim() || null,
    p_contact_phone: p.contactPhone.trim() || null,
    p_address: p.address.trim() || null,
    p_city: p.city.trim() || null,
    p_pincode: p.pincode.trim() || null,
  });
  if (error) throw error;
}

export async function loadStaff(storeId: string): Promise<StaffMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_store_staff", { p_store_id: storeId });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((s: any) => ({
    userId: s.user_id,
    name: s.name ?? null,
    email: s.email ?? "",
    isActive: s.is_active ?? true,
    assignedAt: s.assigned_at,
  }));
}
