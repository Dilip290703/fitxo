-- ============================================================
-- Fitzo Store panel — demo data for Returns / Earnings / Analytics
-- ============================================================
-- Adds to "Fitzo Test Store": one order with a returned item (+ returns row),
-- and two completed orders with kept items — one with a PENDING payout, one
-- with a PAID payout. Spread over recent days so the 30-day charts have shape.
--
-- Prerequisites: store_seed.sql, migrations 004–007, store_dashboard_seed.sql.
-- Run in the Supabase SQL Editor. Re-runnable (idempotent via notes tags).
-- ============================================================

DO $$
DECLARE
  v_store_id   UUID;
  v_user_id    UUID;
  v_product_id UUID;
  v_variant_m  UUID;
  v_variant_s  UUID;
  v_order_id   UUID;
  v_item_id    UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'fitzo-test-store';
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Run store_seed.sql first.'; END IF;

  SELECT user_id INTO v_user_id
  FROM store_managers WHERE store_id = v_store_id AND is_active = true LIMIT 1;

  SELECT id INTO v_product_id FROM products WHERE slug = 'sample-oversized-tee';
  IF v_product_id IS NULL THEN RAISE EXCEPTION 'Run store_dashboard_seed.sql first.'; END IF;

  SELECT id INTO v_variant_m FROM product_variants WHERE sku = 'TEE-BLK-M';
  SELECT id INTO v_variant_s FROM product_variants WHERE sku = 'TEE-BLK-S';

  -- ---- Order B: customer returned the item (3 days ago) -------------------
  IF NOT EXISTS (SELECT 1 FROM orders WHERE notes = 'store-returns-seed') THEN
    INSERT INTO orders (user_id, status, subtotal, final_amount, payment_status, created_at, notes)
    VALUES (v_user_id, 'return_requested', 999, 999, 'pending', NOW() - INTERVAL '3 days', 'store-returns-seed')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, variant_id, product_name, color_name, size,
                             price_at_order, decision, decision_at, return_reason)
    VALUES (v_order_id, v_product_id, v_variant_s, 'Sample Oversized Tee', 'Black', 'S',
            999, 'return', NOW() - INTERVAL '2 days', 'Size too small')
    RETURNING id INTO v_item_id;

    INSERT INTO returns (order_id, order_item_id, reason, condition, status, requested_at)
    VALUES (v_order_id, v_item_id, 'Size too small', 'good', 'requested', NOW() - INTERVAL '2 days');
  END IF;

  -- ---- Order C: kept yesterday → PENDING payout ----------------------------
  IF NOT EXISTS (SELECT 1 FROM orders WHERE notes = 'store-earnings-seed-pending') THEN
    INSERT INTO orders (user_id, status, subtotal, final_amount, payment_status, created_at, notes)
    VALUES (v_user_id, 'completed', 999, 999, 'paid', NOW() - INTERVAL '2 days', 'store-earnings-seed-pending')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, variant_id, product_name, color_name, size,
                             price_at_order, decision, decision_at, prepared_at)
    VALUES (v_order_id, v_product_id, v_variant_m, 'Sample Oversized Tee', 'Black', 'M',
            999, 'keep', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days');

    INSERT INTO payouts (store_id, order_id, amount, status)
    VALUES (v_store_id, v_order_id, 899, 'pending');
  END IF;

  -- ---- Order D: kept 10 days ago → PAID payout ------------------------------
  IF NOT EXISTS (SELECT 1 FROM orders WHERE notes = 'store-earnings-seed-paid') THEN
    INSERT INTO orders (user_id, status, subtotal, final_amount, payment_status, created_at, notes)
    VALUES (v_user_id, 'completed', 999, 999, 'paid', NOW() - INTERVAL '10 days', 'store-earnings-seed-paid')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, variant_id, product_name, color_name, size,
                             price_at_order, decision, decision_at, prepared_at)
    VALUES (v_order_id, v_product_id, v_variant_m, 'Sample Oversized Tee', 'Black', 'M',
            999, 'keep', NOW() - INTERVAL '9 days', NOW() - INTERVAL '10 days');

    INSERT INTO payouts (store_id, order_id, amount, status, paid_at)
    VALUES (v_store_id, v_order_id, 899, 'paid', NOW() - INTERVAL '7 days');
  END IF;

  RAISE NOTICE 'Returns/Earnings/Analytics demo data ready for store %.', v_store_id;
END $$;
