-- Migration 042: traceable manual payouts (Track A Task 5 — ledger hardening)
-- Run in Supabase SQL Editor after migration 041. Idempotent.
--
-- WHY: real Razorpay disbursement is blocked on business steps, not code —
-- RazorpayX needs a registered entity + its own account/KYC, and Route is
-- RBI-gated behind ₹40L turnover (full investigation + go-live checklist in
-- docs/PAYOUTS-GOING-LIVE.md). Until then money moves by MANUAL bank/UPI
-- transfer, and the ledgers are the only record — so make each entry
-- traceable:
--
--   reference — the UTR / UPI transaction id of the manual transfer (typed by
--               the admin in the record-payout modal; optional but nagged).
--   paid_to   — masked destination snapshot at record time ("UPI x@y" /
--               "A/c ····1234 · HDFC0001234"). Riders/stores can edit their
--               payout details later; the snapshot keeps the ledger honest
--               about where the money actually went.
--
-- Both admin record-payout actions degrade gracefully pre-042 (retry the
-- insert without the new columns).

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_to   TEXT;

ALTER TABLE agent_payouts
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_to   TEXT;

COMMENT ON COLUMN payouts.reference        IS 'UTR / UPI txn id of the manual transfer (migration 042).';
COMMENT ON COLUMN payouts.paid_to          IS 'Masked destination snapshot at record time (migration 042).';
COMMENT ON COLUMN agent_payouts.reference  IS 'UTR / UPI txn id of the manual transfer (migration 042).';
COMMENT ON COLUMN agent_payouts.paid_to    IS 'Masked destination snapshot at record time (migration 042).';
