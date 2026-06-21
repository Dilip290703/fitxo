# Fitzo — Build Progress

**This is the living source of truth for what's done.** Claude Code reads this before
starting work and updates it when finishing a task (via `/finish-task`).

Status legend: `[ ]` not started · `[~]` in progress / partial · `[x]` built & merged · `[T]` tested
Owner: put initials (e.g. `J` Jay / `A` Amit) next to in-progress items.

Last updated: 2026-06-04

> **Status (2026-06-04):** Everything below is merged to `main` (no open PRs).
> **Customer panel: standalone screens complete** — Dilip wrapped his customer work
> (Order History, Notifications, Search, Brand pages, How It Works, Size Guide, 404,
> plus the login + navy-button fixes). The core **order → try (rider waits) → keep/return** loop
> is wired (checkout creates a real order + try_session; confirmation + tracking +
> keep/return work). Remaining customer items are flow/Razorpay: **Payment (#13)**,
> Return Pickup (#14), Time Slot (#8), AI Skin Setup (#18) — owned by partner.
> **Store panel (P3) COMPLETE (2026-06-10) — owned by D.** All 14 screens merged +
> browser-verified, with 5 store migrations (004 manager-read, 005 RLS security fix,
> 006 product-write, 007 mark-ready, 008 profile/staff) and seeds under
> `apps/store/seed/`. Store-side writes go through guarded SECURITY DEFINER RPCs.
> Agent panel + Razorpay — partner.
> No automated tests yet. Stack is Supabase (no Firebase).

---

## Foundation
- [x] Monorepo restructure — 4 app folders + shared packages, pnpm workspaces (see Decisions log)
- [ ] 4 hosting projects + subdomains wired (host TBD)
- [x] Supabase schema — full loop now present incl. `try_sessions`, `returns`, `payments`, `payouts` (migration 002) + `order_items` update policy (003).
- [~] RLS policies — enabled across tables; ⚠️ **store-manager visibility of orders containing their products may need a policy** (order_items has no store_id; store sees orders via products.store_id join). Verify/add during Store panel build.
- [~] Auth — customer email+password & phone OTP work; admin email+password works (no 2FA); **store/agent auth not built yet** (store login is the first Store-panel task).
- [~] Razorpay integration (payments) — customer **per-item Keep payment** built & browser-verified in test mode (J, 2026-06-19): `razorpay` SDK + `apps/customer/lib/razorpay.ts` + create/confirm server actions + Razorpay Checkout modal. Settlement goes through a SECURITY DEFINER RPC `confirm_keep_payment` (migration **009**) that re-verifies the HMAC **in-DB** (pgcrypto); secret stored in **Supabase Vault** (`razorpay_key_secret`). Payouts + webhooks still TODO.
- [ ] Razorpay Payouts integration (store + agent)
- [ ] AI skin-tone endpoint — only DB columns + hardcoded display; no endpoint
- [~] Shared UI kit — `packages/ui` exists but thin; admin has its own `components/admin/*`

## P1 — Customer Panel (25)
- [x] 1. Homepage / Landing
- [x] 2. Product Listing Page
- [x] 3. Product Detail Page  *(Supabase-wired; AI skin-tone badge still placeholder)*
- [x] 4. Login / Signup Page  *(LoginPanel, Supabase auth)*
- [~] 5. OTP Verification  *(handled inline in LoginPanel; no standalone screen)*
- [x] 6. Cart / Bag Page  *(CartProvider; localStorage)*
- [x] 7. Checkout — Address Page  *(creates a real order + try_session in Supabase — partner)*
- [ ] 8. Checkout — Delivery-Slot Booking  *(now core to the model — customer picks an available slot; partner)*
- [x] 9. Order Confirmation Page  *(partner)*
- [x] 10. Order Tracking Page  *(timeline + try-window countdown — partner)*
- [~] 11. Try Timer  *(the try-window countdown is built into Order Tracking; no standalone screen)*
- [x] 12. Keep or Return  *(keep/return actions live in Order Tracking — partner)*
- [T] 13. Payment — per-item Razorpay Keep payment — J  *(tap **Keep** on the order-tracking page → Razorpay Checkout → in-DB-verified settle → item flips to "Keeping" + order `payment_status='paid'`. Browser-verified in test mode via UPI `success@razorpay`. Needs migrations 009+010 + the Vault secret. See `docs/HANDOFF-payment.md`.)*
- [~] 14. Return Pickup Scheduling  *(largely obsolete under the new model — returns are handed back to the waiting rider on the spot, no scheduling. Keep only for post-purchase refund returns; partner)*
- [x] 15. Profile Page
- [x] 16. Wishlist Page
- [x] 17. Order History Page — D
- [ ] 18. AI Skin Tone Setup Page  *(placeholder — blocked on AI endpoint)*
- [x] 19. Notifications Page — D
- [x] 20. Brand / Store Page — D
- [x] 21. Search Results Page — D
- [x] 22. How It Works Page — D
- [x] 23. Contact / Support Page
- [x] 24. Size Guide — D
- [x] 25. 404 Error Page — D

## P2 — Delivery Agent Panel (12) — empty shell, not started
- [ ] 1. Agent Login
- [ ] 2. Agent Dashboard / Home
- [ ] 3. Order Detail (Pickup)
- [ ] 4. Order Detail (Delivery)  *(confirm delivery → starts customer try window; rider waits 15–30 min)*
- [ ] 5. Return Collection Page
- [ ] 6. Navigation / Map Screen
- [ ] 7. Agent Earnings Page
- [ ] 8. Agent Profile Page
- [ ] 9. Agent Notifications
- [ ] 10. Order History (Agent)
- [ ] 11. Support Page (Agent)
- [ ] 12. Onboarding / Training (Agent)

## P3 — Store Panel (14) — ✅ COMPLETE, owned by D (built week of 2026-06-04..10; all 14 merged + browser-verified)
> Build order: Login → Dashboard → Catalog → Add/Edit Product → Order Management → Order Detail → rest.
> Data model: store user = role `store_manager` + `store_managers` row (user↔store); products via `products.store_id`; a store's orders via `order_items → products WHERE store_id = mine` (no store_id on order_items). Store dev server runs on **:3003** (`pnpm dev:store`).
- [T] 1. Store Login — D  *(email+pw + store_manager gate, reusable `getStoreContext`, auth-gated root stub; login verified across all conditions in a real browser; PR #11 open)*
- [T] 2. Store Dashboard — D  *(sidebar shell + KPI cards + low-stock & recent-orders panels; migrations 004 & 005 applied; verified in a real browser with seed data — store-scoped RLS confirmed; PR #12 open)*
- [~] 3. Product Catalog Page — D  *(store's own products: table + search/status filter + activate/deactivate + soft-delete; Add/Edit entry points stubbed "Soon" pending #4/#5; layout verified via preview with seed data, write actions pending real-browser test)*
- [T] 4. Add Product Page — D  *(combined with #5 — shared ProductForm at /catalogue/new; migration 006 applied; verified in browser)*
- [T] 5. Edit Product Page — D  *(combined with #4 — shared ProductForm at /catalogue/[id]/edit; RESTRICT-safe variant edits; verified in browser. Images deferred.)*
- [T] 6. Order Management Page — D  *(combined with #7 — /orders list, RLS-scoped, status-bucket filter, per-store subtotal + ready/kept/returned counts; migration 007 applied; verified in browser. Rows are now fully clickable with a › affordance.)*
- [T] 7. Order Detail (Store) — D  *(combined with #6 — /orders/[id]; store's line items + SKU + keep/return outcome; per-item "Mark ready" + "Mark all ready" via guarded set_order_item_prepared RPC; verified in browser. No customer PII (RLS).)*
- [T] 8. Returns Management — D  *(combined with #9/#10 — /returns: read-only tracking (lifecycle owned by agent/admin flow), status filter, condition badges; multi-store leak closed client-side; verified in browser with seed)*
- [T] 9. Earnings Page (Store) — D  *(/earnings: gross kept revenue + payouts ledger + recent kept items; no commission math — commission config doesn't exist yet, see Known issues; verified in browser)*
- [T] 10. Analytics Page (Store) — D  *(/analytics: 30-day CSS bar charts, keep-vs-return rate, top products; verified in browser with seed)*
- [T] 11. Store Profile Settings — D  *(/settings: contact/description/address editable via guarded update_store_profile RPC (migration 008); name/slug/verified stay admin-owned; verified in browser)*
- [T] 12. Staff Management — D  *(/staff: read-only roster via get_store_staff RPC (migration 008 — co-managers' names/emails without widening users RLS); add/remove admin-provisioned; verified in browser)*
- [T] 13. Support Page (Store) — D  *(/support: partner contact + FAQ accordion; static — no complaints table exists yet; verified in browser)*
- [T] 14. Store Onboarding — D  *(/onboarding "Guide": 6-step seller walkthrough; sidebar fully live, no "Soon" chips left; verified in browser)*

## P4 — Admin Panel (21)
> Admin is the most-built panel: 20 of 21 page components are Supabase-wired. Verified by
> static inspection (renders + queries), **not** click-tested. Bonus routes beyond the spec
> list also exist: Brands, Categories, Inventory/Product management (incl. bulk upload).
- [~] 1. Admin Login  *(works; no 2FA yet)*
- [x] 2. Master Dashboard
- [x] 3. All Orders Management
- [x] 4. Order Detail (Admin)
- [x] 5. Customer Management
- [x] 6. Store / Partner Management
- [x] 7. Delivery Agent Management  *(Riders)*
- [x] 8. Revenue & Financial Analytics
- [ ] 9. Payment Records
- [ ] 10. Try & Return Analytics  *(blocked: no try/return data)*
- [~] 11. Live Deliveries Map  *(Deliveries page exists; map view TBD)*
- [ ] 12. Notifications & Alerts Management
- [ ] 13. Complaints & Support Management
- [x] 14. Discount & Promo Code Manager  *(Coupons)*
- [ ] 15. Content Management (CMS)
- [ ] 16. User Role Management
- [ ] 17. Store Payout Management
- [ ] 18. Agent Payout Management
- [~] 19. System Settings — D  *(making it real: `system_settings` table + RLS, persisting commission rate + try-window; replaces the mock toast. Was a mock — toast only, no storage.)*
- [ ] 20. Reports & Export Center
- [ ] 21. Admin Activity Log  *(table exists; no screen)*

---

## Recommended next tasks
**D (Store panel):** Store Login → Dashboard → Product Catalog → Add/Edit Product → Order Management.
**Partner (close the loop + new panel):**
1. **Razorpay Payment** for kept items — the money step that closes the customer loop (#13).
2. Return Pickup scheduling (#14) + Checkout Time Slot (#8).
3. **Agent panel** — rider accepts + confirms delivery (delivery confirmation starts the try window; rider waits 15–30 min while the customer tries on).

## Decisions log (append-only — record anything non-obvious you decided)
- 2026-06-03: Restructured the single Next.js app into a **pnpm monorepo** — one app per panel (`apps/{customer,agent,store,admin}`) + shared `packages/{supabase,ui,config}`. Admin is now a separate build/deploy so admin code & the service-role key never ship in the customer bundle. Kept the `/admin` route prefix inside the admin app to avoid rewriting ~45 links. History preserved via `git mv`. (branch `chore/monorepo-restructure`, PR #1)
- 2026-06-04: Fixed Tailwind v4 CSS-layering bug in customer `globals.css` — unlayered base resets (`a { color: inherit }`) were beating `text-white` on navy `<Link>` buttons; wrapped base resets in `@layer base`.
- 2026-06-04: Extracted size-chart data to `apps/customer/lib/sizeData.ts`, shared by the product SizeChartModal and the new `/size-guide` page.
- 2026-06-04: **Work split** — D wraps the Customer panel (standalone screens) and moves to the **Store panel**. Partner owns Razorpay/customer-loop finish + the Agent panel.
- 2026-06-16: **PRODUCT MODEL PIVOT** — dropped the "try-at-home for 24h + free pickup later" model. New model: customer **books a delivery slot**, the rider brings picks to the door and **waits 15–30 min** while they try on, customer keeps (pays) what they love and **hands the rest back to the rider on the spot** (no scheduled return). Swept all customer + store copy + docs (CLAUDE.md, README, `.claude/` commands). Try-window duration is now a `TRY_WINDOW_MINUTES = 30` constant in `checkout/actions.ts` + admin `OrderActions.tsx` (placeholder — should move to Admin settings and **start on rider arrival**, agent panel). "60-min delivery" replaced by slot-booking copy. (branch `feat/doorstep-try-model`)
- 2026-06-19: **Razorpay Keep payment (#13)** — customer pays **per item** (one Razorpay Checkout per kept item) at the moment they tap "Keep", chosen over a single pay-at-end. Settlement can't be a direct client write (customer app has only the anon key, no service-role), so a SECURITY DEFINER RPC `confirm_keep_payment` re-verifies the Razorpay HMAC in-DB (pgcrypto `hmac`, `search_path` incl. `extensions`) and is the only writer of `payment='success'`/`order paid`. Razorpay **secret lives in Supabase Vault** (`vault.create_secret('…','razorpay_key_secret')`) — Supabase blocks `ALTER DATABASE/ROLE SET` for the SQL-editor role, so GUCs don't work. Migrations **009** (RPC + `payments.order_item_id`) and **010** (see below).
- 2026-06-19: **Found migration 002's RLS policies were missing in the live DB** — `try_sessions`/`returns`/`payments`/`payouts` had RLS *enabled* but **zero policies** (deny-all), which broke checkout (`new row violates RLS for try_sessions`). Migration **010** idempotently recreates exactly those policies. (Migration 005 — re-enable RLS — had already been applied; this was a separate gap.)
- 2026-06-19: **Navbar auth was reading a mock localStorage flag**, not the Supabase session — replaced with `supabase.auth.getUser()` + `onAuthStateChange`. Checkout variant resolver made resilient (falls back to a product's first colour/variant) so an item added without a colour can't abort the order. Added a login-required modal + a checkout confetti celebration.
- 2026-06-19: **Try-window duration — to reconcile:** the doorstep pivot (PR #20) shipped `TRY_WINDOW_MINUTES = 30`; Jay had proposed ~5–7 min on-the-spot. Jay & Dilip to agree on the final value (then move it to Admin settings, see Known issues).

## Known issues / TODO
- **Model pivot follow-ups (2026-06-16):** (1) the functional **delivery-slot picker** isn't built — copy now promises slot booking but Checkout still has no slot UI (maps to customer #8). (2) The **try window still gets its deadline at checkout** (30-min placeholder); it must start when the **rider confirms delivery** (agent panel) — until then the tracking countdown is a placeholder. (3) `TRY_WINDOW_MINUTES` should live in Admin settings alongside the commission rate (same missing `system_settings` storage).
- **No commission/system-settings storage exists** — the admin System Settings screen is a mock (toast only, persists nothing), and there is no `system_settings` table. CLAUDE.md requires the commission rate to be config, so the store Earnings screen shows gross kept revenue + the `payouts` ledger (admin-issued amounts) and does **no** commission math. Needs: a settings table + admin UI + payout computation (ties into Razorpay Payouts, partner/admin scope).
- 🔴 **SECURITY (2026-06-08): RLS was DISABLED on `users`, `orders`, `order_items` in the live DB** — anon key + no session could read all customer PII (names/emails/phones) + all orders. Found while building the Store Dashboard (dashboard showed 6 orders with no session). Policies in schema.sql are intact; RLS had just been turned off. Fix = run **migration 005** (`packages/supabase/migrations/005_reenable_rls.sql`, re-enables RLS on all tables, idempotent). **Affects the customer panel too — apply ASAP.** Verify with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
- **Store panel:** migration **004** (`004_store_manager_read.sql`) adds manager SELECT on products/variants/orders/order_items/returns — required for Dashboard + Orders/Returns/Earnings. Apply before testing the store dashboard.
- **Customer loop:** Payment #13 **done** for the keep path (per-item Razorpay). Delivery-slot booking (#8) is now core and still pending; scheduled Return Pickup (#14) is largely obsolete under the new model. Still pending: Razorpay **payouts** + a **webhook** (today the payment is confirmed only client-side via the success handler — if the customer closes the tab right after paying, the order won't be marked paid; a `payment.captured` webhook should be added before production).
- **Razorpay env:** test keys live in `apps/customer/.env.local` (gitignored — NOT in git). Any teammate must add `NEXT_PUBLIC_RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to their own `.env.local`. **Regenerate the test secret before going live** (it was shared in chat). At deploy, swap to live keys + update the Vault secret + add a verified-website + webhook.
- Store-manager RLS for viewing orders that contain their products likely needs a policy (order_items has no store_id → join via products.store_id). Verify during Store build.
- No automated tests anywhere (0). `/finish-task` should start adding smoke tests per screen.
- Admin has no 2FA (spec requires it for admin login).
- AI skin-tone endpoint not built; Product Detail badge + AI Style Setup are placeholders.
- Hosting provider not chosen (does not affect code; decide before Week 8).
- `agent` app is still an empty shell; `store` app is now in active development (D).
