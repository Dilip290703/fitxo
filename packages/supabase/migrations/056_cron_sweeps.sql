-- Migration 056: schedule the abandoned-order sweeps (W2.9 / B8), and make
-- expire_stale_offers safe to run in a world where the delivery fee is
-- collected UPFRONT.
-- Run after 054 (055 is reserved for M4 tax provisions). Idempotent.
--
-- WHY THIS ISN'T JUST `cron.schedule(...)`:
--
-- 036 wrote expire_stale_offers() on 2026-07-07, when a cancelled order had
-- genuinely taken no money — so it cancels the order and tells the customer
-- "You have not been charged". G9 / migration 050 (2026-07-16) changed that:
-- the delivery fee is now charged upfront, and store_confirm_order raises
-- DELIVERY_FEE_UNPAID unless a successful payment with delivery_fee_component
-- > 0 exists. Since the sweep only ever targets status='confirmed' orders,
-- EVERY order it could cancel has a paid delivery fee (unless the fee was
-- waived by first_order_free). Scheduling it as written would keep the
-- customer's ₹49 and deny it in writing.
--
-- The database cannot fix that alone: Razorpay refunds need the API keys, and
-- those are server-side in the apps (see 054, where cancel-with-paid-fee
-- returns fee_refund_payment_id for the app to refund, then records it via
-- record_cancel_fee_refund). There is no app-side job runner yet, so this
-- migration takes the conservative half:
--
--   1. expire_stale_offers() only auto-cancels orders with NOTHING TO REFUND.
--      Paid-fee orders are left alone and counted, for a human to resolve via
--      Admin > Orders + the 041 refund flow. Its notification copy is now
--      true for every order it actually touches.
--   2. Only expire_try_windows is scheduled. That sweep is money-safe: it
--      auto-returns undecided items and completes the order, which is exactly
--      the G9 policy (a return-everything trip still pays the fee). Stock
--      release rides 047's triggers.
--   3. expire_stale_offers is deliberately NOT scheduled. Enabling it is a
--      follow-up that must ship WITH the refund half — see the block at the
--      bottom, and PROGRESS's W2.9 line.
-- ============================================================

-- 1. expire_stale_offers v2 — skip anything holding customer money -----------
CREATE OR REPLACE FUNCTION expire_stale_offers()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_age INT;
  r         RECORD;
  n         INT := 0;
  v_skipped INT := 0;
BEGIN
  SELECT offer_expiry_minutes INTO v_max_age FROM system_settings WHERE id = 1;
  v_max_age := COALESCE(v_max_age, 120);

  FOR r IN
    SELECT d.id AS delivery_id, o.id AS order_id, o.user_id, o.order_number,
           EXISTS (
             SELECT 1 FROM payments p
              WHERE p.order_id = o.id
                AND p.status = 'success'
           ) AS has_money
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
    WHERE d.rider_id IS NULL
      AND d.status = 'assigned'
      AND o.status = 'confirmed'
      AND o.created_at <= now() - (v_max_age || ' minutes')::interval
  LOOP
    -- Money on the order → cancelling here would silently keep it. Leave the
    -- order confirmed so it stays visible to admin, who cancels + refunds
    -- through the app (Admin > Payments, migration 041). Deliberately quiet:
    -- this runs on a schedule and must not fail the whole sweep.
    IF r.has_money THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE orders     SET status = 'cancelled' WHERE id = r.order_id;
    UPDATE deliveries SET status = 'failed', completed_at = now() WHERE id = r.delivery_id;

    -- True for these orders specifically: no successful payment exists.
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

  IF v_skipped > 0 THEN
    RAISE NOTICE 'expire_stale_offers: skipped % stale order(s) holding a successful payment — resolve via Admin > Orders', v_skipped;
  END IF;

  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION expire_stale_offers() FROM PUBLIC;

COMMENT ON FUNCTION expire_stale_offers() IS
  'Sweep: cancels confirmed-but-unclaimed orders past offer_expiry_minutes. Only touches orders with NO successful payment (056) — a paid delivery fee (G9/050) must be refunded via the app before cancelling, so those are skipped for admin. Returns the number cancelled.';

-- 2. Read-only companion: what the sweep deliberately left behind ------------
--    Gives admin (service role) a straight answer to "what is stuck?" without
--    anyone having to reconstruct the sweep's WHERE clause by hand.
CREATE OR REPLACE FUNCTION stale_offers_needing_refund()
RETURNS TABLE (
  order_id     UUID,
  order_number TEXT,
  user_id      UUID,
  created_at   TIMESTAMPTZ,
  minutes_old  INT,
  amount_paid  NUMERIC
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id,
         o.order_number::TEXT,   -- orders.order_number is VARCHAR(20)
         o.user_id,
         o.created_at,
         (EXTRACT(EPOCH FROM (now() - o.created_at)) / 60)::INT,
         COALESCE((SELECT SUM(p.amount) FROM payments p
                    WHERE p.order_id = o.id AND p.status = 'success'), 0)
    FROM deliveries d
    JOIN orders o ON o.id = d.order_id
   WHERE d.rider_id IS NULL
     AND d.status = 'assigned'
     AND o.status = 'confirmed'
     AND o.created_at <= now() - (COALESCE((SELECT offer_expiry_minutes FROM system_settings WHERE id = 1), 120) || ' minutes')::interval
     AND EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'success')
   ORDER BY o.created_at;
$$;

REVOKE ALL ON FUNCTION stale_offers_needing_refund() FROM PUBLIC;

COMMENT ON FUNCTION stale_offers_needing_refund() IS
  'Read-only: stale unclaimed orders that expire_stale_offers skipped because they hold a successful payment. Service-role only — cancel + refund these through the app.';

-- 3. Schedule the money-safe sweep -------------------------------------------
--    pg_cron must be enabled first (Supabase dashboard → Database → Extensions
--    → "pg_cron"). CREATE EXTENSION is attempted here and may fail on
--    permissions depending on the project — if it does, enable it in the
--    dashboard and re-run this file. The DO block is a no-op without it, so
--    the migration stays safe to run either way.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  -- Swallowed on purpose: the next block checks pg_extension and no-ops if the
  -- extension really is absent, so a permissions failure here must not abort
  -- the whole migration.
  RAISE NOTICE 'pg_cron could not be created from SQL (%) — enable it in Database → Extensions, then re-run 056.', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Idempotent: drop our own job by name before (re)creating it, so re-running
    -- the migration never stacks duplicate schedules.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-try-windows') THEN
      PERFORM cron.unschedule('expire-try-windows');
    END IF;
    PERFORM cron.schedule('expire-try-windows', '* * * * *', $job$SELECT expire_try_windows()$job$);

    -- If a previous hand-run of 027/036's commented blocks scheduled the offer
    -- sweep, remove it — see the header for why it must not run unattended yet.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-offers') THEN
      PERFORM cron.unschedule('expire-stale-offers');
      RAISE NOTICE '056: removed the expire-stale-offers schedule (needs the refund half first).';
    END IF;
  ELSE
    RAISE NOTICE '056: pg_cron not installed — no jobs scheduled. Enable the extension and re-run.';
  END IF;
END $$;

-- 4. NOT SCHEDULED — the follow-up ------------------------------------------
-- Enable this ONLY together with an app-side runner that refunds the delivery
-- fee first (mirror 054: pick up stale_offers_needing_refund() → Razorpay
-- refund in the app → record it → then cancel). Until that exists, the line
-- below would resume keeping customers' money:
--   SELECT cron.schedule('expire-stale-offers', '*/5 * * * *', $$SELECT expire_stale_offers()$$);

-- Verify:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--   SELECT * FROM stale_offers_needing_refund();
