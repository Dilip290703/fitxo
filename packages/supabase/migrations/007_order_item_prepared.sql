-- Migration 007: let a store mark its own order line-items "ready for pickup"
-- Run in Supabase SQL Editor after migration 006.
--
-- Orders are multi-store (one order can contain items from several stores), so
-- the "ready" state lives per LINE ITEM, not per order. A store flips this flag
-- via the set_order_item_prepared() RPC below — NOT a broad UPDATE policy — so a
-- store manager can only toggle prepared_at on their own items and can never
-- touch price_at_order, the customer's keep/return decision, etc.

-- 1. The flag: NULL = not prepared; a timestamp = marked ready at that time.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;

-- 2. Guarded toggle. SECURITY DEFINER runs as the owner (bypassing RLS), but the
--    explicit is_store_manager_of() check (auth.uid() still = the caller) ensures
--    only the managing store can change its own item.
CREATE OR REPLACE FUNCTION set_order_item_prepared(p_item_id UUID, p_ready BOOLEAN)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.id = p_item_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to update this order item';
  END IF;

  UPDATE order_items
  SET prepared_at = CASE WHEN p_ready THEN NOW() ELSE NULL END
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Allow logged-in users to call it (the function itself enforces ownership).
GRANT EXECUTE ON FUNCTION set_order_item_prepared(UUID, BOOLEAN) TO authenticated;
