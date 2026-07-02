-- Migration 030: product image upload for the Store panel (rework L6)
-- Run once in the Supabase SQL Editor after migration 029. Idempotent.
--
-- WHY: the schema has had `product_images` + a `product-images` bucket comment since
-- day one, but nothing was ever wired: store managers have NO write policy on
-- `product_images` (only images_admin_all), and the bucket + its storage policies
-- were never created. This closes both gaps so the store ProductForm can upload.
--
-- Path convention for uploads: {store_id}/{product_id}/{filename} — the FIRST folder
-- is the store id, which is what the storage policies check via is_store_manager_of().

-- ============================================================
-- 1. product_images: manager write (same shape as migration 006's
--    colors/variants policies — scoped through the owning product).
-- ============================================================
DROP POLICY IF EXISTS images_manager_write ON product_images;
CREATE POLICY images_manager_write ON product_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_id AND is_store_manager_of(p.store_id)
  ));

-- ============================================================
-- 2. Storage bucket (public read — product photos are public content).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Storage policies. storage.objects already has RLS enabled by Supabase.
--    Managers may only write inside their own store's folder (first path segment).
-- ============================================================
DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS product_images_manager_insert ON storage.objects;
CREATE POLICY product_images_manager_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND is_store_manager_of(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS product_images_manager_delete ON storage.objects;
CREATE POLICY product_images_manager_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND is_store_manager_of(((storage.foldername(name))[1])::uuid)
  );

-- Admin full access over the bucket (service-role bypasses RLS anyway; this covers
-- admin-session dashboard actions).
DROP POLICY IF EXISTS product_images_admin_all ON storage.objects;
CREATE POLICY product_images_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND is_admin())
  WITH CHECK (bucket_id = 'product-images' AND is_admin());

-- Verify afterwards:
--   SELECT id, public FROM storage.buckets WHERE id = 'product-images';
--   SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'product_images%';
