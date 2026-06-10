# Fitzo

**Fitzo is a "try-at-home" fashion commerce platform.** A customer orders clothes, a
rider delivers them, a **24-hour try-on window** starts, and then the customer either
**keeps** (and pays for) what they like or **returns** the rest with a free pickup.

The product is delivered as **four separate apps**, one per audience, each on its own
subdomain — all sharing one Postgres database (Supabase) and a set of internal packages.

| Panel        | App folder      | Who uses it        | Subdomain        | Dev port |
| ------------ | --------------- | ------------------ | ---------------- | -------- |
| **Customer** | `apps/customer` | shoppers           | `fitzo.in`       | `3000`   |
| **Admin**    | `apps/admin`    | Fitzo owners only  | `admin.fitzo.in` | `3001`   |
| **Agent**    | `apps/agent`    | delivery riders    | `agent.fitzo.in` | `3002`   |
| **Store**    | `apps/store`    | partner store owners | `store.fitzo.in` | `3003` |

---

## The core flow

```
Customer orders  →  Rider picks up from store  →  Rider delivers
      →  24-hour try window starts  →  Customer keeps (pays) or returns (free pickup)
      →  Store is paid out for kept items; returned items come back to the store
```

The try-window duration (24h) and commission rate are intended to be **configuration
values** (Admin → System Settings), never hardcoded constants.

---

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** — one Next.js app per panel
- **Tailwind CSS v4**
- **Supabase** — Postgres + Auth + Storage, with **Row-Level Security (RLS) per panel**
- **Razorpay** — customer payments and store/agent payouts _(integration pending)_
- **pnpm workspaces** monorepo (package manager pinned via `packageManager`)

---

## Monorepo structure

```text
apps/
  customer   Public storefront                         (Next.js, :3000)
  admin      Owner-only admin panel (/admin/*)         (Next.js, :3001)  ← separate build; the ONLY app with the service-role key
  agent      Delivery-agent panel                      (Next.js, :3002)  ← shell / WIP
  store      Store-manager panel                       (Next.js, :3003)  ← complete (14 screens)

packages/
  supabase   @fitzo/supabase   Anon + SSR Supabase clients, DB types, schema.sql, migrations (NO service-role)
  ui         @fitzo/ui         Shared UI primitives (thin today)
  config     @fitzo/config     Shared tsconfig base
```

A **panel = an app folder**, which is also the unit of ownership. Internal packages are
consumed as **TypeScript source** via each app's `transpilePackages` (no build step for
shared code).

---

## Getting started

### Prerequisites

- **Node.js 20+**
- **pnpm 9.15.0** — `corepack enable` will use the pinned version automatically
- A **Supabase project** (free tier is fine for development)

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

Each app reads its own `apps/<panel>/.env.local` (gitignored). Copy the example and fill
in your Supabase project values:

```bash
cp apps/customer/.env.example apps/customer/.env.local   # repeat for admin / agent / store
```

| Variable                        | Apps                     | Notes                                             |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | all                      | Supabase project URL                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all                      | **Anon** key only                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | **`apps/admin` only**    | Server-side only; never ship to the other 3 apps  |

> See each app's `.env.example` for the full list.

### 3. Set up the database

In the **Supabase SQL Editor**, run the base schema then the migrations **in order**:

```text
packages/supabase/schema.sql                          # base schema, enums, RLS policies, helpers
packages/supabase/migrations/002_try_loop.sql         # try_sessions, returns, payments, payouts
packages/supabase/migrations/003_order_items_update_policy.sql
packages/supabase/migrations/004_store_manager_read.sql
packages/supabase/migrations/005_reenable_rls.sql     # security: re-asserts RLS on every table
packages/supabase/migrations/006_store_manager_product_write.sql
packages/supabase/migrations/007_order_item_prepared.sql
packages/supabase/migrations/008_store_profile_staff.sql
```

Optional dev seed data lives under `apps/store/seed/` (a test store + store-manager,
sample products, orders, returns and payouts) — run those after the migrations to exercise
the Store panel.

### 4. Run

```bash
pnpm dev            # customer (:3000) + admin (:3001) together
pnpm dev:store      # just the Store panel  → http://localhost:3003
pnpm dev:customer   # / dev:admin / dev:agent / dev:store
pnpm dev:all        # every panel in parallel
```

---

## Commands

Run from the repo root:

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `pnpm install`       | Install all workspace dependencies            |
| `pnpm dev`           | Customer + Admin together                     |
| `pnpm dev:<panel>`   | One panel (`customer`/`admin`/`agent`/`store`)|
| `pnpm dev:all`       | All four panels in parallel                   |
| `pnpm -r typecheck`  | Type-check every app/package                  |
| `pnpm -r lint`       | Lint every app/package                        |
| `pnpm build`         | Production build of every app                 |

---

## Data model & security (the important parts)

- **Users & roles.** Every app user is a row in `users` with a `role` of
  `customer | store_manager | rider | admin`. A store manager additionally has a row in
  **`store_managers`** (`user_id ↔ store_id`).
- **RLS is mandatory.** Every table holding user data has Row-Level Security policies
  before any UI ships against it. The store panel, for example, can only read/write its
  own products, and only sees orders/returns that contain its products (no other store's
  data, and no customer PII).
- **Guarded writes.** Where a store needs to change something it shouldn't fully own
  (e.g. mark an order item "ready", edit only safe store-profile fields), the write goes
  through a **`SECURITY DEFINER` Postgres function** that checks ownership — never a broad
  table policy. This keeps prices, keep/return decisions and verification flags
  admin-owned.
- **Admin isolation.** `apps/admin` is a **separate build** and the only app that holds
  the `SUPABASE_SERVICE_ROLE_KEY` (server-side, in `apps/admin/lib/supabase/admin.ts`).
  Admin routes and keys never ship to the other three apps.
- **Money flows through Razorpay only** — payment/payout logic is never hand-rolled.

### Hard rules

- Never commit secrets — Supabase/Razorpay/OTP keys live in `.env.local` only (gitignored).
- Every user-data table must have RLS policies before UI ships against it.
- The try-window (24h) and commission rate are config, not constants.

---

## Project status

| Panel        | Status                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| **Store**    | ✅ **Complete** — all 14 screens (login, dashboard, catalogue, add/edit product, orders + detail, returns, earnings, analytics, settings, staff, support, onboarding). |
| **Customer** | 🟢 Mostly built — storefront, auth, cart, checkout, order tracking + 24h try loop, account pages. Pending: Razorpay **Payment**, Return-Pickup scheduling, Time-Slot, AI skin-tone setup. |
| **Admin**    | 🟢 Mostly built — most pages are Supabase-wired (orders, customers, stores, riders, revenue, coupons, settings, inventory, bulk upload). Pending: payments/payout records, complaints, CMS, 2FA. |
| **Agent**    | 🟡 Shell — not yet started. |

**Cross-cutting / pending:** Razorpay payments + payouts, the AI skin-tone endpoint, an
admin commission/settings store, product-image upload (Supabase Storage), and an automated
test suite. See `docs/PROGRESS.md` for the living, screen-by-screen status.

---

## Contributing / workflow

- **Never commit to `main` directly** — work on a feature branch and open a PR.
- Branch naming: `feat/<panel>-<thing>`, `fix/<panel>-<thing>`, `chore/<thing>`,
  `docs/<thing>`.
- Before opening a PR: `pnpm -r typecheck`, lint, and run the relevant checks.
- Keep PRs small (one screen / one self-contained change) and update
  **`docs/PROGRESS.md`** when you finish a screen.
- Shared code (`packages/supabase` schema/types, `packages/ui`) — announce before editing,
  keep changes small, and add new DB changes as a **new numbered migration**.

See **`CLAUDE.md`** (project context) and **`docs/WORKFLOW.md`** (full team workflow) for
the details.

---

## Documentation map

| File                        | What's in it                                              |
| --------------------------- | --------------------------------------------------------- |
| `CLAUDE.md`                 | Project context, monorepo layout, hard rules, code style  |
| `docs/WORKFLOW.md`          | Git strategy, panel ownership, the per-task loop          |
| `docs/PROGRESS.md`          | Living source of truth — every screen's status            |
| `packages/supabase/schema.sql` + `migrations/` | Database schema, RLS policies, helpers |
