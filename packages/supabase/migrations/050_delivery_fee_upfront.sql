-- Migration 050: delivery fee collected UPFRONT + waivers (launch plan G9/W3.6; closes G8)
-- Run in Supabase SQL Editor after migration 049. Idempotent.
-- ⚠️ Renumbering: tax provisions (M4) move to 051.
--
-- WHY (flaw G9, decided 2026-07-14): migration 040 folds the delivery fee into
-- the FIRST Keep charge — so a customer who returns everything pays ₹0 while
-- Fitzo still pays the rider + store handling. Every browse-only order is a
-- guaranteed loss, and it stacks with G5 (no order caps). And G8: the
-- free-delivery waiver was judged on ORDERED value at checkout (order ₹999+,
-- keep one ₹399 tee → trip rides free).
--
-- THE POLICY (all three owner options, config-driven):
--   1. The fee becomes its OWN Razorpay payment right after checkout —
--      collected whether the customer keeps or returns. It doubles as
--      commitment against the G5 abuse loop.
--   2. system_settings.first_order_free — a customer's first order ships free
--      (acquisition lever; default OFF).
--   3. free_delivery_above is RE-BASED to KEPT value: when the order finishes
--      with kept-and-paid value ≥ the threshold, the standalone fee payment is
--      auto-refunded (via Razorpay's refund API in the app + the guarded RPC
--      below). Checkout no longer waives by ordered subtotal — G8 closed.
--
-- COMPOSITION with existing code (why this migration is small):
--   • The upfront payment row carries delivery_fee_component = fee, so 040's
--     "has a successful payment already carried the fee?" check in
--     createKeepPayment automatically stops folding the fee into the first
--     Keep. 040 stays as the safety net for legacy in-flight orders.
--   • The refund uses the 041 columns/status flip; order_economics (044/046)
--     is already refund-aware, so delivery_fee_collected and margin update
--     themselves when the fee refunds.
--   • settle_keep_payment (settling both keep AND fee payments) gets ONE
--     guard: the order-paid rollup only runs for item payments — a fee-only
--     settle must not flip a fresh order to payment_status='paid'.
--   • store_confirm_order gets the enforcement gate: no confirm while the fee
--     is due — otherwise a fee-dodger closes the Razorpay modal and still gets
--     the trip, reopening G9 via abandonment. (Offer-expiry 036 cancels
--     never-paid orders on its normal clock; stock is released by 047's
--     cancel trigger.)

-- ============================================================
-- 1. Config: first-order-free toggle
-- ============================================================
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS first_order_free BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN system_settings.first_order_free IS
  'When true, a customer''s FIRST (non-cancelled) order carries no delivery fee (migration 050). free_delivery_above is the KEPT-value auto-refund threshold, not an ordered-value waiver.';

-- ============================================================
-- 2. place_order: 049 re-created verbatim, fee policy changed —
--    ordered-subtotal waiver REMOVED (G8), first-order-free added.
-- ============================================================
CREATE OR REPLACE FUNCTION place_order(
  p_items          JSONB,
  p_payment_method TEXT DEFAULT 'razorpay',
  p_address_id     UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_line       JSONB;
  v_product    RECORD;
  v_variant    RECORD;
  v_qty        INT;
  v_store_ids  UUID[] := '{}';
  v_unit_price NUMERIC;
  v_subtotal   NUMERIC := 0;
  v_settings   RECORD;
  v_first_free BOOLEAN := false;
  v_delivery   NUMERIC;
  v_order      RECORD;
  -- resolved lines carried between the two passes
  v_resolved   JSONB := '[]'::jsonb;
  v_need       RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  -- The order must carry a real, deliverable address owned by the caller. The
  -- rider drop card + admin order detail read it (via the 014 delivery trigger).
  IF p_address_id IS NULL THEN
    RAISE EXCEPTION 'ADDRESS_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM addresses WHERE id = p_address_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'ADDRESS_INVALID';
  END IF;

  -- ── Pass 1: resolve + validate every line (no writes yet) ───────────────
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_line->>'quantity')::INT, 1);
    IF v_qty < 1 OR v_qty > 10 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT p.id, p.name, p.store_id, p.base_price, p.discounted_price,
           s.onboarding_status, s.is_active AS store_active
      INTO v_product
      FROM products p
      JOIN stores s ON s.id = p.store_id
     WHERE p.id = (v_line->>'product_id')::UUID
       AND p.is_active AND NOT p.is_deleted;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', COALESCE(v_line->>'product_id', '?');
    END IF;
    IF v_product.onboarding_status IS DISTINCT FROM 'approved' OR NOT v_product.store_active THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', v_product.name;
    END IF;

    v_store_ids := array_append(v_store_ids, v_product.store_id);

    -- Variant: the chosen colour+size if given; otherwise the first variant
    -- WITH availability. An explicitly chosen size that's out of stock is an
    -- error — never silently substitute a different size (old G3 behavior).
    SELECT pv.id, pv.size, pc.color_name, pv.available_qty
      INTO v_variant
      FROM product_variants pv
      JOIN product_colors pc ON pc.id = pv.color_id
     WHERE pv.product_id = v_product.id
       AND pv.is_available
       AND (v_line->>'color_name' IS NULL OR pc.color_name = v_line->>'color_name')
       AND (v_line->>'size'       IS NULL OR pv.size       = v_line->>'size')
     ORDER BY (pv.available_qty >= v_qty) DESC, pc.sort_order, pv.size
     LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', v_product.name;
    END IF;
    IF v_variant.available_qty < v_qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:% (%)', v_product.name, v_variant.size;
    END IF;

    -- Server-side price (G2): the client's number is never consulted.
    v_unit_price := COALESCE(NULLIF(v_product.discounted_price, 0), v_product.base_price);
    v_subtotal   := v_subtotal + v_unit_price * v_qty;

    v_resolved := v_resolved || jsonb_build_object(
      'product_id',   v_product.id,
      'product_name', v_product.name,
      'variant_id',   v_variant.id,
      'color_name',   v_variant.color_name,
      'size',         v_variant.size,
      'unit_price',   v_unit_price,
      'quantity',     v_qty,
      'image_url',    v_line->>'image_url'
    );
  END LOOP;

  -- Single-store cart (G1 backstop, decided 2026-07-14).
  IF (SELECT COUNT(DISTINCT s) FROM unnest(v_store_ids) s) > 1 THEN
    RAISE EXCEPTION 'MULTI_STORE_CART';
  END IF;

  -- ── Pass 2: reserve stock under row locks (consistent order = no deadlock) ─
  FOR v_need IN
    SELECT (r->>'variant_id')::UUID AS variant_id,
           SUM((r->>'quantity')::INT) AS qty,
           MIN(r->>'product_name') AS pname,
           MIN(r->>'size') AS psize
      FROM jsonb_array_elements(v_resolved) r
     GROUP BY 1 ORDER BY 1
  LOOP
    PERFORM 1 FROM product_variants WHERE id = v_need.variant_id FOR UPDATE;
    UPDATE product_variants
       SET reserved_qty = reserved_qty + v_need.qty
     WHERE id = v_need.variant_id
       AND available_qty >= v_need.qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:% (%)', v_need.pname, v_need.psize;
    END IF;
  END LOOP;

  -- ── Delivery fee (G9 policy, migration 050) ─────────────────────────────
  -- Charged on EVERY order (collected upfront right after checkout), with two
  -- waivers: first_order_free (below) and the KEPT-value threshold — which is
  -- settled as an AUTO-REFUND at order completion, never waived here. The old
  -- ordered-subtotal waiver is gone (G8: order ₹999+, keep one tee, ride free).
  SELECT delivery_fee, free_delivery_above, rider_fee, first_order_free
    INTO v_settings FROM system_settings WHERE id = 1;

  IF COALESCE(v_settings.first_order_free, false) AND NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = v_user AND o.status <> 'cancelled'
  ) THEN
    v_first_free := true;
  END IF;

  v_delivery := CASE WHEN v_first_free THEN 0
                     ELSE COALESCE(v_settings.delivery_fee, 0) END;

  -- ── Create the order + per-unit items + placeholder try session ─────────
  INSERT INTO orders (user_id, address_id, order_number, status, subtotal,
                      deposit_total, delivery_fee, rider_fee, discount_amount,
                      final_amount, coupon_discount, payment_status, payment_method)
  VALUES (v_user, p_address_id, '', 'pending', v_subtotal,
          0, v_delivery, COALESCE(v_settings.rider_fee, 0), 0,
          v_subtotal + v_delivery, 0, 'pending',
          CASE WHEN p_payment_method IN ('razorpay','cod','wallet')
               THEN p_payment_method::payment_method ELSE 'razorpay'::payment_method END)
  RETURNING id, order_number INTO v_order;

  INSERT INTO order_items (order_id, product_id, variant_id, product_name,
                           color_name, size, image_url, price_at_order,
                           deposit_at_order, decision, stock_reserved)
  SELECT v_order.id,
         (r->>'product_id')::UUID,
         (r->>'variant_id')::UUID,
         r->>'product_name',
         r->>'color_name',
         r->>'size',
         NULLIF(r->>'image_url', ''),
         (r->>'unit_price')::NUMERIC,
         0, 'pending', true
    FROM jsonb_array_elements(v_resolved) r
    CROSS JOIN generate_series(1, (r->>'quantity')::INT);

  -- Placeholder try session (the rider-arrival flow resets it; duration from
  -- settings since 048).
  INSERT INTO try_sessions (order_id, started_at, deadline_at, status)
  SELECT v_order.id, NOW(),
         NOW() + make_interval(mins => COALESCE(s.try_window_minutes, 7)),
         'active'
    FROM system_settings s WHERE s.id = 1;

  RETURN jsonb_build_object(
    'order_id',     v_order.id,
    'order_number', v_order.order_number,
    'delivery_fee', v_delivery
  );
END;
$$;

REVOKE ALL ON FUNCTION place_order(JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order(JSONB, TEXT, UUID) TO authenticated;

-- ============================================================
-- 3. settle_keep_payment: 046 re-created verbatim + ONE guard — the
--    order-paid rollup only runs for ITEM payments. A standalone fee payment
--    settling on a fresh order must not flip payment_status to 'paid'.
-- ============================================================
CREATE OR REPLACE FUNCTION settle_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT  -- checkout signature from the client path; NULL from the webhook
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_rate    NUMERIC;
BEGIN
  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Idempotent: a duplicate settle (client handler + webhook) is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN NULL;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = COALESCE(p_razorpay_signature, razorpay_signature),
         paid_at             = NOW()
   WHERE id = v_payment.id;

  -- Flip the specific kept item now that it's paid for — and freeze the
  -- commission at THIS moment (store override → settings default → 15).
  IF v_payment.order_item_id IS NOT NULL THEN
    SELECT COALESCE(s.commission_rate,
                    (SELECT ss.commission_rate FROM system_settings ss WHERE ss.id = 1),
                    15)::NUMERIC
      INTO v_rate
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN stores s ON s.id = p.store_id
     WHERE oi.id = v_payment.order_item_id;

    UPDATE order_items oi
       SET decision          = 'keep',
           decision_at       = NOW(),
           commission_rate   = COALESCE(oi.commission_rate, v_rate),
           commission_amount = COALESCE(oi.commission_amount,
                                        ROUND(oi.price_at_order * v_rate / 100.0, 2))
     WHERE oi.id = v_payment.order_item_id;

    -- Mark the order paid once no kept item is left unpaid (item payments
    -- only — a fee-only settle on a fresh order must not mark it paid).
    UPDATE orders o
       SET payment_status = 'paid'
     WHERE o.id = v_payment.order_id
       AND NOT EXISTS (
         SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id
            AND oi.decision = 'keep'
            AND NOT EXISTS (
              SELECT 1 FROM payments p
               WHERE p.order_item_id = oi.id AND p.status = 'success'
            )
       );
  END IF;

  RETURN v_payment.order_id;
END;
$$;

REVOKE ALL ON FUNCTION settle_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
-- deliberately no GRANTs: internal only

-- ============================================================
-- 4. store_confirm_order: 033 re-created verbatim + the fee gate. Without it
--    a fee-dodger just closes the Razorpay modal and still gets the trip.
-- ============================================================
CREATE OR REPLACE FUNCTION store_confirm_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addr    addresses%ROWTYPE;
  v_status  order_status;
  v_addr_id UUID;
  v_fee     NUMERIC;
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

  SELECT status, address_id, delivery_fee INTO v_status, v_addr_id, v_fee
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_status <> 'pending' THEN
    RETURN; -- already confirmed (or further along) — nothing to do
  END IF;

  -- G9 gate (050): the delivery fee is collected upfront; no rider trip
  -- starts until it has. Waived-fee orders (first_order_free) pass through.
  IF COALESCE(v_fee, 0) > 0 AND NOT EXISTS (
    SELECT 1 FROM payments p
     WHERE p.order_id = p_order_id
       AND p.status = 'success'
       AND p.delivery_fee_component > 0
  ) THEN
    RAISE EXCEPTION 'DELIVERY_FEE_UNPAID';
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

-- (033's grants for store_confirm_order are preserved by CREATE OR REPLACE.)

-- ============================================================
-- 5. record_delivery_fee_refund: the bookkeeping half of the kept-value
--    waiver. The MONEY moves first via Razorpay's refund API in the customer
--    app's server action (it holds the keys server-side); this RPC then flips
--    the ledger row — after re-verifying eligibility IN-DB, so it cannot be
--    used to flip arbitrary rows:
--      • caller owns the order (or is admin)
--      • every item is decided (no pending) — never refund mid-window, or a
--        later Keep would re-charge the fee via 040's carried-check
--      • kept-and-paid value ≥ system_settings.free_delivery_above (> 0)
--      • only the STANDALONE fee payment (order_item_id IS NULL) — a legacy
--        040 fee folded into a Keep charge can't be auto-refunded (041 is
--        full-refund-only; admin handles those manually)
--    Trust note: a forged call without a real Razorpay refund would only
--    mis-mark the caller's OWN fee row (they gain nothing — no money moves);
--    settlement reconciliation (money plan M6) is the backstop.
-- ============================================================
CREATE OR REPLACE FUNCTION record_delivery_fee_refund(
  p_order_id  UUID,
  p_refund_id TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_threshold NUMERIC;
  v_kept_paid NUMERIC;
  v_payment   payments%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF COALESCE(btrim(p_refund_id), '') = '' THEN
    RAISE EXCEPTION 'refund id required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM orders o
     WHERE o.id = p_order_id AND (o.user_id = v_user OR is_admin())
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  -- Never mid-window: all items must be decided.
  IF EXISTS (
    SELECT 1 FROM order_items oi
     WHERE oi.order_id = p_order_id AND oi.decision = 'pending'
  ) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: items still undecided';
  END IF;

  SELECT COALESCE(free_delivery_above, 0) INTO v_threshold
    FROM system_settings WHERE id = 1;
  IF v_threshold <= 0 THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: no free-delivery threshold configured';
  END IF;

  SELECT COALESCE(SUM(oi.price_at_order), 0) INTO v_kept_paid
    FROM order_items oi
   WHERE oi.order_id = p_order_id
     AND oi.decision = 'keep'
     AND EXISTS (SELECT 1 FROM payments p
                  WHERE p.order_item_id = oi.id AND p.status = 'success');
  IF v_kept_paid < v_threshold THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE: kept value % below threshold %', v_kept_paid, v_threshold;
  END IF;

  -- The standalone upfront fee payment.
  SELECT * INTO v_payment
    FROM payments p
   WHERE p.order_id = p_order_id
     AND p.order_item_id IS NULL
     AND p.delivery_fee_component > 0
   ORDER BY p.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'no_fee_payment';
  END IF;
  IF v_payment.status = 'refunded' THEN
    RETURN 'already_refunded';
  END IF;
  IF v_payment.status <> 'success' THEN
    RETURN 'no_fee_payment';
  END IF;

  UPDATE payments
     SET status             = 'refunded',
         razorpay_refund_id = btrim(p_refund_id),
         refunded_at        = NOW(),
         refund_reason      = 'Free delivery: kept value crossed the threshold'
   WHERE id = v_payment.id;

  RETURN 'refunded';
END;
$$;

REVOKE ALL ON FUNCTION record_delivery_fee_refund(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_delivery_fee_refund(UUID, TEXT) TO authenticated;
