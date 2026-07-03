-- ============================================================
-- 032: double-payout guard on the store payout ledger
--
-- `agent_payouts` has had UNIQUE (rider_id, order_id) since migration 020,
-- but `payouts` (migration 002) never got the mirror constraint — so a
-- double-click / concurrent "Record payout" could insert duplicate ledger
-- rows and overstate what a store was paid. Dedupe, then add the constraint.
--
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1. Remove exact duplicates, keeping the earliest row per (store_id, order_id).
DELETE FROM payouts p
USING payouts older
WHERE p.store_id = older.store_id
  AND p.order_id = older.order_id
  AND (p.created_at > older.created_at
       OR (p.created_at = older.created_at AND p.ctid > older.ctid));

-- 2. Add the unique constraint (skip if it already exists).
DO $$
BEGIN
  ALTER TABLE payouts ADD CONSTRAINT payouts_store_order_unique UNIQUE (store_id, order_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
