-- Migration 037: decouple rider pay from the customer's delivery charge.
-- Run after 036. Idempotent.
--
-- THE PROBLEM (found 2026-07-09): orders.delivery_fee did double duty — it was
-- both what the customer is charged for delivery AND what the rider earns. So a
-- customer who got free delivery (any order at/above free_delivery_above, i.e.
-- most fashion orders) left the rider earning ₹0 for the same trip + 7-min wait.
-- The rider's pay is a platform cost and must not depend on the customer waiver.
--
-- FIX: a separate, always-paid rider fee.
--   • system_settings.rider_fee  — flat amount Fitzo pays a rider per completed
--     delivery (config, default 40; independent of the customer delivery charge).
--   • orders.rider_fee           — stamped at checkout from that config (always,
--     no free-delivery waiver). Agent earnings + Admin > Agent Payouts read THIS,
--     not delivery_fee. orders.delivery_fee stays the CUSTOMER charge (free-above
--     logic unchanged, for when the customer charge is actually collected).
-- ============================================================

-- 1. Config: what the rider earns per completed delivery.
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS rider_fee NUMERIC(10,2) NOT NULL DEFAULT 40
  CHECK (rider_fee >= 0);

-- 2. Per-order rider pay, stamped at placement.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 3. Backfill: give every existing order the currently-configured rider fee, so
--    historical rider earnings aren't zero. Only touches unset (0) rows, so it's
--    safe to re-run.
UPDATE orders
   SET rider_fee = COALESCE((SELECT rider_fee FROM system_settings WHERE id = 1), 40)
 WHERE rider_fee = 0;
