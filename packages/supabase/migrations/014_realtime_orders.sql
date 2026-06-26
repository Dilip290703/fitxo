-- Migration 014: enable Supabase Realtime on orders + order_items
-- Run in Supabase SQL Editor after migration 013.
-- (Already applied as the earlier "009_realtime_orders" — renamed to 014 to
--  avoid the filename clash with 009_keep_payment; re-running is idempotent.)
--
-- Powers the live "new order" pop-up alerts in the Admin and Store panels.
-- Realtime delivers INSERT events only to clients that can SELECT the row, so
-- existing RLS does the routing for free:
--   • Admin   → subscribes to `orders`      (is_admin sees all)
--   • Store   → subscribes to `order_items` (manager-read RLS, migration 004,
--               scopes to that store's own line items)
--
-- Idempotent: skips tables already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
  END IF;
END $$;

-- Realtime needs the full row to evaluate RLS on changes.
ALTER TABLE orders      REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
