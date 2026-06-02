# Fitzo — Team Workflow (Jay + Amit)

Two developers, two Claude Code instances, one repo. This doc keeps you out of each
other's way and keeps `main` always-shippable.

---

## 0. Monorepo layout — panel = app folder

The repo is a **pnpm-workspace monorepo**. Each of the 4 panels is its own deployable
Next.js app, so "work split by panel" is literally "work in your app folder":

```
apps/customer   fitzo.in         (25 screens)
apps/agent      agent.fitzo.in   (12 screens)
apps/store      store.fitzo.in   (14 screens)
apps/admin      admin.fitzo.in   (21 screens)  ← separate build; only app with the service-role key
packages/supabase  @fitzo/supabase  shared anon + SSR clients + DB types (no service-role)
packages/ui        @fitzo/ui        shared UI primitives
packages/config    @fitzo/config    shared tsconfig base
```

Commands (run from repo root):
```bash
pnpm install            # after any package.json change
pnpm dev                # customer (:3000) + admin (:3001) together
pnpm dev:customer       # or dev:admin / dev:agent / dev:store
pnpm -r typecheck       # before every PR
pnpm build              # build every app
```
Shared code goes in `packages/*` (add to the app's deps as `workspace:*` and to its
`next.config.ts` `transpilePackages`). Never import another panel's code across apps.

---

## 1. Git strategy — feature branches + PRs (never push to main)

### One-time setup
```bash
# In your GitHub repo settings → Branches → add a rule for `main`:
#   ✅ Require a pull request before merging
#   ✅ Require status checks to pass (add your CI: typecheck, lint, test)
#   ✅ Do not allow bypassing
# This makes direct pushes to main impossible — the safety net.
```

### Every task
```bash
git checkout main
git pull --rebase origin main          # always start fresh
git checkout -b feat/customer-cart-page # one branch per screen/task
# ...work with Claude Code...
git add -A && git commit -m "feat(customer): cart page with qty + promo"
git push -u origin feat/customer-cart-page
# open a PR on GitHub → other person glances at it → Merge → delete branch
```

### Rules
- **Branch = one screen or one self-contained task.** Keep PRs small; they merge faster and conflict less.
- Branch names: `feat/<panel>-<thing>`, `fix/<panel>-<thing>`, `chore/<thing>`.
- `git pull --rebase origin main` at the **start of every branch** and again before opening the PR.
- Commit messages: `type(scope): summary` — types: feat, fix, chore, refactor, test, docs.
- Never commit `.env*`, keys, or `node_modules`. Already in `.gitignore`.

### When you DO hit a conflict
Conflicts almost always come from two people editing the same file. The split below
prevents most of them. If one happens, the person merging *second* resolves it on their branch:
```bash
git checkout feat/my-branch
git fetch origin && git rebase origin/main
# fix conflicts in the marked files, then:
git add <files> && git rebase --continue
git push --force-with-lease
```

---

## 2. Work split — by panel/folder (this is what avoids conflicts)

Your 4 panels are independent apps under `apps/`. Suggested ownership:

| Area | Owner | Notes |
|------|-------|-------|
| Foundation (Supabase schema, RLS, auth, Razorpay, `packages/*`) | **One person leads, days 1–4** | The other starts on independent customer screens that don't need the backend yet. |
| Customer Panel (`apps/customer`) | **Split screen-by-screen** | Coordinate in PROGRESS.md so you never claim the same screen. |
| Agent Panel (`apps/agent`) | Person A | Self-contained app |
| Store Panel (`apps/store`) | Person B | Self-contained app |
| Admin Panel (`apps/admin`) | Split | Biggest panel; divide by section (orders/finance vs management/CMS). |

**Golden rule:** before starting a screen, put your initials next to it in `docs/PROGRESS.md`
and push that change first. That's your "claim." No two people on the same file.

Shared files (`packages/supabase` schema/types, `packages/ui`) → announce in chat before
editing, keep edits tiny, merge same day.

---

## 3. The per-task loop (what you actually do each time)

1. **Plan** — `git pull --rebase`, create branch, run `/start-task` (or just tell Claude the screen and have it read `docs/PROGRESS.md` + the relevant page of the workflow spec).
2. **Build** — let Claude implement the screen + its touch/action behaviours.
3. **Test** — `pnpm -r typecheck`, lint, run the screen's tests, click through it locally.
4. **Update context** — run `/finish-task`: it updates `docs/PROGRESS.md`, then commits.
5. **Ship** — push, open PR, get a quick review, merge, delete branch.

---

## 4. Suggested 8-week plan (mirrors the spec phases)

This is a guide, not a cage — move screens between weeks as needed.

### Week 1 — Foundation + Customer core (part 1)
- Day 1: repo, .gitignore, branch protection, monorepo restructure ✅ (done), per-panel hosting projects + env setup.
- Day 1–3: Supabase schema v1 + RLS + auth (phone/OTP).
- Day 3–5: Product Detail, Login/Signup, OTP, Cart. (Homepage + Listing already done.)
- Daily target: 1 screen each per person once foundation is up.

### Week 2 — Customer core (part 2) + start Account
- Checkout Address, Time Slot, Order Confirmation, Tracking.
- Try Timer, Keep-or-Return, Payment (Razorpay), Return Pickup.
- This finishes Phase 1 — the full order→try→keep/return loop. **End-to-end test it.**

### Week 3 — Customer Account pages
- Profile, Wishlist, Order History, AI Skin Tone Setup, Notifications, Brand page,
  Search, How It Works, Contact, Size Guide, 404.
- These are smaller — aim 2 screens each per day.

### Week 4 — Delivery Agent Panel (12 screens)
- Person A leads. Login, Dashboard, Pickup/Delivery detail, Return Collection, Map,
  Earnings, Profile, Notifications, History, Support, Onboarding.

### Week 5 — Store Panel (14 screens)
- Person B leads. Login, Dashboard, Catalog, Add/Edit Product, Order Management,
  Order Detail, Returns, Earnings, Analytics, Profile, Staff, Support, Onboarding.

### Week 6 — Admin Panel (21 screens)
- Split: A = orders + finance (Orders, Order Detail, Revenue, Payments, Try&Return,
  Payouts, Live Map). B = management + ops (Customers, Stores, Agents, Complaints,
  Promo, CMS, Roles, Settings, Reports, Activity Log, Dashboard).

### Week 7 — Integration + hardening
- Wire all 4 panels to Supabase, finalize RLS, Razorpay Payouts, AI endpoint.
- End-to-end test the whole flow across all panels.

### Week 8 — Deploy + pilot
- Deploy all 4 apps (one project per panel/subdomain), custom domains, HTTPS.
- Beta test: 10 campus users + 2 stores + yourselves as agents. Fix bugs, retest.
- Go live — campus pilot.

---

## 5. Daily rhythm (lightweight, ~5 min of overhead)
- **Morning (async, 2 lines in chat):** what I'm taking today + which screens I'm claiming in PROGRESS.md.
- **Work:** one branch per screen, small PRs.
- **Before logging off:** all branches pushed or stashed; PROGRESS.md reflects reality; nothing half-merged into main.
- **Weekly (Fri, 15 min):** open PROGRESS.md together, recount done vs pending, re-plan next week.
