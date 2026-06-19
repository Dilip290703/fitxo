-- Migration 010: restore RLS policies for the try-loop tables.
-- Run in the Supabase SQL Editor.
--
-- WHY: migration 002 created try_sessions / returns / payments / payouts AND their
-- RLS policies, but in the live DB the TABLES exist with RLS enabled while the
-- POLICIES are missing (e.g. `SELECT ... FROM pg_policies WHERE tablename='try_sessions'`
-- returns nothing). RLS-enabled + no-policy = deny-all, which is why placing an order
-- fails with "new row violates row-level security policy for table try_sessions".
--
-- This re-creates exactly the policies from migration 002. DROP IF EXISTS first makes
-- it idempotent and safe to run even where some policies already exist.
-- Depends on helper functions is_admin() and is_store_manager_of() (from schema.sql).

-- ── try_sessions ──────────────────────────────────────────
DROP POLICY IF EXISTS try_sessions_select    ON try_sessions;
DROP POLICY IF EXISTS try_sessions_insert    ON try_sessions;
DROP POLICY IF EXISTS try_sessions_admin_all ON try_sessions;

CREATE POLICY try_sessions_select ON try_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR is_admin())
  ));
CREATE POLICY try_sessions_insert ON try_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY try_sessions_admin_all ON try_sessions FOR ALL USING (is_admin());

-- ── returns ───────────────────────────────────────────────
DROP POLICY IF EXISTS returns_select    ON returns;
DROP POLICY IF EXISTS returns_insert    ON returns;
DROP POLICY IF EXISTS returns_update    ON returns;
DROP POLICY IF EXISTS returns_admin_all ON returns;

CREATE POLICY returns_select ON returns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR is_admin())
  ));
CREATE POLICY returns_insert ON returns FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY returns_update ON returns FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR is_admin()
  );
CREATE POLICY returns_admin_all ON returns FOR ALL USING (is_admin());

-- ── payments ──────────────────────────────────────────────
DROP POLICY IF EXISTS payments_select    ON payments;
DROP POLICY IF EXISTS payments_insert    ON payments;
DROP POLICY IF EXISTS payments_admin_all ON payments;

CREATE POLICY payments_select ON payments FOR SELECT
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY payments_admin_all ON payments FOR ALL USING (is_admin());

-- ── payouts ───────────────────────────────────────────────
DROP POLICY IF EXISTS payouts_select    ON payouts;
DROP POLICY IF EXISTS payouts_admin_all ON payouts;

CREATE POLICY payouts_select ON payouts FOR SELECT
  USING (is_admin() OR is_store_manager_of(store_id));
CREATE POLICY payouts_admin_all ON payouts FOR ALL USING (is_admin());

-- Verify afterwards (should list policies for all four tables):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('try_sessions','returns','payments','payouts')
--   ORDER BY tablename, policyname;
