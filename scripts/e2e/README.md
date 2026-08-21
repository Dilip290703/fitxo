# Fitxo end-to-end money-path suite

Drives the real order loop against a live Supabase project as **real signed-in
users**, and asserts what the database actually did at every step.

```bash
pnpm e2e:preflight   # read-only. Safe anywhere, including production.
pnpm e2e             # full run against dev. Writes, then cleans up after itself.
pnpm e2e -- --keep   # full run, fixtures left behind for inspection
pnpm e2e:sweep       # delete leftovers from a run that died before teardown
```

Exit `0` all passed · `1` at least one assertion failed · `2` the suite could
not run (bad credentials, refused target).

Credentials are read from `apps/customer/.env.local` and
`apps/admin/.env.local` automatically, so there is no setup on a dev machine.
`E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` / `E2E_SERVICE_ROLE_KEY` override
them for CI.

## Why this exists

39 tests existed before this, all of them pure `lib/` functions — sorting,
address formatting, form validation. **Zero** covered a server action, an RPC,
or any path that moves money. Meanwhile the money path is where every expensive
bug in this project has actually lived: RLS switched off (2026-06-08), a sweep
cancelling paid orders without refunding them (056), three separate cancel
paths keeping the customer's ₹49 (058), the store panel discarding the
cancellation notification it was being sent (060).

None of those would have been caught by a unit test. All of them would have
been caught here.

## What it actually asserts

**`place_order`** — the only door onto stock, pricing and the abuse caps:

- price resolves from the database and the client's number is ignored (the
  suite sends `price: 1` on a ₹799 product and asserts the order says ₹1598)
- one `order_items` row **per unit**, not per line
- stock reserved under the order (047), released again on return and on cancel
- delivery fee taken from `system_settings`, not a constant
- try window length taken from `system_settings` (048)
- address stamped on the order (A1)
- refusals, each of which is a way to lose money if it stops working:
  `EMPTY_CART` · `ADDRESS_REQUIRED` · `ADDRESS_INVALID` · `INVALID_QUANTITY` ·
  `PRODUCT_UNAVAILABLE` · `OUT_OF_STOCK` · `MULTI_STORE_CART` (G1) ·
  `STORE_PAUSED` (G6/052) · `ORDER_TOO_MANY_ITEMS` and `ORDER_LIMIT_ACTIVE`
  (G5/053)

**Fulfilment** — fee gate, store confirm, rider claim, try window, decisions:

- `store_confirm_order` **refuses** an order whose fee is unpaid
  (`DELIVERY_FEE_UNPAID`, G9/050) and succeeds once it is paid
- the delivery row exists and carries the drop address
- a rider can claim it, and after that the customer's cancel window is closed
  (`CANCEL_RIDER_ASSIGNED`, 054)
- the try window starts **on arrival**, not at checkout, and is settings-length
- keep/return decisions notify the rider (023) **and the store (060)** — the
  row 060 added, which is the bug the store panel had

**Cancellation** — where money actually goes missing:

- customer cancel frees stock, closes the delivery and the try session, and
  notifies the store (054 — the notification the store UI used to throw away)
- a cancelled order that had paid its fee is accounted for by
  `pending_fee_refunds()`, the derived queue from 058

**RLS**, on rows the suite itself just created — not on an empty table:

- anon cannot read the order
- a *different signed-in customer* cannot read it either
- the owner still can (over-locking is a bug too)

**Residue** — the suite asserts it left nothing behind. This is not
housekeeping: `pending_fee_refunds()` infers "order holding money it shouldn't"
from payment rows, so a forgotten test payment shows up as a real customer owed
a real refund. The suite snapshots that queue at the start and asserts the same
count at the end.

## What it deliberately does NOT cover

Say this out loud rather than let a green run imply more than it means.

- **Razorpay.** No API call is made. The captured fee payment is *simulated* by
  inserting the `payments` row the gate looks for. What is tested is the gate's
  contract, not that anyone was charged. The real gateway path needs a browser
  payment — and the webhook half still needs a public URL (W2.2), which is why
  `payment.captured` has never once been observed working.
- **The four panels' UI.** This is the data layer end to end. Nothing clicks a
  button. Admin/store/rider screens behind their sign-in walls remain
  click-tested by hand.
- **pg_cron.** `expire_try_windows` firing on schedule is not observable from
  here; `scripts/supabase/verify-env.sql` section B checks that it is scheduled.
- **Email/SMS.** None is wired up yet anyway (W2.4/W1.2).

## Safety model

Three layers, because this thing writes to a shared database:

1. **An allowlist, not a prod blocklist.** `WRITABLE_REFS` in `lib/env.mjs`
   names dev explicitly. A blocklist fails open — a new staging project, a
   restored snapshot or a typo'd ref would sail past "is it prod?". Production
   is *also* named separately so the refusal can say so out loud, and there is
   no override flag.
2. **Namespaced fixtures.** Every row is prefixed `e2e-<runid>`, so teardown
   finds its own rows deterministically and `--sweep` can clean up after a
   crash without a human working out which of the 60 dev orders were real.
   Nothing is ever matched on "recently created".
3. **Teardown in `finally`, best-effort per table.** A teardown that aborts on
   the first error leaves *more* residue than one that keeps going.

`system_settings` is **read, never written**. The suite adapts to the live caps
and fees instead of setting them — a test that flips a global toggle and then
dies leaves the environment misconfigured for everyone.

One consequence worth knowing: dev runs `max_active_orders = 1`, so each
scenario gets **its own customer**. A suite that reused one account would start
failing at the second order for a reason unrelated to what it was testing.

## Extending it

Add a file under `suites/`, export `async function yourSuite(world, report, ctx)`,
and register it in `run.mjs`. Use `world.createCustomer()` / `createStore()` /
`createStoreManager()` / `createRider()` so teardown knows about your rows, and
call `world.trackOrder(id)` for any order you create outside `place_order`.

Assert through `report.check(name, passed, evidence)` — always pass the
evidence. A passing assertion that cannot say what it saw is indistinguishable
from one that never ran, and a suite full of those is how "all green" stops
meaning anything. For refusals use `report.expectError(name, error, 'CODE')`;
most of this money path's correctness lives in what it refuses to do, and a
suite that only checked happy paths would pass against a build with every guard
deleted.
