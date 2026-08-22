-- verify-env.sql — full environment verification, WITHOUT psql.
--
-- Paste into the Supabase SQL Editor for the project you want to check
-- (dev: zqmggvuizjkxbrxlblzp · prod: bozqclrtbxkjevgztruc). Read-only:
-- no writes, no DDL, safe against production at any time.
--
-- WHY THIS EXISTS (two reasons, both worth keeping):
--
-- 1. `verify-env.sh` needs psql, and psql is not installed on the machine that
--    does this work — so it has never run against EITHER environment, not just
--    prod. Every one of its nine checks is pure SQL; the psql dependency bought
--    nothing but a blocker. This file is that script, minus the blocker.
--
-- 2. `verify-env.sh` has no RLS *policy* audit and never did. Its check 1 is
--    `WHERE NOT rowsecurity` — the on/off switch, which is precisely the
--    2026-06-08 incident (policies intact, switch off, anon reading every
--    customer's name/email/phone/orders) and therefore the single most
--    valuable check here. But it cannot see a table whose switch is ON and
--    whose policies are absent or different from dev's. Sections 02 and 03
--    below are new, and they are what "RLS parity is unproven" actually meant.
--
-- HOW TO RUN IT
--   The SQL Editor shows only the LAST statement's result when you run a whole
--   file, so run ONE SECTION AT A TIME: highlight the section you want and
--   press Run (the editor executes only the selection).
--
-- HOW TO GET A PARITY VERDICT
--   Run section A on dev, copy the whole grid to a file. Run it on prod, copy
--   to a second file. Diff them. The output is sorted deterministically by
--   (section, item) — NOT failures-first — precisely so that a diff shows only
--   real differences instead of reordering noise. Grep `>>>` for failures
--   within one environment.
--
--   A differing md5 in section 03 means the two environments have genuinely
--   different policy logic on that table: run section D for the full text.
--   Section 11 prints the Postgres version — if dev and prod are on different
--   major versions, the server deparses policy expressions slightly
--   differently and a hash can differ with no real change. Check versions
--   before treating a hash diff as a finding.
--
-- Related: `verify-prod-state.sql` answers "which migrations has this
-- environment got?". This file answers "is this environment configured
-- correctly, and does it match dev?". They are complementary; run both.
-- ============================================================


-- ============================================================
-- SECTION A — the main grid. This is the part you diff.
-- Everything here is guaranteed parse-safe: no reference to pg_cron or to any
-- app RPC, so it cannot abort partway and leave you with half an answer.
-- ============================================================

WITH required_functions(fn, why) AS (
  VALUES
    ('confirm_keep_payment',      'in-DB HMAC verify of a keep payment'),
    ('settle_keep_payment',       'moves an item to kept + stamps commission'),
    ('razorpay_webhook_captured', 'recovery path when the customer closes the tab'),
    ('store_order_economics',     'the one money truth the store/admin screens read'),
    ('start_try_window',          'try window opens on rider arrival'),
    ('finalize_order_if_decided', 'closes the order once every item is decided'),
    ('store_confirm_order',       'store accepts; gates on DELIVERY_FEE_UNPAID (050)'),
    ('rider_claim_delivery',      'rider takes a job'),
    ('handle_new_user',           'auth.users -> public.users provisioning (015/029)')
),

-- Application tables only. Extension-owned tables (PostGIS `spatial_ref_sys`
-- and friends) legitimately run with RLS off and are not ours to fix — listing
-- them would put permanent false failures in section 01 and train you to
-- ignore it.
app_tables AS (
  SELECT c.oid, c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND NOT EXISTS (
           SELECT 1 FROM pg_depend d
            WHERE d.objid = c.oid AND d.deptype = 'e')
),

grid AS (

  -- 01 — RLS switch, per table. THE incident check (2026-06-08).
  -- Every table is listed, passing or not, on purpose: a table that exists on
  -- dev and not on prod then shows up in the diff as a missing line, which is
  -- schema parity for free.
  SELECT '01 rls-switch'::text AS section,
         t.relname::text       AS item,
         CASE WHEN t.relrowsecurity THEN 'ok' ELSE '>>> RLS DISABLED' END::text AS verdict,
         CASE WHEN t.relrowsecurity
              THEN 'row security on'
              ELSE 'anon key reads every row — this is the 2026-06-08 incident exactly'
         END::text AS detail
    FROM app_tables t

  UNION ALL

  -- 02 — RLS on but NO policies. The silent case.
  -- Check 01 passes, and a behavioural anon probe against an EMPTY database
  -- also passes, because deny-all and no-rows-to-see look identical from
  -- outside. Two different failures land here:
  --   · a storefront table (products, stores, brands…) = a live outage, the
  --     catalogue renders blank for logged-out visitors;
  --   · a user-data table = whatever policy you believe protects it is not
  --     installed on this environment. Safe today, wrong the moment someone
  --     adds a policy expecting company.
  SELECT '02 rls-no-policy',
         t.relname,
         '>>> RLS ON, ZERO POLICIES',
         'deny-all to anon + authenticated (service role still bypasses); storefront table here = outage, user table here = the policy is missing, not working'
    FROM app_tables t
   WHERE t.relrowsecurity
     AND NOT EXISTS (
           SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = t.relname)

  UNION ALL

  -- 03 — every policy, fingerprinted. This is the actual parity audit.
  -- The md5 covers USING + WITH CHECK together, so a policy that was widened
  -- on one environment and not the other changes the hash. Hashing rather than
  -- dumping keeps the grid diffable by eye; section D prints the real text
  -- when a hash disagrees.
  SELECT '03 policy',
         p.tablename || ' :: ' || p.policyname,
         p.cmd || ' / '
           || CASE WHEN p.permissive = 'PERMISSIVE' THEN 'permissive' ELSE 'restrictive' END
           || ' / ' || array_to_string(p.roles, '+'),
         md5(coalesce(p.qual, '-') || ' ||| ' || coalesce(p.with_check, '-'))
    FROM pg_policies p
    JOIN app_tables t ON t.relname = p.tablename
   WHERE p.schemaname = 'public'

  UNION ALL

  -- 04 — money-critical functions (verify-env.sh check 2).
  SELECT '04 function',
         r.fn,
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc
                            WHERE pronamespace = 'public'::regnamespace
                              AND proname = r.fn)
              THEN 'ok' ELSE '>>> MISSING' END,
         r.why
    FROM required_functions r

  UNION ALL

  -- 05 — order_economics view (check 3).
  SELECT '05 view',
         'order_economics',
         CASE WHEN EXISTS (SELECT 1 FROM pg_views
                            WHERE schemaname = 'public' AND viewname = 'order_economics')
              THEN 'ok' ELSE '>>> MISSING' END,
         'refund-aware money truth behind Money card, payouts, earnings, P&L'

  UNION ALL

  -- 06 — system_settings singleton (check 4), plus the live support contact.
  -- The contact is here because it is launch gate #7 and this is the only
  -- place that reads the real value rather than what a doc claims it is.
  SELECT '06 settings-row',
         'system_settings id=1',
         CASE WHEN EXISTS (SELECT 1 FROM system_settings WHERE id = 1)
              THEN 'ok' ELSE '>>> MISSING — seed it (ENVIRONMENTS.md Part C.3)' END,
         coalesce((SELECT site_name || ' / ' || contact_email
                          || ' / phone=' || coalesce(nullif(support_phone, ''), '(EMPTY)')
                     FROM system_settings WHERE id = 1), '-')

  UNION ALL

  -- 07 — trigger on auth.users (check 5). Without it a new signup never gets a
  -- public.users row, which is the old "rider cannot log in" bug (migration 015).
  SELECT '07 auth-trigger',
         'auth.users',
         CASE WHEN EXISTS (
                SELECT 1 FROM pg_trigger t
                  JOIN pg_class c ON c.oid = t.tgrelid
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'auth' AND c.relname = 'users'
                   AND NOT t.tgisinternal)
              THEN 'ok' ELSE '>>> NO TRIGGER — re-run migration 029 trigger block' END,
         'signup -> public.users + riders row provisioning'

  UNION ALL

  -- 08 — storage bucket (check 6).
  SELECT '08 storage',
         'bucket product-images',
         CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images')
              THEN 'ok' ELSE '>>> MISSING — re-run migration 030' END,
         'store product image uploads'

  UNION ALL

  -- 09 — realtime publication (check 7). Cross-panel alerts ride notifications.
  SELECT '09 realtime',
         'supabase_realtime :: ' || want.t,
         CASE WHEN EXISTS (SELECT 1 FROM pg_publication_tables
                            WHERE pubname = 'supabase_realtime'
                              AND schemaname = 'public' AND tablename = want.t)
              THEN 'ok' ELSE '>>> MISSING — re-run 018/021' END,
         'realtime is the latency optimization; the 4s polls are the reliable core'
    FROM (VALUES ('notifications'), ('orders')) AS want(t)

  UNION ALL

  -- 10 — deliveries REPLICA IDENTITY FULL (check 8, migration 020).
  -- Without it a realtime UPDATE payload carries no old row, so the agent app
  -- cannot tell what changed.
  SELECT '10 replica-identity',
         'deliveries',
         CASE (SELECT c.relreplident FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'deliveries')
              WHEN 'f' THEN 'ok'
              ELSE '>>> NOT FULL — ALTER TABLE deliveries REPLICA IDENTITY FULL;'
         END,
         'migration 020'

  UNION ALL

  -- 11 — environment identity. Read this BEFORE judging a section 03 hash
  -- diff: different Postgres majors deparse policy expressions differently.
  SELECT '11 environment',
         'server',
         'info',
         current_database() || ' / ' || version()
)

SELECT section, item, verdict, detail
  FROM grid
 ORDER BY section, item;


-- ============================================================
-- SECTION B — pg_cron (verify-env.sh check 9).
-- Separate statement on purpose: if pg_cron is not installed, `cron.job` fails
-- to PARSE, which would abort section A and cost you the whole grid.
--
-- If this errors with "schema cron does not exist" — that IS the result:
-- pg_cron is not enabled here. Enable it (Database -> Extensions), re-run
-- migration 056, then re-run this section.
--
-- Expect exactly one job: expire-try-windows, active.
-- expire-stale-offers must NOT be scheduled: since G9/050 the delivery fee is
-- paid upfront, so every order that sweep can cancel is holding real money it
-- does not refund.
-- ============================================================
SELECT jobname,
       schedule,
       active,
       CASE WHEN jobname = 'expire-stale-offers' THEN '>>> UNSCHEDULE THIS — cancels paid orders without refunding'
            WHEN jobname = 'expire-try-windows' AND active THEN 'ok'
            WHEN jobname = 'expire-try-windows' THEN '>>> INACTIVE — abandoned try windows hang open'
            ELSE 'unexpected job — check migration 056' END AS verdict
  FROM cron.job
 ORDER BY jobname;


-- ============================================================
-- SECTION C — money left outstanding.
-- Separate statement because these are app RPCs (056 / 058); on an
-- environment that predates them the call would abort section A.
--
-- `pending_fee_refunds()` must be EMPTY before the Razorpay account switch:
-- a refund can only be issued by the account that captured the payment, so
-- any row here becomes permanently unrefundable once the old account goes.
-- ============================================================
SELECT 'pending_fee_refunds' AS queue, * FROM pending_fee_refunds();
SELECT 'stale_offers_needing_refund' AS queue, * FROM stale_offers_needing_refund();


-- ============================================================
-- SECTION D — full policy text. Run ONLY when a section 03 md5 disagrees
-- between dev and prod, and you need to see what actually differs.
-- Narrow it with the WHERE clause rather than reading all of it.
-- ============================================================
-- SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN ('users', 'orders', 'order_items')   -- <- edit me
--  ORDER BY tablename, policyname;
