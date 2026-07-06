# Admin Panel Audit — Phase 0 Diagnostic

**Date:** 2026-07-03 · **Branch:** `feature/admin-panel-rework` · **Scope:** read-only; nothing changed.
**Method:** static trace of every screen, server action, and the relevant migrations/RLS; verified the customer bundle question by grep across apps/packages.

Screens audited: the 21 spec screens plus 4 bonus routes that exist beyond the spec
(Inventory incl. bulk-upload, Brands, Categories, Deliveries).

---

## 🔴 S. SECURITY (mandatory check) — read this first

### S1. Customer-bundle exposure: **CLEAN (severity: Low)**
The question was whether admin routes/code ship in the customer JS bundle. They do not:

- Admin is a **separate Next.js app** (`apps/admin`), split out in the 2026-06-03 monorepo restructure. `apps/customer/app/` contains no `/admin` route and zero imports from admin code (verified by grep).
- The service-role key is referenced **only** in [admin.ts](apps/admin/lib/supabase/admin.ts) (server-side factory) — never in `packages/supabase` (anon + SSR only), never in customer/store/agent.
- What an attacker inspecting the customer bundle sees: the Supabase URL + **anon key** (by design — RLS is the security boundary) and the customer app's own code. No admin URLs, no admin logic, no privileged keys.
- **Residual risk** is RLS regression, not bundle leakage — exactly the 2026-06-08 incident (RLS disabled in live DB → anon could read all PII). Recommended fix path: keep the `SELECT tablename, rowsecurity FROM pg_tables` re-check as a pre-deploy step; longer-term a tiny CI script that runs it against the project. No repo restructuring needed — it's already correct.

### S2. 🔴 **CRITICAL: `store_manager` role is admitted into the admin panel**
[middleware.ts:43](apps/admin/middleware.ts:43) and [layout.tsx:27](apps/admin/app/admin/layout.tsx:27) both treat `role === 'store_manager'` as admin (`isAdmin = role === 'admin' || role === 'store_manager'`), and [login/page.tsx:34](apps/admin/app/admin/login/page.tsx:34) accepts them too. This looks like a localhost cookie-sharing workaround that shipped as an auth rule.

Since the 2026-07 store rework, **store-manager signup is public self-serve** (migration 029). So today, anyone on the internet can create an account on the store login page and then open `admin.fitzo.in` and pass the gate.

What they can then do is bounded by two layers, and the second one is broken — see S3.

### S3. 🔴 **CRITICAL: no service-role server action verifies the caller is an admin**
RLS itself is correct — `is_admin()` is strictly `role = 'admin'` ([schema.sql:487](packages/supabase/schema.sql:487)), so SSR/browser reads with the anon key are properly scoped. But every admin **server action** writes through `createAdminClient()` (service role, bypasses RLS) with **no role check on the caller** — verified across all 9 action files; the only guards that exist are "is authenticated" and business validation:

| Action | File | What a store_manager could do |
|---|---|---|
| `changeUserRole` | [users/actions.ts:10](apps/admin/app/admin/users/actions.ts:10) | **Promote any account to `admin`** (only blocks changing *your own* role — a second account escalates to full admin) |
| `updateSettings` | [settings/actions.ts](apps/admin/app/admin/settings/actions.ts) | Change commission rate, try window, delivery fee (doesn't even require a session — `user?.id ?? null`) |
| `sendNotification` | [notifications/actions.ts](apps/admin/app/admin/notifications/actions.ts) | Spam every user on the platform |
| `recordStorePayout` / `recordAgentPayout` | payouts/agent-payouts `actions.ts` | Forge payout-ledger entries |
| `updateComplaint`, `saveContentBlock`, inventory CRUD | respective `actions.ts` | Tamper with complaints, CMS, catalog |

Also: [stores/page.tsx:6](apps/admin/app/admin/stores/page.tsx:6) renders the store **list** with the service-role client, so an admitted store_manager sees every store including drafts/rejections. (The store *detail* page uses the SSR anon client, so KYC/bank in `store_business_details` stays RLS-protected — good.)

**Fix path (Phase 1, small):** (1) middleware/layout/login accept `role === 'admin'` only; (2) a shared `requireAdmin()` helper (SSR session → check `users.role === 'admin'`, throw otherwise) as the first line of **every** server action that touches `createAdminClient()`. Defense in depth: both, not either.

### S4. No 2FA on admin login (spec requires it)
Email+password only, no rate limiting beyond Supabase defaults. Fix path: Supabase Auth MFA (TOTP) enrollment + `aal2` check in middleware. Cheap stopgap that fits a 2-user panel: an **email allowlist** (Jay + Amit) checked in middleware alongside the role. Recommend both.

---

## A. Real-world coverage gaps

### A1. Morning routine — "what needs attention today?"
**There is no single view that answers this.** The dashboard ([page.tsx](apps/admin/app/admin/page.tsx)) shows: today's orders/revenue, active-delivery count, try-window count, returns count, low stock, 2 charts, recent orders. All *status*, no *queue*. Missing entirely:

- Failed payments (exists only as a tab inside Payments)
- **"Keep decided but not paid"** — no view anywhere joins `order_items.decision='keep'` with unpaid `payments`; this is real money silently stuck
- Open complaints count
- Payouts due (store + agent)
- Stores awaiting onboarding review (surfaced only inside the Stores page)
- Unassigned/waiting-for-rider deliveries (only on Deliveries page)
- **Expired-but-stuck try windows** (see A2d)

Morning routine today = visiting 7 screens. Phase 2's "Needs Attention" design fixes exactly this.

### A2. When an order goes wrong

a) **Customer unreachable / rider didn't show** — Deliveries page has Assign + "Release back to pool" ([DeliveriesClient.tsx:55](apps/admin/app/admin/deliveries/DeliveriesClient.tsx:55)), which covers reassignment. But `delivery_status = 'failed'` exists in the enum and **no admin UI path can set it** — a hopeless delivery can only be Released (loops forever) or the whole order Cancelled.

b) **Admin status override** — [OrderActions.tsx](apps/admin/app/admin/orders/[id]/OrderActions.tsx) offers only the *next* linear step + Cancel. Can't move backwards, can't jump states, **no reason field**, and **Cancel Order has no confirmation dialog** (Block Customer does — inconsistent). It is activity-logged (good). Cancelling doesn't restock, doesn't touch payments, doesn't fail the delivery → orphaned rows.

c) **Payment failed after keep decision** — the keep flow confirms only client-side success (no webhook yet, known). If payment fails/tab closes: item shows "keep", payment stays `initiated`/`failed`, and admin has **no path**: Payments is read-only, there's no "resend payment link", no mark-paid-with-reason, no refund. Not even surfaced as a problem list.

d) **Timer expired without decision** — migration 027's self-heal fires from the *customer's* tracking page; the pg_cron sweep is **commented out**. If the customer never reopens the page and the rider never completes, the order sits in `try_window_active` forever, and admin has no "expired & stuck" view. Compounding it, the Orders-list deadline column is **broken**: [OrdersClient.tsx:94](apps/admin/app/admin/orders/OrdersClient.tsx:94) computes **hours** (`/3600000`) for what is now a 7-minute window → every active window renders "Expired". The order *detail* page correctly uses minutes.

e) **Item damaged in try-on** — rider records return `condition`; admin can see it in Try-analytics aggregates but there is no item-level admin action (write-off, dispute with store, partial refund). No path.

### A3. Money reconciliation — can you trace one order end-to-end?
**No.** The pieces exist but never join:

- `payments` has no Razorpay **fee** column ([002_try_loop.sql:53](packages/supabase/migrations/002_try_loop.sql:53)) → Razorpay's cut is invisible; "net Fitzo margin" is not computable in-panel.
- No per-order view of: customer paid → commission → store payout → agent payout → margin. You'd open 4 screens and a calculator.
- **Analytics vs Payments will disagree by design**: Analytics sums `orders.final_amount` (includes delivery fee); the payments ledger holds **per-item keep payments** (delivery fee is never charged through Razorpay — COD collects it in cash, prepaid doesn't collect it at all, a known checkout gap). Nothing in the UI explains the mismatch — a founder doing reconciliation will think the numbers are wrong.

### A4. Payout day
- "Record payout" works (ledger insert marked `paid`); math is computed server-side and shared between display and write (good pattern, [compute.ts](apps/admin/app/admin/payouts/compute.ts)).
- Actual disbursement is Razorpay-stubbed (known/planned) — so there is no "payout failed" state to handle *yet*; when Razorpay Payouts lands, the current insert-as-paid flow has no failure path to hang it on.
- **No dispute handling, no partial payout, no receipt/download** (Reports can CSV the payouts table, that's it).
- 🔴 **Double-payout protection is missing for stores**: `agent_payouts` has `UNIQUE (rider_id, order_id)` (migration 020) but **`payouts` has no unique constraint** (migration 002) → a double-click or two concurrent calls duplicates ledger rows and overstates "paid". One-line migration + `upsert`/`onConflict` fixes it.

### A5. Onboarding
- **Store:** self-serve signup → wizard → admin approve/reject with reason works end-to-end (built 2026-07, browser-verified). Admin's manual "Add Store" creates a store with **no manager**; linking one requires the separate User Roles screen with no cross-link or hint — clunky but functional.
- **Rider:** self-serve signup on the agent app (migration 015 auto-provisions), admin verifies via toggle on the rider page. Works. The verify toggle has **no confirmation** and flips instantly — minor.
- Credential sharing is a non-issue now (both roles self-serve their own passwords). ✓

### A6. Dead-end buttons & scenarios with no UI path
| # | Finding | Where |
|---|---|---|
| 1 | **Store detail "Recent Orders" is always wrong/empty** — queries `orders.eq('user_id', storeId)` (a customer column, not the store relation; store orders come via `order_items → products.store_id`) | [stores/[id]/page.tsx:15](apps/admin/app/admin/stores/[id]/page.tsx:15) |
| 2 | Payments has a **"Refunded" tab but no refund mechanism exists anywhere** — nothing can ever set that status | [PaymentsClient.tsx:29](apps/admin/app/admin/payments/PaymentsClient.tsx:29) |
| 3 | **CMS manages `content_blocks` that no app reads** — zero consumers in customer/store/agent (verified by grep). A whole screen + migration 013 with no output | `/admin/content` |
| 4 | Orders-list try-deadline shows hours for a 7-min window → always "Expired" | [OrdersClient.tsx:94](apps/admin/app/admin/orders/OrdersClient.tsx:94) |
| 5 | `TRY_WINDOW_MINUTES = 7` **hardcoded** in OrderActions while System Settings edits `system_settings.try_window_minutes` — the settings screen changes a value this code ignores | [OrderActions.tsx:37](apps/admin/app/admin/orders/[id]/OrderActions.tsx:37) |
| 6 | No admin path to set `delivery_status='failed'` (enum value orphaned in admin UI) | Deliveries |
| 7 | **Customers have no complaint-submission UI** (complaints table is fed only by store-panel tickets) — Admin Complaints will stay near-empty for its primary audience. Backlog item for the customer panel, not this rework | `/admin/complaints` |
| 8 | No refund / mark-paid / payment-retry action for the failed-after-keep scenario | Payments / Order detail |

---

## B. UX & friction (graded)

### Critical
- **Dashboard surfaces vanity stats, not actions** (A1). Charts occupy the prime real estate; queues don't exist.
- **No global search.** Finding an order by phone number = open Orders, wait for the full-table fetch, type into a client-side filter. No jump-to by order #/phone/store anywhere in the header.
- **Full-table fetches with client-side filtering** on the heaviest screens: Orders ([orders/page.tsx:15](apps/admin/app/admin/orders/page.tsx:15) — every order ever, with 2 joins), Payments, Customers, Users. Fine at today's volume, but there's no server pagination/filtering to grow into, and every page load re-downloads everything.

### Major
- **Destructive-action inconsistency:** Block Customer has a ConfirmDialog + log; **Cancel Order has neither confirm nor reason**; rider Verify/Available toggles are instant. All are logged (good) but none support undo.
- **Cross-linking gaps:** Order detail links to customer ✓ but **not to the store** (no store surface at all on an order) and **not to its payment record**; payment rows link to the order but not vice versa; deliveries link to orders ✓. "From an order, jump to customer/store/agent/payment in one click" currently scores 1/4.
- **Sidebar is a flat 23-item emoji list** ([AdminSidebar.tsx](apps/admin/components/admin/AdminSidebar.tsx)) with no grouping — every navigation is a visual scan of 23 rows.
- **Filter state lives in `useState`** — nothing in the URL: no persistence across refresh, no shareable "here's the failed-payments view" links, back-button loses context.
- No keyboard affordances anywhere (no shortcuts, no focus management in dialogs beyond ConfirmDialog).

### Minor
- Visual drift from the upgraded Store Panel: admin is raw `gray-800/900` hexes + emoji icons; store panel has semantic tokens, SVG icons, PageHeader/StatCard/StatusBadge/Skeleton primitives. Same-family components exist here (DataTable, StatsCard, StatusBadge, ConfirmDialog, Toast) but styled differently — reuse is a port, not a rebuild.
- Dashboard "Try Windows Active" counts sessions but shows no deadlines; "Low Stock" links into Inventory which is arguably not admin's job anymore (see D).
- `AdminHeader` title is static ("Admin Panel") on most pages.

---

## C. Core logic & data

### C1. Order status state machine
Enum: `pending → confirmed → assigned → out_for_delivery → delivered → try_window_active → return_requested → return_picked → completed | cancelled` ([schema.sql:19](packages/supabase/schema.sql:19)).
- Admin UI walks a **linear** subset (skips `assigned`/`delivered` — those belong to the rider RPC flow) + Cancel from any non-terminal state.
- There is **no transition guard in the DB** — admin's direct `update` (and any RLS-admin write) can produce states the rider flow never expects (e.g. cancel during `try_window_active` leaves the rider's live delivery + try session dangling; nothing closes them).
- Two writers race on `orders.status`: admin buttons vs rider SECURITY-DEFINER RPCs. No version check/optimistic lock — last write wins silently.
- Verdict: acceptable for 2 careful users **if** override gets a confirm + reason and cancel cleans up (fail delivery, expire try session).

### C2. Payout logic
- Server-side recompute before write (never trusts client amounts) ✓; display and write share one compute module ✓.
- 🔴 `payouts` lacks `UNIQUE(store_id, order_id)` → duplicate-insert race (A4). `agent_payouts` has it.
- Razorpay Payouts not integrated (stubbed, known); when it lands, mid-batch failure handling must be designed — current shape (insert all rows as `paid` in one call) has nowhere to record a partial failure.

### C3. RLS
- Admin data access is enforced **server-side for all anon-key paths** — `is_admin()` is strict and per-table `*_admin_all` policies exist. Hidden-UI-only protection is *not* the pattern here ✓.
- The enforcement hole is app-layer: service-role server actions without caller checks + the `store_manager` middleware admit (S2/S3). RLS can't save you when the app hands out the service role.

### C4. Query efficiency (heavy tables)
- Orders / Payments / Customers / Users pages: unbounded `select *`-ish fetches, client-side sort/paginate in DataTable. Analytics fetches **all** `order_items` rows to aggregate in JS. Payout compute fetches all kept items + full ledger per render.
- At pre-launch volume: harmless. Before real traffic: Orders and Payments need server pagination + indexed filters (indexes already exist on the right columns). Flagging, not fixing, per scope.

---

## D. CUT / SIMPLIFY / KEEP — per screen (recommendations only)

| # | Screen | Verdict | Why / what changes |
|---|---|---|---|
| 1 | Login | **KEEP** | Add MFA + email allowlist + drop store_manager admit (S2/S4) |
| 2 | Master Dashboard | **KEEP (rebuild)** | Action-first per Phase 2; absorbs Active Deliveries list from the map cut |
| 3 | All Orders | **KEEP** | Phase 3: server filters, saved views, fix deadline column |
| 4 | Order Detail | **KEEP** | Add timeline, store/payment links, safe override w/ reason |
| 5 | Customers | **KEEP** | Healthy as-is; minor polish only |
| 6 | Stores | **KEEP** | Fix the recent-orders bug; onboarding review flow is good |
| 7 | Riders (Agents) | **KEEP** | Add confirm on verify; otherwise fine |
| 8 | Revenue Analytics | **SIMPLIFY** | One analytics screen is plenty pre-launch; label the payments-vs-orders discrepancy (A3); absorb Try & Return content |
| 9 | Payment Records | **KEEP** | Read-only is right; becomes the anchor for the Phase-3 reconciliation view |
| 10 | Try & Return Analytics | **SIMPLIFY (merge)** | Fold keep-rate + returns-by-condition into Analytics as a section; a standalone screen for a metric with near-zero volume is over-engineering |
| 11 | Live Deliveries Map | **CUT (approved)** | It's a keyless address-embed iframe, not live tracking — no rider GPS exists in the data model. Replace with dashboard Active Deliveries list. **Schema cleanup: none needed** — it reads only shared `deliveries` columns (`status`, `drop_address`, joins); no map-specific tables/columns, no location polling anywhere |
| 12 | Notifications Manager | **KEEP** | Compose/send + history earn their keep (used for real ops comms). No delivery-rate analytics exists — nothing to cut there |
| 13 | Complaints | **KEEP** | Flag: customer submission UI doesn't exist yet (A6.7), so triage volume ≈ store tickets only |
| 14 | Promo Codes (Coupons) | **KEEP** | Verified consumed by customer checkout (CouponCard) |
| 15 | CMS (Content) | **CUT / park** | Zero consumers (A6.3). Hide from nav + keep code dormant until the customer site actually reads `content_blocks`; wiring it is customer-panel work, not admin |
| 16 | User Role Management | **KEEP (tighten)** | Guard the action (S3). Recommend also removing "grant admin" from the UI entirely — for a 2-founder team, admin grants via SQL are safer than a button |
| 17 | Store Payouts | **KEEP** | Add unique constraint + requireAdmin |
| 18 | Agent Payouts | **KEEP** | Same guard; constraint already exists |
| 19 | System Settings | **KEEP** | Wire its consumers — the hardcoded 7-min try window ignores it today (A6.5) |
| 20 | Reports & Export | **KEEP** | Simple client-side CSV — appropriately boring. No scheduled-reports feature exists — nothing to cut |
| 21 | Activity Log | **KEEP** | Already wired into every mutation; the best part of the panel |
| +1 | Inventory (+ bulk upload, + new/edit) | **SIMPLIFY** | Bonus route. Under the self-serve model, **stores own their catalogs** — admin product *creation* duplicates the store panel and bypasses store ownership. Recommend: read-only browse + moderate (deactivate), park bulk-upload/new behind it. Decide: do founders still seed catalog centrally? |
| +2 | Brands | **SIMPLIFY (merge)** | Bonus route. Merge Brands + Categories into one "Catalog taxonomy" screen with tabs — two nav items for two tiny CRUD tables is noise |
| +3 | Categories | **SIMPLIFY (merge)** | See above |
| +4 | Deliveries | **KEEP (promote)** | Bonus route that becomes *more* important after the map cut — it's the real ops surface (assign/release, riders-online count). Add "mark failed" |

Net effect if all accepted: 25 nav items → ~17, one screen deleted, two merged, two parked.

---

## E. Top 10 fixes, ranked by operational impact ÷ effort

1. **Lock the door** — admin-only middleware/layout/login + `requireAdmin()` in every service-role action (S2/S3). *Critical impact, small effort.*
2. **`UNIQUE(store_id, order_id)` on `payouts`** + insert with conflict handling (C2). *Money integrity, one migration.*
3. **Fix the try-deadline hours bug + read the window from `system_settings`** (A2d, A6.5) — the panel currently lies about every active try window. *High, tiny.*
4. **Rebuild dashboard action-first** (Phase 2 spec) with the Active Deliveries list replacing the map. *Highest daily-use impact, medium effort.*
5. **Apply the cuts** — map screen out, CMS parked, try-analytics merged, brands+categories merged (D). *Removes noise, small.*
6. **Store-detail orders query bug** (A6.1) — one line. *Small but it's a founder-facing lie.*
7. **Safe status override**: confirm dialog + required reason on Cancel/override, cancel cleans up delivery/try session (A2b, C1). *High, small-medium.*
8. **Global header search** — order # / phone / store name → jump (B-Critical). *High, medium.*
9. **Per-order reconciliation strip** on Order Detail: payment → commission → store payout → agent payout → margin, with the delivery-fee caveat labeled (A3). *High for payout day, medium.*
10. **2FA (Supabase TOTP) + founder email allowlist** on login (S4). *High security, medium.*

Honorable mentions (cheap, fold into whichever phase touches them): confirm on rider-verify, "mark delivery failed" action, static header title → per-page.

---

## The 5-minute bad-delivery-day test (success criterion)

Today: Jay hears a delivery went wrong → checks dashboard (nothing actionable) → Orders (deadline column lies) → order detail (no store link, no payment link, cancel has no cleanup) → Deliveries (can release, can't fail) → Payments (read-only, can't refund). **Fails the test — ~5 screens, several dead ends.**

After Phases 1–3 (cuts + action dashboard + order/money rework): dashboard row → order detail with timeline + one-click links + safe override + reconciliation strip → done. That's the bar for the rework.
