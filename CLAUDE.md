# Fitzo — Project Context

Fitzo is a "try-at-home" fashion commerce platform. Customers order clothes, a rider
delivers, a **24-hour try timer** starts, then the customer keeps (pays) or returns (free pickup).

This file is read at the start of every Claude Code session. Keep it short. Long-lived
state lives in `docs/PROGRESS.md` — **read that file before starting any task.**

## The 4 panels (each is its own app + its own subdomain)
| Panel    | App folder      | Users           | Domain          | Screens |
|----------|-----------------|-----------------|-----------------|---------|
| Customer | `apps/customer` | end users       | fitzo.in        | 25      |
| Agent    | `apps/agent`    | delivery riders | agent.fitzo.in  | 12      |
| Store    | `apps/store`    | store owners    | store.fitzo.in  | 14      |
| Admin    | `apps/admin`    | Jay + Amit only | admin.fitzo.in  | 21      |

## Monorepo structure (pnpm workspaces)
```
apps/customer  public storefront        (Next.js)
apps/admin     admin panel (/admin/*)   (Next.js)  ← separate build; only app with the service-role key
apps/agent     delivery-agent panel     (Next.js)  ← shell, WIP
apps/store     store-manager panel      (Next.js)  ← shell, WIP
packages/supabase  @fitzo/supabase  anon + SSR Supabase clients + DB types (NO service-role)
packages/ui        @fitzo/ui        shared UI primitives (thin today)
packages/config    @fitzo/config    shared tsconfig base
```
Each app is its own **Next.js 15 App Router** app with its own `package.json`/config.
A panel's screens live under its app folder — **panel = app folder**, which is also the
unit of ownership (see `docs/WORKFLOW.md`). Internal packages are consumed as TS source
via `transpilePackages` (no build step).

Commands (from repo root): `pnpm dev` (customer + admin), `pnpm dev:<panel>`,
`pnpm -r typecheck`, `pnpm build`. Package manager is pnpm (pinned via `packageManager`).

## Stack
- Next.js 15 (App Router) + TypeScript (scaffolded with Claude Code / Cursor)
- Supabase (Postgres + Auth + Storage) — **Row Level Security per panel is mandatory**
- Razorpay (customer payments + store/agent payouts)
- Hosting: one deployable app per panel, one project per subdomain (host TBD — Vercel/Netlify/etc.)
- AI skin-tone endpoint (analyzes undertone, returns colour palette)

## Hard rules
- Never commit secrets. Supabase keys, Razorpay keys, OTP providers → `.env.local` only (gitignored). Each app has its own `.env.local`; only `apps/admin` gets `SUPABASE_SERVICE_ROLE_KEY`.
- Every Supabase table that holds user data MUST have RLS policies before any UI ships against it.
- Admin is owner-only and a **separate build** — never expose admin routes/keys to the other three apps. The service-role client lives only in `apps/admin/lib/supabase/admin.ts` and is server-side only.
- Money flows through Razorpay only — never hand-roll payment or payout logic.
- The try-window duration (24h) and commission rate are config values (Admin > System Settings), not hardcoded constants.

## Workflow (see docs/WORKFLOW.md for the full version)
- Work on a **feature branch**, never commit to `main` directly.
- Branch naming: `feat/<panel>-<screen>` e.g. `feat/customer-cart-page`.
- Before opening a PR: `pnpm -r typecheck`, lint, and run the relevant tests.
- When you finish a screen/task, run `/finish-task` so `docs/PROGRESS.md` stays current.

## Code style
- TypeScript, function components + hooks. No class components.
- Co-locate a screen's components, hooks, and tests in its own folder under the panel app.
- Prefer running the single relevant test over the whole suite while iterating.
