-- Migration 020: agent (rider) payouts ledger + realtime tuning for agent job alerts
-- Run in Supabase SQL Editor after migration 019.
--
-- Two unrelated-but-small things bundled (both idempotent):
--   1. `agent_payouts` — a per-rider, per-order payout ledger so Admin can settle
--      rider earnings (Σ delivery_fee on completed deliveries) the same way the
--      `payouts` table settles store revenue. Mirrors `payouts` 1:1 (002_try_loop).
--   2. REPLICA IDENTITY FULL on `deliveries` so the agent panel's live "new job"
--      pop-up fires: admin assigns by UPDATEing deliveries.rider_id (NULL -> rider).
--      Realtime needs the full old+new image to evaluate RLS on that transition
--      (the OLD row wasn't visible to the rider; the NEW one is). `deliveries` is
--      already in the supabase_realtime publication (migration 014).
-- ============================================================

-- 1. agent_payouts ledger ------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_payouts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id   UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount     DECIMAL(10, 2) NOT NULL,
  status     payout_status NOT NULL DEFAULT 'paid',
  paid_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rider_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_rider_id ON agent_payouts(rider_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_order_id ON agent_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_status   ON agent_payouts(status);

ALTER TABLE agent_payouts ENABLE ROW LEVEL SECURITY;

-- Admin manages everything; a rider may read only their own payout rows.
DROP POLICY IF EXISTS agent_payouts_admin_all ON agent_payouts;
CREATE POLICY agent_payouts_admin_all ON agent_payouts FOR ALL USING (is_admin());

DROP POLICY IF EXISTS agent_payouts_select_rider ON agent_payouts;
CREATE POLICY agent_payouts_select_rider ON agent_payouts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM riders r
    WHERE r.id = agent_payouts.rider_id AND r.user_id = auth.uid()
  )
);

-- 2. Realtime: full row image so RLS can route the assign-UPDATE to the rider ---
ALTER TABLE deliveries REPLICA IDENTITY FULL;
