-- ============================================================
-- 048 — Try-window single source of truth (launch-plan task W1.5 / A3)
--
-- The try window (the rider's doorstep wait) must have ONE owner:
-- system_settings.try_window_minutes (Admin → System Settings, migration 011).
-- Before this migration the window was decided in three places:
--   • checkout placed a placeholder deadline with a hardcoded 7   (app code — fixed alongside)
--   • start_try_window() (migration 014) hardcoded 7 in SQL       (fixed HERE)
--   • system_settings.try_window_minutes said 60 in the live DB   (fixed HERE)
--
-- Owner decision (Jay, 2026-07-15): the try window is 7 MINUTES. The live
-- value of 60 was a mix-up with the 60-minute DELIVERY promise, so it is
-- corrected 60 → 7 below (guarded: any other deliberately-set value is kept).
--
-- Idempotent: CREATE OR REPLACE + a value-guarded UPDATE.
-- Apply after 047 (Dilip's reserved block 043–047).
-- ============================================================

-- 1) start_try_window reads the setting (fallback 7 if the singleton is missing).
--    Same contract as 014's version: owner-gated, only flips a 'delivered' order.
CREATE OR REPLACE FUNCTION start_try_window(p_order_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_minutes  int;
  v_deadline timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT COALESCE(try_window_minutes, 7) INTO v_minutes FROM system_settings WHERE id = 1;
  IF v_minutes IS NULL OR v_minutes < 1 THEN v_minutes := 7; END IF;

  v_deadline := now() + (v_minutes || ' minutes')::interval;

  UPDATE orders SET status = 'try_window_active', try_deadline = v_deadline
   WHERE id = p_order_id AND status = 'delivered';
  IF NOT FOUND THEN RAISE EXCEPTION 'order is not awaiting a try window'; END IF;

  UPDATE try_sessions SET started_at = now(), deadline_at = v_deadline, status = 'active'
   WHERE order_id = p_order_id;
END; $$;

REVOKE ALL ON FUNCTION start_try_window(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_try_window(uuid) TO authenticated;

-- 2) Correct the live setting: 60 was the delivery-time promise, not the try
--    window. Guarded so a deliberately-tuned value other than 60 is untouched.
UPDATE system_settings
   SET try_window_minutes = 7
 WHERE id = 1
   AND try_window_minutes = 60;
