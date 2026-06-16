-- ============================================================
-- Fitzo Store panel — dashboard demo data for "Fitzo Test Store"
-- ============================================================
-- Gives the seeded test store something to show on the dashboard: one product
-- with two variants (one low-stock), and one order in its (15–30 min) try window.
--
-- Prerequisites (run once, in order):
--   1. apps/store/seed/store_seed.sql        (creates the store + manager)
--   2. packages/supabase/migrations/004_store_manager_read.sql  (manager RLS)
-- Then run this file in the Supabase SQL Editor. Re-runnable (idempotent).
-- ============================================================

DO $$
DECLARE
  v_store_id   UUID;
  v_user_id    UUID;
  v_product_id UUID;
  v_color_id   UUID;
  v_variant_id UUID;
  v_order_id   UUID;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'fitzo-test-store';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Run store_seed.sql first (no fitzo-test-store).';
  END IF;

  SELECT user_id INTO v_user_id
  FROM store_managers
  WHERE store_id = v_store_id AND is_active = true
  LIMIT 1;

  -- Product.
  INSERT INTO products (store_id, name, slug, description, base_price, discounted_price, is_active)
  VALUES (v_store_id, 'Sample Oversized Tee', 'sample-oversized-tee',
          'Seeded demo product for the store dashboard.', 1299, 999, true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true
  RETURNING id INTO v_product_id;

  -- Colour.
  SELECT id INTO v_color_id
  FROM product_colors WHERE product_id = v_product_id AND color_name = 'Black';
  IF v_color_id IS NULL THEN
    INSERT INTO product_colors (product_id, color_name, color_hex)
    VALUES (v_product_id, 'Black', '#111111')
    RETURNING id INTO v_color_id;
  END IF;

  -- Variants: M well-stocked, S low-stock (drives the Low stock panel).
  INSERT INTO product_variants (product_id, color_id, size, stock_qty, sku)
  VALUES (v_product_id, v_color_id, 'M', 25, 'TEE-BLK-M')
  ON CONFLICT (sku) DO UPDATE SET stock_qty = 25
  RETURNING id INTO v_variant_id;

  INSERT INTO product_variants (product_id, color_id, size, stock_qty, sku)
  VALUES (v_product_id, v_color_id, 'S', 1, 'TEE-BLK-S')
  ON CONFLICT (sku) DO UPDATE SET stock_qty = 1;

  -- One order in its try window today (guarded so re-runs don't pile up).
  -- user_id reuses the manager's user purely as demo data.
  IF NOT EXISTS (SELECT 1 FROM orders WHERE notes = 'store-dashboard-seed') THEN
    INSERT INTO orders (user_id, status, subtotal, final_amount, payment_status, try_deadline, notes)
    VALUES (v_user_id, 'try_window_active', 999, 999, 'pending',
            NOW() + INTERVAL '30 minutes', 'store-dashboard-seed')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, variant_id, product_name, color_name, size, price_at_order)
    VALUES (v_order_id, v_product_id, v_variant_id, 'Sample Oversized Tee', 'Black', 'M', 999);
  END IF;

  RAISE NOTICE 'Dashboard demo data ready for store %.', v_store_id;
END $$;
