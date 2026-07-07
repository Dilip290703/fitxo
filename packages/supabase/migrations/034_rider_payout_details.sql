-- Migration 034: agent rework Phase 3 — rider payout details (bank/UPI + PAN).
-- Run in the Supabase SQL Editor after migration 033. Idempotent.
--
-- WHY (docs/AGENT_PANEL_AUDIT.md §B2): Admin > Agent Payouts settles a ledger,
-- but there was NO destination to pay into — no rider bank/UPI anywhere.
-- Mirrors the store panel's `store_business_details` pattern (migration 029):
--   • sensitive data in its own PRIVATE table, never on world-readable rows
--   • RLS: the rider themself or an admin — nobody else, never anon
--   • rider-side writes go through ONE guarded SECURITY DEFINER RPC that
--     validates formats in-DB; there is deliberately NO rider INSERT/UPDATE
--     policy on the table.
-- Unlike stores there is no submit/approve loop — payout details just need to
-- exist (validated) for admin to pay against; verification stays the rider-
-- account gate (riders.is_verified).
-- ============================================================

CREATE TABLE IF NOT EXISTS rider_payout_details (
  rider_id            UUID PRIMARY KEY REFERENCES riders(id) ON DELETE CASCADE,
  legal_name          VARCHAR(255),  -- name as on the bank account / PAN card
  pan_number          VARCHAR(10),
  payout_method       VARCHAR(10) NOT NULL DEFAULT 'upi', -- 'upi' | 'bank'
  bank_account_name   VARCHAR(255),
  bank_account_number VARCHAR(30),
  bank_ifsc           VARCHAR(11),
  upi_id              VARCHAR(100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rider_payout_details ENABLE ROW LEVEL SECURITY;

-- Read: the rider's own row or an admin. NEVER public / anon.
DROP POLICY IF EXISTS rider_payout_details_select ON rider_payout_details;
CREATE POLICY rider_payout_details_select ON rider_payout_details
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM riders r
            WHERE r.id = rider_payout_details.rider_id AND r.user_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS rider_payout_details_admin_all ON rider_payout_details;
CREATE POLICY rider_payout_details_admin_all ON rider_payout_details
  FOR ALL USING (is_admin());

DROP TRIGGER IF EXISTS set_rider_payout_details_updated_at ON rider_payout_details;
CREATE TRIGGER set_rider_payout_details_updated_at
  BEFORE UPDATE ON rider_payout_details
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
-- Guarded save. Validates in-DB (there's no review step to catch bad data
-- later): PAN format, and a complete payout target for the chosen method.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION save_rider_payout_details(
  p_legal_name          TEXT,
  p_pan_number          TEXT,
  p_payout_method       TEXT,
  p_bank_account_name   TEXT,
  p_bank_account_number TEXT,
  p_bank_ifsc           TEXT,
  p_upi_id              TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rider UUID;
  v_pan   TEXT := upper(btrim(coalesce(p_pan_number, '')));
  v_ifsc  TEXT := upper(btrim(coalesce(p_bank_ifsc, '')));
  v_upi   TEXT := lower(btrim(coalesce(p_upi_id, '')));
  v_acct  TEXT := regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g');
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid();
  IF v_rider IS NULL THEN RAISE EXCEPTION 'not a rider'; END IF;

  IF length(btrim(coalesce(p_legal_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter your full name as on the bank account / PAN card';
  END IF;
  IF v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    RAISE EXCEPTION 'PAN must look like ABCDE1234F';
  END IF;

  IF p_payout_method = 'upi' THEN
    IF v_upi !~ '^[a-z0-9.\-_]{2,}@[a-z][a-z0-9]{1,}$' THEN
      RAISE EXCEPTION 'Enter a valid UPI ID like name@bank';
    END IF;
  ELSIF p_payout_method = 'bank' THEN
    IF length(btrim(coalesce(p_bank_account_name, ''))) < 3 THEN
      RAISE EXCEPTION 'Enter the account holder name';
    END IF;
    IF v_acct !~ '^[0-9]{9,18}$' THEN
      RAISE EXCEPTION 'Account number must be 9–18 digits';
    END IF;
    IF v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' THEN
      RAISE EXCEPTION 'IFSC must look like HDFC0001234';
    END IF;
  ELSE
    RAISE EXCEPTION 'Choose UPI or bank transfer';
  END IF;

  INSERT INTO rider_payout_details (
    rider_id, legal_name, pan_number, payout_method,
    bank_account_name, bank_account_number, bank_ifsc, upi_id
  ) VALUES (
    v_rider, btrim(p_legal_name), v_pan, p_payout_method,
    NULLIF(btrim(coalesce(p_bank_account_name, '')), ''),
    NULLIF(v_acct, ''), NULLIF(v_ifsc, ''), NULLIF(v_upi, '')
  )
  ON CONFLICT (rider_id) DO UPDATE SET
    legal_name          = EXCLUDED.legal_name,
    pan_number          = EXCLUDED.pan_number,
    payout_method       = EXCLUDED.payout_method,
    bank_account_name   = EXCLUDED.bank_account_name,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc           = EXCLUDED.bank_ifsc,
    upi_id              = EXCLUDED.upi_id;
END; $$;

REVOKE ALL ON FUNCTION save_rider_payout_details(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_rider_payout_details(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
