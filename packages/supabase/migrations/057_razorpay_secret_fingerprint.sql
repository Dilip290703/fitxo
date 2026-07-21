-- Migration 057: prove the Razorpay secrets in the apps and in Vault are the
-- SAME secret, without ever exposing either (W4.9 / C4 secret rotation).
-- Run after 056 (055 is reserved for M4 tax provisions). Idempotent.
--
-- WHY THIS EXISTS:
--
-- The Razorpay key secret lives in FOUR places that must move together:
--   1. apps/customer/.env.local   (creates the Razorpay order)
--   2. apps/admin/.env.local      (refunds, migration 041)
--   3. Vault `razorpay_key_secret` on DEV
--   4. Vault `razorpay_key_secret` on PROD
--
-- The app and the database each hold a copy for different reasons: the app
-- calls Razorpay's API with it, and `confirm_keep_payment` (009) /
-- `razorpay_webhook_captured` (039) re-verify Razorpay's HMAC **in-DB** with
-- it, precisely so a compromised client can't forge a settlement.
--
-- That split makes a partial rotation fail in the worst possible way: the app
-- charges the customer with the NEW key, Razorpay signs with the NEW secret,
-- the database verifies against the OLD one — so the money moves and the order
-- never settles, with 'invalid payment signature' buried in a server log. On
-- test keys that is a confusing afternoon. At the W5.2 live cutover it is a
-- real customer charged for an order that stays open.
--
-- This function returns an HMAC **fingerprint** of each Vault secret: a
-- deterministic one-way digest of a fixed probe string. The same digest can be
-- computed locally from a .env value, so the two can be compared for equality
-- while neither is ever printed or transmitted.
-- `scripts/razorpay/check-key-sync.mjs` does exactly that.
--
-- Not an information leak worth worrying about: reaching this function needs
-- the service-role key, and anything holding that key can read
-- vault.decrypted_secrets directly.
-- ============================================================

CREATE OR REPLACE FUNCTION razorpay_secret_fingerprints()
RETURNS TABLE (secret_name TEXT, configured BOOLEAN, fingerprint TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
-- `extensions` is required for hmac(): pgcrypto lives there on Supabase, same
-- as 009/039 which do the real verification.
SET search_path = public, extensions
AS $$
DECLARE
  r        RECORD;
  v_secret TEXT;
BEGIN
  FOR r IN SELECT unnest(ARRAY['razorpay_key_secret', 'razorpay_webhook_secret']) AS nm
  LOOP
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = r.nm;

    secret_name := r.nm;
    configured  := v_secret IS NOT NULL AND v_secret <> '';
    -- Fixed probe string — changing it invalidates every previously recorded
    -- fingerprint, so leave it alone.
    fingerprint := CASE
      WHEN configured THEN encode(hmac('fitzo-rotation-check', v_secret, 'sha256'), 'hex')
      ELSE NULL
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION razorpay_secret_fingerprints() FROM PUBLIC;
REVOKE ALL ON FUNCTION razorpay_secret_fingerprints() FROM anon, authenticated;

COMMENT ON FUNCTION razorpay_secret_fingerprints() IS
  'W4.9: one-way HMAC fingerprints of the Vault Razorpay secrets, so a rotation can be proven complete without exposing them. Service-role only. Compare against scripts/razorpay/check-key-sync.mjs.';

-- Verify:
--   SELECT * FROM razorpay_secret_fingerprints();
--   pnpm razorpay:check
