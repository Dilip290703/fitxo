-- Migration 012: complaints / support tickets (Admin panel #13)
-- Run in Supabase SQL Editor after migration 011. Idempotent.
--
-- Backs Admin > Complaints & Support. Customers (or staff) file complaints; admins
-- triage, respond, and resolve. Customer-side submission UI is separate (customer panel).

DO $$ BEGIN
  CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE complaint_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS complaints (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id)  ON DELETE SET NULL,
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  subject        VARCHAR(255) NOT NULL,
  message        TEXT NOT NULL,
  status         complaint_status   NOT NULL DEFAULT 'open',
  priority       complaint_priority NOT NULL DEFAULT 'normal',
  admin_response TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_status     ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

-- ---- RLS: admins manage all; a user can read + file their own --------------
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS complaints_admin_all ON complaints;
CREATE POLICY complaints_admin_all ON complaints FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS complaints_select_own ON complaints;
CREATE POLICY complaints_select_own ON complaints FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS complaints_insert_own ON complaints;
CREATE POLICY complaints_insert_own ON complaints FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- updated_at trigger (reuses the shared function) -----------------------
DROP TRIGGER IF EXISTS set_updated_at_complaints ON complaints;
CREATE TRIGGER set_updated_at_complaints
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
