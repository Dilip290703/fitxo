-- Migration 044: order_economics — ONE source of truth for per-order money (money plan M2)
-- Run in Supabase SQL Editor after migration 043. Idempotent.
--
-- WHY: the money math lives in three hand-mirrored copies (admin Money card,
-- payouts/compute.ts, store lib/earnings.ts) with "must match" comments, none
-- of them refund-aware and none seeing gateway fees. This view computes it
-- once, in the DB, so every screen reads identical rupees. Consumers are
-- repointed in two steps: Money card now (this task), payout computes /
-- store Earnings / dashboard / analytics next (W2.7) — then the copies die.
--
-- REFUND SEMANTICS (owner decision, 2026-07-14 — "accounting-only"):
-- a refund flips the payments row (041) but the item stays decision='keep'.
-- Revenue therefore keys on PAYMENTS, not decisions:
--   • an item counts as revenue ("kept_paid") only while it has a SUCCESS
--     payment — refunding drops it from kept_paid_gross, commission and
--     store_net automatically, with no item-state rewrite.
--   • gateway fees are NOT returned by Razorpay on refund → gateway_cost sums
--     fees over success AND refunded rows (sunk cost).
--   • the delivery fee travels with its payment: refunding the fee-carrying
--     payment removes it from delivery_fee_collected.
--
-- COMMISSION: still the live system_settings rate — M3 (045) will stamp the
-- rate/amount at settlement time and this view will switch to the stamped
-- values. store_net = kept_paid_gross − commission (additive complement, the
-- Money card's existing formula; ≤1 paisa from the old independent rounding).
--
-- RIDER COST: orders.rider_fee counts only once a delivery is COMPLETED —
-- margin never books a rider cost that was never earned.
--
-- SECURITY: security_invoker — the view runs with the CALLER's RLS. Admins
-- see everything (is_admin policies on the underlying tables); a customer
-- could at most see their own orders' rows; anon sees nothing. No RLS
-- widening, no SECURITY DEFINER.

CREATE OR REPLACE VIEW order_economics
WITH (security_invoker = on) AS
WITH cfg AS (
  -- Scalar subquery so cfg ALWAYS has one row — a missing settings singleton
  -- must not blank the whole view via the CROSS JOIN.
  SELECT COALESCE((SELECT commission_rate FROM system_settings WHERE id = 1), 15)::numeric AS rate
),
pay AS (
  SELECT
    p.order_id,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS captured_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0), 2)              AS refunded_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'success'), 0), 2)               AS net_captured,
    ROUND(COALESCE(SUM(p.delivery_fee_component) FILTER (WHERE p.status = 'success'), 0), 2) AS delivery_fee_collected,
    -- Sunk cost: Razorpay keeps its fee on refunds, so refunded rows still count.
    ROUND(COALESCE(SUM(p.gateway_fee) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS gateway_cost,
    BOOL_OR(p.status IN ('success','refunded') AND p.gateway_fee IS NULL)                   AS gateway_cost_incomplete
  FROM payments p
  GROUP BY p.order_id
),
items AS (
  SELECT
    oi.order_id,
    COUNT(*)                                              AS item_count,
    COUNT(*) FILTER (WHERE oi.decision = 'keep')          AS kept_count,
    COUNT(*) FILTER (WHERE oi.decision = 'return')        AS returned_count,
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kept_gross,
    -- Revenue-kept: keep decision AND a live success payment (see header).
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
      WHERE oi.decision = 'keep'
        AND EXISTS (SELECT 1 FROM payments p
                     WHERE p.order_item_id = oi.id AND p.status = 'success')
    ), 0), 2) AS kept_paid_gross
  FROM order_items oi
  GROUP BY oi.order_id
),
del AS (
  SELECT d.order_id, BOOL_OR(d.status = 'completed') AS delivery_completed
  FROM deliveries d
  GROUP BY d.order_id
),
sp AS (
  SELECT order_id, ROUND(COALESCE(SUM(amount), 0), 2) AS store_paid
  FROM payouts GROUP BY order_id
),
rp AS (
  SELECT order_id, ROUND(COALESCE(SUM(amount), 0), 2) AS rider_paid
  FROM agent_payouts GROUP BY order_id
)
SELECT
  o.id                                        AS order_id,
  o.order_number,
  o.user_id,
  o.created_at,
  o.status,
  o.payment_status,
  o.subtotal,
  o.delivery_fee                              AS delivery_fee_charged,
  COALESCE(o.rider_fee, 0)                    AS rider_fee,
  COALESCE(i.item_count, 0)                   AS item_count,
  COALESCE(i.kept_count, 0)                   AS kept_count,
  COALESCE(i.returned_count, 0)               AS returned_count,
  COALESCE(p.captured_total, 0)               AS captured_total,
  COALESCE(p.refunded_total, 0)               AS refunded_total,
  COALESCE(p.net_captured, 0)                 AS net_captured,
  COALESCE(p.delivery_fee_collected, 0)       AS delivery_fee_collected,
  COALESCE(p.gateway_cost, 0)                 AS gateway_cost,
  COALESCE(p.gateway_cost_incomplete, FALSE)  AS gateway_cost_incomplete,
  COALESCE(i.kept_gross, 0)                   AS kept_gross,
  COALESCE(i.kept_paid_gross, 0)              AS kept_paid_gross,
  -- kept but no live success payment (unpaid, or its payment was refunded)
  ROUND(COALESCE(i.kept_gross, 0) - COALESCE(i.kept_paid_gross, 0), 2) AS kept_unpaid_gross,
  cfg.rate                                    AS commission_rate,
  ROUND(COALESCE(i.kept_paid_gross, 0) * cfg.rate / 100.0, 2)          AS commission,
  ROUND(COALESCE(i.kept_paid_gross, 0)
        - ROUND(COALESCE(i.kept_paid_gross, 0) * cfg.rate / 100.0, 2), 2) AS store_net,
  COALESCE(d.delivery_completed, FALSE)       AS delivery_completed,
  CASE WHEN COALESCE(d.delivery_completed, FALSE)
       THEN COALESCE(o.rider_fee, 0) ELSE 0 END AS rider_cost,
  -- Contribution margin, pre-tax: what Fitzo actually made on this order.
  ROUND(
    ROUND(COALESCE(i.kept_paid_gross, 0) * cfg.rate / 100.0, 2)
    + COALESCE(p.delivery_fee_collected, 0)
    - CASE WHEN COALESCE(d.delivery_completed, FALSE)
           THEN COALESCE(o.rider_fee, 0) ELSE 0 END
    - COALESCE(p.gateway_cost, 0)
  , 2)                                        AS margin,
  COALESCE(s.store_paid, 0)                   AS store_paid,
  COALESCE(r.rider_paid, 0)                   AS rider_paid
FROM orders o
CROSS JOIN cfg
LEFT JOIN pay   p ON p.order_id = o.id
LEFT JOIN items i ON i.order_id = o.id
LEFT JOIN del   d ON d.order_id = o.id
LEFT JOIN sp    s ON s.order_id = o.id
LEFT JOIN rp    r ON r.order_id = o.id;

COMMENT ON VIEW order_economics IS
  'Per-order money truth (money plan M2). Refund-aware: revenue keys on live success payments, not item decisions. margin = commission + delivery_fee_collected - rider_cost - gateway_cost. Read by admin Money card (this migration) and, from W2.7, payout computes / store Earnings / dashboard / analytics.';

-- Callers bring their own RLS (security_invoker); anon gets nothing.
REVOKE ALL ON order_economics FROM PUBLIC;
GRANT SELECT ON order_economics TO authenticated;
