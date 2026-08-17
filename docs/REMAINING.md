# FITXO — What's Actually Remaining (audit draft)

**Audited 2026-08-12 against live code + the live dev database**, not against `PROGRESS.md`.
Owner tags: **J** = Jay · **D** = Dilip · **A** = Amit.

> **How to read this:** every line marked ✅ *verified* was checked against real code or a real
> DB query during this audit. Lines marked ⚠️ *unverified* are things I could **not** confirm from
> this machine and someone must check by hand. Nothing here is assumed from the old docs.

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

⚠️ **Unverified: the prod project** (`bozqclrtbxkjevgztruc`). No prod credentials on this machine —
**D must run the same check against prod** before trusting any "applied to prod" claim.

**Next free migration number = 059.** (055 is a reserved hole for M4 tax; 043–054 + 056–058 exist.)

---

## PHASE 0 — Decide before writing any code

### 0.1 — [A + J] Clear the name FITXO *before* the rename lands 🔴 BLOCKING
The move off Fitxo happened because the name was contested. **Do not repeat the mistake in the
other direction.** As of 2026-08-05 Amit was preparing the FITXO filing (Class 35 primary,
Class 25 defensive, ₹4,500/class).

- Confirm whether the **FITXO application was actually submitted**. If it was, that filing and fee
  are now moot and the money is spent — decide whether to abandon or let it lapse.
- Re-run the **Contains + Phonetic** search on **FITXO** across all classes (not exact-match —
  exact-match is what hid the problem last time). Pull the **specification** of any cited mark
  before calling it a blocker or a pass; the class number alone decides nothing.
- Check **fitxo.in** (and .com) availability — the current codebase hardcodes `fitxo.co.in` in 45 places
  and `support@fitxo.co.in` is live in the database.

⚠️ I cannot check the trademark registry or domain availability from here. This is a human step.

### 0.2 — [D] Verify prod matches dev
Run the RPC/schema probe + `verify-env.sh` against prod. Everything below assumes dev ≡ prod;
if it doesn't, that's a hidden launch blocker.

---

## PHASE 1 — The rename (only after 0.1 clears)

### 1.1 — [J] FITXO → FITXO across the codebase
**Now is the cheapest possible moment: there is exactly one open PR (#62) and zero in-flight
feature branches.** Every extra week of building makes this rename bigger.

✅ Verified scope (excluding `node_modules`, `.next`, and 224 stale files under `.claude/worktrees`):

| What | Count | Notes |
|---|---|---|
| Brand strings in `apps/` + `packages/` | ~523 | user-visible — must change |
| `@fitxo/*` package names | 181 | internal only; mechanical, do it in the same PR |
| `fitxo.co.in` domain refs | 45 | blocked on owning fitxo.in |
| Files touched | ~220 real files | across all 4 apps |

**Three traps that a find-and-replace will get wrong** — decide each explicitly:

1. ✅ **localStorage keys** — `lib/mockData.ts` defines `AUTH_STORAGE_KEY = "fitxo-auth"` and
   `PINCODE_STORAGE_KEY = "fitxo-pincode"`. Renaming these **silently signs out every existing
   session and clears saved pincodes**. Either keep the old key strings, or write a one-time
   migration that reads the old key and rewrites it.
2. ✅ **`system_settings.contact_email`** is live in the DB as `support@fitxo.co.in`. A code rename
   does not touch it — it needs an Admin > Settings edit (see 6.1, it's a placeholder anyway).
3. **Outside the repo entirely:** Supabase project names, Razorpay account/business name, the
   GitHub repo name, and any verified-website entry at Razorpay. None of these change by editing code.

---

## PHASE 2 — Cross-panel propagation 🔴 the gap you suspected is real

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

### 2.1 — [D] Store never learns a customer cancelled 🔴 real bug, costs money
✅ Verified: migration 054 **does** insert an `order_cancelled` notification for every active store
manager. The row lands in the database. The store UI then **throws it away**. A store manager
keeps picking and packing an order that no longer exists — and under the upfront-fee model that
order already took the customer's ₹49.

### 2.2 — [D] No keep/return decision reaches the store at all
✅ Verified: `notify_rider_on_decision` (023) notifies **only** `rider_user_for_order`. There is no
store-side equivalent. The store's stock moves (047 release triggers) and its earnings change,
but its screen doesn't. Needs a new trigger (migration **059**) + widening the store's kind filter.

### 2.3 — [D] Store panel has no live refresh on any screen
Even with notifications fixed, `/orders` and `/returns` render once. Add the 4s-poll pattern the
agent app already uses — it's proven and needs no new infrastructure.

### 2.4 — [D] Admin orders list is manual-refresh only
Lower priority than the store (admin is 2 people who can hit reload), but it's the same shape.

---

## PHASE 3 — Launch-blocking infrastructure

### 3.1 — [J] W2.2 Netlify — 4 sites + env vars 🔴 the single biggest bottleneck
Three separate things are stuck behind "there is no public URL":
- The Razorpay **`payment.captured` webhook has never once been observed working** — Razorpay
  cannot reach localhost. This is the recovery path for "customer closed the tab after paying",
  and it got *more* load-bearing when payment moved to the checkout screen.
- **Prod admin MFA** can't be switched on (it's env-var driven, and there's no deployment).
- The **stale-offer sweep** stays unscheduled (needs a job runner that can reach Razorpay).

⚠️ Also verified on **your machine**: `apps/admin/.env.local` has **no Razorpay keys** and **no**
`NEXT_PUBLIC_ADMIN_REQUIRE_MFA` / `ADMIN_EMAIL_ALLOWLIST`. `apps/customer/.env.local` has **no**
`RAZORPAY_WEBHOOK_SECRET` and none of the auth feature flags. So locally: admin refunds
(migration 041) and the admin cancel-and-refund action (058) **will fail**, and admin MFA is off.
This may just be your machine drifting from Dilip's — worth reconciling before you debug a ghost.

### 3.2 — [J] W1.2 SMS/DLT (MSG91) + SMTP signup + **fitxo.in** domain
Now depends on 0.1. Phone-OTP login is currently flag-disabled precisely because this is missing.

### 3.3 — [J] W2.4 custom SMTP on both Supabase projects
✅ Verified: `mailer_autoconfirm` behaviour means **every account today is unverified**. Cannot turn
email confirmation on until real SMTP exists or signup breaks on the built-in sender's rate limit.

### 3.4 — [J] W2.5 Sentry × 4 apps + uptime — ✅ verified: zero error tracking exists today

### 3.5 — [J] W2.3 branch protection on `main` — CI is green, the rule was never switched on (5 min)

---

## PHASE 4 — Customer panel features still missing

### 4.1 — [J] W3.1 slot booking (A2) — needs migration 059+
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
  `contact_email = "support@fitxo.co.in"` (placeholder), `support_phone = ""`. A customer with a
  payment problem currently mails an address nobody has confirmed anyone reads. Also needs the
  rename (0.1/1.1).
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
| 1 | FITXO trademark + domain clearance | **A + J** | everything else is wasted work if the name moves again |
| 2 | Verify prod = dev | **D** | cheap; removes a hidden unknown |
| 3 | Codebase rename to FITXO | **J** | zero in-flight branches right now — cheapest it will ever be |
| 4 | Store cancel/return propagation (2.1–2.3, mig 059) | **D** | live bug with money attached |
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
| 16 | Razorpay live cutover + dry-run | **D + J** | last |

---

## What I could NOT verify (someone must check by hand)

1. **Prod database state** — no prod credentials on this machine.
2. **Trademark status of FITXO or FITXO** — registry is not reachable from here.
3. **fitxo.in domain availability.**
4. **Whether pg_cron jobs are actually scheduled and firing** — not exposed over the REST API.
5. **Anything requiring a login** — I verified all four panels boot and render clean (zero console
   errors), but everything behind the admin/store/rider sign-in walls is code-verified, not click-tested.
