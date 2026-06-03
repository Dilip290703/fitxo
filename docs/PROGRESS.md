# Progress

## 2026-06-03 — Monorepo restructure (`chore/monorepo-restructure`)

Converted the single Next.js app (`tryfit-platform`) into a pnpm-workspace
monorepo with one deployable Next.js app per panel. Switched package manager
from npm to pnpm. **No application logic changed** — files were relocated with
`git mv` (history preserved) and only Supabase import paths were rewritten.

### What moved

| From (old root) | To |
|-----------------|----|
| `app/*` (non-admin routes) | `apps/customer/app/` |
| `components/*` (non-admin) | `apps/customer/components/` |
| `store/`, `lib/{pincode,storage,mockData}.ts` | `apps/customer/` (customer-only) |
| `lib/supabase/products.ts` | `apps/customer/lib/supabase/products.ts` (customer-only; depends on a customer type) |
| `public/`, `instrumentation.ts`, `next.config.ts`, `postcss.config.mjs` | `apps/customer/` |
| `app/admin/**` | `apps/admin/app/admin/**` (route prefix `/admin` kept → zero link changes) |
| `components/admin/**` | `apps/admin/components/admin/**` |
| `lib/supabase/admin.ts` (service-role) | `apps/admin/lib/supabase/admin.ts` (admin-only) |
| `middleware.ts` (admin auth guard) | `apps/admin/middleware.ts` |
| `lib/supabase/{client,server,types}.ts` | `packages/supabase/src/` (`@fitzo/supabase`) |
| `lib/supabase/schema.sql` | `packages/supabase/schema.sql` |
| `tsconfig.json` | `packages/config/tsconfig.base.json` (genericized) |

### What was created

- `apps/admin` new clean root layout (`app/layout.tsx`, no customer providers)
  + `app/page.tsx` redirect to `/admin`.
- `apps/agent`, `apps/store` — runnable Next.js shells.
- `packages/ui` (`@fitzo/ui`) — thin shared-primitives package (`cn` helper).
  Customer & admin share no components today, so it is intentionally minimal.
- `packages/config` (`@fitzo/config`) — shared tsconfig base.
- `pnpm-workspace.yaml`, root workspace `package.json`, per-app
  `package.json`/`tsconfig.json`/config, `.env.example` per app.

### Import rewrites

`@/lib/supabase/{client,server,types}` → `@fitzo/supabase/{client,server,types}`
(49 imports across customer + admin). `@/lib/supabase/products` (customer) and
`@/lib/supabase/admin` (admin) stay app-local.

### Verification

- All four apps typecheck and build cleanly.
- Customer build contains **no** admin code and **no** service-role reference.
- Admin build contains **no** customer-only code.
- The real service-role key value is not present in any client/static chunk;
  only `apps/admin` receives `SUPABASE_SERVICE_ROLE_KEY`.

### Follow-ups

- Set Vercel Root Directory per app (one project per subdomain).
- Optional: strip the `/admin` route prefix inside the admin app (would require
  rewriting ~45 hardcoded links + middleware matcher).
- Build out the `agent` and `store` panels.
