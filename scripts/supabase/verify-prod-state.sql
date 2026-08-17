-- verify-prod-state.sql — which migrations does an environment actually have?
--
-- Paste the whole file into the Supabase SQL Editor for the project you want to
-- check (prod: bozqclrtbxkjevgztruc). Read-only: no writes, no DDL, safe to run
-- against production at any time.
--
-- WHY THIS EXISTS: `baselines/prod_bootstrap.sql` only covers migrations through
-- 047, and several later migrations do nothing but `CREATE OR REPLACE FUNCTION
-- place_order` — so "does place_order exist?" cannot tell you WHICH version is
-- installed. Every check below therefore looks for a marker that only exists
-- once a specific migration has run: a distinguishing string inside the function
-- body, or an object that migration introduced. Existence alone is not evidence.
--
-- Run the same file against dev to get a known-good column to compare with.
-- ============================================================

-- 1. Per-migration verdict ---------------------------------------------------
--    'PRESENT' means that migration's marker was found. Ordered so anything
--    missing sorts to the top.
WITH markers(migration, what_it_added, present) AS (
  VALUES
    ('048 try window from settings',
     'start_try_window reads system_settings.try_window_minutes',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'start_try_window'
               AND prosrc LIKE '%try_window_minutes%')),

    ('049 place_order address',
     'place_order takes p_address_id',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'place_order'
               AND prosrc LIKE '%p_address%')),

    ('050 delivery fee upfront',
     'store_confirm_order raises DELIVERY_FEE_UNPAID',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'store_confirm_order'
               AND prosrc LIKE '%DELIVERY_FEE_UNPAID%')),

    ('051 coupons lockdown',
     'validate_coupon()',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_coupon')),

    ('052 store pause',
     'store_set_paused()',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'store_set_paused')),

    ('053 abuse caps',
     'place_order enforces max_active_orders',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'place_order'
               AND prosrc LIKE '%max_active_orders%')),

    ('054 customer cancel',
     'cancel_order_by_customer() + record_cancel_fee_refund()',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_order_by_customer')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_cancel_fee_refund')),

    ('056 cron sweeps',
     'stale_offers_needing_refund() + expire_stale_offers skips paid orders',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'stale_offers_needing_refund')),

    ('057 razorpay fingerprints',
     'razorpay_secret_fingerprints()',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'razorpay_secret_fingerprints')),

    ('058 admin cancel + fee queue',
     'pending_fee_refunds() + cancel_order_by_admin()',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pending_fee_refunds')
       AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_order_by_admin')),

    ('059 FITXO rebrand',
     'generate_order_number emits FTX-',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_order_number'
               AND prosrc LIKE '%FTX-%')),

    ('060 store decision notifications',
     'notify_store_on_decision() + Fitxo wording in cancel_order_by_admin',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_store_on_decision'))
)
SELECT migration,
       CASE WHEN present THEN 'PRESENT' ELSE '>>> MISSING' END AS status,
       what_it_added
  FROM markers
 ORDER BY present, migration;

-- 2. The rebrand's data half (059) ------------------------------------------
--    059 rewrites the live row AND the column DEFAULTs. Both are checked:
--    a fresh bootstrap that reintroduced 'Fitzo' would show up here.
SELECT s.site_name,
       s.contact_email,
       s.support_phone,
       CASE WHEN s.site_name = 'Fitxo' AND s.contact_email = 'support@fitxo.co.in'
            THEN 'rebranded' ELSE '>>> STILL OLD BRAND' END AS row_verdict,
       (SELECT column_default FROM information_schema.columns
         WHERE table_name = 'system_settings' AND column_name = 'site_name')     AS site_name_default,
       (SELECT column_default FROM information_schema.columns
         WHERE table_name = 'system_settings' AND column_name = 'contact_email') AS contact_email_default
  FROM system_settings s
 WHERE s.id = 1;

-- 3. Brand leftovers still baked into live function bodies -------------------
--    A repo-wide rename cannot see string literals inside SQL, which is how
--    058 kept saying "Fitzo support" after 059 ran. Anything listed here is a
--    live user-visible string, EXCEPT razorpay_secret_fingerprints — its
--    'fitzo-rotation-check' salt must stay spelled that way forever (renaming
--    it would invalidate every stored fingerprint).
SELECT proname AS function_name,
       CASE WHEN proname = 'razorpay_secret_fingerprints'
            THEN 'expected — HMAC salt, do NOT change'
            ELSE '>>> live brand leftover, needs a migration' END AS verdict
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND prosrc ILIKE '%fitzo%'
 ORDER BY 1;

-- 4. pg_cron state (056) -----------------------------------------------------
--    Expect exactly one job: expire-try-windows, '* * * * *', active.
--    expire-stale-offers must NOT be here — it cancels orders holding a paid
--    delivery fee without refunding it (verify-env.sh check 9 fails on it).
SELECT jobname, schedule, active,
       CASE WHEN jobname = 'expire-stale-offers' THEN '>>> UNSCHEDULE THIS'
            ELSE 'ok' END AS verdict
  FROM cron.job
 ORDER BY jobname;

-- 5. Outstanding money ------------------------------------------------------
--    Must be EMPTY before the Razorpay account switch: a refund can only be
--    issued by the account that captured the payment, so any row here becomes
--    permanently unrefundable once the old account is retired.
SELECT * FROM pending_fee_refunds();

-- 6. Data volume — sanity, and a dev/prod comparison ------------------------
--    Dev on 2026-08-17: 60 orders · 10 stores · 56 products · 482 variants
--    · 6 riders · 19 payments · 23 users · 8 complaints · 0 coupons.
SELECT (SELECT count(*) FROM orders)      AS orders,
       (SELECT count(*) FROM order_items) AS order_items,
       (SELECT count(*) FROM stores)      AS stores,
       (SELECT count(*) FROM products)    AS products,
       (SELECT count(*) FROM riders)      AS riders,
       (SELECT count(*) FROM payments)    AS payments,
       (SELECT count(*) FROM users)       AS users,
       (SELECT count(*) FROM coupons)     AS coupons;

-- 7. Raw RPC list — Jay's original query, for the record --------------------
SELECT routine_name
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name NOT LIKE 'st\_%'      -- PostGIS noise: ~290 of these
   AND routine_name NOT LIKE '\_st\_%'
   AND routine_name NOT LIKE 'postgis%'
   AND routine_name NOT LIKE 'geometry%'
   AND routine_name NOT LIKE 'geography%'
 ORDER BY 1;
