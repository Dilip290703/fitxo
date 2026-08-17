import { createClient } from "@fitxo/supabase/client";
import type { StoreOnboardingStatus } from "@fitxo/supabase/types";

/**
 * The store-manager context for the signed-in user. Every store-panel screen
 * gates on this: a valid Supabase session is not enough — the user must also
 * have an active row in `store_managers`, which is what links them to a store.
 */
export type StoreContext = {
  userId: string;
  email: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  onboardingStatus: StoreOnboardingStatus;
  rejectionReason: string | null;
  isActive: boolean;
  isVerified: boolean;
};

/**
 * Resolve the current user's store context, or `null` when there is no session
 * or the user is not an active store manager (e.g. a customer/rider account
 * authenticating against the same Supabase project).
 *
 * THROWS on a transport/query failure — callers must distinguish "not a
 * manager" (null) from "couldn't check right now" (throw), so a flaky
 * connection doesn't masquerade as a failed login.
 *
 * Relies on RLS policy `store_managers_select`, which lets a user read their
 * own `store_managers` rows under the anon client — no service-role needed.
 */
export async function getStoreContext(): Promise<StoreContext | null> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("store_managers")
    .select(
      "store_id, store:stores(id, name, slug, onboarding_status, rejection_reason, is_active, is_verified)",
    )
    .eq("user_id", session.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // A to-one embed comes back as an object, but normalize defensively.
  const store = Array.isArray(data.store) ? data.store[0] : data.store;
  if (!store) return null;

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    storeId: data.store_id,
    storeName: store.name,
    storeSlug: store.slug,
    onboardingStatus: store.onboarding_status,
    rejectionReason: store.rejection_reason,
    isActive: store.is_active,
    isVerified: store.is_verified,
  };
}
