-- Migration 028: recover stuck deliveries (rider release + auto-release on offline)
-- Run in Supabase SQL Editor after migration 027.
--
-- A rider who claims a job then goes offline / closes the app used to freeze that
-- order — it was no longer offered to anyone and only an admin override could move
-- it. This adds:
--   1. rider_release_delivery() — a rider hands an un-picked-up job back to the
--      pool (with a short cooldown so it doesn't bounce straight back to them).
--   2. rider_set_availability() — going Offline auto-releases any un-picked-up jobs
--      the rider was holding, back into the pool for other riders.
-- (Admin release/reassign is handled in the admin app via the admin RLS.)
-- Idempotent.
-- ============================================================

-- 1. Rider voluntarily returns an accepted (not-yet-picked-up) job to the pool.
CREATE OR REPLACE FUNCTION rider_release_delivery(p_delivery_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a verified rider'; END IF;

  UPDATE deliveries
     SET rider_id = NULL, status = 'assigned', accepted_at = NULL
   WHERE id = p_delivery_id AND rider_id = v_rider AND status = 'accepted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'can only release a job you have accepted but not yet picked up';
  END IF;

  -- Short cooldown so the released job doesn't immediately re-offer to this rider.
  INSERT INTO delivery_declines (rider_id, delivery_id)
  VALUES (v_rider, p_delivery_id)
  ON CONFLICT (rider_id, delivery_id) DO UPDATE SET declined_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION rider_release_delivery(UUID) TO authenticated;

-- 2. Going offline auto-releases un-picked-up jobs so nothing stays stuck.
CREATE OR REPLACE FUNCTION rider_set_availability(p_available boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider UUID;
BEGIN
  UPDATE riders SET is_available = p_available WHERE user_id = auth.uid()
   RETURNING id INTO v_rider;
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a rider'; END IF;

  IF NOT p_available THEN
    -- Release only jobs accepted but not yet picked up (a picked-up rider still
    -- physically has the items — that's an admin/support case, not auto-release).
    UPDATE deliveries
       SET rider_id = NULL, status = 'assigned', accepted_at = NULL
     WHERE rider_id = v_rider AND status = 'accepted';
  END IF;
END; $$;
