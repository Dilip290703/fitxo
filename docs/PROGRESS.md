# Fitzo — Build Progress

**This is the living source of truth for what's done.** Claude Code reads this before
starting work and updates it when finishing a task (via `/finish-task`).

Status legend: `[ ]` not started · `[~]` in progress / partial · `[x]` built & merged · `[T]` tested
Owner: put initials (e.g. `J` Jay / `A` Amit) next to in-progress items.

Last updated: 2026-06-03 _(synced to reality via `/audit`)_

> **Audit summary (2026-06-03, strict):** ~17 of 72 screens genuinely built, plus several
> partials. Customer **8** solid (+3 partial), Admin **9** solid (+2 partial), Agent **0**,
> Store **0** (empty shells). **No automated tests exist anywhere (0).** The signature
> **order → 24h try → keep/return → payment** loop is **not functional**: checkout doesn't
> persist orders, the `try_sessions/returns/payments/payouts` tables don't exist, and
> Razorpay + the AI skin-tone endpoint are not integrated (only DB columns / display fields).
> Firebase is **not** in the current codebase (0 refs) — stack of record is Supabase.

---

## Foundation
- [x] Monorepo restructure — 4 app folders + shared packages, pnpm workspaces (see Decisions log)
- [ ] 4 hosting projects + subdomains wired (host TBD)
- [~] Supabase schema — 17 tables present (users, products, product_colors/variants/images, brands, categories, stores, store_managers, addresses, orders, order_items, riders, deliveries, coupons, notifications, activity_logs). **Missing: `try_sessions`, `returns`, `payments`, `payouts`.**
- [~] RLS policies — ~40 policies / RLS enabled on existing tables; pending for the missing loop tables.
- [~] Auth — customer phone+OTP works (Supabase `signInWithOtp`/`verifyOtp`); admin email+password works but **no 2FA**; store/agent auth not built.
- [ ] Razorpay integration (payments) — only type fields + admin display; no SDK/flow
- [ ] Razorpay Payouts integration (store + agent)
- [ ] AI skin-tone endpoint — only DB columns + hardcoded display; no endpoint
- [~] Shared UI kit — `packages/ui` exists but thin; admin has its own `components/admin/*`

## P1 — Customer Panel (25)
- [x] 1. Homepage / Landing
- [x] 2. Product Listing Page
- [x] 3. Product Detail Page  *(Supabase-wired; AI skin-tone badge still placeholder)*
- [x] 4. Login / Signup Page  *(LoginPanel, Supabase auth)*
- [~] 5. OTP Verification  *(handled inline in LoginPanel; no standalone screen)*
- [x] 6. Cart / Bag Page  *(CartProvider; localStorage, not yet persisted as an order)*
- [~] 7. Checkout — Address Page  *(UI exists but does NOT create an order in Supabase)*
- [ ] 8. Checkout — Time Slot Page
- [ ] 9. Order Confirmation Page
- [ ] 10. Order Tracking Page  *(placeholder)*
- [ ] 11. Try Timer Page  *(placeholder — the signature 24h countdown)*
- [ ] 12. Keep or Return Page
- [ ] 13. Payment Page  *(blocked: no Razorpay, no payments table)*
- [ ] 14. Return Pickup Scheduling
- [x] 15. Profile Page
- [x] 16. Wishlist Page
- [ ] 17. Order History Page  *(placeholder)*
- [ ] 18. AI Skin Tone Setup Page  *(placeholder)*
- [ ] 19. Notifications Page  *(placeholder)*
- [ ] 20. Brand / Store Page  *(placeholder, uses mockData)*
- [ ] 21. Search Results Page  *(placeholder)*
- [ ] 22. How It Works Page  *(only a homepage section, no route)*
- [x] 23. Contact / Support Page
- [~] 24. Size Guide  *(SizeChartModal component exists; no standalone screen)*
- [ ] 25. 404 Error Page  *(no custom not-found)*

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

## P3 — Store Panel (14) — empty shell, not started
- [ ] 1. Store Login
- [ ] 2. Store Dashboard
- [ ] 3. Product Catalog Page
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

## Recommended next 5 tasks (ordered by what unblocks the most)
1. **Schema: add `try_sessions`, `returns`, `payments`, `payouts` (+ RLS, + types)** — unblocks the entire signature loop and several admin screens. Foundation, do first.
2. **Wire customer Checkout → create order** in Supabase (orders + order_items + address); cart is currently localStorage-only.
3. **Order Confirmation + Order Tracking** pages reading the real order (replace placeholders).
4. **Try Timer (24h) + Keep-or-Return** wired to `try_sessions` — the product differentiator.
5. **Razorpay Payment** for kept items (needs #1, #2) — the money step that closes the loop.

## Decisions log (append-only — record anything non-obvious you decided)
- 2026-06-03: Restructured the single Next.js app into a **pnpm monorepo** — one app per panel (`apps/{customer,agent,store,admin}`) + shared `packages/{supabase,ui,config}`. Admin is now a separate build/deploy so admin code & the service-role key never ship in the customer bundle. Kept the `/admin` route prefix inside the admin app to avoid rewriting ~45 links. History preserved via `git mv`. (branch `chore/monorepo-restructure`, PR #1)

## Known issues / TODO
- **Critical-path blocker:** order→try→keep/return→payment loop not functional — no order creation on checkout, missing `try_sessions/returns/payments/payouts` tables, no Razorpay.
- No automated tests anywhere (0). `/finish-task` should start adding smoke tests per screen.
- Admin has no 2FA (spec requires it for admin login).
- AI skin-tone endpoint not built; Product Detail badge + AI Style Setup are placeholders.
- Hosting provider not chosen (does not affect code; decide before Week 8).
- `agent` and `store` apps are empty shells.
