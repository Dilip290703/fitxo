# Fitzo — Build Progress

**This is the living source of truth for what's done.** Claude Code reads this before
starting work and updates it when finishing a task (via `/finish-task`).

Status legend: `[ ]` not started · `[~]` in progress / partial · `[x]` built & merged · `[T]` tested
Owner: put initials (e.g. `J` Jay / `A` Amit) next to in-progress items.

Last updated: 2026-06-04

> **Status (2026-06-04):** Everything below is merged to `main` (no open PRs).
> **Customer panel: standalone screens complete** — Dilip wrapped his customer work
> (Order History, Notifications, Search, Brand pages, How It Works, Size Guide, 404,
> plus the login + navy-button fixes). The core **order → 24h try → keep/return** loop
> is wired (checkout creates a real order + try_session; confirmation + tracking +
> keep/return work). Remaining customer items are flow/Razorpay: **Payment (#13)**,
> Return Pickup (#14), Time Slot (#8), AI Skin Setup (#18) — owned by partner.
> **Now in progress: Store panel (P3) — owned by D.** Agent panel + Razorpay — partner.
> No automated tests yet. Stack is Supabase (no Firebase).

---

## Foundation
- [x] Monorepo restructure — 4 app folders + shared packages, pnpm workspaces (see Decisions log)
- [ ] 4 hosting projects + subdomains wired (host TBD)
- [x] Supabase schema — full loop now present incl. `try_sessions`, `returns`, `payments`, `payouts` (migration 002) + `order_items` update policy (003).
- [~] RLS policies — enabled across tables; ⚠️ **store-manager visibility of orders containing their products may need a policy** (order_items has no store_id; store sees orders via products.store_id join). Verify/add during Store panel build.
- [~] Auth — customer email+password & phone OTP work; admin email+password works (no 2FA); **store/agent auth not built yet** (store login is the first Store-panel task).
- [ ] Razorpay integration (payments) — still not built; no SDK/flow/payment route (partner's task)
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
- [ ] 8. Checkout — Time Slot Page  *(partner)*
- [x] 9. Order Confirmation Page  *(partner)*
- [x] 10. Order Tracking Page  *(timeline + 24h countdown — partner)*
- [~] 11. Try Timer  *(the 24h countdown is built into Order Tracking; no standalone screen)*
- [x] 12. Keep or Return  *(keep/return actions live in Order Tracking — partner)*
- [ ] 13. Payment Page  *(not built — Razorpay, partner)*
- [ ] 14. Return Pickup Scheduling  *(partner)*
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
- [ ] 4. Order Detail (Delivery)  *(confirm delivery → starts customer 24h timer)*
- [ ] 5. Return Collection Page
- [ ] 6. Navigation / Map Screen
- [ ] 7. Agent Earnings Page
- [ ] 8. Agent Profile Page
- [ ] 9. Agent Notifications
- [ ] 10. Order History (Agent)
- [ ] 11. Support Page (Agent)
- [ ] 12. Onboarding / Training (Agent)

## P3 — Store Panel (14) — 🔨 IN PROGRESS, owned by D (started week of 2026-06-04)
> Build order: Login → Dashboard → Catalog → Add/Edit Product → Order Management → Order Detail → rest.
> Data model: store user = role `store_manager` + `store_managers` row (user↔store); products via `products.store_id`; a store's orders via `order_items → products WHERE store_id = mine` (no store_id on order_items). Store dev server runs on **:3003** (`pnpm dev:store`).
- [T] 1. Store Login — D  *(email+pw + store_manager gate, reusable `getStoreContext`, auth-gated root stub; login verified across all conditions in a real browser; PR #11 open)*
- [T] 2. Store Dashboard — D  *(sidebar shell + KPI cards + low-stock & recent-orders panels; migrations 004 & 005 applied; verified in a real browser with seed data — store-scoped RLS confirmed; PR #12 open)*
- [~] 3. Product Catalog Page — D  *(store's own products: table + search/status filter + activate/deactivate + soft-delete; Add/Edit entry points stubbed "Soon" pending #4/#5; layout verified via preview with seed data, write actions pending real-browser test)*
- [ ] 4. Add Product Page
- [ ] 5. Edit Product Page
- [ ] 6. Order Management Page
- [ ] 7. Order Detail (Store)
- [ ] 8. Returns Management
- [ ] 9. Earnings Page (Store)
- [ ] 10. Analytics Page (Store)
- [ ] 11. Store Profile Settings
- [ ] 12. Staff Management
- [ ] 13. Support Page (Store)
- [ ] 14. Store Onboarding

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
- [x] 19. System Settings
- [ ] 20. Reports & Export Center
- [ ] 21. Admin Activity Log  *(table exists; no screen)*

---

## Recommended next tasks
**D (Store panel):** Store Login → Dashboard → Product Catalog → Add/Edit Product → Order Management.
**Partner (close the loop + new panel):**
1. **Razorpay Payment** for kept items — the money step that closes the customer loop (#13).
2. Return Pickup scheduling (#14) + Checkout Time Slot (#8).
3. **Agent panel** — rider accepts + confirms delivery (delivery confirmation starts the 24h try timer).

## Decisions log (append-only — record anything non-obvious you decided)
- 2026-06-03: Restructured the single Next.js app into a **pnpm monorepo** — one app per panel (`apps/{customer,agent,store,admin}`) + shared `packages/{supabase,ui,config}`. Admin is now a separate build/deploy so admin code & the service-role key never ship in the customer bundle. Kept the `/admin` route prefix inside the admin app to avoid rewriting ~45 links. History preserved via `git mv`. (branch `chore/monorepo-restructure`, PR #1)
- 2026-06-04: Fixed Tailwind v4 CSS-layering bug in customer `globals.css` — unlayered base resets (`a { color: inherit }`) were beating `text-white` on navy `<Link>` buttons; wrapped base resets in `@layer base`.
- 2026-06-04: Extracted size-chart data to `apps/customer/lib/sizeData.ts`, shared by the product SizeChartModal and the new `/size-guide` page.
- 2026-06-04: **Work split** — D wraps the Customer panel (standalone screens) and moves to the **Store panel**. Partner owns Razorpay/customer-loop finish + the Agent panel.

## Known issues / TODO
- 🔴 **SECURITY (2026-06-08): RLS was DISABLED on `users`, `orders`, `order_items` in the live DB** — anon key + no session could read all customer PII (names/emails/phones) + all orders. Found while building the Store Dashboard (dashboard showed 6 orders with no session). Policies in schema.sql are intact; RLS had just been turned off. Fix = run **migration 005** (`packages/supabase/migrations/005_reenable_rls.sql`, re-enables RLS on all tables, idempotent). **Affects the customer panel too — apply ASAP.** Verify with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
- **Store panel:** migration **004** (`004_store_manager_read.sql`) adds manager SELECT on products/variants/orders/order_items/returns — required for Dashboard + Orders/Returns/Earnings. Apply before testing the store dashboard.
- **Customer loop:** Payment (Razorpay) not built yet — kept items can't be charged (#13). Return Pickup (#14) + Checkout Time Slot (#8) also pending. (Partner.)
- Store-manager RLS for viewing orders that contain their products likely needs a policy (order_items has no store_id → join via products.store_id). Verify during Store build.
- No automated tests anywhere (0). `/finish-task` should start adding smoke tests per screen.
- Admin has no 2FA (spec requires it for admin login).
- AI skin-tone endpoint not built; Product Detail badge + AI Style Setup are placeholders.
- Hosting provider not chosen (does not affect code; decide before Week 8).
- `agent` app is still an empty shell; `store` app is now in active development (D).
