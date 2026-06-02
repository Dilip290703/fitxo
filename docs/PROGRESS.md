# Fitzo — Build Progress

**This is the living source of truth for what's done.** Claude Code reads this before
starting work and updates it when finishing a task (via `/finish-task`).

Status legend: `[ ]` not started · `[~]` in progress · `[x]` built & merged · `[T]` tested
Owner: put initials (e.g. `J` Jay / `A` Amit) next to in-progress items.

Last updated: 2026-06-03 _(seed tracker; run `/audit` to sync to reality)_

---

## Foundation (do this first — shared, coordinate before touching)
- [x] Monorepo restructure — 4 app folders + shared packages, pnpm workspaces (see Decisions log)
- [ ] 4 hosting projects + subdomains wired (host TBD)
- [ ] Supabase project, schema v1 (users, products, stores, orders, order_items, try_sessions, returns, payments, payouts)
- [ ] RLS policies per panel
- [ ] Auth: phone+OTP (customer/agent), email+password (store), email+password+2FA (admin)
- [ ] Razorpay integration (payments)
- [ ] Razorpay Payouts integration (store + agent)
- [ ] AI skin-tone endpoint
- [ ] Shared UI kit (buttons, inputs, cards, toasts, modals)

## P1 — Customer Panel (25)
- [x] 1. Homepage / Landing
- [x] 2. Product Listing Page
- [ ] 3. Product Detail Page  *(critical — has AI skin-tone badge + "Try at Home" CTA)*
- [ ] 4. Login / Signup Page
- [ ] 5. OTP Verification Page
- [ ] 6. Cart / Bag Page
- [ ] 7. Checkout — Address Page
- [ ] 8. Checkout — Time Slot Page
- [ ] 9. Order Confirmation Page
- [ ] 10. Order Tracking Page
- [ ] 11. Try Timer Page  *(the signature 24h countdown screen)*
- [ ] 12. Keep or Return Page
- [ ] 13. Payment Page  *(Razorpay, kept items only)*
- [ ] 14. Return Pickup Scheduling
- [ ] 15. Profile Page
- [ ] 16. Wishlist Page
- [ ] 17. Order History Page
- [ ] 18. AI Skin Tone Setup Page
- [ ] 19. Notifications Page
- [ ] 20. Brand / Store Page
- [ ] 21. Search Results Page
- [ ] 22. How It Works Page
- [ ] 23. Contact / Support Page
- [ ] 24. Size Guide Page
- [ ] 25. 404 Error Page

## P2 — Delivery Agent Panel (12)
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

## P3 — Store Panel (14)
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
- [ ] 1. Admin Login (2FA)
- [ ] 2. Master Dashboard
- [ ] 3. All Orders Management
- [ ] 4. Order Detail (Admin)
- [ ] 5. Customer Management
- [ ] 6. Store / Partner Management
- [ ] 7. Delivery Agent Management
- [ ] 8. Revenue & Financial Analytics
- [ ] 9. Payment Records
- [ ] 10. Try & Return Analytics
- [ ] 11. Live Deliveries Map
- [ ] 12. Notifications & Alerts Management
- [ ] 13. Complaints & Support Management
- [ ] 14. Discount & Promo Code Manager
- [ ] 15. Content Management (CMS)
- [ ] 16. User Role Management
- [ ] 17. Store Payout Management
- [ ] 18. Agent Payout Management
- [ ] 19. System Settings
- [ ] 20. Reports & Export Center
- [ ] 21. Admin Activity Log

---

## Decisions log (append-only — record anything non-obvious you decided)
- 2026-06-03: Restructured the single Next.js app into a **pnpm monorepo** — one app per panel (`apps/{customer,agent,store,admin}`) + shared `packages/{supabase,ui,config}`. Admin is now a separate build/deploy so admin code & the service-role key never ship in the customer bundle. Kept the `/admin` route prefix inside the admin app to avoid rewriting ~45 links. History preserved via `git mv`. (branch `chore/monorepo-restructure`, PR #1)

## Known issues / TODO
- Hosting provider not yet chosen (Vercel vs Netlify/Cloudflare/VPS) — does not affect code; decide before Week 8.
- `agent` and `store` apps are empty shells — screens not started.
- Reconcile Supabase vs Firebase: git history shows a Firebase integration commit, but the stack of record is Supabase. The audit should determine what's actually wired.
