-- Migration 039: Razorpay `payment.captured` webhook settlement
-- Run in Supabase SQL Editor after migration 038. Idempotent.
--
-- WHY: a Keep payment is settled only by the customer's browser success handler
-- (order-tracking → confirm_keep_payment). If the tab closes / the phone dies
-- right after Razorpay captures the money, the payment stays 'initiated' and the
-- order unpaid — Fitzo has the money but doesn't know it. Razorpay's
-- `payment.captured` webhook is the server-to-server source of truth; this
-- migration gives it a settlement path.
--
-- TRUST MODEL (same as migration 009): the customer app holds only the ANON key,
-- so the webhook RPC cannot trust its caller — anyone with the anon key could
-- call it. It therefore re-verifies the webhook HMAC signature *inside Postgres*
-- over the raw request body, keyed by the WEBHOOK secret (a different secret
-- from the checkout key secret) stored in Supabase Vault. A forged call without
-- the webhook secret is rejected.
--
-- DOUBLE-SETTLE RACE: the client success handler and the webhook both fire for
-- the same capture. Both paths funnel into settle_keep_payment(), which locks
-- the payments row FOR UPDATE and no-ops when it is already 'success' — whoever
-- arrives second waits on the lock, then does nothing.
--
-- ONE-TIME MANUAL STEPS (Dilip):
--   1. Razorpay Dashboard → Settings → Webhooks → Add New Webhook:
--        URL:            https://<customer-domain>/api/razorpay/webhook
--                        (local testing: expose :3000 via a tunnel, e.g. ngrok)
--        Secret:         generate a strong random string (this is the WEBHOOK
--                        secret — not the key secret)
--        Active events:  payment.captured
--   2. Store the same secret in Vault:
--        SELECT vault.create_secret('<webhook_secret>', 'razorpay_webhook_secret', 'Razorpay webhook secret');
--        -- verify: SELECT name FROM vault.secrets WHERE name = 'razorpay_webhook_secret';
--   3. Add it to apps/customer/.env.local:
--        RAZORPAY_WEBHOOK_SECRET=<webhook_secret>
--      (the route handler fast-rejects bad signatures before touching the DB;
--       the RPC re-verifies in-DB so the route check is belt-and-braces only).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- settle_keep_payment: the settle core, extracted verbatim from 009's
-- confirm_keep_payment so the client-confirm path and the webhook path share
-- one implementation and cannot drift.
--
-- NOT callable by any client role (no grants) — only the SECURITY DEFINER
-- entry points below reach it. It does NO signature or ownership checks
-- itself; each entry point does its own before calling.
--
-- Returns the Fitzo order id it settled, or NULL when the payment was already
-- 'success' (idempotent duplicate).
-- ============================================================
CREATE OR REPLACE FUNCTION settle_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT  -- checkout signature from the client path; NULL from the webhook
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
BEGIN
  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Idempotent: a duplicate settle (client handler + webhook) is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN NULL;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = COALESCE(p_razorpay_signature, razorpay_signature),
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

  RETURN v_payment.order_id;
END;
$$;

REVOKE ALL ON FUNCTION settle_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
-- deliberately no GRANTs: internal only

-- ============================================================
-- confirm_keep_payment: SAME contract as 009 (args, behavior, error messages)
-- — now a thin wrapper: verify the checkout HMAC in-DB + check ownership, then
-- delegate the settle to settle_keep_payment().
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
BEGIN
  -- Read the Razorpay KEY secret from Vault (decrypted on read; only the definer can see it).
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

  IF NOT EXISTS (
    SELECT 1 FROM payments WHERE razorpay_order_id = p_razorpay_order_id
  ) THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Ownership: caller must own the order this payment belongs to.
  -- (SECURITY DEFINER bypasses RLS, so we check ownership explicitly.)
  IF NOT EXISTS (
    SELECT 1 FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.razorpay_order_id = p_razorpay_order_id AND o.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  PERFORM settle_keep_payment(p_razorpay_order_id, p_razorpay_payment_id, p_razorpay_signature);
END;
$$;

-- Only logged-in customers (and admins) may call it; the function checks ownership itself.
REVOKE ALL ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_keep_payment(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- razorpay_webhook_captured: entry point for the customer app's
-- /api/razorpay/webhook route handler. Verifies the WEBHOOK signature over the
-- raw body in-DB, then settles exactly like the client path.
--
-- Returns a status string for the route's response / logs:
--   'settled'         — payment settled by this call
--   'already_settled' — client handler (or an earlier delivery) got there first
--   'not_tracked'     — capture for a razorpay order we have no payments row for
--                       (e.g. a dashboard test payment) — not an error, don't retry
--   'ignored'         — event other than payment.captured
-- ============================================================
CREATE OR REPLACE FUNCTION razorpay_webhook_captured(
  p_payload   TEXT,  -- the RAW webhook request body, byte-for-byte
  p_signature TEXT   -- the X-Razorpay-Signature header
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret         TEXT;
  v_expected       TEXT;
  v_event          JSONB;
  v_entity         JSONB;
  v_rzp_order_id   TEXT;
  v_rzp_payment_id TEXT;
  v_amount_paise   BIGINT;
  v_payment        payments%ROWTYPE;
  v_order_id       UUID;
BEGIN
  -- Read the WEBHOOK secret from Vault (distinct from the checkout key secret).
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'razorpay_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'razorpay webhook secret not configured (create vault secret razorpay_webhook_secret)';
  END IF;

  -- Razorpay signs webhooks: HMAC_SHA256(raw_body), hex digest.
  v_expected := encode(hmac(p_payload, v_secret, 'sha256'), 'hex');
  IF v_expected IS DISTINCT FROM p_signature THEN
    RAISE EXCEPTION 'invalid webhook signature';
  END IF;

  v_event := p_payload::jsonb;
  IF v_event->>'event' IS DISTINCT FROM 'payment.captured' THEN
    RETURN 'ignored';
  END IF;

  v_entity         := v_event->'payload'->'payment'->'entity';
  v_rzp_order_id   := v_entity->>'order_id';
  v_rzp_payment_id := v_entity->>'id';
  v_amount_paise   := (v_entity->>'amount')::BIGINT;

  IF v_rzp_order_id IS NULL OR v_rzp_payment_id IS NULL THEN
    RAISE EXCEPTION 'malformed payment.captured payload';
  END IF;

  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = v_rzp_order_id;

  IF NOT FOUND THEN
    RETURN 'not_tracked';
  END IF;

  -- Integrity: the captured amount must equal what checkout initiated
  -- (payments.amount is rupees; the webhook entity amount is paise).
  IF v_amount_paise IS DISTINCT FROM ROUND(v_payment.amount * 100)::BIGINT THEN
    RAISE EXCEPTION 'captured amount % paise does not match initiated payment for razorpay order %',
      v_amount_paise, v_rzp_order_id;
  END IF;

  v_order_id := settle_keep_payment(v_rzp_order_id, v_rzp_payment_id, NULL);
  IF v_order_id IS NULL THEN
    RETURN 'already_settled';
  END IF;

  -- Close the loop like the client path does. The client calls
  -- finalize_order_if_decided (019) after settling, but that RPC is
  -- owner-gated on auth.uid(), which a webhook call doesn't have — so the
  -- same idempotent steps are inlined here (keep in sync with 019).
  IF NOT EXISTS (
    SELECT 1 FROM order_items oi
     WHERE oi.order_id = v_order_id AND oi.decision = 'pending'
  ) THEN
    UPDATE try_sessions
       SET status = 'completed'
     WHERE order_id = v_order_id AND status = 'active';

    UPDATE orders
       SET status = 'completed', updated_at = NOW()
     WHERE id = v_order_id
       AND status IN ('try_window_active', 'return_requested', 'return_picked');
  END IF;

  RETURN 'settled';
END;
$$;

-- The route handler calls this with the ANON key (webhooks have no user
-- session). Safe: authorization is the in-DB webhook-signature check above,
-- which requires the secret only Razorpay and the Vault hold.
REVOKE ALL ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) TO anon, authenticated;
