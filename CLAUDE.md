# FitZo — Monorepo Guide

FitZo is a fashion try-before-you-buy delivery platform. The repo is a **pnpm
workspace monorepo**: one independently deployable Next.js app per panel, plus
shared packages. The admin panel is a **separate build** and never ships in the
public customer bundle.

## Structure

```
apps/
  customer/   Public customer site        (Next.js)  → customer subdomain
  admin/      Admin panel (routes /admin/*) (Next.js)  → admin subdomain   [separate build]
  agent/      Delivery-agent panel         (Next.js)  → agent subdomain    [shell — WIP]
  store/      Store-manager panel          (Next.js)  → store subdomain    [shell — WIP]
packages/
  supabase/   @fitzo/supabase  Shared Supabase clients + DB types (anon/SSR only)
  ui/         @fitzo/ui        Shared UI primitives + `cn` helper (intentionally thin)
  config/     @fitzo/config    Shared tsconfig base
```

Each app is its own Vite-free **Next.js 15 (App Router)** app with its own
`package.json`, `next.config.ts`, `tsconfig.json` (extends `@fitzo/config`),
`postcss.config.mjs`, and `globals.css`. Internal packages are consumed as
TypeScript source via `transpilePackages` (no build step).

## Folder-based ownership

| Path | Owns | Notes |
|------|------|-------|
| `apps/customer/**` | Public storefront | No admin code may be imported here. |
| `apps/admin/**` | Admin panel | The **only** app with `SUPABASE_SERVICE_ROLE_KEY`. Service-role client lives at `apps/admin/lib/supabase/admin.ts` and is imported by server code only. |
| `apps/agent/**`, `apps/store/**` | Future panels | Runnable shells; build on shared packages. |
| `packages/supabase/**` | Shared data layer | Anon browser client (`/client`), SSR client (`/server`), DB `types`. **No** service-role here. **No** app-specific imports. |
| `packages/ui/**` | Cross-app UI | Customer & admin currently share zero components by design; add here only when genuinely shared. |
| `packages/config/**` | Toolchain config | `tsconfig.base.json`. |

## Security model (important)

- **Admin is a separate deployable unit** — admin routes/components are never
  bundled into the customer site. Verified at build time: the customer build
  contains no admin code and no service-role reference.
- `SUPABASE_SERVICE_ROLE_KEY` is set **only** in the admin deployment and is
  used only in server components / server actions / route handlers.
- `@fitzo/supabase` exposes only anon/public clients, so importing it anywhere
  can never pull in the service-role helper.

## Commands (run from repo root)

```bash
pnpm install                 # install all workspaces
pnpm dev:customer            # customer on :3000
pnpm dev:admin               # admin on :3001
pnpm dev:agent               # agent on :3002
pnpm dev:store               # store on :3003
pnpm -r typecheck            # typecheck every workspace
pnpm build                   # build every app
pnpm --filter @fitzo/admin build   # build one app
```

Package manager is pinned via `packageManager` (pnpm). Use `corepack` if pnpm
is not installed globally.

## Env

Each app reads its own `.env.local` (gitignored). See each app's `.env.example`.
Only `apps/admin/.env.example` documents `SUPABASE_SERVICE_ROLE_KEY`.

## Deployment

One Vercel project per app, each with its **Root Directory** set to the app
folder (`apps/customer`, `apps/admin`, …) and its own subdomain + env vars.
