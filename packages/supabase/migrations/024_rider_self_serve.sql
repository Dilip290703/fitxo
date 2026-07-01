-- Migration 024: rider self-serve delivery claiming (no admin assignment needed)
-- Run in Supabase SQL Editor after migration 023.
--
-- NEW FLOW: customer orders -> STORE confirms (creates the delivery, rider_id NULL)
-- -> the delivery is offered to ALL online verified riders, who see it and tap
-- Accept. First to accept CLAIMS it (atomic); the rest see "just taken". Admin
-- assignment still works as an override but is no longer required.
--
-- Both functions are SECURITY DEFINER so we don't need to widen delivery RLS to
-- expose unclaimed deliveries — the functions themselves gate on "verified rider".
-- Idempotent.
-- ============================================================

-- The offer feed: unclaimed deliveries for confirmed orders. Only a verified
-- rider gets rows; everyone else gets an empty set.
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM riders r WHERE r.user_id = auth.uid() AND r.is_verified = true
  ) THEN
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
         d.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'          -- created-but-unclaimed
    AND o.status = 'confirmed'         -- store has confirmed it
  ORDER BY d.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;

-- Atomic claim: the first verified rider to call this wins. The
-- `rider_id IS NULL` guard + row lock makes a double-accept impossible.
CREATE OR REPLACE FUNCTION rider_claim_delivery(p_delivery_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider UUID;
  v_order UUID;
BEGIN
  SELECT id INTO v_rider FROM riders WHERE user_id = auth.uid() AND is_verified = true;
  IF v_rider IS NULL THEN
    RAISE EXCEPTION 'not a verified rider';
  END IF;

  UPDATE deliveries
     SET rider_id = v_rider, status = 'accepted', accepted_at = now()
   WHERE id = p_delivery_id
     AND rider_id IS NULL
     AND status = 'assigned'
  RETURNING order_id INTO v_order;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'This job was just taken by another rider';
  END IF;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION rider_claim_delivery(UUID) TO authenticated;
