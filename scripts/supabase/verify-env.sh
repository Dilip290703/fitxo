#!/usr/bin/env bash
# Verify a Fitxo Supabase environment (docs/ENVIRONMENTS.md Part G).
# Read-only. Fails loudly on anything that would have caused a past incident
# or breaks the money path. Run against BOTH dev and prod — same expectations.
#
# ⚠️ PREFER `verify-env.sql` — same nine checks, plus the RLS policy audit this
# script does NOT have, and no psql required (paste it into the SQL Editor).
# Two things to be honest about here:
#   · psql is not installed on the machine that does this work, so this script
#     has never run against either environment. Every check below is pure SQL.
#   · check 1 is the RLS *switch* (`NOT rowsecurity`) — the 2026-06-08 incident
#     class, and the most valuable single check. It is NOT a policy audit: this
#     script never reads pg_policies, so it cannot prove dev/prod policy parity
#     and never could. `verify-env.sql` sections 02 and 03 are that audit.
# Kept because it is the only form that runs unattended in a shell/CI job.
#
# Usage: ./scripts/supabase/verify-env.sh "postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres"
set -euo pipefail

DB_URL="${1:-}"
if [[ -z "$DB_URL" ]]; then
  echo "Usage: $0 <postgres-connection-url>" >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found (brew install libpq && brew link --force libpq)." >&2
  exit 1
fi

PSQL=(psql "$DB_URL" -X -A -t -v ON_ERROR_STOP=1)
FAILURES=0

fail() { echo "  ❌ $1"; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  ✅ $1"; }

echo "== 1. RLS SWITCH on every public table (2026-06-08 incident class) =="
echo "   (switch only — policy parity lives in verify-env.sql sections 02/03)"
RLS_OFF="$("${PSQL[@]}" -c "
  SELECT string_agg(tablename, ', ')
    FROM pg_tables
   WHERE schemaname = 'public' AND NOT rowsecurity;")"
if [[ -n "$RLS_OFF" ]]; then fail "RLS DISABLED on: $RLS_OFF"; else ok "all public tables have RLS enabled"; fi

echo "== 2. Money-critical functions exist =="
for fn in confirm_keep_payment settle_keep_payment razorpay_webhook_captured \
          store_order_economics start_try_window finalize_order_if_decided \
          store_confirm_order rider_claim_delivery handle_new_user; do
  FOUND="$("${PSQL[@]}" -c "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                             WHERE n.nspname = 'public' AND p.proname = '$fn' LIMIT 1;")"
  if [[ "$FOUND" == "1" ]]; then ok "$fn"; else fail "missing function: $fn"; fi
done

echo "== 3. order_economics view exists =="
FOUND="$("${PSQL[@]}" -c "SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='order_economics';")"
if [[ "$FOUND" == "1" ]]; then ok "order_economics"; else fail "missing view: order_economics"; fi

echo "== 4. system_settings singleton seeded =="
FOUND="$("${PSQL[@]}" -c "SELECT 1 FROM system_settings WHERE id = 1;")" || FOUND=""
if [[ "$FOUND" == "1" ]]; then ok "system_settings row present"; else fail "system_settings row (id=1) missing — seed it (Part C.3)"; fi

echo "== 5. auth.users trigger attached (handle_new_user) =="
FOUND="$("${PSQL[@]}" -c "SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                           JOIN pg_namespace n ON n.oid = c.relnamespace
                          WHERE n.nspname='auth' AND c.relname='users' AND NOT t.tgisinternal LIMIT 1;")" || FOUND=""
if [[ "$FOUND" == "1" ]]; then ok "trigger on auth.users"; else fail "no trigger on auth.users — re-run migration 029's trigger block (Part C.2)"; fi

echo "== 6. product-images storage bucket =="
FOUND="$("${PSQL[@]}" -c "SELECT 1 FROM storage.buckets WHERE id = 'product-images';")" || FOUND=""
if [[ "$FOUND" == "1" ]]; then ok "bucket product-images"; else fail "bucket product-images missing — re-run migration 030 (Part C.2)"; fi

echo "== 7. realtime publication carries notifications + orders =="
PUB="$("${PSQL[@]}" -c "SELECT string_agg(tablename, ',') FROM pg_publication_tables
                         WHERE pubname='supabase_realtime' AND schemaname='public';")" || PUB=""
for t in notifications orders; do
  if [[ ",$PUB," == *",$t,"* ]]; then ok "publication has $t"; else fail "supabase_realtime missing $t — re-run 018/021 (Part C.2)"; fi
done

echo "== 8. deliveries REPLICA IDENTITY FULL (migration 020) =="
RI="$("${PSQL[@]}" -c "SELECT relreplident FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                        WHERE n.nspname='public' AND c.relname='deliveries';")" || RI=""
if [[ "$RI" == "f" ]]; then ok "deliveries replica identity FULL"; else fail "deliveries replica identity is '$RI' — run: ALTER TABLE deliveries REPLICA IDENTITY FULL;"; fi

echo "== 9. abandoned-order sweeps scheduled (W2.9, migration 056) =="
HAS_CRON="$("${PSQL[@]}" -c "SELECT 1 FROM pg_extension WHERE extname='pg_cron';")" || HAS_CRON=""
if [[ "$HAS_CRON" != "1" ]]; then
  fail "pg_cron not installed — enable it (Database → Extensions) and re-run migration 056"
else
  ok "pg_cron installed"
  TRY_JOB="$("${PSQL[@]}" -c "SELECT active FROM cron.job WHERE jobname='expire-try-windows';")" || TRY_JOB=""
  case "$TRY_JOB" in
    t) ok "expire-try-windows scheduled and active" ;;
    f) fail "expire-try-windows exists but is INACTIVE — abandoned try windows will hang open" ;;
    *) fail "expire-try-windows not scheduled — re-run migration 056" ;;
  esac

  # Guard, not a nicety: expire_stale_offers cancels confirmed orders, and since
  # G9/050 every such order has a PAID delivery fee. Until an app-side runner
  # refunds it first, an unattended schedule keeps customers' money. See 056.
  OFFER_JOB="$("${PSQL[@]}" -c "SELECT 1 FROM cron.job WHERE jobname='expire-stale-offers';")" || OFFER_JOB=""
  if [[ "$OFFER_JOB" == "1" ]]; then
    fail "expire-stale-offers IS scheduled — it cancels paid orders without refunding the delivery fee. Unschedule it (see migration 056) unless the app-side refund runner shipped."
  else
    ok "expire-stale-offers correctly not scheduled"
  fi

  STUCK="$("${PSQL[@]}" -c "SELECT count(*) FROM stale_offers_needing_refund();")" || STUCK=""
  if [[ -n "$STUCK" && "$STUCK" != "0" ]]; then
    echo "  ⚠️  $STUCK stale unclaimed order(s) hold a paid delivery fee — cancel + refund via Admin (not a failure)"
  fi
fi

echo
if [[ $FAILURES -gt 0 ]]; then
  echo "❌ $FAILURES check(s) failed — see docs/ENVIRONMENTS.md Part C."
  exit 1
fi
echo "✅ Environment looks right."
