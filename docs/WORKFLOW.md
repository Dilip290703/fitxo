# Workflow

## Monorepo layout & ownership

This is a pnpm-workspace monorepo. Work happens inside one app or one package
at a time, and ownership follows the folder:

- **`apps/customer/`** — the public storefront. Customer-only components, the
  `store/` state providers, and `lib/{pincode,storage,mockData}.ts` live here.
  Never import admin code into this app.
- **`apps/admin/`** — the admin panel, served under `/admin/*`. The
  service-role Supabase client (`lib/supabase/admin.ts`) and the auth
  `middleware.ts` live here. This is the only app that receives
  `SUPABASE_SERVICE_ROLE_KEY`.
- **`apps/agent/`, `apps/store/`** — runnable shells for future panels.
- **`packages/supabase/`** (`@fitzo/supabase`) — shared anon/SSR Supabase
  clients and DB types. Changes here affect every app, so keep it free of
  app-specific imports and never add the service-role helper.
- **`packages/ui/`** (`@fitzo/ui`) — shared UI primitives. Add a component here
  only when two or more apps genuinely need it.
- **`packages/config/`** (`@fitzo/config`) — shared `tsconfig.base.json`.

## Day-to-day

```bash
pnpm install            # once, and after any package.json change
pnpm dev:customer       # or dev:admin / dev:agent / dev:store
pnpm -r typecheck       # before pushing
pnpm build              # full build of every app
```

## Adding shared code

1. If two apps need the same logic/UI, put it in the relevant `packages/*`.
2. Add the package to the app's `dependencies` as `"workspace:*"`.
3. List it in that app's `next.config.ts` `transpilePackages` (already set for
   `@fitzo/supabase` and `@fitzo/ui`).
4. `pnpm install`, then import via the package name (e.g.
   `@fitzo/supabase/server`).

## Importing Supabase

- Browser/anon client: `import { createClient } from '@fitzo/supabase/client'`
- SSR/anon client: `import { createClient } from '@fitzo/supabase/server'`
- DB types: `import type { ... } from '@fitzo/supabase/types'`
- Service-role (admin app only): `import { createAdminClient } from '@/lib/supabase/admin'`
  — server-side usage only.

## Branches & PRs

- Branch off `main`; do not commit directly to `main`.
- `pnpm -r typecheck` and `pnpm build` must pass before opening a PR.

## Deployment

One Vercel project per app. Set each project's **Root Directory** to the app
folder and configure that app's env vars (only admin gets the service-role key).
