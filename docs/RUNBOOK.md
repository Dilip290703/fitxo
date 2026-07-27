# Fitzo — Ops Runbook

**Launch-plan W5.5. This is the "something is wrong at 9pm" document.** Symptom → check →
fix, in that order. Everything here has been verified against the code; where a value is a
config knob it says so rather than quoting a number that will drift.

Companion docs: **`ENVIRONMENTS.md`** (dev/prod setup, key rotation, backups),
**`PROGRESS.md`** (what exists and why — the decisions log is the archaeology).

> ⚠️ **One item still open before launch: the support contact.** Admin → Settings
> currently holds the placeholder `support@fitzo.in` with no phone. **Nobody is
> confirmed to be reading it** — decide the address (and a number, if there is
> one), set them in Settings, and record them in §6. A contact that looks staffed
> and isn't is worse than none.
>
> *(Resolved 2026-07-26: rider-failed fee policy §3.3 · SLA §6 · on-call §6.)*

---

## 0. First 60 seconds

| Symptom | Go to |
|---|---|
| Customer paid but the order still says unpaid | [§2.1](#21-payment-captured-but-order-not-settled) |
| Order stuck — no rider ever picked it up | [§1.1](#11-order-confirmed-but-no-rider-claims-it) |
| Rider is stuck / can't complete a job | [§1.2](#12-rider-cannot-complete-a-delivery) |
| Try window never closed | [§1.3](#13-try-window-expired-but-the-order-never-closed) |
| Customer wants their money back | [§3](#3-refunds) |
| "I was charged twice / never refunded" | [§3.2](#32-delivery-fee-still-held-after-a-cancel) |
| Nobody can log into Admin | [§5.1](#51-locked-out-of-admin-mfa) |
| Store or rider says they weren't paid | [§4](#4-payouts) |

**The three screens that answer most questions:** Admin → **Dashboard** (Needs-attention
queues), Admin → **Orders → [order]** (timeline + Money card), Admin → **Payments** (the
money ledger).

---

## 1. Stuck orders and deliveries

### 1.1 Order confirmed but no rider claims it

**What's happening:** the order was paid for and confirmed by the store, but it sits in the
rider offer feed unclaimed. After `system_settings.offer_expiry_minutes` (default 120) it
stops being offered at all — the feed filters by freshness — so it becomes invisible to
riders while still looking live to the customer.

**Check:** Admin → Dashboard → the delivery-fee queue; or
```sql
SELECT * FROM pending_fee_refunds() WHERE reason = 'stale_unclaimed';
```

**Fix:** Admin → Orders → the order → **Cancel Order** with a reason. This is the *only*
correct route — it cancels, refunds the upfront delivery fee, notifies the customer and the
stores, and releases reserved stock (migration 058). Do **not** cancel by editing the row.

> ⚠️ **Why the automatic sweep doesn't do this for you.** `expire_stale_offers()` exists but is
> deliberately **not scheduled**: it cannot call Razorpay from inside Postgres, so an
> unattended run would cancel orders while keeping the customer's delivery fee. `verify-env.sh`
> check 9 **fails** if anyone schedules it. Automating this needs an app-side runner that
> refunds first — gated on W2.2.

### 1.2 Rider cannot complete a delivery

**Rider-side (preferred):** the rider app's own fail path asks for a reason, fails the
delivery, cancels the order, and **automatically files a high-priority complaint** into
Admin → Complaints. It also notifies the customer (migration 058) — deliberately without
promising anything about the fee, see §3.3.

**Admin-side:** Admin → **Deliveries** →
- **Release delivery** — unassigns the rider and returns the job to the offer pool. Use when
  the rider simply can't continue but the order is still deliverable.
- **Mark delivery failed** — terminal. Use when the order is not going to be delivered.

**After either:** check the order's status is coherent (Admin → Orders → [order]) and, if the
order ended cancelled, that the fee was refunded — §3.2.

### 1.3 Try window expired but the order never closed

**This should self-heal.** `expire-try-windows` runs **every minute** via pg_cron
(migration 056): it auto-returns any still-undecided items and completes the order. Clients
also call `expire_order_if_due` when their countdown hits zero.

**Check the sweep is actually alive:**
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
SELECT status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
```
Expect exactly one job — `expire-try-windows`, `* * * * *`, active — and recent `succeeded`
runs. **If `expire-stale-offers` appears here, unschedule it** (see the warning in §1.1).

**If the sweep is dead:** re-run migration **056**; it is idempotent and re-creates the
schedule. One-off manual close: `SELECT expire_try_windows();`

**Note:** the window length is `system_settings.try_window_minutes` (Admin → Settings), not a
constant, and it starts when the **rider marks delivered**, not at checkout.

---

## 2. Payments

### 2.1 Payment captured but order not settled

**Two independent paths settle a payment:** the browser success handler, and the
`payment.captured` webhook (migration 039) for when the browser never comes back — phone
died, tab closed. Both funnel into the same in-DB core, which locks the row and no-ops on
duplicates, so them racing is safe.

> ⚠️ **The webhook path has never actually been observed working — verify it at W5.2.**
>
> Its secret was wrong until 2026-07-26 (Vault held a copy of the **API key secret**, so the
> route passed on the env value and the in-DB re-check against Vault then rejected it). That
> is **fixed** — `pnpm razorpay:check` reports every copy in agreement on dev and prod.
>
> But agreement is not proof: Razorpay cannot reach `localhost`, so no signed delivery has ever
> completed. The secret is right; the path is untested. **First real webhook lands only once the
> apps are deployed at a public URL (W2.2)** — treat that as the acceptance test, and until it
> passes, assume a customer whose browser dies right after paying may leave a captured payment
> Fitzo never records. A `gateway_fee` of NULL on a settled payment is the usual tell (the
> webhook stamps it; Admin → Payments → *Sync gateway fees* is the manual backfill).
>
> This matters more since 2026-07-26, when payment moved to the **checkout** screen: customers
> now pay at a moment when closing the tab is likelier, which is exactly what this path exists
> to recover.

**Check:**
1. Admin → **Payments** — find the row. `initiated` means we created the order but never
   confirmed capture; `success` means settled.
2. Razorpay dashboard — was it actually captured?
3. `pnpm razorpay:check` — if the Vault key secret and the app envs disagree, **every**
   settlement fails signature verification. That's the first thing to rule out.

**Fix:** if Razorpay shows captured and Fitzo shows `initiated`, re-deliver the webhook from
the Razorpay dashboard once the secret is correct. Never hand-edit a payment row to
`success` — the in-DB HMAC check exists precisely so settlement can't be forged.

### 2.2 Webhook is down or rejecting

| Response | Meaning | Action |
|---|---|---|
| **401** | Signature verification failed | Secret mismatch — `pnpm razorpay:check`. A retry won't fix a forgery. |
| **500** | `RAZORPAY_WEBHOOK_SECRET` not set | Set it in the customer app's env **and** Vault; both are checked, in different places. |
| **2xx** but nothing settles | Event isn't `payment.captured` | Only that event is subscribed; others are acked and ignored by design. |

Razorpay retries non-2xx with backoff for ~24h, so a fixed secret can recover recent misses
by re-delivery.

---

## 3. Refunds

### 3.1 Ordinary refund

Admin → **Payments** → the row → **Refund** (confirm-with-reason). Full refunds only
(migration 041). The money moves at Razorpay first, then the row flips to `refunded` and the
action is audit-logged. `order_economics` is refund-aware, so the Money card, Finance/P&L and
payout math all correct themselves — no second step.

**If it errors "insufficient balance to instantly refund":** that's the Razorpay account, not
us. Top up refund credits / test balance and retry.

### 3.2 Delivery fee still held after a cancel

Since the fee is charged **upfront**, a cancelled order can still be sitting on real customer
money. This is tracked automatically:

**Admin → Dashboard → the red delivery-fee queue**, or:
```sql
SELECT * FROM pending_fee_refunds();
```

| `reason` | Meaning | Action |
|---|---|---|
| `cancelled_unrefunded` | Cancelled, fee never came back | Refund via Admin → Payments (§3.1) |
| `stale_unclaimed` | Still confirmed, no rider ever took it | Cancel it properly (§1.1) — that refunds too |
| `rider_failed` | Rider travelled and couldn't deliver | Refund by default, but check for a repeat pattern — §3.3 |

The queue is **derived from the payment rows**, not a flag anyone maintains, so any future
cancel path shows up here on its own. If the dashboard shows an amber *"Delivery-fee refund
check unavailable"* row, migration 058 isn't applied on that environment.

### 3.3 Rider-failed deliveries — refund by default

**Policy (decided 2026-07-26): refund the ₹49, and treat it as the standing answer.**

When a rider travelled and couldn't deliver (customer unreachable, wrong address, safety
issue), Fitzo still pays the rider — so a refund means absorbing roughly the rider fee on a
trip that did happen. That cost is accepted: at launch volume, ₹49 is far cheaper than a
customer's first experience being "they took my money and nothing arrived", and the customer
usually cannot prove they *were* reachable.

**It stays a human click, deliberately** — these are never auto-refunded:

- `rider_fail_delivery` runs in the database and cannot call Razorpay, so an automatic refund
  is blocked by the same constraint as `expire_stale_offers` (§1.1). Nothing to automate today.
- Keeping a person in the loop is also what makes a **pattern** visible. One customer with
  repeated "unreachable" failures is the case this policy is *not* meant to cover.

**How to action one:** Admin → Dashboard → the delivery-fee queue (or `SELECT * FROM
pending_fee_refunds()`), find the `rider_failed` row, refund via Admin → Payments (§3.1).

**When to refuse:** a repeat pattern from the same customer. Check their order history first;
if this is their second or third rider-failed order, escalate rather than refunding reflexively
— and record the reason on the refund so the next person sees it.

The customer's automatic notification says support is reviewing and **promises nothing about
money**, which keeps this reversible: you can refuse a specific case without having contradicted
anything the customer was already told.

---

## 4. Payouts

**Cadence: weekly, manual, UTR-referenced.** RazorpayX automation is blocked on a registered
entity and its own KYC (see `PAYOUTS-GOING-LIVE.md`) — manual is the accepted launch plan,
not an oversight.

| Who | Screen | Basis |
|---|---|---|
| Stores | Admin → **Payouts** | kept revenue − commission, minus already-paid |
| Riders | Admin → **Agent Payouts** | delivery fee per completed job, minus already-paid |

**Procedure:** pay from the bank/UPI first → then **Record payout** in the admin screen and
paste the **UTR / UPI transaction id** into *Payment reference*. Always record the reference:
it is the only link between Fitzo's ledger and the bank, and it is what makes a "you didn't
pay me" dispute answerable. Every payout is audit-logged.

**"I wasn't paid":** Admin → Payouts / Agent Payouts shows outstanding vs paid per partner;
Admin → Activity Log shows who recorded what and when.

**Never** hand-insert payout rows — the double-payout guard (migration 032) lives on the
recorded path.

---

## 5. Access and security

### 5.1 Locked out of Admin (MFA)

Admin requires TOTP plus an email allowlist (W3.5). **There is deliberately no in-app reset —
that would be the bypass.**

- **Lost authenticator:** Supabase dashboard → Authentication → Users → the user → remove the
  MFA factor. Next sign-in walks them through QR enrollment again.
- **Locked out by the allowlist:** `ADMIN_EMAIL_ALLOWLIST` is server-side env. Remove or
  correct the entry and restart/redeploy the admin app.
- **Enrollment dead-ends:** TOTP must be enabled on the Supabase project *before*
  `NEXT_PUBLIC_ADMIN_REQUIRE_MFA=true`, or `enroll()` fails.

### 5.2 Suspected data exposure

```bash
SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… pnpm rls-probe
```
Proves over the public anon key that no sensitive table leaks a row — the automated guard for
the 2026-06-08 incident (RLS silently disabled). Runs in CI daily against dev; **run it by
hand against prod** on any suspicion. `scripts/supabase/verify-env.sh` is the fuller audit.

### 5.3 Key rotation

`ENVIRONMENTS.md` → "Rotating the Razorpay keys". The trap worth knowing cold: the secret
lives in **four** places (customer env, admin env, Vault on dev, Vault on prod) and a partial
rotation means **the app charges while the database rejects the settlement** — money moves,
order never settles. Verify with `pnpm razorpay:check` per project, then one test payment.

### 5.4 Data loss / restore

Prod is on the **Free plan — no PITR**, daily backups only. A restore can lose **up to 24
hours** of orders, payments and payouts. Razorpay remains the independent record of money
actually moved, so cash is reconcilable; order and try-session state is not.

**Take a manual backup before any destructive prod work.** Revisit Pro + PITR at the W5.2
live cutover — with real money flowing daily this stops being optional.

---

## 6. Support

**Channel:** Admin → **Complaints** (statuses `open` → `in_progress` → `resolved` / `closed`).
Rider-reported failures land here automatically at high priority.

⚠️ **Customer-facing contact is still unset.** Admin → Settings holds `contact_email =
support@fitzo.in` and an **empty** `support_phone`, and that address is a placeholder nobody
has confirmed is monitored. Before launch: pick the address a human genuinely reads, set it in
Settings, and write it here. Leaving a plausible-looking address in place is the failure mode —
a customer with a payment problem mails into a void and concludes Fitzo is a scam.

**SLA (agreed 2026-07-26):**

| Severity | Example | Respond within |
|---|---|---|
| **P0** — money or safety | Charged but not settled · refund owed · rider safety | **1 hour** |
| **P1** — order blocked | Stuck order · nothing delivered · store can't confirm | **4 hours** |
| **P2** — everything else | Sizing, app questions, general queries | **Next working day** |

The P0 clock is set by the money paths: a captured-but-unsettled payment or an unrefunded fee
must not sit overnight, because the customer sees the charge long before we see the queue.

**On-call: no formal rota — Dilip and Jay both respond, whichever is free.**

That is the honest description of a two-person team, but it has one known failure mode worth
naming: *nobody* is definitively responsible, so the risk is not two people colliding on an
incident — it's both assuming the other saw it. Two habits make it safe enough at launch
volume:

- **Claim it out loud.** Say "taking this" in chat before acting, so the other stops watching.
- **Sweep the queues daily** rather than relying on noticing. The dashboard's Needs-attention
  section plus `pending_fee_refunds()` are the two that hold customer money.

Revisit this the moment order volume outgrows "we'd both notice" — a rota costs nothing to
introduce and a missed P0 costs a customer.

**Escalation for anything involving money:** capture the order number and the payment id,
check Admin → Orders → Money card **and** the Razorpay dashboard before promising a customer
anything. Those two disagreeing is itself the bug worth reporting.

---

## 7. Config knobs (Admin → Settings)

Change these here, never in code: **try-window minutes** · **offer expiry minutes** ·
**delivery fee** and free-delivery threshold · **first-order-free** toggle · **commission
rate** · **rider fee** · **abuse caps** (max items per order, max active orders, daily cap —
`0` disables a cap).

Defaults at the time of writing: try window as configured, offer expiry 120, delivery fee ₹49,
free above ₹999, commission 15%, rider fee ₹40, caps 8 / 1 / off.
