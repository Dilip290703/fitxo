-- Migration 040: collect the customer delivery fee with the FIRST Keep payment
-- Run in Supabase SQL Editor after migration 039. Idempotent.
--
-- WHY: `orders.delivery_fee` (the customer charge, decoupled from rider pay in
-- 037) was stamped at checkout but never actually collected — the per-item Keep
-- charge was the bare item price, and COD (which collected it in cash) is gone.
-- Owner decision (2026-07-10): fold the fee into the FIRST Keep charge on the
-- order — no extra payment prompt, rides the existing verified per-item flow.
-- If the customer returns everything, the fee goes uncollected (accepted churn
-- cost, also an owner decision).
--
-- HOW: no RPC changes. createKeepPayment (customer server action) now:
--   1. checks whether any successful payment on the order already carried the
--      fee (delivery_fee_component > 0),
--   2. if not, charges item price + orders.delivery_fee and records the split
--      in the new column below.
-- The 039 webhook amount check keeps working because payments.amount is the
-- full charged amount (item + fee component).
--
-- KNOWN LIMIT (accepted): the "already collected?" check happens in the server
-- action, so two Keeps initiated simultaneously from two tabs could both carry
-- the fee. The UI serializes keeps on one device, and the refund path (Track A
-- Task 4) covers the freak case.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS delivery_fee_component NUMERIC(10,2) NOT NULL DEFAULT 0
  CHECK (delivery_fee_component >= 0);

COMMENT ON COLUMN payments.delivery_fee_component IS
  'Portion of amount that is the customer delivery fee (folded into the first Keep charge, migration 040). 0 = pure item payment.';
