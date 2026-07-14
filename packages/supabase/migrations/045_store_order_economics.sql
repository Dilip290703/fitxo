-- Migration 045: store_order_economics() — per-STORE slice of the money truth (money plan M2, part 2)
-- Run in Supabase SQL Editor after migration 044. Idempotent.
-- ⚠️ Renumbering note: the launch plan reserved 045 for M3 (commission stamping)
--    and 046 for M4 (tax provisions); those shift to 046 and 047.
--
-- WHY: 044's order_economics view is per-ORDER, but store payables and store
-- Earnings need per-(store, order) numbers — an order can hold items from
-- several stores (until G1's single-store cart ships, and forever in history).
--
-- WHY A FUNCTION, NOT A VIEW: kept_paid_gross needs to read `payments`, and a
-- security_invoker view would apply the CALLER's RLS — store managers cannot
-- (and must not) SELECT customer payment rows, so for them the view would
-- silently report every kept item as unpaid. This SECURITY DEFINER function is
-- the house pattern instead (like 031's bulk mark-ready): it bypasses RLS
-- internally and gates explicitly —
--   p_store_id = NULL   → all stores; admin only (Admin > Store Payouts).
--   p_store_id given    → that store; its manager or an admin (store Earnings).
--
-- SEMANTICS: identical to 044 (one truth, two granularities — keep in sync):
--   kept_paid_gross = kept items with a live SUCCESS payment (refund-aware),
--   commission      = ROUND(kept_paid_gross × rate/100, 2)   [live settings
--                     rate until M3 stamps it at settlement],
--   store_net       = kept_paid_gross − commission (additive complement).
-- Only (store, order) groups with kept items are returned.

CREATE OR REPLACE FUNCTION store_order_economics(p_store_id UUID DEFAULT NULL)
RETURNS TABLE (
  store_id        UUID,
  order_id        UUID,
  kept_gross      NUMERIC,
  kept_paid_gross NUMERIC,
  commission_rate NUMERIC,
  commission      NUMERIC,
  store_net       NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  IF p_store_id IS NULL THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'not authorised';
    END IF;
  ELSIF NOT (is_admin() OR is_store_manager_of(p_store_id)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  v_rate := COALESCE((SELECT s.commission_rate FROM system_settings s WHERE s.id = 1), 15)::NUMERIC;

  RETURN QUERY
  SELECT
    g.sid,
    g.oid,
    g.kg,
    g.kpg,
    v_rate,
    ROUND(g.kpg * v_rate / 100.0, 2),
    ROUND(g.kpg - ROUND(g.kpg * v_rate / 100.0, 2), 2)
  FROM (
    SELECT
      pr.store_id AS sid,
      oi.order_id AS oid,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kg,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
        WHERE oi.decision = 'keep'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_item_id = oi.id AND p.status = 'success')
      ), 0), 2) AS kpg
    FROM order_items oi
    JOIN products pr ON pr.id = oi.product_id
    WHERE p_store_id IS NULL OR pr.store_id = p_store_id
    GROUP BY pr.store_id, oi.order_id
  ) g
  WHERE g.kg > 0;
END;
$$;

REVOKE ALL ON FUNCTION store_order_economics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_order_economics(UUID) TO authenticated;
