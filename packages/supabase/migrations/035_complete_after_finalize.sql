-- Migration 035: let the rider close out a delivery after the customer's last
-- decision auto-completed the order. Run after 034. Idempotent.
--
-- FOUND IN THE 2026-07-07 LIVE LOOP TEST (order FTZ-2026-00049):
-- finalize_order_if_decided (019) runs on the customer's LAST keep/return and
-- completes the ORDER + try session — but never the DELIVERY. Before 033 that
-- was masked: rider_complete_delivery had no status guard, so the rider's
-- "complete" tap still worked afterwards. 033's integrity guard (order must be
-- try_window_active) closed that hole and exposed the gap: once the customer
-- decides everything, the delivery is stuck at 'arrived' forever — the rider is
-- never credited (total_deliveries / earnings) and the 1-job cap stays blocked.
--
-- Fix: rider_complete_delivery now ALSO accepts order status 'completed' (the
-- finalize-ran case). In that state every item is already decided, so there is
-- nothing to auto-return — the rider is just confirming physical collection of
-- the returns before leaving. The try_window_active path keeps all 033 guards.
-- ============================================================

CREATE OR REPLACE FUNCTION rider_complete_delivery(p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_ostatus order_status; v_deadline timestamptz;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id, o.status INTO v_order, v_ostatus
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'arrived'
  FOR UPDATE OF d;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot complete delivery'; END IF;

  IF v_ostatus = 'try_window_active' THEN
    -- Window still open: only completable when it's genuinely over.
    SELECT deadline_at INTO v_deadline
    FROM try_sessions WHERE order_id = v_order;

    IF EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.order_id = v_order AND oi.decision = 'pending'
    ) AND (v_deadline IS NULL OR v_deadline > now()) THEN
      RAISE EXCEPTION 'the customer is still deciding — wait for the timer or the last decision';
    END IF;

    PERFORM auto_return_pending_items(v_order);
    UPDATE orders SET status = 'completed' WHERE id = v_order;
    UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  ELSIF v_ostatus = 'completed' THEN
    -- finalize_order_if_decided (019) already closed the order on the
    -- customer's last decision — nothing pending, nothing to auto-return.
    NULL;
  ELSE
    RAISE EXCEPTION 'the try-on window has not started yet';
  END IF;

  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;
