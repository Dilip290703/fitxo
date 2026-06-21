-- Migration 009: per-item keep-payment (Razorpay, customer panel #13)
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Prerequisite: migration 002 (try-loop: payments table) must already be applied.
--
-- WHY A SECURITY DEFINER RPC:
--   The customer app holds only the ANON key (no service-role, per the hard rules).
--   RLS lets a customer INSERT/SELECT their own `payments` rows but NOT UPDATE them.
--   Marking a payment "success" must therefore happen through a guarded function that
--   cannot be forged by a client — so this RPC re-verifies the Razorpay HMAC signature
--   *inside Postgres* before writing. A direct/forged RPC call without a valid signature
--   (which requires the secret) is rejected. Same guarded-RPC pattern as the Store panel.
--
-- ONE-TIME MANUAL STEP — store the Razorpay key SECRET in Supabase Vault (never committed).
-- (Supabase blocks ALTER DATABASE/ROLE for the SQL-editor role, so we use Vault.)
--   SELECT vault.create_secret('<your_razorpay_test_secret>', 'razorpay_key_secret', 'Razorpay key secret');
--   -- verify it stored:
--   SELECT name FROM vault.secrets WHERE name = 'razorpay_key_secret';
--   At deployment, rotate to the LIVE secret with:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'razorpay_key_secret'), '<live_secret>');

-- ============================================================
-- pgcrypto provides hmac() for in-DB signature verification.
-- On Supabase it normally already exists in the `extensions` schema (no-op here).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- Map each payment to the specific kept item it settles
-- (payments was order-scoped; per-item flow needs item granularity)
-- ============================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_item_id ON payments(order_item_id);

-- ============================================================
-- confirm_keep_payment: verify Razorpay signature, then mark
-- the payment paid and flip the kept item to 'keep'.
-- Called by the customer server action AFTER Razorpay checkout succeeds.
-- ============================================================
CREATE OR REPLACE FUNCTION confirm_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- include `extensions` so pgcrypto's hmac() resolves (Supabase installs it there, not public)
SET search_path = public, extensions
AS $$
DECLARE
  v_secret   TEXT;
  v_expected TEXT;
  v_payment  payments%ROWTYPE;
BEGIN
  -- Read the Razorpay secret from Vault (decrypted on read; only the definer can see it).
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'razorpay_key_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'razorpay secret not configured (create vault secret razorpay_key_secret)';
  END IF;

  -- Razorpay signs: HMAC_SHA256(razorpay_order_id || '|' || razorpay_payment_id), hex digest.
  v_expected := encode(
    hmac(p_razorpay_order_id || '|' || p_razorpay_payment_id, v_secret, 'sha256'),
    'hex'
  );

  IF v_expected IS DISTINCT FROM p_razorpay_signature THEN
    RAISE EXCEPTION 'invalid payment signature';
  END IF;

  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Ownership: caller must own the order this payment belongs to.
  -- (SECURITY DEFINER bypasses RLS, so we check ownership explicitly.)
  IF NOT EXISTS (
    SELECT 1 FROM orders o
     WHERE o.id = v_payment.order_id AND o.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  -- Idempotent: a duplicate confirm is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = p_razorpay_signature,
         paid_at             = NOW()
   WHERE id = v_payment.id;

  -- Flip the specific kept item now that it's paid for.
  IF v_payment.order_item_id IS NOT NULL THEN
    UPDATE order_items
       SET decision = 'keep', decision_at = NOW()
     WHERE id = v_payment.order_item_id;
  END IF;

  -- Mark the order paid once no kept item is left unpaid.
  UPDATE orders o
     SET payment_status = 'paid'
   WHERE o.id = v_payment.order_id
     AND NOT EXISTS (
       SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.decision = 'keep'
          AND NOT EXISTS (
            SELECT 1 FROM payments p
             WHERE p.order_item_id = oi.id AND p.status = 'success'
          )
     );
END;
$$;

-- Only logged-in customers (and admins) may call it; the function checks ownership itself.
REVOKE ALL ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) TO authenticated;
