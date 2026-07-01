-- Migration 027: resolve expired try windows so orders never hang
-- Run in Supabase SQL Editor after migration 026.
--
-- Today finalize_order_if_decided() only completes an order once EVERY item is
-- decided. If the window ends with items still pending (rider leaves, customer
-- walks off), the order + try session hang open forever. This migration:
--   1. auto_return_pending_items() — flips undecided items to 'return' + records
--      return rows (the customer hands them back to the waiting rider anyway).
--   2. rider_complete_delivery() — now auto-returns pending items before closing,
--      so the rider's "Collect returns & complete" always leaves a clean state.
--   3. expire_order_if_due() — clients call this when their countdown hits 0 to
--      self-heal a single order (safe: only acts on a genuinely-expired window).
--   4. expire_try_windows() — a global sweep for a scheduled job (pg_cron), for
--      the fully-abandoned case where nobody is watching.
-- Idempotent.
-- ============================================================

-- 1. Turn every still-pending item on an order into a return (+ a returns row).
CREATE OR REPLACE FUNCTION auto_return_pending_items(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_items
     SET decision = 'return', decision_at = now()
   WHERE order_id = p_order_id AND decision = 'pending';

  INSERT INTO returns (order_id, order_item_id, reason)
  SELECT oi.order_id, oi.id, 'Auto-returned: try window ended'
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.decision = 'return'
    AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.order_item_id = oi.id);
END;
$$;

-- 2. Rider completion auto-resolves anything left pending.
CREATE OR REPLACE FUNCTION rider_complete_delivery(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id AND rider_id = v_rider
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot complete delivery'; END IF;

  PERFORM auto_return_pending_items(v_order);

  UPDATE orders SET status = 'completed' WHERE id = v_order;
  UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;

-- 3. Per-order self-heal — safe to grant: only acts if the window is truly expired.
CREATE OR REPLACE FUNCTION expire_order_if_due(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_due BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM try_sessions
    WHERE order_id = p_order_id AND status = 'active' AND deadline_at < now()
  ) INTO v_due;
  IF NOT v_due THEN
    RETURN false;
  END IF;

  PERFORM auto_return_pending_items(p_order_id);
  UPDATE try_sessions SET status = 'completed' WHERE order_id = p_order_id AND status = 'active';
  UPDATE orders SET status = 'completed' WHERE id = p_order_id AND status <> 'completed';
  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE order_id = p_order_id AND status NOT IN ('completed', 'failed');
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_order_if_due(UUID) TO authenticated;

-- 4. Global sweep for a scheduled job (NOT granted to clients).
CREATE OR REPLACE FUNCTION expire_try_windows()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; n INT := 0;
BEGIN
  FOR r IN
    SELECT order_id FROM try_sessions WHERE status = 'active' AND deadline_at < now()
  LOOP
    PERFORM auto_return_pending_items(r.order_id);
    UPDATE try_sessions SET status = 'completed' WHERE order_id = r.order_id;
    UPDATE orders SET status = 'completed' WHERE id = r.order_id AND status <> 'completed';
    UPDATE deliveries SET status = 'completed', completed_at = now()
     WHERE order_id = r.order_id AND status NOT IN ('completed', 'failed');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION expire_try_windows() FROM PUBLIC;

-- OPTIONAL — run the sweep every minute (needs the pg_cron extension enabled in
-- the Supabase dashboard → Database → Extensions). Uncomment to enable:
--   SELECT cron.schedule('expire-try-windows', '* * * * *', $$SELECT expire_try_windows()$$);
