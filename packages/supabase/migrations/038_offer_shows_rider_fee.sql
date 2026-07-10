-- Migration 038: the rider offer card shows the RIDER's pay, not the customer's
-- delivery charge. Run after 037. Idempotent.
--
-- After 037 decoupled rider pay (orders.rider_fee) from the customer delivery
-- charge (orders.delivery_fee), available_deliveries() was still returning
-- delivery_fee — so a rider saw "+₹0" on any free-delivery order even though they
-- now earn the flat rider_fee. This repoints the offer feed to rider_fee.
--
-- The RETURNS TABLE column changes name (delivery_fee → rider_fee), which needs a
-- DROP (CREATE OR REPLACE can't alter the return type). Everything else is
-- carried over verbatim from 036: verified-rider gate, 1-job cap, offer-expiry
-- freshness filter, decline cooldown, ordering.
-- ============================================================

DROP FUNCTION IF EXISTS available_deliveries();

CREATE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_area    JSONB,
  item_count   BIGINT,
  rider_fee    NUMERIC,   -- what the RIDER earns (was delivery_fee)
  store_name   TEXT,
  store_area   TEXT,
  store_count  BIGINT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rider   UUID;
  v_max_age INT;
BEGIN
  SELECT id INTO v_rider FROM riders r
  WHERE r.user_id = auth.uid() AND r.is_verified = true;
  IF v_rider IS NULL THEN
    RETURN; -- not a verified rider → no offers
  END IF;

  -- One job at a time: an active delivery hides the feed entirely.
  IF EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.rider_id = v_rider
      AND d.status IN ('accepted', 'picked_up', 'en_route', 'arrived')
  ) THEN
    RETURN;
  END IF;

  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  RETURN QUERY
  SELECT d.id,
         d.order_id,
         o.order_number::TEXT,
         jsonb_build_object(
           'city',     d.drop_address->>'city',
           'pincode',  d.drop_address->>'pincode',
           'landmark', d.drop_address->>'landmark'
         ),
         (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id),
         o.rider_fee,                 -- the rider's pay, not the customer charge
         d.pickup_address->>'store_name',
         concat_ws(' · ', NULLIF(d.pickup_address->>'city', ''),
                          NULLIF(d.pickup_address->>'pincode', '')),
         COALESCE((d.pickup_address->>'store_count')::BIGINT, 1),
         o.created_at
  FROM deliveries d
  JOIN orders o ON o.id = d.order_id
  WHERE d.rider_id IS NULL
    AND d.status = 'assigned'
    AND o.status = 'confirmed'
    AND o.created_at > now() - (v_max_age || ' minutes')::interval   -- freshness
    AND NOT EXISTS (
      SELECT 1 FROM delivery_declines dd
      WHERE dd.rider_id = v_rider
        AND dd.delivery_id = d.id
        AND dd.declined_at > now() - interval '10 minutes'
    )
  ORDER BY o.created_at ASC;
END; $$;

GRANT EXECUTE ON FUNCTION available_deliveries() TO authenticated;
