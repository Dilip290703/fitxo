-- Migration 031: bulk "mark ready" — one round-trip instead of one RPC per item.
-- Run in Supabase SQL Editor after migration 030. Idempotent.
--
-- WHY: the store panel's "Mark all ready" / dashboard "Ready & confirm" used to
-- call set_order_item_prepared() (migration 007) once per line item — a
-- 10-item order was 10 sequential round-trips on store Wi-Fi. This RPC flips
-- every one of the CALLER'S OWN items in an order in a single statement.
-- Authorization is by construction: the UPDATE only touches items whose
-- product belongs to a store the caller manages (is_store_manager_of), so a
-- multi-store order can never have another store's items flipped.

CREATE OR REPLACE FUNCTION mark_order_items_prepared(p_order_id UUID, p_ready BOOLEAN DEFAULT TRUE)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Caller must manage the store of at least one item in this order
  -- (same gate as store_confirm_order, migration 016).
  IF NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND is_store_manager_of(p.store_id)
  ) THEN
    RAISE EXCEPTION 'Not authorised to update this order';
  END IF;

  UPDATE order_items oi
  SET prepared_at = CASE WHEN p_ready THEN NOW() ELSE NULL END
  FROM products p
  WHERE p.id = oi.product_id
    AND oi.order_id = p_order_id
    AND is_store_manager_of(p.store_id)
    -- only rows that actually change (keeps first-ready timestamps stable
    -- when the RPC is retried)
    AND ((p_ready AND oi.prepared_at IS NULL) OR (NOT p_ready AND oi.prepared_at IS NOT NULL));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

GRANT EXECUTE ON FUNCTION mark_order_items_prepared(UUID, BOOLEAN) TO authenticated;
