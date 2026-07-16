#!/usr/bin/env bash
# Dump the LIVE dev schema as the prod baseline (docs/ENVIRONMENTS.md Part B).
#
# The baseline is a schema-only dump of dev — dev is the truth, not the 46
# migration files (hand-applied SQL can drift from the repo; see the
# 2026-06-08 RLS incident). Output is committed to supabase/baselines/.
#
# Usage:
#   export SUPABASE_DEV_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres'
#   ./scripts/supabase/dump-baseline.sh
set -euo pipefail

if [[ -z "${SUPABASE_DEV_DB_URL:-}" ]]; then
  echo "ERROR: set SUPABASE_DEV_DB_URL first (dashboard → Settings → Database → Connection string)." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$REPO_ROOT/supabase/baselines"
OUT_FILE="$OUT_DIR/$(date +%Y%m%d)_prod_baseline.sql"
mkdir -p "$OUT_DIR"

if command -v supabase >/dev/null 2>&1; then
  echo "Dumping via supabase CLI → $OUT_FILE"
  # Schema-only dump of the public schema: tables, enums, functions, views,
  # RLS policies, grants. (Auth-schema triggers, storage buckets, realtime
  # publication membership and cron jobs are NOT included — Part C re-runs those.)
  supabase db dump --db-url "$SUPABASE_DEV_DB_URL" -f "$OUT_FILE"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "supabase CLI not found — dumping via pg_dump → $OUT_FILE"
  pg_dump "$SUPABASE_DEV_DB_URL" \
    --schema=public \
    --schema-only \
    --no-owner \
    --no-privileges \
    > "$OUT_FILE"
  echo "NOTE: pg_dump used --no-privileges; re-check GRANTs on order_economics /" \
       "store_order_economics / RPCs after applying (the supabase CLI dump keeps them)." >&2
else
  echo "ERROR: need either the supabase CLI (brew install supabase/tap/supabase) or pg_dump." >&2
  exit 1
fi

echo
echo "Baseline written: $OUT_FILE"
echo "Next: docs/ENVIRONMENTS.md Part C (apply to prod + re-run the non-schema bits)."
