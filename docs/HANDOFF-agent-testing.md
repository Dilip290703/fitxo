# Testing the delivery-agent loop — without touching Supabase

Earlier we kept dropping into the Supabase SQL editor to make tests work (rider couldn't
log in, the try-on timer wouldn't start, deliveries didn't show up for the rider). Almost
all of that was **one-time DB setup that hadn't been applied yet**. Once the two migrations
below are run **once per environment**, the whole loop is testable from the apps with **no SQL**.

## One-time setup (per Supabase project) — do this once, ever

In the Supabase **SQL Editor**, paste and run each file's contents once:

1. `packages/supabase/migrations/014_agent_panel.sql` — rider action RPCs, the auto-create-
   delivery trigger, the 7-minute `start_try_window` function, and Realtime on
   `orders` / `try_sessions` / `deliveries`. **If this isn't applied, the timer won't start
   and rider actions fail — that was the "timer" SQL we kept doing.**
2. `packages/supabase/migrations/015_auto_provision_users.sql` — auto-creates the
   `public.users` row (and a `riders` row for riders) the moment anyone signs up. **If this
   isn't applied, a new rider is invisible in Admin and can't be verified without a manual
   INSERT — that was the "rider can't log in" SQL we kept doing.**

To check they're applied: in the SQL editor run
`select proname from pg_proc where proname in ('start_try_window','handle_new_user');`
— you should see both names.

## ✅ Local-testing: panels no longer share one login

**Fixed (2026-06-26):** each app now sets a distinct Supabase auth-cookie name
(`NEXT_PUBLIC_SUPABASE_COOKIE_NAME`, e.g. `sb-fitzo-agent`) in its `next.config.ts`, so the
four panels no longer clobber each other's session on `localhost` (cookies are shared across
ports). You can be logged into customer (:3000), admin (:3001) and rider (:3002) **at the
same time in one browser profile**. The middleware also renders the login form instead of
looping, so the old `ERR_TOO_MANY_REDIRECTS` on `/admin/login` is gone.

> Historical note: before that fix, all three apps shared **one** auth-session cookie, so a
> single browser profile could only hold one panel login at a time.

The full loop needs 3 concurrent logins (customer, admin, rider). Thanks to the per-panel
cookie names above, a **single browser profile** now holds all three at once — just open
each app in its own tab. (Separate profiles still work too, if you prefer to isolate them.)

## Testing the full loop (no SQL after the one-time setup)

Run the apps: `pnpm dev` (customer :3000 + admin :3001), `pnpm dev:agent` (:3002).

1. **Rider signs up** — agent app (:3002) → Create account. They'll see "an admin will verify
   you." (015 auto-creates their `users` + `riders` rows, so they now appear in Admin.)
2. **Admin verifies the rider** — admin app → **Riders** → open the rider → **Verify Rider**.
   (Optional: **Mark Available**, or let the rider toggle "online" themselves in step 4.)
3. **Customer places an order** — customer app (:3000): add items → checkout. This auto-creates
   a delivery in `assigned` state (trigger from 014).
4. **Rider goes online** — agent app → toggle availability **online** (so admin can assign them).
5. **Admin assigns the delivery** — admin app → **Deliveries** → the order shows under
   "Unassigned" → pick the rider from the dropdown → **Assign**.
6. **Rider runs the status machine** — agent app → the delivery now appears → **Accept** →
   **Picked up from store** → **Mark delivered (at door)**.
7. **Customer starts the try-on** — customer order-tracking page shows an "order arrived"
   prompt → tap **Start try-on**. The 7-minute timer starts and shows live on **both** the
   customer and rider screens.
8. **Customer decides** — keep / return per item; the rider screen updates live.
9. **Rider completes** — when the timer ends (or all items are decided) → **Collect returns &
   complete**. Order → `completed`.

That's the whole loop. The only Supabase visit is the one-time migration paste in setup.

## If something still sends you to Supabase
That's a bug or a missing screen — tell Jay. The intent is: onboarding = Admin clicks,
the loop = app taps. We add an admin/app control rather than living in the SQL editor.
