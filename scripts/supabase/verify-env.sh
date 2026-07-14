#!/usr/bin/env bash
# Verify a Fitzo Supabase environment (docs/ENVIRONMENTS.md Part G).
# Read-only. Fails loudly on anything that would have caused a past incident
# or breaks the money path. Run against BOTH dev and prod — same expectations.
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

echo "== 1. RLS enabled on every public table (2026-06-08 incident class) =="
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

echo
if [[ $FAILURES -gt 0 ]]; then
  echo "❌ $FAILURES check(s) failed — see docs/ENVIRONMENTS.md Part C."
  exit 1
fi
echo "✅ Environment looks right."
