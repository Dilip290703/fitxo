-- Migration 046: commission stamped at settlement + per-store rate (money plan M3)
-- Run in Supabase SQL Editor after migration 045. Idempotent.
-- (Plan renumbering: this was "045/M3" in the launch PDF; 045 became the
--  store_order_economics RPC. Tax provisions M4 → 047.)
--
-- WHY: commission was computed at DISPLAY time from the live
-- system_settings.commission_rate — change the rate in Settings and every
-- historical unpaid payable silently recomputes while recorded payout rows
-- keep their old amounts: books that disagree with themselves. A real
-- marketplace freezes the rate per transaction. From now on the rate and the
-- rupee amount are stamped onto the order_item at the moment the Keep payment
-- SETTLES (client path and webhook share settle_keep_payment, so both stamp),
-- and the settings rate is only the default for NEW settlements.
--
-- Also adds the per-store override: stores.commission_rate (NULL = platform
-- default). Resolution order at settlement: store override → settings → 15.
--
-- READERS: order_economics (044) and store_order_economics (045) are
-- recreated to sum per-item COALESCE(stamped amount, computed-at-current-rate)
-- over kept-and-paid items. The fallback only matters for an item that
-- somehow settles unstamped — the backfill below stamps all existing history
-- at today's effective rates (same rupees as before, now frozen).

-- ============================================================
-- 1. Columns
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2)
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
COMMENT ON COLUMN stores.commission_rate IS
  'Per-store commission override in percent. NULL = platform default (system_settings.commission_rate). Applied to NEW settlements only — history keeps its stamped rate.';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);
COMMENT ON COLUMN order_items.commission_rate IS
  'Commission rate frozen at Keep-settlement time (migration 046). NULL = never settled (or pre-046 and unpaid).';
COMMENT ON COLUMN order_items.commission_amount IS
  'Commission rupees frozen at Keep-settlement time: ROUND(price_at_order × rate/100, 2). The economics views read this, not the live rate.';

-- ============================================================
-- 2. settle_keep_payment: 039's core re-created verbatim + the stamp.
--    Fill-only — a re-settle or race never overwrites a stamped value.
-- ============================================================
CREATE OR REPLACE FUNCTION settle_keep_payment(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature  TEXT  -- checkout signature from the client path; NULL from the webhook
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_rate    NUMERIC;
BEGIN
  -- Find the pending payment row created when checkout was initiated.
  SELECT * INTO v_payment
    FROM payments
   WHERE razorpay_order_id = p_razorpay_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found for razorpay order %', p_razorpay_order_id;
  END IF;

  -- Idempotent: a duplicate settle (client handler + webhook) is a no-op.
  IF v_payment.status = 'success' THEN
    RETURN NULL;
  END IF;

  UPDATE payments
     SET status              = 'success',
         razorpay_payment_id = p_razorpay_payment_id,
         razorpay_signature  = COALESCE(p_razorpay_signature, razorpay_signature),
         paid_at             = NOW()
   WHERE id = v_payment.id;

  -- Flip the specific kept item now that it's paid for — and freeze the
  -- commission at THIS moment (store override → settings default → 15).
  IF v_payment.order_item_id IS NOT NULL THEN
    SELECT COALESCE(s.commission_rate,
                    (SELECT ss.commission_rate FROM system_settings ss WHERE ss.id = 1),
                    15)::NUMERIC
      INTO v_rate
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN stores s ON s.id = p.store_id
     WHERE oi.id = v_payment.order_item_id;

    UPDATE order_items oi
       SET decision          = 'keep',
           decision_at       = NOW(),
           commission_rate   = COALESCE(oi.commission_rate, v_rate),
           commission_amount = COALESCE(oi.commission_amount,
                                        ROUND(oi.price_at_order * v_rate / 100.0, 2))
     WHERE oi.id = v_payment.order_item_id;
  END IF;

  -- Mark the order paid once no kept item is left unpaid.
  UPDATE orders o
     SET payment_status = 'paid'
   WHERE o.id = v_payment.order_id
     AND NOT EXISTS (
       SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id
          AND oi.decision = 'keep'
          AND NOT EXISTS (
            SELECT 1 FROM payments p
             WHERE p.order_item_id = oi.id AND p.status = 'success'
          )
     );

  RETURN v_payment.order_id;
END;
$$;

REVOKE ALL ON FUNCTION settle_keep_payment(TEXT, TEXT, TEXT) FROM PUBLIC;
-- deliberately no GRANTs: internal only (called by confirm_keep_payment and
-- razorpay_webhook_captured, both SECURITY DEFINER)

-- ============================================================
-- 3. Backfill: freeze existing kept-and-paid history at today's effective
--    rates — identical rupees to what every screen showed yesterday, but no
--    longer mutable by a Settings change. Fill-only → idempotent.
-- ============================================================
UPDATE order_items oi
   SET commission_rate   = r.rate,
       commission_amount = ROUND(oi.price_at_order * r.rate / 100.0, 2)
  FROM (
    SELECT oi2.id,
           COALESCE(s.commission_rate,
                    (SELECT ss.commission_rate FROM system_settings ss WHERE ss.id = 1),
                    15)::NUMERIC AS rate
      FROM order_items oi2
      JOIN products p ON p.id = oi2.product_id
      LEFT JOIN stores s ON s.id = p.store_id
     WHERE oi2.decision = 'keep'
       AND oi2.commission_amount IS NULL
       AND EXISTS (SELECT 1 FROM payments pay
                    WHERE pay.order_item_id = oi2.id AND pay.status = 'success')
  ) r
 WHERE oi.id = r.id;

-- ============================================================
-- 4. order_economics (044) re-created: commission = Σ stamped amounts over
--    kept-and-paid items (store-aware live-rate fallback for unstamped edge
--    cases). Column list unchanged; commission_rate stays the platform
--    default rate — screens derive the effective rate as commission/kept_paid.
-- ============================================================
CREATE OR REPLACE VIEW order_economics
WITH (security_invoker = on) AS
WITH cfg AS (
  SELECT COALESCE((SELECT commission_rate FROM system_settings WHERE id = 1), 15)::NUMERIC AS rate
),
pay AS (
  SELECT
    p.order_id,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('success','refunded')), 0), 2) AS captured_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'refunded'), 0), 2)              AS refunded_total,
    ROUND(COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'success'), 0), 2)               AS net_captured,
    ROUND(COALESCE(SUM(p.delivery_fee_component) FILTER (WHERE p.status = 'success'), 0), 2) AS delivery_fee_collected,
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
    ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
      WHERE oi.decision = 'keep'
        AND EXISTS (SELECT 1 FROM payments p
                     WHERE p.order_item_id = oi.id AND p.status = 'success')
    ), 0), 2) AS kept_paid_gross,
    -- Stamped at settlement (046); store-aware live-rate fallback for
    -- anything that settled unstamped.
    ROUND(COALESCE(SUM(
      COALESCE(oi.commission_amount,
               ROUND(oi.price_at_order * COALESCE(st.commission_rate, cfg.rate) / 100.0, 2))
    ) FILTER (
      WHERE oi.decision = 'keep'
        AND EXISTS (SELECT 1 FROM payments p
                     WHERE p.order_item_id = oi.id AND p.status = 'success')
    ), 0), 2) AS commission
  FROM order_items oi
  JOIN products pr ON pr.id = oi.product_id
  LEFT JOIN stores st ON st.id = pr.store_id
  CROSS JOIN cfg
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
  ROUND(COALESCE(i.kept_gross, 0) - COALESCE(i.kept_paid_gross, 0), 2) AS kept_unpaid_gross,
  cfg.rate                                    AS commission_rate,
  COALESCE(i.commission, 0)                   AS commission,
  ROUND(COALESCE(i.kept_paid_gross, 0) - COALESCE(i.commission, 0), 2) AS store_net,
  COALESCE(d.delivery_completed, FALSE)       AS delivery_completed,
  CASE WHEN COALESCE(d.delivery_completed, FALSE)
       THEN COALESCE(o.rider_fee, 0) ELSE 0 END AS rider_cost,
  ROUND(
    COALESCE(i.commission, 0)
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
  'Per-order money truth (M2+M3). Refund-aware; commission = stamped-at-settlement amounts (046), commission_rate column = platform default rate — derive effective rate as commission/kept_paid_gross.';

REVOKE ALL ON order_economics FROM PUBLIC;
GRANT SELECT ON order_economics TO authenticated;

-- ============================================================
-- 5. store_order_economics (045) re-created on the same stamped basis.
--    commission_rate column now = the STORE's effective default rate
--    (override → settings), which is what both panels should display.
-- ============================================================
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
  v_default NUMERIC;
BEGIN
  IF p_store_id IS NULL THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'not authorised';
    END IF;
  ELSIF NOT (is_admin() OR is_store_manager_of(p_store_id)) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  v_default := COALESCE((SELECT s.commission_rate FROM system_settings s WHERE s.id = 1), 15)::NUMERIC;

  RETURN QUERY
  SELECT
    g.sid,
    g.oid,
    g.kg,
    g.kpg,
    g.srate,
    g.comm,
    ROUND(g.kpg - g.comm, 2)
  FROM (
    SELECT
      pr.store_id AS sid,
      oi.order_id AS oid,
      COALESCE(st.commission_rate, v_default) AS srate,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (WHERE oi.decision = 'keep'), 0), 2) AS kg,
      ROUND(COALESCE(SUM(oi.price_at_order) FILTER (
        WHERE oi.decision = 'keep'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_item_id = oi.id AND p.status = 'success')
      ), 0), 2) AS kpg,
      ROUND(COALESCE(SUM(
        COALESCE(oi.commission_amount,
                 ROUND(oi.price_at_order * COALESCE(st.commission_rate, v_default) / 100.0, 2))
      ) FILTER (
        WHERE oi.decision = 'keep'
          AND EXISTS (SELECT 1 FROM payments p
                       WHERE p.order_item_id = oi.id AND p.status = 'success')
      ), 0), 2) AS comm
    FROM order_items oi
    JOIN products pr ON pr.id = oi.product_id
    LEFT JOIN stores st ON st.id = pr.store_id
    WHERE p_store_id IS NULL OR pr.store_id = p_store_id
    GROUP BY pr.store_id, oi.order_id, st.commission_rate
  ) g
  WHERE g.kg > 0;
END;
$$;

REVOKE ALL ON FUNCTION store_order_economics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_order_economics(UUID) TO authenticated;
