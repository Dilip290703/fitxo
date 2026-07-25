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
     Extensions), then run **migration 056**. Do NOT hand-run the commented
     schedule blocks in 027/036: 056 supersedes them and deliberately schedules
     only `expire_try_windows`. `expire_stale_offers` stays unscheduled because
     it cancels `confirmed` orders, and since G9/050 every such order has a
     **paid** delivery fee it does not refund — 056 also makes the function skip
     those, and `verify-env.sh` fails if anything re-schedules it.
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

## Part D — auth settings 🧑 (Authentication, **both projects** — W4.4 / D4)

**Read the current state first, don't assume it** — this endpoint is public and
needs only the anon key:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $ANON_KEY" | python3 -m json.tool
```

It returns which providers are actually on, plus `mailer_autoconfirm` and
`disable_signup`. Dev on 2026-07-21 read: `email: true`, `phone: false`,
`google: false`, `mailer_autoconfirm: true`.

### Providers — keep the dashboard and the app in step

A provider that is off while the UI still offers it produces a dead button and a
raw error toast. The customer login is gated on env flags for exactly this
reason (W4.4); **flip the flag only when the provider is genuinely live.**

| Provider | State | App flag (`apps/customer`) | Unblocked by |
|---|---|---|---|
| Email + password | **ON** | — (always available) | — |
| Phone OTP | **OFF** | `NEXT_PUBLIC_PHONE_AUTH_ENABLED` | SMS provider + DLT registration (W1.2/B7) |
| Google OAuth | **OFF** | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | a Google Cloud OAuth client on the project |

If Google is ever enabled: callback is `https://<ref>.supabase.co/auth/v1/callback`
on the Google side, and `/auth/callback` must be in the redirect allowlist below.

### Email confirmation — currently OFF, and that is a sequenced decision

`mailer_autoconfirm: true` means signups get an instant session and **no
verification email**, so every account today is unverified. Turning confirmation
on without custom SMTP breaks signup outright — the built-in sender is limited to
a handful of mails an hour. Order matters:

**W2.4 custom SMTP live → turn confirmation ON → then W4.2 transactional emails.**

Until then, accept unverified emails (soft launch, low volume) and know that a
mistyped address means the customer silently never receives order mail.

### Redirect URLs — derived from the code, not guessed

Only three call sites pass a `redirectTo`, all using `window.location.origin`:

| App | Path | Source |
|---|---|---|
| customer | `/auth/callback` | `components/LoginPanel.tsx` (OAuth) + `app/auth/callback/route.ts` (PKCE exchange) |
| store | `/reset-password` | `components/StoreLoginPanel.tsx` |
| agent | `/reset-password` | `app/login/page.tsx` |
| admin | — | no reset/OAuth flow exists; it needs no redirect entry |

**Prod allowlist** (exact paths beat `/**` wildcards — a wildcard lets any path on
the domain be a redirect target):

```
https://fitzo.in/auth/callback
https://store.fitzo.in/reset-password
https://agent.fitzo.in/reset-password
```

**Dev allowlist** (ports from `.claude/launch.json`):

```
http://localhost:3000/auth/callback
http://localhost:3003/reset-password
http://localhost:3002/reset-password
```

Add Netlify preview/staging aliases alongside these when W2.2 lands. Site URL:
`https://fitzo.in` on prod, `http://localhost:3000` on dev.

### Hardening (D4)

- **Leaked-password protection ON** (both projects) — rejects passwords found in
  known breach corpora. Affects signup and password change, not existing logins.
- **OTP / token expiry ≤ 3600s.** Supabase's own advisor flags anything longer.
- **Review rate limits** (Authentication → Rate Limits): the defaults are tuned
  for a busy app, not a soft launch — token, signup, and email-send limits are
  the ones that matter before real traffic.
- Password minimum length: the customer signup form enforces 6 characters
  client-side; set the project minimum to match or raise both together.

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

## Part F — backups 🧑 (W2.9 / B8)

**Prod is on the Free plan, so PITR is not available** — it is a paid add-on
(Pro plan + PITR). What Free gives you is **daily backups with 7-day retention**,
taken automatically. Dev needs nothing.

1. Settings → Database → Backups → confirm daily backups are listed and the most
   recent one is < 24h old. There is nothing to switch on; the check is that
   backups are actually being produced.
2. **Know the exposure and write it down** rather than assuming it away: with
   daily-only backups, a restore loses **up to 24 hours** of orders, payments,
   and payouts. Razorpay is the independent record of money actually moved, so a
   restore is reconcilable — but order/try-session state is not, and
   `order_economics` is derived from rows that would be gone.
3. **Before anything destructive on prod** (a migration that drops or rewrites
   data, a bulk fix), take a manual backup first — Free-plan dailies are not a
   safety net for a mistake made at 3pm.
4. Revisit at the Razorpay live cutover (W5.2): once real money flows daily,
   Pro + PITR (~7-day window) stops being optional. Track it as a launch cost,
   not a nice-to-have.

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

## RLS probe (W4.1 — the 2026-06-08 incident guard)

`scripts/supabase/rls-probe.mjs` proves, over the anon key, that no sensitive
table leaks a row — the automated backstop for the day RLS was found silently
disabled. Run locally against either env:

```bash
SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… pnpm rls-probe
```

The service-role key is optional but makes results *evidence* (proves "N rows
exist, anon sees 0" instead of "anon sees 0, maybe just empty"). In CI it runs
on every push to main + daily, once these repo secrets are set (Settings →
Secrets and variables → Actions):

- `RLS_PROBE_URL` — the DEV project URL (probe the env that changes most)
- `RLS_PROBE_ANON_KEY`
- `RLS_PROBE_SERVICE_KEY` (optional)

Until the secrets exist the CI job no-ops green. Run it by hand against **prod**
before go-live (W5).

---

## Rotating the Razorpay keys (W4.9 / C4 — and the W5.2 live cutover)

**Why the test secret is being rotated:** it was shared in chat (plan item D2 —
"rotate anything ever shared in chat"). It was **not** committed — a scan of the
full git history found only placeholders (`rzp_test_xxxxxxxx`) in the deleted
`docs/HANDOFF-payment.md`, and `.env*` files have never been tracked. So there
is **no history to rewrite**; regenerating the key is the whole fix.

### The secret lives in four places, and they must move together

| # | Location | Used for |
|---|---|---|
| 1 | `apps/customer/.env.local` | creating the Razorpay order at checkout/Keep |
| 2 | `apps/admin/.env.local` | refunds (migration 041) |
| 3 | Vault `razorpay_key_secret` — **dev** | in-DB HMAC verification |
| 4 | Vault `razorpay_key_secret` — **prod** | in-DB HMAC verification |

The app and the database hold the same secret for *different* reasons: the app
calls Razorpay's API with it, and `confirm_keep_payment` (009) /
`razorpay_webhook_captured` (039) re-verify Razorpay's signature **inside
Postgres** with it, so a compromised client cannot forge a settlement.

⚠️ **That is why a half-finished rotation is dangerous.** Update the app but not
the Vault and the app charges with the new key, Razorpay signs with the new
secret, and the database checks against the old one — **the money moves and the
order never settles**, leaving only `invalid payment signature` in a log. On
test keys that is a lost afternoon; at the live cutover it is a real customer
charged for an order that stays open.

### Order of operations

1. **Razorpay dashboard → Settings → API Keys → Regenerate Test Key.** Note that
   this issues a **new key id AND a new secret** — both change, and the old pair
   stops working immediately.
2. Update **both** app envs (all four values, not just the secrets):
   - `apps/customer/.env.local` — `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `apps/admin/.env.local` — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
3. Update the Vault on **each project** (dev and prod are separate):
   ```sql
   SELECT vault.update_secret(
     (SELECT id FROM vault.secrets WHERE name = 'razorpay_key_secret'),
     '<new secret>'
   );
   ```
4. Restart the dev servers — `NEXT_PUBLIC_*` is inlined at build time, so a
   running server keeps serving the old key id to the browser. After W2.2, the
   Netlify env vars need the same update **and a redeploy**, not just a save.
5. **Verify** (see below) before doing anything else.

### Verify — `pnpm razorpay:check`

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm razorpay:check
```

Compares every copy **by HMAC fingerprint**, so no secret is printed, logged, or
transmitted. It checks the two app envs against each other (secret *and* key id)
and against the Vault via `razorpay_secret_fingerprints()` (migration **057**).
Run it once per project — the Vault half is per-environment.

Then the behavioural check the plan asks for: **one test payment end-to-end**
(order → Keep → UPI `success@razorpay`) and confirm the payment row reaches
`success`. That exercises the in-DB HMAC path the fingerprints only *predict*.

### Two things that bite

- **In-flight payments die.** Any `payments` row left at `status='initiated'`
  from before the rotation can never be verified — its Razorpay order was signed
  with the old secret. Rotate when nothing is mid-checkout, and expect stale
  `initiated` rows on dev to stay stuck.
- **The webhook secret is a separate credential.** Regenerating API keys does
  **not** change `razorpay_webhook_secret`. If it was also shared in chat, rotate
  it separately: Razorpay dashboard → Webhooks → edit the endpoint → new secret,
  then update `RAZORPAY_WEBHOOK_SECRET` in `apps/customer/.env.local` **and** the
  Vault copy on both projects. `pnpm razorpay:check` covers this one too.

  **Three copies must agree, not two.** Razorpay's webhook endpoint holds the
  authoritative value; `RAZORPAY_WEBHOOK_SECRET` (used by the route) and Vault's
  `razorpay_webhook_secret` (used by the in-DB re-verification) must **both**
  equal it. Fixing only one side just moves the failure: a wrong **env** value
  makes the route reject genuine webhooks with **401**, and a wrong **Vault**
  value lets the route pass and the RPC reject. If you are unsure which copy is
  stale, set a fresh secret on the Razorpay webhook endpoint and paste that one
  value into all copies — guessing costs more than resetting.

  ⚠️ **The mistake to avoid, found live on dev 2026-07-25:** Vault's
  `razorpay_webhook_secret` had been set to a copy of the **API key secret** —
  the two live in different dashboard screens and are easy to confuse. The
  failure is silent and asymmetric: `/api/razorpay/webhook` verifies the
  signature against the **env** value and passes, then `razorpay_webhook_captured`
  (039) re-verifies against **Vault** and rejects it. So `payment.captured` never
  settles, and the whole reason 039 exists — settling when the browser handler
  never runs (phone died, tab closed) — quietly does nothing. `razorpay:check`
  now names this case explicitly, because two distinct credentials can never
  legitimately be equal. The webhook secret comes from **Settings → Webhooks**
  (the endpoint's own secret), not **Settings → API Keys**.

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
