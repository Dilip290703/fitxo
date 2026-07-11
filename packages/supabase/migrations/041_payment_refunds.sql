-- Migration 041: admin-initiated payment refunds (Track A Task 4, scoped MVP)
-- Run in Supabase SQL Editor after migration 040. Idempotent.
--
-- WHY: no refund path existed anywhere — a charging mistake (double fee, wrong
-- item) could only be fixed with raw SQL + the Razorpay dashboard. Admin >
-- Payments (read-only by design) grows exactly ONE action: full-refund a
-- successful Razorpay payment row.
--
-- HOW: the money moves via Razorpay's refund API, called from a guarded admin
-- server action (requireAdmin() + service-role write, the established admin
-- mutation pattern — no new RPC/RLS needed; customers can already SELECT their
-- own payment rows, so they see the refunded status for free). The action
-- flips the SAME payments row success → 'refunded' (the enum has had the value
-- since 002; the Payments screen has always had a Refunded tab) and records the
-- Razorpay refund id + when + why below. Everything is audit-logged.
--
-- SCOPE (MVP, deliberate): full refunds only, admin-initiated only, no
-- customer-facing self-serve, and no automatic order/item state changes — the
-- admin fixes order state separately via the existing order-detail actions if
-- needed (e.g. cancel with reason).

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS refunded_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason      TEXT;

COMMENT ON COLUMN payments.razorpay_refund_id IS
  'Razorpay refund id (rfnd_…) when this payment was refunded via Admin > Payments (migration 041).';
COMMENT ON COLUMN payments.refunded_at IS
  'When the admin-initiated full refund was issued (migration 041).';
COMMENT ON COLUMN payments.refund_reason IS
  'Admin-entered reason for the refund — also in the audit log (migration 041).';
