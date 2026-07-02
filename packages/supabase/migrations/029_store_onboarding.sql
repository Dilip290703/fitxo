-- Migration 029: real store onboarding (self-serve signup → wizard → admin approval)
-- Run once in the Supabase SQL Editor after migration 028. Idempotent.
--
-- WHAT THIS ENABLES (Store panel rework, week of 2026-07-02):
--   * A store manager can SIGN UP themselves (no more hand-created accounts). Signup
--     auto-provisions a DRAFT store + the store_managers link via handle_new_user.
--   * The store fills an onboarding wizard (business + pickup + bank/UPI + GST/PAN),
--     then SUBMITS for review. Admin approves → store goes live (is_active/is_verified).
--   * Sensitive KYC/bank details live in a SEPARATE private table (store_business_details),
--     NOT on `stores`, because `stores` is world-readable (customer storefront reads it).
--
-- SECURITY: same guarded SECURITY DEFINER pattern as 007/008 — the store fills its own
-- DRAFT, but can NEVER self-set is_verified / is_active / onboarding_status='approved'.
-- Only admin (service-role, stores_admin_all) flips those.

-- ============================================================
-- 1. Onboarding status enum + new columns on `stores`
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_onboarding_status') THEN
    CREATE TYPE store_onboarding_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
  END IF;
END $$;

ALTER TABLE stores ADD COLUMN IF NOT EXISTS category          VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_status store_onboarding_status NOT NULL DEFAULT 'draft';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;

-- Back-fill: any store that existed before onboarding (seeded/verified test stores)
-- is treated as already approved so it keeps working and isn't locked out of the panel.
UPDATE stores SET onboarding_status = 'approved'
WHERE onboarding_status = 'draft' AND (is_verified = true OR is_active = true);

-- ============================================================
-- 2. Private business/KYC/bank details (never world-readable)
-- ============================================================
CREATE TABLE IF NOT EXISTS store_business_details (
  store_id            UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  legal_name          VARCHAR(255),
  entity_type         VARCHAR(50),   -- individual | proprietorship | partnership | pvt_ltd | llp
  gst_number          VARCHAR(15),
  pan_number          VARCHAR(10),
  bank_account_name   VARCHAR(255),
  bank_account_number VARCHAR(30),
  bank_ifsc           VARCHAR(11),
  upi_id              VARCHAR(100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE store_business_details ENABLE ROW LEVEL SECURITY;

-- Read: only the store's own manager or an admin. NEVER public / anon.
DROP POLICY IF EXISTS store_business_details_select ON store_business_details;
CREATE POLICY store_business_details_select ON store_business_details
  FOR SELECT USING (is_store_manager_of(store_id) OR is_admin());

-- Admin full access (service-role + admin session). Store-side writes go through the
-- SECURITY DEFINER RPC below, so there is intentionally NO store INSERT/UPDATE policy.
DROP POLICY IF EXISTS store_business_details_admin_all ON store_business_details;
CREATE POLICY store_business_details_admin_all ON store_business_details
  FOR ALL USING (is_admin());

DROP TRIGGER IF EXISTS set_store_business_details_updated_at ON store_business_details;
CREATE TRIGGER set_store_business_details_updated_at
  BEFORE UPDATE ON store_business_details
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Back-fill an (empty) details row for every existing store.
INSERT INTO store_business_details (store_id)
SELECT id FROM stores
ON CONFLICT (store_id) DO NOTHING;

-- ============================================================
-- 3. A manager must be able to read their OWN store even while it's a
--    draft (is_active = false). The base stores_select hides inactive
--    stores from everyone but admin, which would break login + the gate.
-- ============================================================
DROP POLICY IF EXISTS stores_manager_select ON stores;
CREATE POLICY stores_manager_select ON stores
  FOR SELECT USING (is_store_manager_of(id));

-- ============================================================
-- 4. Auto-provision a DRAFT store on store-manager signup
--    (extends the migration-015 handle_new_user trigger).
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role       user_role;
  v_name       text;
  v_store_name text;
  v_slug       text;
  v_store_id   uuid;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    ''
  );

  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  IF v_role = 'rider' THEN
    INSERT INTO public.riders (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF v_role = 'store_manager' THEN
    -- Only provision a fresh store if this user isn't already linked to one
    -- (guards against the trigger re-running / an admin-invited manager).
    IF NOT EXISTS (SELECT 1 FROM public.store_managers WHERE user_id = NEW.id) THEN
      v_store_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'store_name', ''), 'My Store');

      -- URL-safe slug from the store name + a short unique suffix to avoid collisions.
      v_slug := trim(both '-' from regexp_replace(lower(v_store_name), '[^a-z0-9]+', '-', 'g'));
      IF v_slug = '' THEN v_slug := 'store'; END IF;
      v_slug := v_slug || '-' || substr(md5(NEW.id::text), 1, 6);

      INSERT INTO public.stores (name, slug, contact_email, onboarding_status, is_active, is_verified)
      VALUES (v_store_name, v_slug, NEW.email, 'draft', false, false)
      RETURNING id INTO v_store_id;

      INSERT INTO public.store_managers (user_id, store_id)
      VALUES (NEW.id, v_store_id);

      INSERT INTO public.store_business_details (store_id)
      VALUES (v_store_id)
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- Trigger itself is unchanged (created in 015) but re-assert it idempotently.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 5. Guarded store-side writes (fill draft + submit for review)
-- ============================================================

-- Save/patch the onboarding draft: safe `stores` columns + private business details in
-- one call. Allowed only while draft or rejected (locked once submitted/approved).
-- Never touches slug / is_active / is_verified / onboarding_status.
CREATE OR REPLACE FUNCTION save_store_onboarding(
  p_store_id            UUID,
  p_name                TEXT,
  p_category            TEXT,
  p_description         TEXT,
  p_contact_email       TEXT,
  p_contact_phone       TEXT,
  p_address             TEXT,
  p_city                TEXT,
  p_pincode             TEXT,
  p_legal_name          TEXT,
  p_entity_type         TEXT,
  p_gst_number          TEXT,
  p_pan_number          TEXT,
  p_bank_account_name   TEXT,
  p_bank_account_number TEXT,
  p_bank_ifsc           TEXT,
  p_upi_id              TEXT
) RETURNS VOID AS $$
DECLARE
  v_status store_onboarding_status;
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to update this store';
  END IF;

  SELECT onboarding_status INTO v_status FROM stores WHERE id = p_store_id;
  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Onboarding is locked while under review or approved';
  END IF;

  UPDATE stores SET
    name          = COALESCE(NULLIF(p_name, ''), name),
    category      = p_category,
    description   = p_description,
    contact_email = p_contact_email,
    contact_phone = p_contact_phone,
    address       = p_address,
    city          = p_city,
    pincode       = p_pincode,
    updated_at    = NOW()
  WHERE id = p_store_id;

  INSERT INTO store_business_details AS d (
    store_id, legal_name, entity_type, gst_number, pan_number,
    bank_account_name, bank_account_number, bank_ifsc, upi_id
  ) VALUES (
    p_store_id, p_legal_name, p_entity_type, upper(NULLIF(p_gst_number, '')), upper(NULLIF(p_pan_number, '')),
    p_bank_account_name, p_bank_account_number, upper(NULLIF(p_bank_ifsc, '')), p_upi_id
  )
  ON CONFLICT (store_id) DO UPDATE SET
    legal_name          = EXCLUDED.legal_name,
    entity_type         = EXCLUDED.entity_type,
    gst_number          = EXCLUDED.gst_number,
    pan_number          = EXCLUDED.pan_number,
    bank_account_name   = EXCLUDED.bank_account_name,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc           = EXCLUDED.bank_ifsc,
    upi_id              = EXCLUDED.upi_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_store_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Submit the draft for admin review. Validates the essential fields server-side so a
-- half-filled store can't reach the review queue. Moves draft/rejected → submitted.
CREATE OR REPLACE FUNCTION submit_store_onboarding(p_store_id UUID)
RETURNS VOID AS $$
DECLARE
  v_status store_onboarding_status;
  v_missing text[] := '{}';
  s stores%ROWTYPE;
  d store_business_details%ROWTYPE;
BEGIN
  IF NOT is_store_manager_of(p_store_id) THEN
    RAISE EXCEPTION 'Not authorised to submit this store';
  END IF;

  SELECT * INTO s FROM stores WHERE id = p_store_id;
  v_status := s.onboarding_status;
  IF v_status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'This store is already % ', v_status;
  END IF;

  SELECT * INTO d FROM store_business_details WHERE store_id = p_store_id;

  -- Essential fields for a reviewable application.
  IF COALESCE(NULLIF(s.category, ''), NULL)      IS NULL THEN v_missing := v_missing || 'category'; END IF;
  IF COALESCE(NULLIF(s.contact_phone, ''), NULL) IS NULL THEN v_missing := v_missing || 'contact phone'; END IF;
  IF COALESCE(NULLIF(s.address, ''), NULL)       IS NULL THEN v_missing := v_missing || 'pickup address'; END IF;
  IF COALESCE(NULLIF(s.city, ''), NULL)          IS NULL THEN v_missing := v_missing || 'city'; END IF;
  IF COALESCE(NULLIF(s.pincode, ''), NULL)       IS NULL THEN v_missing := v_missing || 'pincode'; END IF;
  IF d.legal_name  IS NULL OR d.legal_name  = '' THEN v_missing := v_missing || 'legal name'; END IF;
  IF d.entity_type IS NULL OR d.entity_type = '' THEN v_missing := v_missing || 'entity type'; END IF;
  IF d.pan_number  IS NULL OR d.pan_number  = '' THEN v_missing := v_missing || 'PAN'; END IF;
  -- A payout target: either full bank triplet or a UPI id.
  IF (d.upi_id IS NULL OR d.upi_id = '')
     AND (d.bank_account_number IS NULL OR d.bank_account_number = ''
          OR d.bank_ifsc IS NULL OR d.bank_ifsc = '') THEN
    v_missing := v_missing || 'payout details (bank or UPI)';
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Please complete: %', array_to_string(v_missing, ', ');
  END IF;

  UPDATE stores SET
    onboarding_status = 'submitted',
    submitted_at      = NOW(),
    rejection_reason  = NULL,
    updated_at        = NOW()
  WHERE id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_store_onboarding(UUID) TO authenticated;

-- Verify afterwards:
--   SELECT id, name, slug, onboarding_status, is_active, is_verified FROM stores;
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'store_business_details';
