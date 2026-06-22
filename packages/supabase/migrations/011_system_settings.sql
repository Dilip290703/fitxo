-- Migration 011: system_settings (Admin panel #19)
-- Run in Supabase SQL Editor after migration 010. Idempotent — safe to re-run.
--
-- Replaces the mock Admin > System Settings screen (toast-only, persisted nothing)
-- with a real singleton config row. CLAUDE.md requires the commission rate and the
-- try-window duration to be config values, not hardcoded constants — this is their
-- source of truth. The customer try-timer and the (future) Razorpay payout math read
-- from here; admin writes via the service-role client.
--
-- try-window is stored in MINUTES (not hours) to survive the pending doorstep pivot
-- from 24h at-home (1440) to ~5–7 min on-the-spot.

-- ---- Singleton settings row -----------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  id                  SMALLINT      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- General
  site_name           VARCHAR       NOT NULL DEFAULT 'Fitzo',
  contact_email       VARCHAR       NOT NULL DEFAULT 'support@fitzo.in',
  support_phone       VARCHAR       NOT NULL DEFAULT '',
  -- Delivery & try-on
  try_window_minutes  INTEGER       NOT NULL DEFAULT 1440 CHECK (try_window_minutes >= 1),
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 49   CHECK (delivery_fee >= 0),
  free_delivery_above NUMERIC(10,2) NOT NULL DEFAULT 999  CHECK (free_delivery_above >= 0),
  -- Commission (percent)
  commission_rate     NUMERIC(5,2)  NOT NULL DEFAULT 15   CHECK (commission_rate >= 0 AND commission_rate <= 100),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by          UUID          REFERENCES users(id) ON DELETE SET NULL
);

-- Seed the single row (no-op if it already exists).
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---- RLS -------------------------------------------------------------------
-- Any signed-in user may READ (store Earnings needs commission_rate, the customer
-- try-timer needs try_window_minutes); only admins may WRITE.
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_settings_select ON system_settings;
CREATE POLICY system_settings_select ON system_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS system_settings_admin_all ON system_settings;
CREATE POLICY system_settings_admin_all ON system_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---- updated_at trigger (reuses the shared function from schema.sql) --------
DROP TRIGGER IF EXISTS set_updated_at_system_settings ON system_settings;
CREATE TRIGGER set_updated_at_system_settings
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
