# Fitzo environments — prod/dev split (W2.1)

**Why this exists:** today ONE Supabase project is both dev and "prod" — E2E fixtures,
test riders and 50 test orders live beside what would be real customer data, and the
schema was built by hand-pasting 46 migrations (with one silent drift incident already:
RLS found disabled on live tables, 2026-06-08). Before any real customer exists we split
into two projects and make prod reproducible from the repo.

| | Project | Who uses it | Data |
|---|---|---|---|
| **dev** | the existing project (keep as-is) | Dilip + Jay + Claude sessions, all local `.env.local`s | test fixtures, seeds, experiments |
| **prod** | new project `fitzo-prod` | deployed apps only (Netlify env vars) | real stores, riders, customers — **zero test data** |

The split is **Part A–G below, in order**. Steps marked 🧑 need the Supabase dashboard
(Dilip); steps marked 💻 run from the repo. Allow ~30–45 min end to end.

---

## Part A — create the prod project 🧑

1. Supabase dashboard → New project → org: Fitzo → name **`fitzo-prod`** →
   region **Mumbai (ap-south-1)** → generate a strong DB password → **store the DB
   password in the password manager** (needed for dumps/psql, not by the apps).
2. Note the new project's: Project URL, `anon` key, `service_role` key
   (Settings → API). Do NOT put any of these in git.

## Part B — baseline the schema from dev 💻

The baseline is a **schema-only dump of the LIVE dev DB** — not a replay of the 46
migration files — because dev is the truth (hand-applied migrations can drift from
the files; that's the whole lesson of the RLS incident).

```bash
# 1. Get the DEV DB connection string: dashboard → Settings → Database →
#    Connection string (URI). Then:
export SUPABASE_DEV_DB_URL='postgresql://postgres:<dev-password>@db.<dev-ref>.supabase.co:5432/postgres'

# 2. Dump (schema only, public schema, incl. RLS policies/functions/views/grants):
./scripts/supabase/dump-baseline.sh
#    → writes supabase/baselines/<date>_prod_baseline.sql
```

Requires the `supabase` CLI (`brew install supabase/tap/supabase`) or falls back to
`pg_dump` if installed. Commit the baseline file — it is the reproducible birth
certificate of prod.

## Part C — apply the baseline + the bits a schema dump can't carry 🧑💻

1. **Apply the baseline**: prod SQL editor → paste the baseline file → run.
   (Or `psql "$SUPABASE_PROD_DB_URL" -f supabase/baselines/<file>.sql`.)
2. **Re-run the sections a public-schema dump does NOT include** (all idempotent —
   paste each into the prod SQL editor):
   - **`auth.users` trigger** — the `handle_new_user` trigger lives on the `auth`
     schema: re-run the trigger block of **migration 029** (its latest definition).
   - **Realtime publication** — re-run the `ALTER PUBLICATION supabase_realtime ADD …`
     lines from **migrations 018 and 021** (orders + notifications), and confirm
     `deliveries` REPLICA IDENTITY FULL survived the dump
     (`SELECT relreplident FROM pg_class WHERE relname='deliveries';` → `f`).
   - **Storage bucket + policies** — re-run **migration 030** (creates the
     `product-images` bucket; bucket rows are data, not schema).
   - **pg_cron sweeps (W2.9)** — enable the `pg_cron` extension (Database →
     Extensions), then run the commented schedule blocks in **migrations 027 + 036**
     (`expire_try_windows`, `expire_stale_offers`).
3. **Seed the config singleton** (the ONLY data row prod starts with):
   ```sql
   INSERT INTO system_settings (id, site_name, contact_email, support_phone,
     try_window_minutes, delivery_fee, free_delivery_above, commission_rate,
     offer_expiry_minutes, rider_fee)
   VALUES (1, 'Fitzo', 'support@fitzo.in', '', 60, 49, 999, 15, 120, 40)
   ON CONFLICT (id) DO NOTHING;
   ```
4. **Vault secrets** (test keys until Razorpay live KYC clears — C3; swap at cutover W5.2):
   ```sql
   SELECT vault.create_secret('<razorpay key secret>',    'razorpay_key_secret',     'Razorpay checkout key secret');
   SELECT vault.create_secret('<razorpay webhook secret>','razorpay_webhook_secret', 'Razorpay webhook secret');
   ```
5. **First admin user**: sign up via the admin login page pointed at prod, then in SQL:
   `UPDATE users SET role='admin' WHERE email='<you>';` (do this before inviting anyone).

## Part D — auth settings 🧑 (Authentication → settings, prod project)

- Email provider ON; **custom SMTP** (Resend/Brevo — B6/W2.4; the built-in sender is
  rate-limited to a handful of mails per hour and will break signup).
- Phone provider OFF until DLT/SMS is ready (B7) — email+password soft launch.
- Redirect URLs: `https://fitzo.in/**`, `https://store.fitzo.in/**`,
  `https://agent.fitzo.in/**`, `https://admin.fitzo.in/**` (plus staging aliases).
- Enable leaked-password protection; review OTP/token expiries and rate limits (D4).

## Part E — app env wiring 💻

Each app gets prod values ONLY in its deploy platform (Netlify env vars — W2.2),
never in git. Matrix:

| Var | customer | agent | store | admin |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (prod) | ✅ | ✅ | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` (prod) | ❌ | ❌ | ❌ | ✅ **only** |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | ✅ | ❌ | ❌ | ✅ (refunds) |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | ❌ | ❌ | ❌ |

Local `.env.local`s keep pointing at **dev**. Never point a local app at prod unless
you are doing the cutover checks.

## Part F — backups 🧑

- Prod: enable PITR if on a paid plan, else confirm daily backups are on
  (Settings → Database → Backups). Dev needs nothing.

## Part G — verify 💻

```bash
export SUPABASE_PROD_DB_URL='postgresql://postgres:<prod-password>@db.<prod-ref>.supabase.co:5432/postgres'
./scripts/supabase/verify-env.sh "$SUPABASE_PROD_DB_URL"
```

The script fails loudly if: any public table has RLS disabled (the 2026-06-08 incident
class), a money-critical function/view is missing (`confirm_keep_payment`,
`settle_keep_payment`, `razorpay_webhook_captured`, `order_economics`,
`store_order_economics`), the `system_settings` row is absent, the `product-images`
bucket is missing, or the auth trigger isn't attached. Run it against dev too — same
expectations, one truth.

Final manual check: place one test order against prod through the deployed apps
(W5.4's dry-run does this properly).

---

## Going forward — migration workflow after the split

- **One migrations directory stays the truth**: `packages/supabase/migrations/NNN_*.sql`,
  numbered, idempotent, claimed in PROGRESS Known-issues before writing (unchanged).
- Apply order: **dev first** (SQL editor, as today) → verify → merge the PR →
  **then prod** (SQL editor or `psql -f`). Prod only ever gets migrations that are
  **merged to main**. Record "applied to prod" in the PROGRESS Known-issues line.
- Re-baseline (`dump-baseline.sh` against dev) only when standing up a fresh
  environment — never edit an old baseline.
- Test fixtures (accounts `*@fitzo.test`, orders tagged E2E, seed stores/riders)
  stay in dev, forever. Nothing in prod is fake — if a prod smoke test is needed,
  use a clearly-named real account and clean it up the same day (W5.4).
