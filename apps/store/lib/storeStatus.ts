import { createClient } from "@fitxo/supabase/client";

/**
 * Store Open/Paused state (G6 / migration 052).
 *
 * Paused = the store takes no NEW orders (place_order raises STORE_PAUSED);
 * everything already placed still needs fulfilling, and the store + catalogue
 * stay visible to customers. Distinct from is_active — that's the admin kill
 * switch and managers can't touch it.
 */

/**
 * null = the DB predates migration 052 (is_paused column missing) — callers
 * hide the control instead of rendering a dead switch.
 */
export async function loadPauseState(storeId: string): Promise<{ paused: boolean } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("is_paused")
    .eq("id", storeId)
    .maybeSingle();
  if (error || !data) return null;
  return { paused: data.is_paused === true };
}

/** Flip the pause flag via the guarded RPC (008-pattern: no UPDATE policy on stores). */
export async function setStorePaused(storeId: string, paused: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("store_set_paused", {
    p_store_id: storeId,
    p_paused: paused,
  });
  if (error) throw new Error(error.message);
}
