-- Migration 036: reliability — stale offers stop ringing riders, and genuinely
-- abandoned orders get cleaned up instead of hanging forever.
-- Run after 035. Idempotent.
--
-- FOUND IN THE 2026-07-07 LIVE LOOP TEST: confirmed-but-never-claimed orders
-- (days/weeks old test data) kept appearing in the offer feed — the agent saw
-- "waiting 25512 min" cards for orders no rider would ever take, and those
-- orders sat in 'confirmed' forever with no resolution.
--
-- This adds:
--   1. system_settings.offer_expiry_minutes — how long a confirmed order stays
--      offerable before it's considered abandoned (default 120 min). Config, not
--      hardcoded (same pattern as try_window_minutes / commission_rate).
--   2. available_deliveries() — only offers orders placed within that window, so
--      stale jobs stop ringing riders immediately.
--   3. expire_stale_offers() — a sweep (for pg_cron) that terminally resolves an
--      abandoned order: cancels it, fails its unclaimed delivery, and notifies
--      the customer (born-visible notification). Prevents orphaned 'confirmed'
--      orders. Service-role only.
--   4. Optional pg_cron schedule for BOTH sweeps (this one + 027's try-window).
-- ============================================================

-- 1. Config knob -------------------------------------------------------------
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS offer_expiry_minutes INTEGER NOT NULL DEFAULT 120
  CHECK (offer_expiry_minutes >= 5);

-- 2. Offer feed v4: add the freshness filter, preserve everything from 033
--    (verified-rider gate, 1-job cap, decline cooldown, shape, ordering).
CREATE OR REPLACE FUNCTION available_deliveries()
RETURNS TABLE (
  delivery_id  UUID,
  order_id     UUID,
  order_number TEXT,
  drop_area    JSONB,
  item_count   BIGINT,
  delivery_fee NUMERIC,
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
         o.delivery_fee,
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

-- 3. Sweep: terminally resolve abandoned orders (confirmed + never claimed +
--    past the expiry window). Cancels the order, fails the unclaimed delivery,
--    and drops a born-visible notification to the customer. NOT client-granted.
CREATE OR REPLACE FUNCTION expire_stale_offers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_age INT;
  r         RECORD;
  n         INT := 0;
BEGIN
  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  FOR r IN
    SELECT d.id AS delivery_id, o.id AS order_id, o.user_id, o.order_number
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    WHERE d.rider_id IS NULL
      AND d.status = 'assigned'
      AND o.status = 'confirmed'
      AND o.created_at <= now() - (v_max_age || ' minutes')::interval
  LOOP
    UPDATE orders     SET status = 'cancelled' WHERE id = r.order_id;
    UPDATE deliveries SET status = 'failed', completed_at = now() WHERE id = r.delivery_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.user_id, 'order_update',
      'Order could not be delivered',
      'We couldn''t find a rider for order ' || COALESCE(r.order_number, '') ||
        ' in time, so it has been cancelled. You have not been charged — please try again.',
      jsonb_build_object('kind', 'order_cancelled_no_rider', 'order_id', r.order_id)
    );
    n := n + 1;
  END LOOP;

  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION expire_stale_offers() FROM PUBLIC;

-- 4. OPTIONAL — schedule both sweeps every minute. Needs the pg_cron extension
--    (Supabase dashboard → Database → Extensions → enable "pg_cron"). Uncomment:
--   SELECT cron.schedule('expire-stale-offers', '* * * * *', $$SELECT expire_stale_offers()$$);
--   SELECT cron.schedule('expire-try-windows',  '* * * * *', $$SELECT expire_try_windows()$$);
--
-- Without pg_cron the offer FEED still self-heals (stale orders simply stop
-- being offered via the freshness filter in step 2); the sweep is what also
-- cancels the order + notifies the customer, so run it on a schedule for prod.
