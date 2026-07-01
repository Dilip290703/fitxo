-- Migration 025: rider decline cooldown + admin visibility helpers
-- Run in Supabase SQL Editor after migration 024.
--
-- When a rider declines an offered delivery we don't want it flashing back into
-- their feed on the next 7s poll (or after a refresh). Record the decline and hide
-- that job from THAT rider for a cooldown window. It still stays offered to every
-- other online rider, and it re-surfaces to the decliner after the cooldown in case
-- nobody else took it. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_declines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id    UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  declined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rider_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_declines_lookup
  ON delivery_declines(rider_id, delivery_id, declined_at);

ALTER TABLE delivery_declines ENABLE ROW LEVEL SECURITY;

-- A rider manages only their own declines; admins can read all.
DROP POLICY IF EXISTS delivery_declines_rider ON delivery_declines;
CREATE POLICY delivery_declines_rider ON delivery_declines FOR ALL USING (
  EXISTS (SELECT 1 FROM riders r WHERE r.id = delivery_declines.rider_id AND r.user_id = auth.uid())
  OR is_admin()
);

-- Record a decline (upsert so re-declining resets the cooldown).
CREATE OR REPLACE FUNCTION rider_decline_delivery(p_delivery_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RAISE EXCEPTION 'not a verified rider';
  END IF;

  INSERT INTO delivery_declines (rider_id, delivery_id)
  VALUES (v_rider, p_delivery_id)
  ON CONFLICT (rider_id, delivery_id)
  DO UPDATE SET declined_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION rider_decline_delivery(UUID) TO authenticated;

-- Rebuild the offer feed to hide jobs this rider declined within the cooldown
-- (10 minutes). Same shape as migration 024.
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
    RETURN; -- not a verified rider → no offers
  END IF;

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         d.drop_address,
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.final_amount,
         o.delivery_fee,
         o.created_at            -- deliveries has no created_at; use the order's
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
