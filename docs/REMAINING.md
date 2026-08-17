# FITXO — What's Actually Remaining

**Audited 2026-08-12 against live code + the live dev database**, not against `PROGRESS.md`.
**Reconciled 2026-08-17** after the rename landed — see "What changed since the audit" below.
Owner tags: **J** = Jay · **D** = Dilip · **A** = Amit.

> **How to read this:** every line marked ✅ *verified* was checked against real code or a real
> DB query during this audit. Lines marked ⚠️ *unverified* are things I could **not** confirm from
> this machine and someone must check by hand. Nothing here is assumed from the old docs.

> ⚠️ **This file is partly a historical record — do not run a brand find-and-replace over it.**
> Its subject *is* the old name, so a blind replace turns "the move off Fitzo" into "the move off
> Fitxo" and "FITZO → FITXO" into "FITXO → FITXO". That is exactly what happened in PR #63 and
> had to be undone by hand on 2026-08-17. Occurrences of **Fitzo** below are deliberate.

---

## What changed since the 2026-08-12 audit

- ✅ **The rename landed** — PR #63 `rebrand: FITZO → FITXO across the monorepo`, 232 files,
  merged to `main`. Phase 1 is **done**.
- ✅ **Migrations 059 and 060 are applied on BOTH dev and prod** (2026-08-17). Verified by query
  on each: `site_name = "Fitxo"`, `contact_email = "support@fitxo.co.in"`, the `contact_email`
  column DEFAULT rewritten, `generate_order_number` emitting **`FTX-`**, plus 060's
  `notify_store_on_decision` + its trigger and a brand-clean `cancel_order_by_admin`. Existing
  `FTZ-` order numbers are deliberately left alone (prod had none — it is empty).
- ✅ **The domain is bought: `fitxo.co.in`** (with `store.` / `agent.` / `admin.` subdomains).
  This is the name already hardcoded across the codebase and written into the DB — the audit's
  open question of `fitxo.in` vs `.co.in` is **settled as `.co.in`**.
- ✅ **Supabase moved to the new Fitxo email.** An org transfer keeps the project ref, so
  `zqmggvuizjkxbrxlblzp` (dev) / `bozqclrtbxkjevgztruc` (prod) are unchanged and **no env file
  needs editing** for this.
- ⬜ **Razorpay: a new account under the Fitxo identity is still to be created.** This is not just
  a login change — it reissues **three** credentials (key id, key secret, webhook secret) across
  **seven** slots. `ENVIRONMENTS.md` → "Moving to a NEW Razorpay account" is the procedure; a
  half-done rotation is the silent-failure mode recorded on 2026-07-21. ✅ Now known to risk **no
  real money**, since prod holds no payments — but the webhook half cannot be finished until a
  public URL exists, so expect it to land in two passes.
- ✅ **Hosting platform decided: Firebase App Hosting** — PR #64 (`chore(deploy): Firebase App
  Hosting config for all 4 panels`) is **merged**, so every "Netlify" reference below (W2.2, §3.1)
  is stale wherever it names a vendor. The *substance* of those lines stands: the sites are not
  live yet, and that is still what blocks the Razorpay webhook, prod admin MFA, and the stale-offer
  sweep. ⬜ Config merged ≠ deployed — no public URL exists yet.

**Consequence for §2:** migration **059 is taken by the rebrand**, so the store-propagation work
below is **060**, not 059.

---

## 0. Corrections to `PROGRESS.md` (read this first)

`PROGRESS.md` is **stale in a way that matters** — it lists migrations 043–058 as "pending apply".

✅ **Verified: every migration through 058 is already applied on the dev project** (`zqmggvuizjkxbrxlblzp`).
Probed the live PostgREST schema; all 20 RPCs resolve, including the ones the docs call pending:
`place_order`, `validate_coupon`, `store_set_paused`, `cancel_order_by_customer`,
`cancel_order_by_admin`, `pending_fee_refunds`, `stale_offers_needing_refund`,
`razorpay_secret_fingerprints`, `store_order_economics`, `record_delivery_fee_refund`,
`record_cancel_fee_refund`, `settle_keep_payment`, `razorpay_webhook_captured`,
`start_try_window`, `expire_try_windows`, `rider_fail_delivery`.

✅ **Verified live dev settings:** try window **7 min**, commission **15%**, delivery fee **₹49**,
rider pay **₹40**, caps **8 items / 1 active order / daily off**, offer expiry **120 min**.

✅ **RESOLVED 2026-08-17 — prod verified for the first time since 047.** Dilip ran the checks
against `bozqclrtbxkjevgztruc` from the SQL Editor. **Prod holds every function the repo defines,
with zero drift** (nothing on prod that no migration creates). Both environments are now at **060**.
The audit's worry was misplaced in extent but right in kind: prod was never stuck at 047 — the
decisions log was correct that 051–054 and 056–058 shipped there — but **059 genuinely had not run**,
so prod really was serving the old brand until today.

**Next free migration number = 060.** (055 is a reserved hole for M4 tax; 043–054 + 056–059 exist
— 059 is the rebrand.)

---

## PHASE 0 — Decide before writing any code

### 0.1 — [A + J] Clear the name FITXO *before* the rename lands — ⚠️ PARTLY RESOLVED
The move off **Fitzo** happened because that name was already registered. **Do not repeat the
mistake in the other direction.** As of 2026-08-05 Amit was preparing the **FITZO** filing
(Class 35 primary, Class 25 defensive, ₹4,500/class).

- ✅ **The name decision is made and the rename has shipped** — see "What changed" above.
- ✅ **Domain secured: `fitxo.co.in`.** The `.in` vs `.co.in` question in the original audit is
  closed; `.co.in` is what the code and the DB use.
- ⬜ **[A] Still open — the trademark half.** Confirm whether the **FITZO** application was
  actually submitted; if it was, that filing and fee are moot and the money is spent — decide
  whether to abandon it or let it lapse. Then re-run the **Contains + Phonetic** search on
  **FITXO** across all classes (not exact-match — exact-match is what hid the problem last time),
  and pull the **specification** of any cited mark before calling it a blocker or a pass; the
  class number alone decides nothing.

⚠️ The trademark registry is not reachable from this machine. That bullet is a human step, and it
is now the *only* part of 0.1 outstanding — note the code shipped ahead of it, which is a risk
someone accepted rather than one that was checked off.

### 0.2 — [D] Verify prod matches dev — ✅ DONE 2026-08-17
Verified: prod is at **060**, same function set as the repo, no drift, and 059's data half
(`site_name`, `contact_email`, both column DEFAULTs, the `FTX-` order prefix) all confirmed by
query. Reusable check: **`scripts/supabase/verify-prod-state.sql`** — read-only, safe against
prod, and it prints `>>> MISSING` per migration instead of a list to eyeball.

✅ **Also established: prod is EMPTY — 0 orders, 0 stores.** It was created 2026-07-15 as
schema-only from `prod_bootstrap.sql` and has never been seeded (that is W5.3, still open). Two
consequences worth carrying forward: (1) the **entire money path has never executed on prod** —
`place_order` → fee → `store_confirm_order` → try window → keep/return → settle — which is exactly
what W5.4's live dry-run is for; (2) the **Razorpay account switch risks no real money**, because
no orders means no payments to strand (see `ENVIRONMENTS.md`).

⚠️ **`verify-env.sh`'s full RLS audit still needs psql + a prod connection string** and has not
been run. Schema and function parity are proven; the RLS policy audit is not.

---

## PHASE 1 — The rename — ✅ DONE (PR #63, merged)

### 1.1 — [J] FITZO → FITXO across the codebase — ✅ DONE
Shipped as **PR #63**, 232 files, while there was exactly one open PR (#62) and zero in-flight
feature branches — the cheapest possible moment, as planned.

Original verified scope (excluding `node_modules`, `.next`, and 224 stale files under
`.claude/worktrees`): ~523 brand strings in `apps/` + `packages/`, 181 `@fitzo/*` package names,
45 `fitzo.in` domain refs, ~220 real files across all 4 apps.

**How each of the three traps actually resolved:**

1. ⚠️ **localStorage keys — renamed with NO migration shim.** The keys are now
   `AUTH_STORAGE_KEY = "fitxo-auth"` and `PINCODE_STORAGE_KEY = "fitxo-pincode"`
   (`apps/customer/lib/mockData.ts`, and `PINCODE_STORAGE_KEY` again in
   `apps/customer/store/locationStore.tsx`). Nothing reads the old `fitzo-*` keys.
   **Decided 2026-08-17: accept it.** On deploy every existing session signs out and saved
   pincodes clear — which is tolerable only because there are no real customers yet (23 test
   users on dev). **If this ships after any real signup, it is a regression**, so if launch slips
   past first real users, revisit before deploying.
2. ✅ **`system_settings.contact_email`** could not be fixed by a code rename — handled by
   **migration 059**, which rewrites `site_name` → `Fitxo` and `contact_email` →
   `support@fitxo.co.in`, moves both column DEFAULTs, and flips `generate_order_number()` from the
   `FTZ-` prefix to `FTX-`. Existing order numbers keep `FTZ-` on purpose (renumbering would break
   every receipt, job card and Razorpay note). ✅ **Applied and verified by query on BOTH dev and
   prod (2026-08-17).**
3. ⬜ **Outside the repo entirely** — still outstanding in part: Supabase project names, the
   **Razorpay account/business name (new account still to be created)**, the GitHub repo name, and
   any verified-website entry at Razorpay. None of these change by editing code.

**Two things the rename got wrong, fixed on 2026-08-17:**
- It replaced brand strings inside **already-applied migrations' comments** and inside this audit
  document, where the old name is history rather than branding. The migrations were left alone
  (correct — they are immutable history); this file was un-mangled by hand.
- It did **not** touch `cancel_order_by_admin` in migration 058, which builds customer- and
  store-facing notification bodies reading *"was cancelled by Fitzo support."* Those run live.
  Fixed in **migration 060** (§2.1).

**Deliberately not renamed, and correctly so:** the HMAC salt `'fitzo-rotation-check'` in
migration 057. Changing it changes every stored fingerprint and would make `pnpm razorpay:check`
report a false mismatch during the Razorpay rotation.

---

## PHASE 2 — Cross-panel propagation — ✅ 2.1–2.3 DONE (PR #66 + migration 060)

> ✅ **Shipped and applied 2026-08-17.** PR #66 widened the store's notification kinds and added
> the 4s poll to `/orders`, `/orders/[id]` and `/returns`; **migration 060 is applied on dev and
> prod**. The root cause below is preserved because the *shape* of it recurs: the cancellation
> notifications were already being written by 054 and 058 — the client was discarding them. Look
> for discarded data before assuming a missing feature.
>
> ⬜ **Still open: 2.4 (admin orders list), and the logged-in click-test of the store panel** —
> the store flows are code-verified and the app boots clean, but nobody has driven them behind the
> sign-in yet.

## The original finding (2026-08-12)

You asked whether a return reflects to rider, customer and store in 3–4s. I traced it end to end.

✅ **Verified propagation matrix — customer taps "Return" on an item:**

| Panel | Gets it? | How | Latency |
|---|---|---|---|
| **Customer** | ✅ yes | own action → `router.refresh()` | instant |
| **Rider** | ✅ yes | `item_returned` notification (migration 023) **+** delivery-detail polls every 4s | **≤4s** ✅ |
| **Store** | ❌ **never** | nothing notifies it, nothing refreshes | **manual page reload only** |
| **Admin** | ❌ **never** | subscribes to `orders` INSERT + `deliveries` only | **manual page reload only** |

**Root cause, double-checked:** the DB emits **7 notification kinds**
(`new_store_order`, `order_cancelled`, `order_cancelled_by_admin`, `order_cancelled_no_rider`,
`new_job`, `try_started`, `delivery_failed`, plus `item_kept`/`item_returned` from 023).
The store panel's `OrderAlertsProvider` consumes **exactly one** — it hard-filters
`kind !== "new_store_order"` in *both* the 8-second poll and the realtime handler. And no
store page (`/orders`, `/orders/[id]`, `/returns`, dashboard) has any `setInterval`,
`postgres_changes`, or `router.refresh` at all.

### 2.1 — [D] Store never learns a customer cancelled — ✅ FIXED (PR #66)
✅ Verified: migration 054 **does** insert an `order_cancelled` notification for every active store
manager. The row lands in the database. The store UI then **throws it away**. A store manager
keeps picking and packing an order that no longer exists — and under the upfront-fee model that
order already took the customer's ₹49.

Migration **060** also recreates `cancel_order_by_admin` (058) to fix the leftover *"cancelled by
**Fitzo** support"* wording in the two notification bodies it writes — one to the customer, one to
every store manager. 059 did not touch that function, so until 060 lands, every admin cancellation
tells the customer the old brand name.

### 2.2 — [D] No keep/return decision reaches the store at all — ✅ FIXED (migration 060)
✅ Verified: `notify_rider_on_decision` (023) notifies **only** `rider_user_for_order`. There is no
store-side equivalent. The store's stock moves (047 release triggers) and its earnings change,
but its screen doesn't. Needs a new trigger (migration **060**) + widening the store's kind filter.

### 2.3 — [D] Store panel has no live refresh on any screen — ✅ FIXED (PR #66)
Even with notifications fixed, `/orders` and `/returns` render once. Add the 4s-poll pattern the
agent app already uses — it's proven and needs no new infrastructure.

### 2.4 — [D] Admin orders list is manual-refresh only
Lower priority than the store (admin is 2 people who can hit reload), but it's the same shape.

---

## PHASE 3 — Launch-blocking infrastructure

### 3.1 — [J] W2.2 hosting — 4 sites + env vars 🔴 the single biggest bottleneck
**Platform: Firebase App Hosting** (PR #64, merged 2026-08-17 — the plan's "Netlify" is superseded).
Three separate things are stuck behind "there is no public URL":
- The Razorpay **`payment.captured` webhook has never once been observed working** — Razorpay
  cannot reach localhost. This is the recovery path for "customer closed the tab after paying",
  and it got *more* load-bearing when payment moved to the checkout screen.
- **Prod admin MFA** can't be switched on (it's env-var driven, and there's no deployment).
- The **stale-offer sweep** stays unscheduled (needs a job runner that can reach Razorpay).

⚠️ Machine drift (2026-08-12, **Jay's** machine — reconciled since: Dilip's machine has all of
these present, so this was drift, not a missing config): `apps/admin/.env.local` has **no Razorpay keys** and **no**
`NEXT_PUBLIC_ADMIN_REQUIRE_MFA` / `ADMIN_EMAIL_ALLOWLIST`. `apps/customer/.env.local` has **no**
`RAZORPAY_WEBHOOK_SECRET` and none of the auth feature flags. So locally: admin refunds
(migration 041) and the admin cancel-and-refund action (058) **will fail**, and admin MFA is off.
This may just be your machine drifting from Dilip's — worth reconciling before you debug a ghost.

### 3.2 — [J] W1.2 SMS/DLT (MSG91) + SMTP signup — ✅ domain no longer blocking
**`fitxo.co.in` is bought**, so the domain half of this line is closed; SMS/DLT (MSG91) and SMTP
remain. Phone-OTP login is currently flag-disabled precisely because these are missing.

### 3.3 — [J] W2.4 custom SMTP on both Supabase projects
✅ Verified: `mailer_autoconfirm` behaviour means **every account today is unverified**. Cannot turn
email confirmation on until real SMTP exists or signup breaks on the built-in sender's rate limit.

### 3.4 — [J] W2.5 Sentry × 4 apps + uptime — ✅ verified: zero error tracking exists today

### 3.5 — [J] W2.3 branch protection on `main` — CI is green, the rule was never switched on (5 min)

---

## PHASE 4 — Customer panel features still missing

### 4.1 — [J] W3.1 slot booking (A2) — needs migration 060+
✅ Verified: **zero** slot-related code in `app/checkout/`. But the homepage and marketing copy
already promise slot-based delivery. Today the customer picks nothing.

### 4.2 — [J] W3.2 coupon UI (A4) — the DB half is done, the screen half doesn't exist
✅ Verified: `validate_coupon` RPC is **live on dev**, and **no file in any app calls it**.
✅ Verified: the `coupons` table has **0 rows** — so there is nothing to test against either.
⚠️ Blocked on a decision first: with pay-per-item Keep, is the discount **prorated per item** or
applied to the **kept total**? Showing a discount you never charge is the exact fake-UI bug A1 killed.

### 4.3 — [J] W3.3 honesty/copy sweep — ✅ each item below verified live
- **`/reviews` serves fabricated testimonials** from `lib/mockData.ts` under the heading
  *"Real reactions from people using…"*. Not linked from nav, but publicly reachable. It also still
  advertises "pay-later checkout", which stopped being true on 2026-07-26.
- **"Try First, Pay Later"** still appears in `ProductInfo.tsx`, `BagPageView.tsx`, `LoginPanel.tsx`
  — the ₹49 delivery fee is now charged **upfront at checkout**. Checkout itself was fixed; these three weren't.
- **Footer social links point at bare `facebook.com`, `x.com`, `instagram.com`, `tiktok.com`,
  `snapchat.com`** — clicking "Instagram" lands on Instagram's homepage, not a brand account.
- **Two live placeholder routes:** `/try-timer` and `/ai-style-setup` both render a
  "reserved for…" stub to anyone who navigates there.

### 4.4 — [J] W4.2 transactional emails — ✅ verified: no mail library anywhere in the monorepo
(no nodemailer/resend/sendgrid/postmark). Confirmed / on-the-way / receipt / refund all unbuilt.

### 4.5 — [J] Customer cannot file a complaint 🟠 gap in the support story
✅ Verified: **no complaints UI in the customer app.** Riders can file (`rider_fail_delivery` →
Admin > Complaints) and admin can manage them (8 rows exist on dev). The customer — the person
whose ₹49 is stuck — has no route in. This undercuts the whole runbook support flow.

---

## PHASE 5 — Quality & scale (not launch-blocking, but cheap now / expensive later)

- **[J] W4.3 Playwright E2E** — ✅ verified: no playwright config, no `e2e/` directory. The
  order → try → keep/return loop has never been tested automatically.
- **[J/D] ESLint** — ✅ verified: **no ESLint config in any app or package.** This is why the CI
  lint job was deliberately excluded (`next lint` drops into an interactive prompt and hangs CI).
  Configure it, then add the lint job.
- **[D] Test coverage** — ✅ verified: 39 tests across **6 files, all pure `lib/` logic**
  (`addresses`, `sort`, `storeConflict`, `onboarding`, `productForm`, `productImages`).
  **Zero tests** on server actions, RPCs, the agent app, or the admin app — i.e. zero on the money paths.
- **[D] Admin server-side pagination** — ✅ verified: no `.range()`/page-size logic anywhere in
  `apps/admin/app/admin`. Fine at 60 orders, breaks well before 5,000.
- **[J] Delete 11 stale merged local branches** + the 224-file `.claude/worktrees` copies that
  pollute every repo-wide search.

---

## PHASE 6 — Business (A + D, runs in parallel with all code work)

- **[D] Support contact — last runbook gate.** ✅ Verified live in the DB *right now*:
  `contact_email = "support@fitxo.co.in"` (set by migration 059, still a **placeholder**),
  `support_phone = ""`. The rename is done, so what remains is the real question: **make that
  mailbox exist on the new Fitxo email and confirm somebody reads it**, then set a phone if there
  is one. A customer with a payment problem currently mails an address nobody has confirmed.
- **[A/D] Entity + GST + CA call** — still the gate on Razorpay live KYC and payouts.
- **[D] W4.8 M4 tax provisions** (migration 055, the reserved hole) — needs CA input.
- **[D] W5.2 Razorpay LIVE cutover** — the rotation runbook exists and was proven on test keys.
- **[D+J] W5.3 seed real stores/riders · W5.4 live dry-run.**
  ✅ Current dev data: 10 stores, 56 products, 482 variants, 6 riders, 60 orders, 19 payments,
  23 users, 8 complaints, **0 coupons**.

---

## Suggested order of attack

| # | Task | Owner | Why this position |
|---|---|---|---|
| ~~1~~ | ~~FITXO domain clearance~~ — ✅ `fitxo.co.in` bought. **[A] trademark search still open** | **A** | the code shipped ahead of this; see 0.1 |
| ~~2~~ | ~~Verify prod = dev~~ — ✅ **DONE 2026-08-17**: both at 060, no drift, prod empty | **D** | done |
| ~~3~~ | ~~Codebase rename to FITXO~~ — ✅ **DONE**, PR #63 + migration 059 | **J** | done 2026-08-16 |
| ~~4~~ | ~~Store cancel/return propagation (2.1–2.3, mig 060)~~ — ✅ **DONE**, applied dev + prod | **D** | done 2026-08-17 |
| 5 | Netlify 4 sites (W2.2) | **J** | unblocks webhook + prod MFA + sweeps |
| 6 | Reconcile `.env.local` across machines | **J + D** | stops you debugging phantom failures |
| 7 | Prove the Razorpay webhook on a real URL | **D** | first thing possible once #5 lands |
| 8 | Honesty/copy sweep (W3.3) | **J** | fastest credibility win; pure deletion |
| 9 | SMTP + Sentry + branch protection | **J** | |
| 10 | Slot booking (W3.1) | **J** | the copy already promises it |
| 11 | Coupon decision, then coupon UI (W3.2) | **J** (+D on the rule) | |
| 12 | Transactional emails (W4.2) | **J** | needs #9 |
| 13 | Customer complaint UI (4.5) | **J** | needs a real support address (#14) |
| 14 | Support contact + entity/GST/KYC | **A + D** | long lead time — start early, finishes late |
| 15 | ESLint → CI lint job → Playwright E2E | **J/D** | |
| 16 | Razorpay live cutover + dry-run | **D + J** | last — and note the **new Fitxo Razorpay account** reissues all three credentials, so treat it as a full 4-place rotation |

---

## What I could NOT verify (someone must check by hand)

1. ~~Prod database state~~ — ✅ **resolved 2026-08-17** (Dilip ran the checks; both environments at
   060, no drift, prod empty at 0 orders / 0 stores). Still open on prod: the **`verify-env.sh` RLS
   audit**, which needs psql and a connection string.
2. **Trademark status of FITZO or FITXO** — registry is not reachable from here.
3. ~~fitxo.in domain availability~~ — ✅ resolved: **`fitxo.co.in` is bought**.
4. **Whether pg_cron jobs are actually scheduled and firing** — not exposed over the REST API.
5. **Anything requiring a login** — I verified all four panels boot and render clean (zero console
   errors), but everything behind the admin/store/rider sign-in walls is code-verified, not click-tested.
