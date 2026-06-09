-- Migration 006: let store managers CREATE/EDIT their own products
-- Run in Supabase SQL Editor after migration 005.
--
-- Until now managers could only UPDATE existing products (products_manager_write)
-- and READ their catalogue (004). They could not INSERT a product, nor write
-- product_colors / product_variants at all. This unblocks the Add Product (#4)
-- and Edit Product (#5) screens. All policies are scoped to products the manager
-- owns via is_store_manager_of(store_id).

-- PRODUCTS: a manager can create products for a store they manage.
CREATE POLICY products_manager_insert ON products FOR INSERT
  WITH CHECK (is_store_manager_of(store_id));

-- PRODUCT COLORS: full write (insert/update/delete) for the manager's products.
CREATE POLICY colors_manager_write ON product_colors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- PRODUCT VARIANTS: full write for the manager's products.
CREATE POLICY variants_manager_write ON product_variants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));
