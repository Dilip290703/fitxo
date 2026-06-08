-- Migration 005: re-enable Row Level Security (SECURITY FIX)
-- Run in Supabase SQL Editor ASAP.
--
-- Discovered 2026-06-08 while building the Store Dashboard: with only the public
-- anon key and NO session, `users`, `orders`, and `order_items` were fully
-- readable (all customer names/emails/phones + all orders). The policies from
-- schema.sql are intact, so RLS had been DISABLED on these tables (typically
-- happens when it's toggled off to debug during dev and never turned back on).
--
-- `ENABLE ROW LEVEL SECURITY` is idempotent — running it on a table that already
-- has RLS enabled is a harmless no-op — so this re-asserts it across every table
-- that is supposed to have it, not just the three confirmed leaks. All these
-- tables already have policies (schema.sql + migrations 002/004), so enabling
-- RLS will not lock anyone out who should have access.

ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;  -- confirmed leak
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_colors   ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;  -- confirmed leak
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;  -- confirmed leak
ALTER TABLE riders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_managers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE try_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts          ENABLE ROW LEVEL SECURITY;

-- Verify afterwards (every row should show rowsecurity = true):
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' ORDER BY tablename;
