-- Migration 043: capture Razorpay gateway fees on payments (money plan M1)
-- Run in Supabase SQL Editor after migration 042. Idempotent.
--
-- WHY: Razorpay takes ~2% MDR + 18% GST on every capture, but Fitzo never
-- records it — so every margin figure (admin Money card, future P&L) overstates
-- by the gateway's cut. Razorpay reports the exact fee per payment: the
-- `payment.captured` webhook payload and the Payments fetch API both carry
-- `fee` and `tax` on the payment entity (both in PAISE).
--
-- SEMANTICS (Razorpay's, documented here so nobody re-derives them wrong):
--   • entity.fee = the TOTAL amount Razorpay deducted, INCLUDING tax.
--   • entity.tax = the GST portion inside that fee.
--   • Net MDR   = fee − tax.
--   • On refunds Razorpay does NOT return the fee — it stays a sunk cost, so a
--     refunded payment keeps its gateway_fee (order_economics treats it as cost).
--   • NULL gateway_fee = "not yet known" (pre-043 rows, or webhook not yet
--     delivered). 0 is a real value (some promos/methods are zero-fee).
--
-- WRITE PATHS:
--   1. razorpay_webhook_captured() (below) stamps fee+tax from the webhook
--      payload — including when the payment was already settled by the client
--      path, because the client success handler never sees fee data. The stamp
--      only fills NULLs; it never overwrites a recorded value.
--   2. Admin > Payments "Sync gateway fees" (server action) backfills
--      pre-043 / missed rows via the Razorpay Payments fetch API.

-- ============================================================
-- 1. Columns (rupees, like payments.amount — converted from paise on write)
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_tax NUMERIC(10,2);

COMMENT ON COLUMN payments.gateway_fee IS
  'Total Razorpay deduction for this capture, in rupees, INCLUDING GST (entity.fee/100). NULL = not yet reported. Not reversed on refund.';
COMMENT ON COLUMN payments.gateway_tax IS
  'GST portion inside gateway_fee, in rupees (entity.tax/100). Net MDR = gateway_fee - gateway_tax.';

-- ============================================================
-- 2. razorpay_webhook_captured: 039's function re-created verbatim, plus the
--    fee/tax stamp. Contract unchanged (args, return values, error messages).
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
  v_fee_paise      BIGINT;
  v_tax_paise      BIGINT;
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
  v_fee_paise      := (v_entity->>'fee')::BIGINT;   -- total deduction incl. GST
  v_tax_paise      := (v_entity->>'tax')::BIGINT;   -- GST portion of the fee

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

  -- Stamp the gateway fee BEFORE the settle branch: the client path usually
  -- settles first (webhook returns 'already_settled'), and the client never
  -- sees fee data — this webhook is the only automatic source. Fill-only:
  -- never overwrite a value already recorded (e.g. by the admin backfill).
  IF v_fee_paise IS NOT NULL THEN
    UPDATE payments
       SET gateway_fee = ROUND(v_fee_paise / 100.0, 2),
           gateway_tax = CASE WHEN v_tax_paise IS NULL THEN gateway_tax
                              ELSE ROUND(v_tax_paise / 100.0, 2) END
     WHERE id = v_payment.id
       AND gateway_fee IS NULL;
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

-- Grants identical to 039: the route calls with the anon key; the in-DB
-- webhook-signature check is the authorization.
REVOKE ALL ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION razorpay_webhook_captured(TEXT, TEXT) TO anon, authenticated;
