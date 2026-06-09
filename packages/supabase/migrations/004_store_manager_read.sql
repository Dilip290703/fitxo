-- Migration 004: store-manager READ access to their own catalogue, orders & returns
-- Run in Supabase SQL Editor after migration 003.
--
-- Why: store managers authenticate against the same Supabase project but, until
-- now, RLS only let them UPDATE their products and SELECT their payouts. They
-- could not read their own draft/inactive products, nor any orders/returns
-- containing their products (order_items has no store_id — visibility comes from
-- joining order_items → products → store_id). This unblocks the Store panel's
-- Dashboard, Catalogue, Order Management, Returns and Earnings screens.
--
-- All policies below are PERMISSIVE SELECT policies, so they are OR-ed with the
-- existing public/customer/admin policies — they only ADD visibility, never
-- remove it.

-- ============================================================
-- Helper: does the given order contain an item from a store the
-- current user manages? SECURITY DEFINER so the inner joins bypass
-- RLS on order_items/products and we avoid orders↔order_items recursion.
-- ============================================================
CREATE OR REPLACE FUNCTION is_my_store_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN store_managers sm ON sm.store_id = p.store_id
    WHERE oi.order_id = order_uuid
      AND sm.user_id = auth.uid()
      AND sm.is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- PRODUCTS: a manager can read ALL of their store's products
-- (incl. inactive/deleted drafts), on top of the public active view.
-- ============================================================
CREATE POLICY products_manager_select ON products FOR SELECT
  USING (is_store_manager_of(store_id));

-- PRODUCT VARIANTS: read variants of products the manager owns.
CREATE POLICY variants_manager_select ON product_variants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- ============================================================
-- ORDERS: a manager can read orders that contain at least one of
-- their products.
-- ============================================================
CREATE POLICY orders_manager_select ON orders FOR SELECT
  USING (is_my_store_order(id));

-- ORDER ITEMS: a manager can read only the line items that are their
-- products (so a multi-store order never exposes another store's lines).
CREATE POLICY order_items_manager_select ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- ============================================================
-- RETURNS: a manager can read returns for orders containing their products.
-- ============================================================
CREATE POLICY returns_manager_select ON returns FOR SELECT
  USING (is_my_store_order(order_id));
