-- 059_rebrand_fitxo.sql
-- FITZO → FITXO rebrand, database side.
--
-- The code rename (branch feat/rename-fitxo) cannot touch values that live in the
-- database. Three of them do:
--   1. system_settings.site_name / contact_email — seeded as 'Fitzo' / 'support@fitzo.in'
--      by 011, still those values on dev today.
--   2. The column DEFAULTs from 011, so a fresh bootstrap doesn't reintroduce the old brand.
--   3. generate_order_number() — emits the 'FTZ-' prefix on every new order.
--
-- Existing orders KEEP their FTZ- numbers. Renumbering them would break every
-- customer receipt, rider job card and Razorpay note that already references them.
-- Only orders created after this migration get FTX-.
--
-- NOT touched on purpose:
--   - packages/supabase/migrations/057: the HMAC salt 'fitzo-rotation-check' is an
--     input to razorpay_secret_fingerprints(). Changing it changes every stored
--     fingerprint and would make the rotation runbook report a false mismatch.
--   - Earlier migrations and baselines/prod_bootstrap.sql: history, already applied.

-- ---- 1. Column defaults (affects future bootstraps only) -------------------
ALTER TABLE system_settings
  ALTER COLUMN site_name     SET DEFAULT 'Fitxo',
  ALTER COLUMN contact_email SET DEFAULT 'support@fitxo.co.in';

-- ---- 2. The live singleton row ---------------------------------------------
-- Only rewrite values that are still the old brand, so a support address someone
-- has already customised by hand is left alone.
UPDATE system_settings
   SET site_name     = 'Fitxo',
       updated_at    = NOW()
 WHERE id = 1
   AND site_name = 'Fitzo';

UPDATE system_settings
   SET contact_email = 'support@fitxo.co.in',
       updated_at    = NOW()
 WHERE id = 1
   AND contact_email = 'support@fitzo.in';

-- ---- 3. Order number prefix -------------------------------------------------
-- Same sequence, same format, new prefix. The sequence is deliberately NOT reset:
-- FTX numbering continues where FTZ left off so no two orders can ever collide.
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'FTX-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
