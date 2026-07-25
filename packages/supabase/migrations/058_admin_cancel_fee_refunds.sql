-- Migration 058: no cancel path may quietly keep a customer's delivery fee.
-- Run after 057 (055 is still reserved for M4 tax provisions). Idempotent.
--
-- THE PATTERN THIS CLOSES:
--
-- Since G9/050 the delivery fee is charged UPFRONT, so any order past 'pending'
-- has real customer money attached. Four code paths cancel an order, and they
-- were written at different times against different assumptions:
--
--   1. cancel_order_by_customer (054)  ✅ returns fee_refund_payment_id; the
--                                          app refunds, record_cancel_fee_refund
--                                          writes the ledger.
--   2. expire_stale_offers (036 → 056) ✅ now SKIPS orders holding a payment
--                                          (it cannot call Razorpay from pg_cron).
--   3. Admin "Cancel Order"            ❌ bare orders.update() from the client:
--                                          no refund, no customer notification.
--   4. rider_fail_delivery (033)       ❌ cancels and files a complaint under the
--                                          RIDER's user id; the customer learns
--                                          nothing and is refunded nothing.
--
-- (4) is the sharpest: its status gate is picked_up/en_route/arrived, so the fee
-- is not merely likely to be paid — it is *guaranteed* paid.
--
-- Rather than patch each path (and miss the fifth one somebody adds next month),
-- this migration makes the condition DERIVED and therefore self-maintaining:
-- "an order holding a delivery-fee payment it should not still be holding" is a
-- query, not a flag anyone has to remember to set. Any future cancel path shows
-- up in that queue automatically, even if its author never reads this file.
--
--   1. pending_fee_refunds()    — the derived queue (service-role only).
--   2. cancel_order_by_admin()  — the guarded admin cancel, mirroring 054:
--                                 notifies the customer + stores, hands back the
--                                 payment id for the app to refund.
--   3. rider_fail_delivery      — patched to notify the CUSTOMER. Deliberately
--                                 promises nothing about the money (see below).
--
-- ⚠️ POLICY NOT DECIDED HERE: when a rider physically travelled and could not
-- deliver (customer unreachable, wrong address), the trip cost Fitzo the rider
-- fee, so whether the customer's delivery fee is refunded is a business call,
-- not a bug. This migration therefore surfaces those as reason 'rider_failed'
-- for a human to decide, and does NOT auto-refund them or promise a refund in
-- the customer's notification.
-- ============================================================

-- 1. The derived queue -------------------------------------------------------
--    One row per order still holding a delivery fee that warrants attention.
--    Only STANDALONE upfront fee payments (order_item_id IS NULL) are listed:
--    the legacy 040 path folded the fee into a Keep charge, and 041 refunds are
--    full-payment-only, so those must be handled by hand (same caveat as 050).
CREATE OR REPLACE FUNCTION pending_fee_refunds()
RETURNS TABLE (
  order_id            UUID,
  order_number        TEXT,
  user_id             UUID,
  order_status        TEXT,
  reason              TEXT,
  fee_amount          NUMERIC,
  razorpay_payment_id TEXT,
  order_created_at    TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- Columns are aliased away from the RETURNS TABLE output names on purpose:
  -- an OUT parameter sharing a name with a column reference is an ambiguity
  -- trap that only shows up at call time.
  WITH fee_payment AS (
    SELECT p.order_id            AS fee_order_id,
           p.razorpay_payment_id AS fee_rzp_id,
           p.delivery_fee_component AS fee_amt
      FROM payments p
     WHERE p.order_item_id IS NULL
       AND p.status = 'success'                 -- 'refunded' rows are done
       AND COALESCE(p.delivery_fee_component, 0) > 0
       AND p.razorpay_payment_id IS NOT NULL
  )
  SELECT o.id,
         o.order_number::TEXT,
         o.user_id,
         o.status::TEXT,
         CASE
           -- rider_fail_delivery is the only thing that writes rider_notes on a
           -- failed delivery it claimed — that is the fingerprint we match on.
           WHEN EXISTS (
             SELECT 1 FROM deliveries d
              WHERE d.order_id = o.id
                AND d.rider_id IS NOT NULL
                AND d.status = 'failed'
                AND COALESCE(btrim(d.rider_notes), '') <> ''
           ) THEN 'rider_failed'
           WHEN o.status = 'cancelled' THEN 'cancelled_unrefunded'
           ELSE 'stale_unclaimed'
         END,
         f.fee_amt,
         f.fee_rzp_id,
         o.created_at
    FROM orders o
    JOIN fee_payment f ON f.fee_order_id = o.id
   WHERE
     -- (a) cancelled by ANY path, fee never refunded
     o.status = 'cancelled'
     -- (b) still confirmed but stale + unclaimed: expire_stale_offers (056)
     --     deliberately refuses to touch these because it cannot refund.
     OR (
       o.status = 'confirmed'
       AND EXISTS (
         SELECT 1 FROM deliveries d
          WHERE d.order_id = o.id
            AND d.rider_id IS NULL
            AND d.status = 'assigned'
       )
       AND o.created_at <= now() - (
         COALESCE((SELECT offer_expiry_minutes FROM system_settings WHERE id = 1), 120) || ' minutes'
       )::interval
     )
   ORDER BY o.created_at;
$$;

REVOKE ALL ON FUNCTION pending_fee_refunds() FROM PUBLIC;
REVOKE ALL ON FUNCTION pending_fee_refunds() FROM anon, authenticated;

COMMENT ON FUNCTION pending_fee_refunds() IS
  'W2.9/058: orders still holding an upfront delivery-fee payment that needs attention — cancelled-but-unrefunded (any path), stale unclaimed, or rider-failed (needs a human policy call). Derived, so a new cancel path appears here automatically. Service-role only; legacy 040 fees folded into a Keep charge are NOT listed.';

-- 2. Admin cancel, mirroring 054 --------------------------------------------
--    Called ONLY through the admin server action, which runs requireAdmin()
--    (so since W3.5 it also demands MFA + the email allowlist) and holds the
--    service-role key. Revoked from anon/authenticated accordingly.
CREATE OR REPLACE FUNCTION cancel_order_by_admin(p_order_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status    order_status;
  v_order_num TEXT;
  v_user      UUID;
  v_fee_pid   TEXT;
  v_fee_amt   NUMERIC;
  m           RECORD;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;

  SELECT status, order_number, user_id
    INTO v_status, v_order_num, v_user
    FROM orders WHERE id = p_order_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object('cancelled', true, 'already', true, 'fee_refund_payment_id', NULL);
  END IF;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'CANCEL_ALREADY_COMPLETED';
  END IF;

  -- Cancel — the 047 trigger releases any still-reserved stock.
  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;

  UPDATE deliveries SET status = 'failed', completed_at = now()
   WHERE order_id = p_order_id AND status NOT IN ('completed', 'failed');
  UPDATE try_sessions SET status = 'expired'
   WHERE order_id = p_order_id AND status = 'active';

  -- The customer was told nothing by the old client-side cancel. Tell them.
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user, 'order_update', 'Order cancelled',
    'Order ' || COALESCE(v_order_num, '') || ' was cancelled by Fitzo support. ' ||
      btrim(p_reason),
    jsonb_build_object('kind', 'order_cancelled_by_admin', 'order_id', p_order_id)
  );

  -- Stores with items in the order stop preparing it (022's born-visible rows).
  FOR m IN
    SELECT DISTINCT sm.user_id
      FROM order_items oi
      JOIN products p        ON p.id = oi.product_id
      JOIN store_managers sm ON sm.store_id = p.store_id
     WHERE oi.order_id = p_order_id AND sm.is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      m.user_id, 'order_update', 'Order cancelled',
      'Order ' || COALESCE(v_order_num, '') || ' was cancelled by Fitzo support.',
      jsonb_build_object('kind', 'order_cancelled', 'order_id', p_order_id)
    );
  END LOOP;

  -- Hand back the standalone upfront fee payment, if any — the APP moves the
  -- money (it holds the Razorpay keys) and then calls record_cancel_fee_refund,
  -- exactly as 054 does. If that refund fails, the order is still cancelled and
  -- this row surfaces in pending_fee_refunds() until someone retries.
  SELECT razorpay_payment_id, delivery_fee_component
    INTO v_fee_pid, v_fee_amt
    FROM payments
   WHERE order_id = p_order_id
     AND order_item_id IS NULL
     AND status = 'success'
     AND COALESCE(delivery_fee_component, 0) > 0
     AND razorpay_payment_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'cancelled', true,
    'order_number', v_order_num,
    'fee_refund_payment_id', v_fee_pid,
    'fee_amount', v_fee_amt
  );
END;
$$;

REVOKE ALL ON FUNCTION cancel_order_by_admin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_order_by_admin(UUID, TEXT) FROM anon, authenticated;

COMMENT ON FUNCTION cancel_order_by_admin(UUID, TEXT) IS
  'Admin cancel (058): cancels, releases stock via the 047 trigger, closes delivery/try rows, notifies the customer AND the stores, and returns the upfront delivery-fee payment id for the app to refund. Service-role only — the caller gates with requireAdmin().';

-- 3. rider_fail_delivery: tell the customer something happened ---------------
--    Unchanged except for the notification. Everything else (reason length
--    gate, status gate, complaint filing) is preserved verbatim from 033.
--    The copy deliberately makes NO promise about the delivery fee: the rider
--    travelled, so that refund is a policy decision, surfaced for a human via
--    pending_fee_refunds() with reason 'rider_failed'.
CREATE OR REPLACE FUNCTION rider_fail_delivery(p_delivery_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rider uuid; v_order uuid; v_order_no text; v_customer uuid;
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

  SELECT order_number, user_id INTO v_order_no, v_customer FROM orders WHERE id = v_order;

  INSERT INTO complaints (user_id, order_id, subject, message, priority)
  VALUES (
    auth.uid(), v_order,
    left('[Rider issue] Delivery failed — ' || coalesce(v_order_no, 'order'), 255),
    left(btrim(p_reason), 2000) || E'\n\n(Filed automatically from the rider app; items returned to the store.)',
    'high'
  );

  -- NEW (058): the customer used to learn nothing at all.
  IF v_customer IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_customer, 'order_update', 'Delivery could not be completed',
      'We could not complete the delivery for order ' || coalesce(v_order_no, '') ||
        '. Our support team is reviewing what happened and will be in touch.',
      jsonb_build_object('kind', 'delivery_failed', 'order_id', v_order)
    );
  END IF;
END; $$;

REVOKE ALL ON FUNCTION rider_fail_delivery(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rider_fail_delivery(uuid, text) TO authenticated;

-- Verify:
--   SELECT * FROM pending_fee_refunds();
