-- Migration 026: fix available_deliveries() — deliveries has no created_at column
-- Run in Supabase SQL Editor after migration 025.
--
-- Bug: migrations 024/025 selected `d.created_at`, but the deliveries table has no
-- `created_at` (it has assigned_at/accepted_at/…). The RPC errored with
-- "column d.created_at does not exist", so the rider offer feed showed that error
-- and no jobs. Fix: use the ORDER's created_at (which exists) as the offer time.
-- Idempotent (CREATE OR REPLACE). Same shape/logic as 025, only the column fixed.
-- ============================================================

CREATE OR REPLACE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_address JSONB,
  item_count   BIGINT,
  final_amount NUMERIC,
  delivery_fee NUMERIC,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         d.drop_address,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.final_amount,
         o.delivery_fee,
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.delivery_id = d.id
        AND dd.rider_id = v_rider
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;
