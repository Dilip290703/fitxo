-- Migration 017: Agent panel — rider self-service profile edits.
-- Run in the Supabase SQL Editor (after 014..016).
--
-- The agent panel lets a rider edit their own vehicle type/number from Settings.
-- We route this through a guarded SECURITY DEFINER RPC (same pattern as every
-- other rider write) instead of a broad table UPDATE policy.

-- ============================================================
-- Guarded profile update — a rider can only edit safe, self-owned fields.
-- (is_verified / rating / total_deliveries stay admin/system-owned.)
-- ============================================================
CREATE OR REPLACE FUNCTION rider_update_profile(
  p_vehicle_type text,
  p_vehicle_number text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE riders
     SET vehicle_type   = p_vehicle_type::vehicle_type,
         vehicle_number = NULLIF(btrim(p_vehicle_number), '')
   WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not a rider'; END IF;
END; $$;

REVOKE ALL ON FUNCTION rider_update_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_update_profile(text, text) TO authenticated;

-- ============================================================
-- Security fix: migration 014 (agent panel) added `riders_update_own` as a broad
-- FOR UPDATE policy with no WITH CHECK, which would let a rider flip their own
-- is_verified flag straight from the client. All legitimate rider writes now go
-- through SECURITY DEFINER RPCs (set_availability, update_profile), so the broad
-- policy is no longer needed — drop it to close the privilege-escalation path.
-- ============================================================
DROP POLICY IF EXISTS riders_update_own ON riders;
