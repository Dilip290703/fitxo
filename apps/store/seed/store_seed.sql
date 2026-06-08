-- ============================================================
-- Fitzo Store panel — dev seed: one store + one store_manager
-- ============================================================
-- Store login has no signup (accounts are admin-provisioned), so to test the
-- Store panel you need a seeded store manager. Two steps:
--
--   1. Supabase Dashboard → Authentication → Users → "Add user"
--        Email:    store@fitzo.in
--        Password: <pick one you'll remember>
--        ✅ Auto Confirm User   (confirm-email is off in dev anyway)
--
--   2. Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--      It looks the auth user up by email and wires up the store rows.
--
-- Re-runnable (idempotent). To use a different email, change it in BOTH places
-- below.
-- ============================================================

DO $$
DECLARE
  v_email   TEXT := 'store@fitzo.in';   -- must match the auth user from step 1
  v_user_id UUID;
  v_store_id UUID;
BEGIN
  -- 1. Locate the auth user created in the dashboard.
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'No auth user with email %. Create it in Authentication → Users first (step 1).',
      v_email;
  END IF;

  -- 2. Upsert the store.
  INSERT INTO stores (name, slug, contact_email, city, is_active, is_verified)
  VALUES ('Fitzo Test Store', 'fitzo-test-store', v_email, 'Bengaluru', true, true)
  ON CONFLICT (slug) DO UPDATE SET is_active = true
  RETURNING id INTO v_store_id;

  -- 3. Upsert the app-level user row with the store_manager role.
  INSERT INTO users (id, email, name, role, is_active, is_blocked)
  VALUES (v_user_id, v_email, 'Test Store Manager', 'store_manager', true, false)
  ON CONFLICT (id) DO UPDATE
    SET role = 'store_manager', is_active = true;

  -- 4. Link the user to the store.
  INSERT INTO store_managers (user_id, store_id, is_active)
  VALUES (v_user_id, v_store_id, true)
  ON CONFLICT (user_id, store_id) DO UPDATE SET is_active = true;

  RAISE NOTICE 'Seeded store % (manager %) — log in at :3003/login as %',
    v_store_id, v_user_id, v_email;
END $$;
