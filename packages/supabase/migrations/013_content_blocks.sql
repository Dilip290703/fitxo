-- Migration 013: content_blocks (Admin panel #15 — CMS)
-- Run in Supabase SQL Editor after migration 012. Idempotent.
--
-- Backs Admin > Content Management. Editable content the customer site can read
-- (banners, static pages, FAQs, announcements). Published blocks are world-readable;
-- only admins write.

DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('page', 'banner', 'faq', 'announcement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS content_blocks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(100) UNIQUE NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  type         content_type NOT NULL DEFAULT 'page',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_type ON content_blocks(type);

-- ---- RLS: anyone reads published; admins manage --------------------------
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_blocks_public_read ON content_blocks;
CREATE POLICY content_blocks_public_read ON content_blocks FOR SELECT USING (is_published OR is_admin());

DROP POLICY IF EXISTS content_blocks_admin_all ON content_blocks;
CREATE POLICY content_blocks_admin_all ON content_blocks FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---- updated_at trigger (reuses the shared function) ---------------------
DROP TRIGGER IF EXISTS set_updated_at_content_blocks ON content_blocks;
CREATE TRIGGER set_updated_at_content_blocks
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
