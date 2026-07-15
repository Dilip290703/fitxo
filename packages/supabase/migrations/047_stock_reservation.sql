-- Migration 047: stock reservation — place_order RPC + transition-driven releases (launch plan G3/W2.8)
-- Run in Supabase SQL Editor after migration 046. Idempotent.
-- ⚠️ Renumbering: tax provisions (M4) move 047 → 048.
--
-- WHY (flaw G3): product_variants has carried stock_qty / reserved_qty /
-- available_qty (GENERATED stock − reserved) since day one, but nothing ever
-- wrote them at order time: placeOrder never checked stock, never reserved,
-- and its variant fallback happily picked an out-of-stock size. Two customers
-- could order the last unit; items out on a try-run stayed "available".
--
-- THE MODEL (textbook reservation, using the columns the schema already has):
--   place order      → reserved_qty += 1 per unit (locked, availability-checked)
--   customer KEEPS   → stock_qty −= 1, reserved_qty −= 1   (unit sold)
--   customer RETURNS → reserved_qty −= 1                   (back on the shelf)
--   order CANCELLED  → reserved_qty −= 1 for every still-reserved unit
--
-- Releases are DRIVEN BY TRIGGERS on the transitions, not by editing every
-- code path: settle_keep_payment, returnItem, auto_return_pending_items (027),
-- rider_fail_delivery (033), expire_stale_offers (036) and admin Cancel all
-- flip decisions / order status — the triggers below catch all of them without
-- touching those functions. Idempotency rides order_items.stock_reserved:
-- reservations are only ever consumed/released once per item, and pre-047
-- orders (flag false) are untouched by every branch.
--
-- ALSO IN THIS RPC (they must live in the same transaction to be correct):
--   • server-side pricing (flaw G2): unit price = products.discounted_price
--     ?? base_price read in-DB — the client's price is IGNORED. ⚠️ Jay: this
--     covers W1.4's server half; the client keeps sending its price only for
--     the pre-047 legacy fallback in checkout/actions.ts.
--   • single-store cart backstop (flaw G1, decided 2026-07-14): a cart
--     spanning >1 store errors MULTI_STORE_CART. ⚠️ Jay: W2.6's server half —
--     the "Replace bag?" client UX is still yours.
--   • product is_active / not deleted / store approved+active checks — the
--     old client inserts validated none of this.
--
-- NOT here (unchanged behavior, other tasks): delivery-fee policy (G9/W3.6),
-- try-window duration source (A3 — the 7-min placeholder below matches the
-- current checkout and is reset by the rider-arrival flow).

-- ============================================================
-- 1. Idempotency flag: has this item's unit got a live reservation?
-- ============================================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN order_items.stock_reserved IS
  'True while this unit holds a product_variants.reserved_qty unit (migration 047). Consumed on keep (stock−1, reserved−1), released on return / order cancel (reserved−1). Pre-047 orders: false.';

-- ============================================================
-- 2. place_order(): the one way an order comes into existence.
--    p_items: [{"product_id": uuid, "color_name": text|null,
--               "size": text|null, "quantity": int}]
-- ============================================================
CREATE OR REPLACE FUNCTION place_order(
  p_items          JSONB,
  p_payment_method TEXT DEFAULT 'razorpay'
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
  INSERT INTO orders (user_id, order_number, status, subtotal, deposit_total,
                      delivery_fee, rider_fee, discount_amount, final_amount,
                      coupon_discount, payment_status, payment_method)
  VALUES (v_user, '', 'pending', v_subtotal, 0,
          v_delivery, COALESCE(v_settings.rider_fee, 0), 0, v_subtotal + v_delivery,
          0, 'pending',
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

REVOKE ALL ON FUNCTION place_order(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order(JSONB, TEXT) TO authenticated;

-- ============================================================
-- 3. Consume/release on item decision (BEFORE UPDATE trigger — catches the
--    customer keep-settle, returnItem, and the 027 auto-return sweep).
-- ============================================================
CREATE OR REPLACE FUNCTION handle_item_stock_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stock_reserved
     AND OLD.decision = 'pending'
     AND NEW.decision IS DISTINCT FROM OLD.decision THEN
    IF NEW.decision = 'keep' THEN
      -- Unit sold: it leaves both the shelf and the reservation.
      UPDATE product_variants
         SET stock_qty    = GREATEST(stock_qty - 1, 0),
             reserved_qty = GREATEST(reserved_qty - 1, 0)
       WHERE id = OLD.variant_id;
      NEW.stock_reserved := false;
    ELSIF NEW.decision = 'return' THEN
      -- Handed back to the rider: back on the shelf.
      UPDATE product_variants
         SET reserved_qty = GREATEST(reserved_qty - 1, 0)
       WHERE id = OLD.variant_id;
      NEW.stock_reserved := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_stock_transition ON order_items;
CREATE TRIGGER trg_item_stock_transition
  BEFORE UPDATE OF decision ON order_items
  FOR EACH ROW EXECUTE FUNCTION handle_item_stock_transition();

-- ============================================================
-- 4. Release everything still reserved when an order is cancelled
--    (admin Cancel, rider_fail_delivery 033, expire_stale_offers 036).
--    The order_items UPDATE below does not change `decision`, so the item
--    trigger above ignores it — no double release.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_order_cancel_stock_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE product_variants pv
       SET reserved_qty = GREATEST(pv.reserved_qty - r.units, 0)
      FROM (SELECT variant_id, COUNT(*) AS units
              FROM order_items
             WHERE order_id = NEW.id AND stock_reserved
             GROUP BY variant_id) r
     WHERE pv.id = r.variant_id;

    UPDATE order_items
       SET stock_reserved = false
     WHERE order_id = NEW.id AND stock_reserved;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancel_stock_release ON orders;
CREATE TRIGGER trg_order_cancel_stock_release
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_cancel_stock_release();
