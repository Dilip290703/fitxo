-- Migration 022: reliable "new order" signal for the STORE panel
-- Run in Supabase SQL Editor after migration 021.
--
-- WHY: the store new-order pop-up subscribed to `order_items` INSERT and leaned on
-- the RLS policy `order_items_manager_select` to route only that store's lines. But
-- that policy is a JOIN through `products` (is_store_manager_of(p.store_id)), and
-- Supabase Realtime can't reliably evaluate a join-based policy to decide who gets a
-- postgres_changes event — so the store stopped receiving the pop-up. (Admin still
-- works: its policy is a plain is_admin(). The agent was moved to notifications in
-- migration 021 for the same reason.)
--
-- FIX: same born-visible pattern. When an order line lands, a trigger inserts a
-- `notifications` row owned by each manager of that line's store (deduped per
-- order). notifications has the simple `user_id = auth.uid()` policy Realtime can
-- route, and it's already on the publication (migration 021). The store panel then
-- subscribes to its own notifications instead of order_items.
--
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_store_on_new_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
  v_order_number TEXT;
  m RECORD;
BEGIN
  SELECT store_id INTO v_store_id FROM products WHERE id = NEW.product_id;
  IF v_store_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_number INTO v_order_number FROM orders WHERE id = NEW.order_id;

  FOR m IN
    SELECT user_id FROM store_managers WHERE store_id = v_store_id AND is_active = true
  LOOP
    -- One new-order notification per manager per order (multi-item orders fire the
    -- trigger once per line; only the first creates the row).
    IF NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = m.user_id
        AND n.data->>'kind' = 'new_store_order'
        AND n.data->>'order_id' = NEW.order_id::text
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        m.user_id,
        'order_update',
        'New order',
        'Order ' || COALESCE(v_order_number, '') || ' has items from your store.',
        jsonb_build_object('kind', 'new_store_order', 'order_id', NEW.order_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_store_on_new_order_item ON order_items;
CREATE TRIGGER trg_notify_store_on_new_order_item
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_store_on_new_order_item();
