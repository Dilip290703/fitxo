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
