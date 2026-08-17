# Integration test plan — migrations 051–054 + M5 (2026-07-18)

**What's under test:** five features built 2026-07-17/18, all merged together on branch
`integration/test-051-054` (= main + PRs #47 #48 #50 #51 #49, PROGRESS conflicts resolved):

| # | Feature | Migration | PR |
|---|---------|-----------|----|
| 1 | Coupons lockdown + `validate_coupon` RPC | 051 | #47 |
| 2 | Store Open/Paused + serviceability gate at approval | 052 | #48 |
| 3 | Abuse caps (settings-driven, in `place_order`) | 053 | #50 (stacked on #48) |
| 4 | Customer self-cancel + fee refund | 054 | #51 |
| 5 | Admin Finance/P&L screen | none | #49 |

**Environment state (verified 2026-07-18, this session):**
- Dev DB has 051–054 applied. Confirmed live: `pnpm rls-probe` **fully green incl. coupons**
  ("1 row exists, anon sees 0"); `stores.is_paused` present (all false); caps at defaults
  **8 / 1 / 0**; all four new RPCs exist and reject anon.
- Merged code: typecheck ×4, customer+admin+store builds, 16+23 tests — all green.
- **Prod is NOT touched** — see "After testing" at the bottom.

**⚠️ READ FIRST — the active-order cap is already live on dev.** Every test account has
stale active orders (31 total across `fitxo.contact@gmail.com` (18!), `store@fitxo.co.in` (10),
`uitest-a1@fitxo.dev`, `fitxoloop.customer@gmail.com`, `goku@gmail.com`), so **every new
order will be rejected with ORDER_LIMIT_ACTIVE until step 0 is done.**

---

## Step 0 — unblock the accounts (pick one)

- **Option A (recommended, tests G4 on the way):** log in as a customer with a `pending`
  stale order → tracking page → the new **Cancel order** card → cancel. Repeat for the
  account(s) you'll test with. (Admin > Orders > Cancel works for the rest / non-pending.)
- **Option B (fastest):** Admin → Settings → Order Limits → set *Max active orders* to `0`
  (off) while testing other features; set it back to `1` for test 3.

## Test 1 — Coupons lockdown (051)

1. ✅ *Already verified live:* anon `GET /rest/v1/coupons` returns zero rows; probe green.
   Re-run yourself if you like: `SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… pnpm rls-probe`.
2. Admin → Promo Codes: list loads, create/toggle a coupon still works (admin session passes `is_admin()`).
3. In Supabase SQL editor (runs as postgres, so auth-gate won't fire — use the REST path
   or browser console of a **logged-in customer** session):
   `await supabase.rpc('validate_coupon', { p_code: 'SUMMER2026', p_subtotal: 2000 })`
   → `valid: true` + rupee discount. Garbage code → `INVALID_CODE`. Subtotal below
   min_order → `MIN_ORDER` + `min_amount`. Confirm `used_count` did **not** increment.
4. No customer coupon UI exists yet (by design — W3.2's remaining half needs the
   discount-proration rule). Nothing to test on the storefront.

## Test 2 — Store Open/Paused + serviceability (052)

1. Store panel (store.fitxo.co.in dev / `pnpm dev:store`) → Dashboard shows the
   **"Store open — taking new orders"** card. Click **Pause store** → red paused state.
2. Customer: the paused store's products still **browsable**; add to bag → checkout →
   Place Order → friendly error "**{Store} is temporarily closed…**"; no order row created.
3. **Resume orders** → the same checkout goes through.
4. An order placed *before* pausing still flows (store can confirm/fulfil it while paused).
5. Admin serviceability: Stores → a test store → set its pincode to `110001` (Delhi) via
   Store Info → Onboarding card now shows "OUTSIDE the delivery area" + Approve asks
   **"Approve anyway"** → confirm → Activity Log entry carries `serviceability_override: true`.
   Set pincode `411001` → approve is clean, no override step.

## Test 3 — Abuse caps (053)

Settings live in Admin → Settings → **Order Limits** (0 disables any cap).

1. **Active cap** (default 1): with one active order, place another → "You already have an
   order in progress — finish that doorstep try-on…". Cancel/complete it → order flows.
2. **Item cap** (default 8): put 9 units in the bag → "at most 8 items". 8 units → OK.
3. **Daily cap** (default off): set to 1 → after one order (cancelled ones don't count),
   a second within 24 h → "reached the limit of 1 orders in 24 hours". Set back to 0.
4. Settings validation: negative/decimal values rejected; saves persist after reload.
5. Note the interplay: **cancelling an order frees its active-cap slot immediately**
   (cancelled is excluded from the active count) but does NOT free a daily-cap slot…
   actually cancelled is excluded from the daily count too — verify: with daily cap 1,
   place → cancel → place again should SUCCEED (cancelled doesn't eat quota).

## Test 4 — Customer self-cancel (054)

1. **Pending cancel:** place an order (don't pay the fee) → tracking shows the
   **"Cancel order"** card → confirm sheet (no fee-refund line, nothing paid) → cancel →
   Cancelled banner; variant's `available_qty` restored (check product page or DB);
   store panel gets an **"Order cancelled"** notification.
2. **Confirmed + fee paid cancel:** place → pay the ₹49 fee → store confirms (no rider
   yet) → Cancel still offered, sheet now says "**Your delivery fee will be refunded**" →
   cancel → payments row flips `refunded` (+ real refund visible in Razorpay test
   dashboard); Admin > Payments shows it.
3. **Rider claimed:** place → fee → store confirms → rider (agent panel, Online) accepts
   the job → refresh tracking → **Cancel card is GONE**. (Optional hard check: forced RPC
   call from the console raises `CANCEL_RIDER_ASSIGNED`.)
4. Cancelled order shows correctly in admin order detail + doesn't jam rider/store queues
   (delivery `failed`, try session `expired`).

## Test 5 — Finance / P&L (M5)

1. Admin → Money → **Finance (P&L)**: statement renders for 30d; "Cash collected" =
   Payments' captured − refunded for the range; per-order table margins look sane.
2. The **gateway-fee warning** should show (recent captures unsynced) → run **Sync
   gateway fees** on Payments → warning clears, gateway costs populate.
3. Range presets + custom range change the numbers; **Export CSV** downloads and its
   totals match the on-screen statement.
4. Cross-check one order (e.g. FTZ-2026-00055) against its order-detail Money card —
   same commission/margin rupees.
5. After test 4's fee-refund cancel: that order shows net 0 items + fee refunded —
   margin reflects only real money.

## Cross-feature sweeps (the reason to test together)

- Pause the store → existing active order still cancellable by the customer.
- Cancel → immediately place a new order (active cap freed) → works.
- P&L after the whole session: refunded fees appear in "refunded", cancelled orders
  contribute ₹0 margin, numbers still reconcile with Payments.
- Full regression happy path once at the end: place → pay fee → store confirm → rider
  claim → deliver → try window → keep one (bill sheet) + return one → fee auto-refund
  if kept ≥ threshold → payouts/economics screens all consistent.

## After testing — merge + prod runbook

**Prod verdict: do NOT apply 051–054 to prod yet.** Rules (ENVIRONMENTS.md): prod only
gets **merged** migrations, dev-verified first. Also prod is still at 047 — it needs
048, 049, 050 first. No urgency: prod serves no customers yet.

Order of operations after this test pass:
1. Merge PRs: **#47 → #48 → #50** (retargets to main when #48 merges) **→ #51 → #49**.
   Each merge after the first will hit a small PROGRESS.md conflict — resolve keep-both,
   or just merge `integration/test-051-054` into main instead (it already contains all
   five, conflicts resolved) and close the PRs as merged-via-integration.
2. Apply to prod **in one sitting, in order**: `048 → 049 → 050 → 051 → 052 → 053 → 054`
   (all idempotent; SQL editor or `psql -f`).
3. Re-run `pnpm rls-probe` against **prod** (with prod keys) → must be fully green.
4. Add GitHub repo secrets `RLS_PROBE_URL` / `RLS_PROBE_ANON_KEY` / `RLS_PROBE_SERVICE_KEY`
   (Settings → Actions) — only AFTER 051 is on the target env, else the daily job is red
   on coupons by design.
5. Update PROGRESS: flip the five board lines to [x]-style done notes + record live-fire
   results in the decisions log; M4 tax = **055**.
