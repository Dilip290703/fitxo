# Store Panel — Professional Audit (Phase 0)

Date: 2026-07-03 · Auditor: Claude (senior product-engineer lens: Shopify Admin / Swiggy-Zomato partner panels / Meesho Supplier)
Basis: full code trace of `apps/store` (~6.7k lines) + migrations 004/007/016/029/030 + RLS schema.
**Not click-tested in a browser for this audit** — findings marked (code-traced). Branch: `feature/store-panel-upgrade`, cut from `feat/store-support-hardening` (latest store code; rebase onto main after PR merges).

---

## 0. Panel map

**Routes (16):**

| Route | Screen | View component | Data module |
|---|---|---|---|
| `/login` | Store Login (signin/signup/forgot) | `StoreLoginPanel` | `store-auth.ts` |
| `/reset-password` | Password reset | inline page | — |
| `/onboarding` | 5-step seller wizard + under-review/rejected states | `OnboardingWizard` | `onboarding.ts` |
| `/` | Dashboard | `StoreDashboard` | `dashboard.ts` |
| `/catalogue` | Product Catalog | `CatalogueView` | `products.ts` |
| `/catalogue/new`, `/catalogue/[id]/edit` | Add/Edit Product (shared form) | `ProductForm` | `productForm.ts`, `productImages.ts` |
| `/orders` | Order Management | `OrdersView` | `orders.ts`, `orderStatus.ts` |
| `/orders/[id]` | Order Detail (mark ready + confirm) | `OrderDetailView` | `orders.ts` |
| `/returns` | Returns (read-only) | `ReturnsView` | `returns.ts` |
| `/earnings` | Earnings & payouts | `EarningsView` | `earnings.ts` |
| `/analytics` | 30-day analytics | `AnalyticsView` | `analytics.ts` |
| `/settings` | Store profile | `SettingsView` | `storeSettings.ts` |
| `/staff` | Staff roster (read-only) | `StaffView` | `storeSettings.ts` |
| `/support` | Tickets + FAQ | `SupportView` | `support.ts` |
| `/guide` | Static seller guide | `OnboardingView` | — |

**Shared elements:** `StoreShell` (sidebar + mobile slide-over), `OrderAlertsProvider` (bell + pop-ups, 8s notification poll + realtime), `useStoreGuard`/`getStoreContext` (auth gate, approved-store gate). There is **no shared table, stat-card, badge, toast, dialog, form-field, or skeleton primitive** — every view re-implements its own (see B6).

**Architecture note that shapes everything below:** every page is a client component that runs `useStoreGuard()` itself and mounts its own `StoreShell`. The shell is **not** a persistent layout.

---

## A. What's good (keep this — don't rewrite it)

- **Security posture is genuinely strong.** All store writes go through guarded SECURITY DEFINER RPCs (`set_order_item_prepared` 007, `store_confirm_order` 016 with `FOR UPDATE` lock + idempotent pending-check, `update_store_profile`/`get_store_staff` 008, `save/submit_store_onboarding` 029). No customer PII on any store screen, by design. KYC/bank data isolated in private `store_business_details`.
- **`store_confirm_order` is a correct little state machine** ([016_store_confirm_order.sql](../packages/supabase/migrations/016_store_confirm_order.sql)): row lock, only acts on `pending`, delivery-exists guard — multi-store double-confirm safe.
- **`lib/earnings.ts` is the best data module**: uncapped totals query separate from the display query, per-order rounding that exactly mirrors Admin > Store Payouts, explicit `products.store_id` filter with a comment explaining *why* (personal customer orders must not count). `analytics.ts` and `returns.ts` apply the same guard.
- **`updateProductFull` is RESTRICT-aware** ([productForm.ts:249](../apps/store/lib/productForm.ts)): updates variants in place, delete-or-disable fallback so an ordered variant is never destroyed. `friendlyDbError` translates slug/SKU collisions into human messages.
- **Onboarding wizard UX is near-professional**: per-step validation, persist-on-every-step, rejected-with-reason resubmit loop, load-failure Retry state, masked bank account on review. Best screen in the panel.
- **OrderAlertsProvider** encodes a hard-won reliability lesson (poll-first, realtime as a nudge, seeded first poll, dedupe by notification id) and has mute persistence + audio-unlock handling.
- **Visual language is consistent** in palette (navy `#171d2b` / yellow `#ffd233` / warm neutrals), and most list views have real skeletons and `role="alert"` error banners.
- **Empty states exist everywhere** and some have personality ("No returns yet — that's a good sign.").
- **First tests exist** (`lib/*.test.ts`, vitest) over the pure validators.

---

## B. What's bad

### B1. Navigation & IA — **Major**

- **Flat 10-item sidebar, no grouping** ([StoreShell.tsx:19](../apps/store/components/StoreShell.tsx)). Shopify/Swiggy group by job: *Orders / Catalogue / Money / Store*. Fitxo's list mixes daily-use (Orders) with once-a-quarter (Staff, Guide) at equal weight.
- **Emoji icons** (`🛍 🧾 ↩ ₹ 📊 👥 ⚙ 💬 🧭`) — render differently per OS, unaligned optical sizes. Reads "student project" instantly. **Major** for the professional bar.
- **No badge counts.** A Swiggy partner sees "New Orders (3)" in the nav; here the only signal is the floating bell.
- **No header bar on desktop.** No page-level breadcrumb/primary-action slot; the bell floats at `fixed right-4 top-4` **over page content** (e.g. over the status badge on Order Detail, near "+ Add product" on Catalogue). (code-traced)
- Store name is buried at the sidebar *bottom* with no status (approved/active) chip.
- Dead code: the `ready?: boolean` "Soon" branch in NAV is unreachable — every item is `ready: true`.

### B2. Shell architecture / perceived performance — **Critical** (worst daily-feel issue)

- **The shell remounts on every navigation.** Each page runs `useStoreGuard()` → 2 Supabase queries (`store_managers` + `stores` join) → full-screen `Loading…` → then mounts `StoreShell` + view. Result: **every sidebar click blanks the whole app** (sidebar included) for a round-trip. Real dashboards never drop the chrome. (code-traced: [app/orders/page.tsx:10-16](../apps/store/app/orders/page.tsx) — same pattern in all 12 authed pages)
- **Consequence: `OrderAlertsProvider` remounts per navigation** — bell history, unread count and the seeded-poll state are wiped every time the owner changes pages; the notification poll re-seeds and re-subscribes. An alert that popped on /orders is gone from the bell after navigating to /catalogue. **Critical** for an alerts feature the store relies on.
- `useStoreGuard` treats **any error as "not a manager"**: `getStoreContext` returns `null` on a transient network failure → instant redirect to `/login` while actually still authenticated. (store-auth.ts:47)

### B3. Visual polish — **Minor–Major**

- **Hardcoded hex values everywhere** — `#171d2b` appears ~80×, `#ece5da` ~60× across 15 files. Palette is consistent *today* only by copy-paste discipline; there is no token layer (globals.css is 5 lines). One brand tweak = 15-file sweep. **Major** as debt, Minor visually.
- Type scale is ad-hoc per-pixel (`text-[9px]` … `text-[40px]`, ~14 distinct sizes) but hierarchy is mostly coherent. Radius discipline is decent (xl/2xl/full); shadows are disciplined (borders-first).
- Inconsistent loading states: list views get skeletons; **Order Detail and ProductForm get a bare uppercase "Loading…" string** ([OrderDetailView.tsx:139](../apps/store/components/orders/OrderDetailView.tsx)); Settings gets a single gray box.
- No per-route `<title>` — every tab says "FitXo Store".
- Success feedback is inconsistent: Settings shows inline "Saved ✓", ProductForm silently redirects, Support shows a green banner. No toast system.

### B4. UX friction / real-world workflow fit — **Critical** (the "would a Swiggy PM approve" test fails here)

The store owner's job, 15× a day: *order comes in → pack items → mark ready → confirm → hand to rider.* Today's click path: **hear chime → tap pop-up → Order Detail → tap "Mark ready" per item (or "Mark all ready") → tap "Confirm order"**. Issues:

- **Dashboard is a report, not an operations home.** No "needs action" queue, no inline Mark-ready/Confirm, stat cards are not clickable (not links, no hrefs), recent-orders rows are not clickable either. Swiggy's partner home *is* the order queue. **Critical.**
- **"Mark all ready" fires N sequential RPCs** ([OrderDetailView.tsx:101-109](../apps/store/components/orders/OrderDetailView.tsx)) — a 10-item order ≈ 10 round-trips (multi-second on store Wi-Fi). Needs one bulk RPC (`mark_order_items_prepared(order_id)`). Also: `togglePrepared` swallows its own errors, so the loop *continues* after a failure despite the comment claiming it surfaces the first failure, and later failures overwrite earlier messages.
- **Mark-ready + Confirm are two separate stops** with no combined "Mark all ready & confirm" for the common all-in-stock case. That's the 80% path and it's the slowest.
- **Orders list is fetch-once and static**: no search by order number, no counts on the filter chips (`All / Active / …` — you can't see *how many* need action without clicking), no auto-refresh — a new order chimes but **the list on screen doesn't update** until manual reload. No bulk actions from the list.
- **Order-list rows are `<tr onClick>`** — not focusable, not keyboard/screen-reader operable, no real links (can't middle-click/cmd-click). Same for the delete-confirm modal (no Escape, no focus trap) and the bell dropdown (no outside-click close).
- **ProductForm has no dirty-state guard** — Cancel/back discards 20 minutes of variant entry silently. No draft state (new products default `isActive: true` → live on the storefront the moment you hit Create). Validation is one string in the sticky bar (truncated!), not inline per field.
- Catalogue empty state ("No products yet.") has **no CTA** — a new store's most important moment gets a dead end instead of an "Add your first product" button.

### B5. Core logic — one **Major** correctness bug + assorted

- **Personal-order leak (Major, confirmed against RLS):** `orders_select (user_id = auth.uid())` is OR'd with `orders_manager_select` (schema.sql:544 + migration 004). `loadStoreOrders()` and 5 of 7 dashboard queries rely on **RLS alone with no store filter** ([orders.ts:71-81](../apps/store/lib/orders.ts), [dashboard.ts:56-77](../apps/store/lib/dashboard.ts)) — the dashboard comment even asserts "no store filter needed". A manager who also shops on fitxo.co.in as a customer sees their **personal orders** in the store Orders list and inflating Today's/Total/Try-window/Returns counts. `earnings.ts`/`analytics.ts`/`returns.ts` all explicitly guard against exactly this; orders/dashboard forgot.
- **Dashboard "Pending payout" is a different metric than Earnings' "Awaiting payout"** (dashboard sums `payouts.status='pending'` rows; admin records payouts directly as `paid`, so the card reads ₹0 forever while Earnings shows the real computed figure). Two screens, two answers to "how much am I owed". **Major** trust issue for money.
- **Non-transactional product create** ([productForm.ts:225-240](../apps/store/lib/productForm.ts)): product row → colors → variants → images as separate inserts. A mid-sequence failure leaves a half-created *live* product, and retrying Create makes a duplicate. Edit has the same shape. Needs an RPC or an idempotent create-then-patch flow.
- Stale-data handling: everything is fetch-once-on-mount; no refetch on focus/interval, no realtime on the lists themselves.
- Over-fetching: `loadStoreOrders` pulls **all orders ever, with all items** (no limit/pagination); Catalogue similarly unbounded. Fine at pilot scale, flag before growth. Dashboard fires 8 parallel queries (acceptable).
- `markAllReady`'s optimistic update recomputes `preparedCount` correctly, but `busyItem` flips per-item so the whole-batch busy state flickers.

### B6. Code quality — **Major** (volume of duplication), no dead code otherwise

- `formatCurrency` is defined **7×**, `formatDate` 6×, `StatCard` 3×, `Field` + `inputClass` 4×, the error-banner `<p role="alert" …>` markup ~10×, skeleton blocks 5×. Zero shared primitives; `packages/ui` unused by this app.
- The data-module pattern (`lib/*.ts` returning typed shapes) is good, but every module hand-rolls `// eslint-disable-next-line no-explicit-any` mapping — a typed `select` helper or generated types would remove ~30 `any`s.
- Views are otherwise clean, focused, and consistently structured — this is a *consolidation* job, not a rewrite.

---

## C. Top 10 fixes (impact on daily store-owner experience ÷ effort)

| # | Fix | Sev | Effort | Why first |
|---|---|---|---|---|
| 1 | **Persistent shell**: move guard + `StoreShell` + `OrderAlertsProvider` into a layout/context so navigation never blanks the app and alerts survive page changes | Critical | M | Every single interaction feels broken today |
| 2 | **Store-scope the orders + dashboard queries** (filter via `order_items→products.store_id` like earnings does) — kills the personal-order leak and wrong counts | Major (correctness) | S | Wrong data > ugly data |
| 3 | **Dashboard → operations home**: "Needs action" order queue (pending/unconfirmed) with inline **Mark all ready & Confirm**; make stat cards real links | Critical | M | This is the screen a Swiggy PM judges |
| 4 | **Bulk-ready RPC** `mark_order_items_prepared(order_id)` + one-tap "Ready & confirm"; fix the error-swallowing loop | Major | S | 15 orders in a minute becomes physically possible |
| 5 | **Shared primitives**: `StatCard`, `StatusBadge`, `ErrorBanner`, `Field/Input`, `Skeleton`, `ConfirmDialog`, `formatCurrency/Date` in one place; design tokens (CSS vars) for the palette | Major | M | Halves the cost of every later phase |
| 6 | **Sidebar v2**: grouped sections (Orders / Catalogue / Money / Store), SVG icon set, "Orders (n)" badge from the alerts provider, store name + status chip at top, integrate the bell into a proper header | Major | M | The first-impression fix |
| 7 | **Orders list: live + countable**: chip counts, order-number search, auto-refresh/refetch when an alert lands, rows as real `<Link>`s | Major | S–M | Daily-use screen #2 |
| 8 | **Reconcile "Pending payout"** card with Earnings' awaiting-payout math (reuse `loadStoreEarnings` logic) | Major | S | Money numbers must agree |
| 9 | **ProductForm safety**: dirty-state warning, inline field errors, "save as draft" (isActive off by default + explicit publish), transactional/idempotent create | Major | M | Protects the highest-effort workflow |
| 10 | **Guard + polish sweep**: distinguish network-fail from not-a-manager in `useStoreGuard` (retry, don't bounce to /login); consistent skeletons on Order Detail/ProductForm; empty-state CTAs; per-route titles; toast for saves | Minor–Major | M | The "designed, not assembled" layer |

**Explicitly out of scope unless asked:** rewriting the RPC/security layer, the onboarding wizard (already good), the alerts poll-first architecture (correct as-is), and anything customer/agent/admin-side beyond the shared migrations in #4.

---

*Phase 0 ends here — no product code was changed. Next: Phase 1 (design tokens + shell) after approval.*
