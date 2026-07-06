-- Migration 033: agent rework Phase 2 — the delivery flow made real.
-- Run in the Supabase SQL Editor after migration 032. Idempotent.
--
-- What this fixes (see docs/AGENT_PANEL_AUDIT.md):
--   A/C2  Rider was never told WHERE to pick up: deliveries.pickup_address existed
--         but nothing populated it. store_confirm_order() now stamps it (items
--         exist at confirm time; the order-INSERT trigger was removed in 016).
--   D1    available_deliveries() leaked full customer PII (name/phone/street) to
--         every polling rider pre-claim → now returns a redacted drop_area only.
--   B5    No concurrent-job cap → the feed is now empty while a rider holds an
--         active job (cap = 1, matching real delivery apps at this scale).
--   B7    No handover verification → 4-digit delivery OTP: shown to the customer
--         on their tracking page, entered by the rider at the door.
--   D2    rider_complete_delivery had no status guard (console-callable straight
--         after accept → instant earnings) → now requires an arrived delivery +
--         an actually-finished try window.
--   D3    rider_mark_picked_up ignored store readiness → now requires every item
--         prepared; rider_mark_delivered no longer reachable from 'accepted'.
--   C3    Bad-day path: rider_fail_delivery(reason) — rider-side terminal exit
--         (customer unreachable / can't complete) that files into Admin > Complaints.
--
-- ⚠️ Contract changes (flag for Jay):
--   • available_deliveries() return shape changed: drop_address → drop_area
--     (redacted), final_amount removed, + store_name/store_area/store_count.
--   • rider_mark_delivered(uuid) is DROPPED, replaced by (uuid, text) with the
--     OTP. The agent client falls back to the old call when 033 isn't applied.
--   • rider_mark_delivered now requires the new arrival step (rider_mark_arrived)
--     first; it no longer jumps straight from picked_up/accepted.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Handover OTP column + backfill for in-flight deliveries.
-- ------------------------------------------------------------
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_otp TEXT;

UPDATE deliveries
   SET delivery_otp = lpad(floor(random() * 10000)::int::text, 4, '0')
 WHERE delivery_otp IS NULL
   AND status NOT IN ('completed', 'failed');

-- ------------------------------------------------------------
-- 2. Helper: the pickup snapshot for an order — first store by name +
--    a store_count so multi-store orders are visible to the rider.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION order_pickup_snapshot(p_order_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'store_name', s.name,
    'address',    s.address,
    'city',       s.city,
    'pincode',    s.pincode,
    'phone',      s.contact_phone,
    'store_count', (SELECT count(DISTINCT p2.store_id)
                    FROM order_items oi2
                    JOIN products p2 ON p2.id = oi2.product_id
                    WHERE oi2.order_id = p_order_id)
  )
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN stores  s ON s.id = p.store_id
  WHERE oi.order_id = p_order_id
  ORDER BY s.name
  LIMIT 1;
$$;

-- Backfill pickup info onto existing in-flight deliveries that lack it.
UPDATE deliveries d
   SET pickup_address = COALESCE(order_pickup_snapshot(d.order_id), '{}'::jsonb)
 WHERE (d.pickup_address IS NULL OR d.pickup_address = '{}'::jsonb)
   AND d.status NOT IN ('completed', 'failed');

-- ------------------------------------------------------------
-- 3. store_confirm_order(): same signature + semantics as 016 (store-ownership
--    check, FOR UPDATE lock, idempotent early return) — now also stamps
--    pickup_address and generates the handover OTP at delivery creation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION store_confirm_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addr    addresses%ROWTYPE;
  v_status  order_status;
  v_addr_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to confirm this order';
  END IF;

  SELECT status, address_id INTO v_status, v_addr_id
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_status <> 'pending' THEN
    RETURN; -- already confirmed (or further along) — nothing to do
  END IF;

  UPDATE orders SET status = 'confirmed' WHERE id = p_order_id;

  IF NOT EXISTS (SELECT 1 FROM deliveries WHERE order_id = p_order_id AND type = 'delivery') THEN
    SELECT * INTO v_addr FROM addresses WHERE id = v_addr_id;
    INSERT INTO deliveries (order_id, type, status, drop_address, pickup_address, delivery_otp)
    VALUES (
      p_order_id, 'delivery', 'assigned',
      CASE WHEN v_addr.id IS NOT NULL THEN jsonb_build_object(
        'full_name', v_addr.full_name, 'phone', v_addr.phone, 'line1', v_addr.line1,
        'line2', v_addr.line2, 'landmark', v_addr.landmark, 'city', v_addr.city,
        'state', v_addr.state, 'pincode', v_addr.pincode
      ) ELSE '{}'::jsonb END,
      COALESCE(order_pickup_snapshot(p_order_id), '{}'::jsonb),
      lpad(floor(random() * 10000)::int::text, 4, '0')
    );
  END IF;
END; $$;

-- ------------------------------------------------------------
-- 4. Customer-side OTP read. Customers can't SELECT deliveries under RLS
--    (rider/admin only) — this narrow accessor returns ONLY the OTP, only to
--    the order's owner, only while the order is out for delivery.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_delivery_handover(p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_otp TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND user_id = auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT d.delivery_otp INTO v_otp
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.order_id = p_order_id
    AND d.type = 'delivery'
    AND o.status = 'out_for_delivery'
  LIMIT 1;
  RETURN v_otp;
END; $$;

REVOKE ALL ON FUNCTION get_delivery_handover(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_delivery_handover(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. Offer feed v3. Changes vs 025/026:
--    • cap = 1: nothing is offered while the rider holds an active job
--    • drop_area replaces drop_address — city/pincode/landmark only; the full
--      address + phone become visible only AFTER claiming (deliveries_select RLS)
--    • store_name / store_area / store_count from the pickup snapshot
--    • final_amount removed (the rider's number is the fee, not the bill)
--    • created_at kept = the ORDER's created_at (026), so the card can show age
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS available_deliveries();
CREATE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_area    JSONB,
  item_count   BIGINT,
  delivery_fee NUMERIC,
  store_name   TEXT,
  store_area   TEXT,
  store_count  BIGINT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders r
  WHERE r.user_id = auth.uid() AND r.is_verified = true;
  IF v_rider IS NULL THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  -- One job at a time: an active delivery hides the feed entirely.
  IF EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.rider_id = v_rider
      AND d.status IN ('accepted', 'picked_up', 'en_route', 'arrived')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         jsonb_build_object(
           'city',     d.drop_address->>'city',
           'pincode',  d.drop_address->>'pincode',
           'landmark', d.drop_address->>'landmark'
         ),
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.delivery_fee,
         d.pickup_address->>'store_name',
         concat_ws(' · ', NULLIF(d.pickup_address->>'city', ''),
                          NULLIF(d.pickup_address->>'pincode', '')),
         COALESCE((d.pickup_address->>'store_count')::BIGINT, 1),
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.rider_id = v_rider
        AND dd.delivery_id = d.id
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END; $$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;

-- ------------------------------------------------------------
-- 6. Pickup now requires the store to have marked every item ready.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_mark_picked_up(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id INTO v_order
  FROM deliveries d
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'accepted';
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot mark picked up'; END IF;

  IF EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = v_order AND oi.prepared_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The store has not marked all items ready yet — check with the store staff';
  END IF;

  UPDATE deliveries SET status = 'picked_up', picked_up_at = now()
   WHERE id = p_delivery_id;
  UPDATE orders SET status = 'out_for_delivery' WHERE id = v_order;
END; $$;

-- ------------------------------------------------------------
-- 7. NEW arrival step: at the door, before handover. Delivery → 'arrived';
--    the ORDER stays out_for_delivery until the OTP handover.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_mark_arrived(p_delivery_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid;
BEGIN
  v_rider := current_rider_id();
  UPDATE deliveries SET status = 'arrived'
   WHERE id = p_delivery_id AND rider_id = v_rider
     AND status IN ('picked_up', 'en_route');
  IF NOT FOUND THEN RAISE EXCEPTION 'cannot mark arrived'; END IF;
END; $$;

REVOKE ALL ON FUNCTION rider_mark_arrived(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_mark_arrived(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. Handover = OTP verified at the door. Replaces rider_mark_delivered(uuid).
--    Legacy deliveries with no OTP (pre-033, or admin-created) skip the check.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS rider_mark_delivered(uuid);

CREATE OR REPLACE FUNCTION rider_mark_delivered(p_delivery_id uuid, p_otp text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_otp text;
BEGIN
  v_rider := current_rider_id();

  SELECT d.order_id, d.delivery_otp INTO v_order, v_otp
  FROM deliveries d
  WHERE d.id = p_delivery_id AND d.rider_id = v_rider AND d.status = 'arrived'
  FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'cannot mark delivered — tap "I''m at the door" first'; END IF;

  IF v_otp IS NOT NULL AND btrim(coalesce(p_otp, '')) <> v_otp THEN
    RAISE EXCEPTION 'Wrong code — ask the customer for the 4-digit code on their tracking page';
  END IF;

  UPDATE orders SET status = 'delivered' WHERE id = v_order;
END; $$;

REVOKE ALL ON FUNCTION rider_mark_delivered(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_mark_delivered(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 9. Completion guard (audit D2). Requires: the delivery is 'arrived', the try
--    window actually ran (order try_window_active), and it's genuinely over —
--    every item decided OR the deadline passed. Keeps 027's auto-return.
-- ------------------------------------------------------------
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

  IF v_ostatus <> 'try_window_active' THEN
    RAISE EXCEPTION 'the try-on window has not started yet';
  END IF;

  SELECT deadline_at INTO v_deadline
  FROM try_sessions WHERE order_id = v_order;

  IF EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = v_order AND oi.decision = 'pending'
  ) AND (v_deadline IS NULL OR v_deadline > now()) THEN
    RAISE EXCEPTION 'the customer is still deciding — wait for the timer or the last decision';
  END IF;

  PERFORM auto_return_pending_items(v_order);

  UPDATE deliveries SET status = 'completed', completed_at = now()
   WHERE id = p_delivery_id;
  UPDATE orders SET status = 'completed' WHERE id = v_order;
  UPDATE try_sessions SET status = 'completed' WHERE order_id = v_order;
  UPDATE riders SET total_deliveries = total_deliveries + 1 WHERE id = v_rider;
END; $$;

-- ------------------------------------------------------------
-- 10. Bad-day terminal exit (audit C3): the rider cannot deliver (customer
--     unreachable, wrong address, safety issue). Requires a reason; fails the
--     delivery, cancels the order, closes any try session, and FILES A
--     COMPLAINT so it lands in Admin > Complaints for review. The rider
--     physically returns the items to the store.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rider_fail_delivery(p_delivery_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_order_no text;
BEGIN
  v_rider := current_rider_id();
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a rider'; END IF;

  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'a short reason is required';
  END IF;

  UPDATE deliveries
     SET status = 'failed',
         completed_at = now(),
         rider_notes = left(btrim(p_reason), 500)
   WHERE id = p_delivery_id AND rider_id = v_rider
     AND status IN ('picked_up', 'en_route', 'arrived')
   RETURNING order_id INTO v_order;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'can only report a failed delivery on a job you picked up';
  END IF;

  UPDATE orders SET status = 'cancelled' WHERE id = v_order;
  UPDATE try_sessions SET status = 'expired' WHERE order_id = v_order AND status = 'active';

  SELECT order_number INTO v_order_no FROM orders WHERE id = v_order;
  INSERT INTO complaints (user_id, order_id, subject, message, priority)
  VALUES (
    auth.uid(), v_order,
    left('[Rider issue] Delivery failed — ' || coalesce(v_order_no, 'order'), 255),
    left(btrim(p_reason), 2000) || E'\n\n(Filed automatically from the rider app; items returned to the store.)',
    'high'
  );
END; $$;

REVOKE ALL ON FUNCTION rider_fail_delivery(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_fail_delivery(uuid, text) TO authenticated;
