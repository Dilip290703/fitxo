-- prod_catchup_048_059.sql — generated 2026-08-17
--
-- baselines/prod_bootstrap.sql only covers migrations through 047.
-- This file is everything after it, concatenated in order, so a prod
-- database that was bootstrapped from that baseline can be brought level
-- with dev in one run. (055 does not exist — it is a reserved hole for the
-- M4 tax work, see docs/REMAINING.md.)
--
-- Run AFTER prod_bootstrap.sql, never before. Wrapped in a transaction so a
-- failure part-way leaves prod untouched rather than half-migrated.

BEGIN;


-- ==================== 048_try_window_from_settings

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

-- ==================== 049_place_order_address

-- Migration 049: place_order carries the delivery address (launch plan A1 × G3)
-- Run in Supabase SQL Editor after migration 048. Idempotent.
--
-- WHY: A1 (real address at checkout, PR #40) shipped to main AFTER 047's
-- place_order() was written, so the RPC created orders with address_id = NULL.
-- Migration 014's create_delivery_for_order trigger then had nothing to
-- snapshot into deliveries.drop_address — the rider drop card and the admin
-- order detail would lose the address. This migration folds the address into
-- the one atomic order path so the G3 RPC matches what A1 established.
--
-- WHAT CHANGES vs 047:
--   • new required arg p_address_id UUID
--   • the address must belong to the caller (auth.uid()). This RPC runs
--     SECURITY DEFINER (bypasses RLS), so ownership MUST be checked here or a
--     user could stamp someone else's address_id → ADDRESS_INVALID otherwise.
--   • orders.address_id is stamped, so create_delivery_for_order (014) snapshots
--     the full drop address exactly as the pre-G3 client-insert path did.
--
-- Serviceability (the Pune-only pincode gate) deliberately stays in the app
-- layer: lib/pincode.ts is the declared single source of truth for the pincode
-- list, and checkout/actions.ts enforces it before calling this RPC. We do not
-- duplicate that list into SQL (that is the drift the pincode file warns
-- against); the RPC owns the ownership + atomicity invariants, the app owns
-- serviceability.
--
-- Everything else (server-side pricing G2, single-store G1, stock reservation
-- G3, the transition-driven release triggers from 047) is unchanged.

-- The 047 signature (JSONB, TEXT) is superseded — drop it so there is exactly
-- one place_order and PostgREST can't resolve to the address-less overload.
DROP FUNCTION IF EXISTS place_order(JSONB, TEXT);

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

  -- ── Fees from Admin → System Settings (unchanged model; G9 reworks later) ─
  SELECT delivery_fee, free_delivery_above, rider_fee
    INTO v_settings FROM system_settings WHERE id = 1;
  v_delivery := CASE
    WHEN COALESCE(v_settings.free_delivery_above, 0) > 0
     AND v_subtotal >= v_settings.free_delivery_above THEN 0
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

  -- Placeholder try session (the rider-arrival flow resets it — A3 wires the
  -- duration to system_settings; keep parity with the legacy path for now).
  INSERT INTO try_sessions (order_id, started_at, deadline_at, status)
  VALUES (v_order.id, NOW(), NOW() + INTERVAL '7 minutes', 'active');

  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number);
END;
$$;

REVOKE ALL ON FUNCTION place_order(JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order(JSONB, TEXT, UUID) TO authenticated;

-- ==================== 050_delivery_fee_upfront

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

-- ==================== 051_coupons_lockdown

-- ============================================================
-- 051 — Coupons lockdown: no anon reads + validate_coupon() RPC
--        (security half of W3.2 lean coupons; found by the W4.1 RLS probe)
--
-- WHY: schema.sql's day-one policy was
--   coupons_select: USING (is_active = true OR is_admin())
-- so anyone holding the (public) anon key could enumerate EVERY active promo
-- code via GET /rest/v1/coupons — including limited-use ones (SUMMER2026 has
-- usage_limit = 1). A promo code is a secret the customer brings to us, not
-- a list we hand out.
--
-- SHAPE:
--   1) The coupons table becomes admin-only (reads AND writes). The admin
--      panel keeps working untouched — it reads with the owner's session and
--      is_admin() passes; nothing else in any app selects from coupons.
--   2) validate_coupon(p_code, p_subtotal) is the ONLY customer-facing door:
--      SECURITY DEFINER, authenticated-only, checks ONE exact submitted code
--      and returns its discount — a caller can test codes they know, never
--      list codes they don't.
--
-- validate_coupon deliberately does NOT increment used_count: validation is
-- not redemption (else previewing a code at checkout burns a usage_limit=1
-- coupon). The increment + stamping into orders.coupon_code/coupon_discount
-- belongs to the redemption half of W3.2 (place_order, with the agreed
-- commission-base rule) — not built here.
--
-- Idempotent: policy drops are IF EXISTS, function is CREATE OR REPLACE.
-- Apply after 050. (M4 tax provisions move to 052.)
-- After applying, scripts/supabase/rls-probe.mjs treats coupons as a
-- sensitive table — anon must see zero rows.
-- ============================================================

-- 1) Replace the world-readable SELECT policy with admin-only.
--    (coupons_admin_all FOR ALL already grants admins SELECT; the explicit
--    admin-only SELECT policy keeps intent readable in pg_policies.)
DROP POLICY IF EXISTS coupons_select ON coupons;
DROP POLICY IF EXISTS coupons_select_admin ON coupons;
CREATE POLICY coupons_select_admin ON coupons FOR SELECT USING (is_admin());

-- 2) The one customer-facing door: check a single submitted code.
--    Returns exactly one row:
--      valid = true  → discount is the rupee value for p_subtotal
--                      (percent capped by max_discount_amount, never > subtotal)
--      valid = false → reason ∈ INVALID_CODE   (unknown OR inactive — one
--                                               answer, so inactive codes
--                                               can't be confirmed to exist)
--                               NOT_STARTED    (valid_from in the future)
--                               EXPIRED        (valid_until passed)
--                               USAGE_LIMIT    (fully redeemed)
--                               MIN_ORDER      (min_amount says how far off)
CREATE OR REPLACE FUNCTION validate_coupon(p_code text, p_subtotal numeric)
RETURNS TABLE (
  valid       boolean,
  reason      text,
  code        varchar(50),
  description text,
  discount    numeric,
  min_amount  numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c        coupons%ROWTYPE;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_subtotal IS NULL OR p_subtotal < 0 THEN
    RAISE EXCEPTION 'invalid subtotal';
  END IF;

  SELECT * INTO c
    FROM coupons
   WHERE upper(coupons.code) = upper(trim(p_code));

  -- Unknown and inactive answer identically: a disabled code must not be
  -- distinguishable from one that never existed.
  IF NOT FOUND OR NOT c.is_active THEN
    RETURN QUERY SELECT false, 'INVALID_CODE', NULL::varchar(50), NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF c.valid_from > now() THEN
    RETURN QUERY SELECT false, 'NOT_STARTED', c.code, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN QUERY SELECT false, 'EXPIRED', c.code, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN
    RETURN QUERY SELECT false, 'USAGE_LIMIT', c.code, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  IF p_subtotal < c.min_order_amount THEN
    RETURN QUERY SELECT false, 'MIN_ORDER', c.code, NULL::text, NULL::numeric, c.min_order_amount;
    RETURN;
  END IF;

  IF c.discount_type = 'percent' THEN
    v_amount := round(p_subtotal * c.discount_value / 100.0, 2);
    IF c.max_discount_amount IS NOT NULL AND v_amount > c.max_discount_amount THEN
      v_amount := c.max_discount_amount;
    END IF;
  ELSE
    v_amount := c.discount_value;
  END IF;
  IF v_amount > p_subtotal THEN
    v_amount := p_subtotal;
  END IF;

  RETURN QUERY SELECT true, NULL::text, c.code, c.description, v_amount, c.min_order_amount;
END;
$$;

-- Authenticated-only: anon holds no door into coupons at all.
REVOKE EXECUTE ON FUNCTION validate_coupon(text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_coupon(text, numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION validate_coupon(text, numeric) TO authenticated;

-- ==================== 052_store_pause

-- ============================================================
-- 052 — Store Open/Paused toggle (G6 half 2 / W4.7)
--
-- WHY: stores had no way to stop taking orders short of asking an admin to
-- deactivate them (`is_active` — the ADMIN kill switch). A store owner who
-- steps out for lunch, runs out of hands, or closes for a festival needs a
-- self-serve pause that doesn't conflate with admin deactivation — a manager
-- must never be able to flip `is_active` back on after an admin turned it off.
--
-- SHAPE:
--   1) `stores.is_paused` — manager-controlled, separate from `is_active`.
--      Pausing does NOT hide the store or its catalogue (stores_select still
--      keys on is_active); it only stops NEW orders at placement.
--   2) `store_set_paused(p_store_id, p_paused)` — guarded SECURITY DEFINER
--      RPC (the 007/008 store-write pattern: no UPDATE policy on `stores`,
--      so admin-owned columns stay untouchable).
--   3) `place_order` (050's version, recreated verbatim) gains the gate:
--      a paused store's products error with STORE_PAUSED:<store name> —
--      checkout maps it to friendly copy. Existing orders are unaffected
--      (the store still fulfils what's already placed).
--
-- The G6 serviceability half (store pincode checked when admin approves
-- onboarding) is app-layer — no migration; lives in the admin panel +
-- @fitzo/pincode.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- Apply after 051 (coupons lockdown, PR #47). (M4 tax provisions → 053.)
-- ============================================================

-- 1) The flag. NOT NULL DEFAULT false = every existing store stays open.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN stores.is_paused IS
  'Manager-controlled pause (migration 052): true = taking no NEW orders (place_order raises STORE_PAUSED). Distinct from is_active, the admin kill switch — a manager can never flip is_active. Store + catalogue stay visible while paused.';

-- 2) The one way a manager flips it (no UPDATE policy on stores — 008 pattern).
CREATE OR REPLACE FUNCTION store_set_paused(p_store_id UUID, p_paused BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to update this store';
  END IF;
  -- Pause only makes sense for a live store; an unapproved store can't take
  -- orders anyway, and letting it toggle would just confuse the dashboard.
  IF NOT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND onboarding_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Store is not live yet';
  END IF;

  UPDATE stores SET is_paused = p_paused, updated_at = NOW() WHERE id = p_store_id;
END;
$$;

REVOKE ALL ON FUNCTION store_set_paused(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_set_paused(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- 3) place_order: 050 re-created verbatim + the STORE_PAUSED gate in pass 1.
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
           s.onboarding_status, s.is_active AS store_active,
           s.name AS store_name, s.is_paused AS store_paused
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
    -- G6 (migration 052): a paused store takes no NEW orders. Distinct error
    -- so the customer sees "temporarily closed", not "product unavailable".
    IF v_product.store_paused THEN
      RAISE EXCEPTION 'STORE_PAUSED:%', v_product.store_name;
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

-- ==================== 053_abuse_caps

-- ============================================================
-- 053 — Order abuse caps (G5 / W4.6)
--
-- WHY (audit G5): checkout takes no payment beyond the delivery fee, so
-- nothing stops a customer ordering armfuls of clothes to their door on
-- repeat and returning everything — each round costs Fitzo two rider trips
-- and store handling. G9's upfront fee added commitment; these caps bound
-- the blast radius. Deposits/holds stay a post-launch option (per plan).
--
-- SHAPE (exactly the plan's v1): three config caps in system_settings,
-- enforced inside place_order — server-side, so a tampered client changes
-- nothing. 0 disables a cap. Defaults: 8 items/order, 1 active order
-- (the plan's number), daily cap OFF ("optional" in the plan).
--
--   • max_items_per_order — total UNITS in one order (per-line qty 1–10
--     guard already existed; this bounds the whole bag).
--   • max_active_orders   — orders not yet completed/cancelled. One live
--     doorstep try-on at a time; return_requested/return_picked still
--     count (a rider trip is in flight).
--   • max_orders_per_day  — rolling 24h, cancelled EXCLUDED on purpose:
--     today cancellation is admin/expiry-driven (store never confirmed —
--     not the customer's fault), so it must not eat their quota. Revisit
--     if G4 self-cancel ever makes cancelling free.
--
-- Errors carry the limit so checkout copy can say the number:
--   ORDER_TOO_MANY_ITEMS:<max> · ORDER_LIMIT_ACTIVE:<max> · ORDER_LIMIT_DAILY:<max>
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- Apply after 052 (store pause, PR #48) — this place_order is 052's
-- version + the caps; applying 053 without 052 first would skip the pause
-- gate. (M4 tax provisions → 054.)
-- ============================================================

-- 1) The three knobs (Admin → System Settings → Order limits).
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS max_items_per_order INT NOT NULL DEFAULT 8;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS max_active_orders   INT NOT NULL DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS max_orders_per_day  INT NOT NULL DEFAULT 0;
COMMENT ON COLUMN system_settings.max_items_per_order IS
  'G5 (053): max total units in one order. 0 = no cap. Enforced in place_order (ORDER_TOO_MANY_ITEMS).';
COMMENT ON COLUMN system_settings.max_active_orders IS
  'G5 (053): max orders per customer that are not completed/cancelled. 0 = no cap. Enforced in place_order (ORDER_LIMIT_ACTIVE).';
COMMENT ON COLUMN system_settings.max_orders_per_day IS
  'G5 (053): max orders per customer per rolling 24h, cancelled excluded. 0 = no cap (default — "optional" per plan). Enforced in place_order (ORDER_LIMIT_DAILY).';

-- ============================================================
-- 2) place_order: 052 re-created verbatim + the caps block before pass 1.
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
  -- G5 caps (migration 053)
  v_caps       RECORD;
  v_units      INT;
  v_count      INT;
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

  -- ── G5 abuse caps (migration 053) — fail fast, before any product work ──
  -- 0/NULL = cap disabled. GREATEST(…,0) so a negative quantity can't shrink
  -- the unit total (pass 1 rejects it anyway).
  SELECT max_items_per_order, max_active_orders, max_orders_per_day
    INTO v_caps FROM system_settings WHERE id = 1;

  IF COALESCE(v_caps.max_items_per_order, 0) > 0 THEN
    SELECT COALESCE(SUM(GREATEST(COALESCE((l->>'quantity')::INT, 1), 0)), 0)
      INTO v_units FROM jsonb_array_elements(p_items) l;
    IF v_units > v_caps.max_items_per_order THEN
      RAISE EXCEPTION 'ORDER_TOO_MANY_ITEMS:%', v_caps.max_items_per_order;
    END IF;
  END IF;

  IF COALESCE(v_caps.max_active_orders, 0) > 0 THEN
    SELECT COUNT(*) INTO v_count FROM orders
     WHERE user_id = v_user AND status NOT IN ('completed', 'cancelled');
    IF v_count >= v_caps.max_active_orders THEN
      RAISE EXCEPTION 'ORDER_LIMIT_ACTIVE:%', v_caps.max_active_orders;
    END IF;
  END IF;

  IF COALESCE(v_caps.max_orders_per_day, 0) > 0 THEN
    SELECT COUNT(*) INTO v_count FROM orders
     WHERE user_id = v_user
       AND created_at > NOW() - INTERVAL '24 hours'
       AND status <> 'cancelled';
    IF v_count >= v_caps.max_orders_per_day THEN
      RAISE EXCEPTION 'ORDER_LIMIT_DAILY:%', v_caps.max_orders_per_day;
    END IF;
  END IF;

  -- ── Pass 1: resolve + validate every line (no writes yet) ───────────────
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_line->>'quantity')::INT, 1);
    IF v_qty < 1 OR v_qty > 10 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT p.id, p.name, p.store_id, p.base_price, p.discounted_price,
           s.onboarding_status, s.is_active AS store_active,
           s.name AS store_name, s.is_paused AS store_paused
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
    -- G6 (migration 052): a paused store takes no NEW orders. Distinct error
    -- so the customer sees "temporarily closed", not "product unavailable".
    IF v_product.store_paused THEN
      RAISE EXCEPTION 'STORE_PAUSED:%', v_product.store_name;
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

-- ==================== 054_customer_cancel

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

-- ==================== 056_cron_sweeps

-- Migration 056: schedule the abandoned-order sweeps (W2.9 / B8), and make
-- expire_stale_offers safe to run in a world where the delivery fee is
-- collected UPFRONT.
-- Run after 054 (055 is reserved for M4 tax provisions). Idempotent.
--
-- WHY THIS ISN'T JUST `cron.schedule(...)`:
--
-- 036 wrote expire_stale_offers() on 2026-07-07, when a cancelled order had
-- genuinely taken no money — so it cancels the order and tells the customer
-- "You have not been charged". G9 / migration 050 (2026-07-16) changed that:
-- the delivery fee is now charged upfront, and store_confirm_order raises
-- DELIVERY_FEE_UNPAID unless a successful payment with delivery_fee_component
-- > 0 exists. Since the sweep only ever targets status='confirmed' orders,
-- EVERY order it could cancel has a paid delivery fee (unless the fee was
-- waived by first_order_free). Scheduling it as written would keep the
-- customer's ₹49 and deny it in writing.
--
-- The database cannot fix that alone: Razorpay refunds need the API keys, and
-- those are server-side in the apps (see 054, where cancel-with-paid-fee
-- returns fee_refund_payment_id for the app to refund, then records it via
-- record_cancel_fee_refund). There is no app-side job runner yet, so this
-- migration takes the conservative half:
--
--   1. expire_stale_offers() only auto-cancels orders with NOTHING TO REFUND.
--      Paid-fee orders are left alone and counted, for a human to resolve via
--      Admin > Orders + the 041 refund flow. Its notification copy is now
--      true for every order it actually touches.
--   2. Only expire_try_windows is scheduled. That sweep is money-safe: it
--      auto-returns undecided items and completes the order, which is exactly
--      the G9 policy (a return-everything trip still pays the fee). Stock
--      release rides 047's triggers.
--   3. expire_stale_offers is deliberately NOT scheduled. Enabling it is a
--      follow-up that must ship WITH the refund half — see the block at the
--      bottom, and PROGRESS's W2.9 line.
-- ============================================================

-- 1. expire_stale_offers v2 — skip anything holding customer money -----------
CREATE OR REPLACE FUNCTION expire_stale_offers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_age INT;
  r         RECORD;
  n         INT := 0;
  v_skipped INT := 0;
BEGIN
  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  FOR r IN
    SELECT d.id AS delivery_id, o.id AS order_id, o.user_id, o.order_number,
           EXISTS (
             SELECT 1 FROM payments p
              WHERE p.order_id = o.id
                AND p.status = 'success'
           ) AS has_money
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    WHERE d.rider_id IS NULL
      AND d.status = 'assigned'
      AND o.status = 'confirmed'
      AND o.created_at <= now() - (v_max_age || ' minutes')::interval
  LOOP
    -- Money on the order → cancelling here would silently keep it. Leave the
    -- order confirmed so it stays visible to admin, who cancels + refunds
    -- through the app (Admin > Payments, migration 041). Deliberately quiet:
    -- this runs on a schedule and must not fail the whole sweep.
    IF r.has_money THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE orders     SET status = 'cancelled' WHERE id = r.order_id;
    UPDATE deliveries SET status = 'failed', completed_at = now() WHERE id = r.delivery_id;

    -- True for these orders specifically: no successful payment exists.
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.user_id, 'order_update',
      'Order could not be delivered',
      'We couldn''t find a rider for order ' || COALESCE(r.order_number, '') ||
        ' in time, so it has been cancelled. You have not been charged — please try again.',
      jsonb_build_object('kind', 'order_cancelled_no_rider', 'order_id', r.order_id)
    );
    n := n + 1;
  END LOOP;

  IF v_skipped > 0 THEN
    RAISE NOTICE 'expire_stale_offers: skipped % stale order(s) holding a successful payment — resolve via Admin > Orders', v_skipped;
  END IF;

  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION expire_stale_offers() FROM PUBLIC;

COMMENT ON FUNCTION expire_stale_offers() IS
  'Sweep: cancels confirmed-but-unclaimed orders past offer_expiry_minutes. Only touches orders with NO successful payment (056) — a paid delivery fee (G9/050) must be refunded via the app before cancelling, so those are skipped for admin. Returns the number cancelled.';

-- 2. Read-only companion: what the sweep deliberately left behind ------------
--    Gives admin (service role) a straight answer to "what is stuck?" without
--    anyone having to reconstruct the sweep's WHERE clause by hand.
CREATE OR REPLACE FUNCTION stale_offers_needing_refund()
RETURNS TABLE (
  order_id     UUID,
  order_number TEXT,
  user_id      UUID,
  created_at   TIMESTAMPTZ,
  minutes_old  INT,
  amount_paid  NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id,
         o.order_number::TEXT,   -- orders.order_number is VARCHAR(20)
         o.user_id,
         o.created_at,
         (EXTRACT(EPOCH FROM (now() - o.created_at)) / 60)::INT,
         COALESCE((SELECT SUM(p.amount) FROM payments p
                    WHERE p.order_id = o.id AND p.status = 'success'), 0)
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
   WHERE d.rider_id IS NULL
     AND d.status = 'assigned'
     AND o.status = 'confirmed'
     AND o.created_at <= now() - (COALESCE((SELECT offer_expiry_minutes FROM system_settings WHERE id = 1), 120) || ' minutes')::interval
     AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'success')
   ORDER BY o.created_at;
$$;

REVOKE ALL ON FUNCTION stale_offers_needing_refund() FROM PUBLIC;

COMMENT ON FUNCTION stale_offers_needing_refund() IS
  'Read-only: stale unclaimed orders that expire_stale_offers skipped because they hold a successful payment. Service-role only — cancel + refund these through the app.';

-- 3. Schedule the money-safe sweep -------------------------------------------
--    pg_cron must be enabled first (Supabase dashboard → Database → Extensions
--    → "pg_cron"). CREATE EXTENSION is attempted here and may fail on
--    permissions depending on the project — if it does, enable it in the
--    dashboard and re-run this file. The DO block is a no-op without it, so
--    the migration stays safe to run either way.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  -- Swallowed on purpose: the next block checks pg_extension and no-ops if the
  -- extension really is absent, so a permissions failure here must not abort
  -- the whole migration.
  RAISE NOTICE 'pg_cron could not be created from SQL (%) — enable it in Database → Extensions, then re-run 056.', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Idempotent: drop our own job by name before (re)creating it, so re-running
    -- the migration never stacks duplicate schedules.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-try-windows') THEN
      PERFORM cron.unschedule('expire-try-windows');
    END IF;
    PERFORM cron.schedule('expire-try-windows', '* * * * *', $job$SELECT expire_try_windows()$job$);

    -- If a previous hand-run of 027/036's commented blocks scheduled the offer
    -- sweep, remove it — see the header for why it must not run unattended yet.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-offers') THEN
      PERFORM cron.unschedule('expire-stale-offers');
      RAISE NOTICE '056: removed the expire-stale-offers schedule (needs the refund half first).';
    END IF;
  ELSE
    RAISE NOTICE '056: pg_cron not installed — no jobs scheduled. Enable the extension and re-run.';
  END IF;
END $$;

-- 4. NOT SCHEDULED — the follow-up ------------------------------------------
-- Enable this ONLY together with an app-side runner that refunds the delivery
-- fee first (mirror 054: pick up stale_offers_needing_refund() → Razorpay
-- refund in the app → record it → then cancel). Until that exists, the line
-- below would resume keeping customers' money:
--   SELECT cron.schedule('expire-stale-offers', '*/5 * * * *', $$SELECT expire_stale_offers()$$);

-- Verify:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--   SELECT * FROM stale_offers_needing_refund();

-- ==================== 057_razorpay_secret_fingerprint

-- Migration 057: prove the Razorpay secrets in the apps and in Vault are the
-- SAME secret, without ever exposing either (W4.9 / C4 secret rotation).
-- Run after 056 (055 is reserved for M4 tax provisions). Idempotent.
--
-- WHY THIS EXISTS:
--
-- The Razorpay key secret lives in FOUR places that must move together:
--   1. apps/customer/.env.local   (creates the Razorpay order)
--   2. apps/admin/.env.local      (refunds, migration 041)
--   3. Vault `razorpay_key_secret` on DEV
--   4. Vault `razorpay_key_secret` on PROD
--
-- The app and the database each hold a copy for different reasons: the app
-- calls Razorpay's API with it, and `confirm_keep_payment` (009) /
-- `razorpay_webhook_captured` (039) re-verify Razorpay's HMAC **in-DB** with
-- it, precisely so a compromised client can't forge a settlement.
--
-- That split makes a partial rotation fail in the worst possible way: the app
-- charges the customer with the NEW key, Razorpay signs with the NEW secret,
-- the database verifies against the OLD one — so the money moves and the order
-- never settles, with 'invalid payment signature' buried in a server log. On
-- test keys that is a confusing afternoon. At the W5.2 live cutover it is a
-- real customer charged for an order that stays open.
--
-- This function returns an HMAC **fingerprint** of each Vault secret: a
-- deterministic one-way digest of a fixed probe string. The same digest can be
-- computed locally from a .env value, so the two can be compared for equality
-- while neither is ever printed or transmitted.
-- `scripts/razorpay/check-key-sync.mjs` does exactly that.
--
-- Not an information leak worth worrying about: reaching this function needs
-- the service-role key, and anything holding that key can read
-- vault.decrypted_secrets directly.
-- ============================================================

CREATE OR REPLACE FUNCTION razorpay_secret_fingerprints()
RETURNS TABLE (secret_name TEXT, configured BOOLEAN, fingerprint TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
-- `extensions` is required for hmac(): pgcrypto lives there on Supabase, same
-- as 009/039 which do the real verification.
SET search_path = public, extensions
AS $$
DECLARE
  r        RECORD;
  v_secret TEXT;
BEGIN
  FOR r IN SELECT unnest(ARRAY['razorpay_key_secret', 'razorpay_webhook_secret']) AS nm
  LOOP
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = r.nm;

    secret_name := r.nm;
    configured  := v_secret IS NOT NULL AND v_secret <> '';
    -- Fixed probe string — changing it invalidates every previously recorded
    -- fingerprint, so leave it alone.
    fingerprint := CASE
      WHEN configured THEN encode(hmac('fitzo-rotation-check', v_secret, 'sha256'), 'hex')
      ELSE NULL
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION razorpay_secret_fingerprints() FROM PUBLIC;
REVOKE ALL ON FUNCTION razorpay_secret_fingerprints() FROM anon, authenticated;

COMMENT ON FUNCTION razorpay_secret_fingerprints() IS
  'W4.9: one-way HMAC fingerprints of the Vault Razorpay secrets, so a rotation can be proven complete without exposing them. Service-role only. Compare against scripts/razorpay/check-key-sync.mjs.';

-- Verify:
--   SELECT * FROM razorpay_secret_fingerprints();
--   pnpm razorpay:check

-- ==================== 058_admin_cancel_fee_refunds

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

-- ==================== 059_rebrand_fitxo

-- 059_rebrand_fitxo.sql
-- FITZO → FITXO rebrand, database side.
--
-- The code rename (branch feat/rename-fitxo) cannot touch values that live in the
-- database. Three of them do:
--   1. system_settings.site_name / contact_email — seeded as 'Fitzo' / 'support@fitzo.in'
--      by 011, still those values on dev today.
--   2. The column DEFAULTs from 011, so a fresh bootstrap doesn't reintroduce the old brand.
--   3. generate_order_number() — emits the 'FTZ-' prefix on every new order.
--
-- Existing orders KEEP their FTZ- numbers. Renumbering them would break every
-- customer receipt, rider job card and Razorpay note that already references them.
-- Only orders created after this migration get FTX-.
--
-- NOT touched on purpose:
--   - packages/supabase/migrations/057: the HMAC salt 'fitzo-rotation-check' is an
--     input to razorpay_secret_fingerprints(). Changing it changes every stored
--     fingerprint and would make the rotation runbook report a false mismatch.
--   - Earlier migrations and baselines/prod_bootstrap.sql: history, already applied.

-- ---- 1. Column defaults (affects future bootstraps only) -------------------
ALTER TABLE system_settings
  ALTER COLUMN site_name     SET DEFAULT 'Fitxo',
  ALTER COLUMN contact_email SET DEFAULT 'support@fitxo.co.in';

-- ---- 2. The live singleton row ---------------------------------------------
-- Only rewrite values that are still the old brand, so a support address someone
-- has already customised by hand is left alone.
UPDATE system_settings
   SET site_name     = 'Fitxo',
       updated_at    = NOW()
 WHERE id = 1
   AND site_name = 'Fitzo';

UPDATE system_settings
   SET contact_email = 'support@fitxo.co.in',
       updated_at    = NOW()
 WHERE id = 1
   AND contact_email = 'support@fitzo.in';

-- ---- 3. Order number prefix -------------------------------------------------
-- Same sequence, same format, new prefix. The sequence is deliberately NOT reset:
-- FTX numbering continues where FTZ left off so no two orders can ever collide.
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'FTX-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
