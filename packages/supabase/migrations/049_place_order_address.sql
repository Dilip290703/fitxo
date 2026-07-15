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
