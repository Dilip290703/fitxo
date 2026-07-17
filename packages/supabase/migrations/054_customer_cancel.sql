-- ============================================================
-- 054 — Customer self-cancel (G4 / W4.5)
--
-- WHY (audit G4): only admin cancel + the 120-min staleness sweep exist. A
-- customer who ordered by mistake must phone support or wait for expiry —
-- which surfaces to them as "no rider found", the wrong message. They need a
-- Cancel button on the tracking page while the order hasn't left the shelf.
--
-- WHEN cancellable (the plan's rule): status = 'pending' (store hasn't
-- confirmed) OR status = 'confirmed' AND no rider has CLAIMED the delivery
-- yet (deliveries.rider_id IS NULL). Once a rider accepts, a trip is in
-- motion — that's support's call, not a self-serve button.
--
-- WHAT it does, atomically (mirrors the admin cancel path in OrderActions):
--   • orders.status → 'cancelled'  → the 047 trigger frees all reserved stock
--   • any live delivery → 'failed'  (rider/agent apps stop acting on it)
--   • the active try session → 'expired'
--   • notifies every active manager of each store in the order (022 pattern:
--     a born-visible notifications row Realtime can actually route)
--
-- FEE: G9 (050) collects the delivery fee UPFRONT and store_confirm_order
-- gates on it, so a 'confirmed' order has usually PAID the fee. Cancelling
-- before any rider trip means that fee is owed back. The RPC returns the
-- standalone fee payment's razorpay_payment_id so the customer app can issue
-- the Razorpay refund (it holds the keys), then record_cancel_fee_refund
-- flips the ledger row — the same app-then-RPC shape as 050's kept-value
-- waiver. A 'pending' order pre-payment has nothing to refund.
--
-- Idempotent: CREATE OR REPLACE. Apply after 053.
-- (M4 tax provisions → 055.)
-- ============================================================

-- 1) The cancel RPC.
CREATE OR REPLACE FUNCTION cancel_order_by_customer(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_status    order_status;
  v_claimed   BOOLEAN;
  v_store_id  UUID;
  v_order_num TEXT;
  v_fee_pid   TEXT;
  m           RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Lock the order and confirm ownership in one shot (SECURITY DEFINER
  -- bypasses RLS, so ownership MUST be checked explicitly).
  SELECT status, order_number INTO v_status, v_order_num
    FROM orders WHERE id = p_order_id AND user_id = v_user
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  -- Already terminal — make it idempotent-ish rather than a scary error.
  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object('cancelled', true, 'already', true, 'fee_refund_payment_id', NULL);
  END IF;

  -- Cancellable-state gate. Has any rider claimed the delivery?
  SELECT EXISTS (
    SELECT 1 FROM deliveries
     WHERE order_id = p_order_id AND type = 'delivery' AND rider_id IS NOT NULL
  ) INTO v_claimed;

  IF v_status = 'pending' THEN
    NULL; -- always cancellable before the store confirms
  ELSIF v_status = 'confirmed' AND NOT v_claimed THEN
    NULL; -- confirmed but no rider has taken it yet
  ELSIF v_status = 'confirmed' AND v_claimed THEN
    RAISE EXCEPTION 'CANCEL_RIDER_ASSIGNED';
  ELSE
    RAISE EXCEPTION 'CANCEL_TOO_LATE:%', v_status;
  END IF;

  -- Cancel — the 047 AFTER UPDATE OF status trigger releases reserved stock.
  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;

  -- Close out live rows so the rider/store apps stop acting on a dead order
  -- (same cleanup the admin cancel does client-side in OrderActions).
  UPDATE deliveries SET status = 'failed'
   WHERE order_id = p_order_id AND status NOT IN ('completed', 'failed');
  UPDATE try_sessions SET status = 'expired'
   WHERE order_id = p_order_id AND status = 'active';

  -- Notify every active manager of each store with items in this order
  -- (022's born-visible notifications pattern — Realtime can route these).
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
      'Order ' || COALESCE(v_order_num, '') || ' was cancelled by the customer.',
      jsonb_build_object('kind', 'order_cancelled', 'order_id', p_order_id)
    );
  END LOOP;

  -- The standalone upfront delivery-fee payment, if one succeeded — the app
  -- refunds it via Razorpay then calls record_cancel_fee_refund. NULL when
  -- the fee was never paid (typical for a pending-state cancel).
  SELECT razorpay_payment_id INTO v_fee_pid
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
    'fee_refund_payment_id', v_fee_pid
  );
END;
$$;

REVOKE ALL ON FUNCTION cancel_order_by_customer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_order_by_customer(UUID) TO authenticated;

-- 2) Ledger half of the fee refund on cancel. Money moves at Razorpay FIRST
--    (customer app, server-side keys); this flips the row after re-verifying
--    in-DB. Trust note (same as 050): a forged call without a real refund
--    only mis-marks the caller's OWN row — no money moves — and M6
--    reconciliation is the backstop.
CREATE OR REPLACE FUNCTION record_cancel_fee_refund(p_order_id UUID, p_refund_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_status order_status;
  v_pay_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_refund_id IS NULL OR btrim(p_refund_id) = '' THEN
    RAISE EXCEPTION 'refund id required';
  END IF;

  SELECT status INTO v_status FROM orders
   WHERE id = p_order_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  IF v_status <> 'cancelled' THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: order is not cancelled';
  END IF;

  -- The one standalone fee payment still marked success.
  SELECT id INTO v_pay_id FROM payments
   WHERE order_id = p_order_id
     AND order_item_id IS NULL
     AND status = 'success'
     AND COALESCE(delivery_fee_component, 0) > 0
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_pay_id IS NULL THEN
    RETURN jsonb_build_object('refunded', false);
  END IF;

  UPDATE payments
     SET status             = 'refunded',
         razorpay_refund_id = p_refund_id,
         refunded_at        = NOW(),
         refund_reason      = 'Order cancelled by customer'
   WHERE id = v_pay_id;

  RETURN jsonb_build_object('refunded', true);
END;
$$;

REVOKE ALL ON FUNCTION record_cancel_fee_refund(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_cancel_fee_refund(UUID, TEXT) TO authenticated;
