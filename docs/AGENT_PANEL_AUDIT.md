# Agent Panel — Real-World Audit (Phase 0)

**Date:** 2026-07-06 · **Branch:** `feature/agent-panel-rework` (cut from main after PR #32) · **Nothing changed — diagnostic only.**

Scope: `apps/agent` (9 screens + `AgentShell`), migrations 014–028, and the cross-panel
surfaces a rider touches (checkout COD, customer keep flow, admin agent payouts).
Benchmarks: Swiggy Delivery Partner, Zomato Rider, Blinkit/Zepto, Uber Driver, Rapido Captain.
Success bar: *a brand-new rider on a ₹8k Android in sunlight completes delivery #1, including the
7-min doorstep wait, without calling anyone.*

**Verification caveat:** login verified live at 375×812 (zero overflow) on :3002. The authed
screens were audited **in code** — the repo holds no rider credentials (consistent with every
prior phase), so the logged-in 375px pass is Dilip's browser step, and it is a **hard gate** for
every later phase.

---

## A. A rider's real day, traced in code

### The good day

| Step | What exists | Verdict |
|---|---|---|
| Go online | Shell toggle → `rider_set_availability` (optimistic, reverts on error) | ✅ Works |
| Offer arrives | `IncomingJobsProvider` polls `available_deliveries()` every 7s while Online; repeating 3.5s chime; Accept/Decline card | ✅ Mechanism solid |
| Offer card content | Order number, **+₹fee**, item count, city · pincode | 🔴 **Not enough to decide.** No pickup store, no distance (no geo anywhere in the DB), no order age/expiry. Fee + pincode is all a rider gets. |
| Accept race | `rider_claim_delivery` atomic on `rider_id IS NULL`; loser gets a 4s "just taken" toast and the card drops | ✅ Good loser UX |
| Navigate to store | — | 🔴 **DEAD END — the #1 finding.** `deliveries.pickup_address` exists in the schema but **nothing ever populates it** (`create_delivery_for_order` writes only `drop_address`). The delivery detail screen has *only* a "Deliver to" card. **The rider is never told which store to pick up from, anywhere.** Multi-store orders (items span `products.store_id`) make it worse — the flow implicitly assumes one store and names none. |
| Pickup confirmation | One self-attested tap: "Picked up from store" | 🟠 No handover verification. `rider_mark_picked_up` doesn't even check the store marked items ready (`prepared_at`) or that the store confirmed — a rider can "pick up" an unprepared order. Store panel has no "handed to rider" step. |
| Navigate to customer | "Open in Maps" link (address-text search) + "Call {phone}" | ✅ Adequate for now (no Maps key by decision) |
| Arrival + handover | Single "Mark delivered (at door)" flips delivery→`arrived`, order→`delivered` | 🟠 One tap conflates arrive + handover; **no delivery OTP** — nothing proves the rider is at the door. Customer then taps "Start try-on". |
| The 7-min wait | Blue card, 44px mono countdown (deadline timestamp from `try_sessions`, ticks client-side — survives network drops), live keep/return badges via realtime + a 4s poll fallback, running Keeping/Returning/Collect tally | ✅ The strongest screen. Gaps: no wake-lock (phone sleeps mid-wait → chime/poll stop), nothing tells the rider *what to do* while waiting. |
| Collect returns & complete | Button gates on `expired \|\| allDecided`; `rider_complete_delivery` (027) auto-returns pending items, completes order + session, bumps `total_deliveries` | 🟠 Collect is a **count**, not a checklist — no per-item tick-off, no condition marking, no photo. He signs off on "3 item(s)" blind. |
| Earnings updated | Rollups from `orders.delivery_fee` on completed deliveries | ✅ Consistent with Admin > Agent Payouts. (Money caveat in §B1.) |

### The bad day

| Scenario | What happens today |
|---|---|
| Customer unreachable at door | 🔴 **No path.** The only forward action is "Mark delivered" (a lie). Rider can call, then… nothing. `delivery_status='failed'` is admin-only (the Fail action from the admin rework). No rider-side fail/return-to-store, no "attempted delivery" state, no way to even tell admin from the app. |
| Store not ready at pickup | 🔴 No path. Wait or phone a human. No "store delayed" report, no gate stopping him from tapping Picked-up anyway. |
| Wrong/damaged-item accusation | 🔴 No evidence path — no photos, no condition marking on collected returns, no dispute flow. `returns.condition` column exists, unused by the rider. |
| App killed mid-delivery | ✅ **Recovers cleanly** — all state is in the DB; reopening shows the active job on the dashboard. (Offer chime obviously dies with the tab.) |
| Network drop during the timer | 🟡 Countdown keeps ticking (local math on a fetched deadline). Actions fail with a raw Supabase error string and no retry queue; realtime + poll resume on reconnect. Survivable, ugly. |
| Abandon mid-job | 🟡 Pre-pickup: ✅ "Can't take it — return to pool" (`rider_release_delivery`, 028) + auto-release on going Offline. **Post-pickup: nothing** — rider holding goods has no in-app path at all; it's an admin/support case with no way to reach support about *this* delivery. |
| Phone call during the timer | 🟡 Tab backgrounds; JS throttles; chime stops (and chime only ever works after one tap unlocks AudioContext). Poll catches up on return. No vibration fallback. |
| Try window expires, customer gone | ✅ Handled (027): auto-return on complete, `expire_order_if_due` self-heal, sweep available. |

**Verdict on A:** the happy path is real and recoverable, but a brand-new rider fails the success
bar **at step 4** — he cannot find the store — and any doorstep deviation strands him.

---

## B. Missing features vs benchmark apps — BUILD / SIMPLIFY / SKIP

| # | Feature | Today | Recommendation |
|---|---|---|---|
| 1 | **COD / cash-in-hand** | **Half-modeled, currently incoherent.** Checkout offers "Cash on Delivery" (`payment_method='cod'` on orders) — but the keep flow on the tracking page is **Razorpay-only** (a COD customer tapping Keep still gets the Razorpay modal), the rider panel says nothing about collecting cash, and no cash ledger exists. PROGRESS already flags that prepaid customers aren't charged the delivery fee "COD collects in cash" — which nobody tells the rider to collect. | **DECIDE (owner call).** Either **SIMPLIFY**: hide COD at checkout until it's modeled (1-line change, honest product) — my recommendation for now; or **BUILD**: "Collect ₹X cash" step on complete + rider cash ledger + admin reconciliation (real scope, Phase 3 if chosen). |
| 2 | Rider KYC + bank/UPI for payouts | Nothing. Admin > Agent Payouts has **no destination to pay into**. | **BUILD** (Phase 3, planned) — mirror `store_business_details`: private table, own-rider-or-admin RLS, guarded RPC, destination surfaced on Admin > Agent Payouts. |
| 3 | Per-order earnings breakdown + payout history | Per-order fee list exists; "Recent payouts" is mislabeled (it's completed jobs, not payouts). `agent_payouts` ledger is admin-visible only — rider RLS exists but the panel never reads it. | **BUILD** the earned-vs-paid split reading `agent_payouts` (Phase 3). **SKIP** surge/incentive structures — no schema, 1–2 riders, invent nothing. |
| 4 | Offer auto-expiry countdown on card | Offers never expire; card shows no age. An old offer looks identical to a fresh one. | **SIMPLIFY**: show order age ("waiting 6 min") on the card. **SKIP** hard expiry — with 1–2 riders an expired offer is an undelivered order. |
| 5 | Concurrent-job cap | **None** — a rider can claim unlimited jobs (PROGRESS known issue). Every benchmark caps at 1–2. | **BUILD**: `available_deliveries()` returns nothing while the rider has an active job (cap = 1). One migration, huge integrity win. |
| 6 | Auto-offline on inactivity | None (028 auto-releases jobs on manual Offline only). | **SKIP** — needs heartbeat infra; wrong scale. Revisit pre-launch. |
| 7 | Delivery OTP / handover verification | None at store, none at door. | **BUILD** a doorstep OTP (4-digit code on the customer's tracking page; rider enters to mark delivered — Swiggy/Zomato standard). **SIMPLIFY** store-side: gate `rider_mark_picked_up` on all items `prepared_at` instead of a store-handover ceremony. |
| 8 | In-app issue reporting per delivery | None. Support = static helpline + FAQ. | **BUILD** on the existing `complaints` table (migration 012) exactly like the store panel did — zero/near-zero migration, feeds Admin > Complaints, and becomes the "bad day" escape hatch (report issue / can't-reach-customer / abandon-with-reason). |
| 9 | SOS / emergency | None. | **SKIP** the dedicated SOS system; make the helpline a one-tap call button on the active-delivery screen. |
| 10 | Ratings visibility | Shows `riders.rating` — which **nothing ever writes**; every rider is a hardcoded-looking 5.00. | **SIMPLIFY**: hide the fake rating until a rating source exists. **SKIP** building customer-rates-rider now. |
| 11 | Weekly earnings summary | ✅ Exists (this-week hero + 7-day bars). | Keep; restyle in Phase 1. |
| 12 | Wake-lock during active delivery | None — the screen sleeps during the 7-min doorstep wait. | **BUILD**: Screen Wake Lock API while a delivery is active. A few lines, outsized value. |
| 13 | Offline-tolerant status updates (queue & retry) | None; raw error strings. | **SIMPLIFY**: friendly error + explicit one-tap Retry on every action. **SKIP** a persistent offline queue. |
| 14 | PWA installability | **Nothing** — no manifest, no icons, `apps/agent` has no `public/` dir at all. | **BUILD** (Phase 1, mandated): manifest + icons + theme color, installable to home screen. |

---

## C. UX & mobile audit (Critical / Major / Minor)

**Critical**
- **C1. Offer card lacks decision info** (no store, no distance, no age) — see A. The one decision the app exists for is made blind.
- **C2. No pickup destination anywhere** — see A. Fails the success criterion outright.
- **C3. No bad-day exits** — every deviation dead-ends into "call somebody" with no number for admin and no per-delivery report (§A bad day, §B8).

**Major**
- **M1. Online toggle in the mobile header is ~30px tall** (`px-3 py-1.5` compact pill) — the single most important control, under the 44px minimum, top-right (worst thumb zone one-handed).
- **M2. Chime requires a tap-to-unlock AudioContext and has no vibration fallback** (`navigator.vibrate` unused). A rider who opens the app and pockets the phone hears nothing.
- **M3. Sunlight/contrast**: hand-rolled dark navy theme; body text `#7c8aa5` on `#0f1522` at 11–13px ≈ 4.4:1 — below comfortable for small text outdoors. Also diverges completely from the paper/ink/gold family (Phase 1 fixes both).
- **M4. No error states**: every data hook (`fetchMyDeliveries`, `fetchCompletedDeliveries`, …) swallows errors and returns `[]` — a network/RLS failure renders as a cheerful empty state ("No deliveries right now") or eternal "Loading…". On flaky networks this is actively misleading.
- **M5. Emoji as iconography** (🛵💰🔔 in nav, tabs, cards) — renders inconsistently on cheap Androids; store/admin use SVG.
- **M6. Collect-returns is a count, not a checklist** (§A) — the highest-stakes doorstep moment has the least UI.
- **M7. Two parallel alert systems** (offers overlay + JobAlerts popups/bell) with two separate mute keys and two chimes. A rider can mute one and think both are muted.
- **M8. DeliveryCard leads with the order's `final_amount`** (customer's bill) instead of the rider's fee — the number he's paid is the one *not* shown.

**Minor**
- Stale copy: Deliveries empty state says "When an admin assigns you a job…" (pre-self-serve); Earnings calls completed jobs "Recent payouts"; Guide still describes admin-assignment.
- Bare "Loading…" strings everywhere (store/admin standardized on skeletons).
- Dashboard "New jobs · accept now" section duplicates the offer overlay for admin-assigned jobs — two accept surfaces for the same concept.
- Profile shows rating "5.00 ★" (fake — see B10) and a truncated internal rider UUID nobody needs.
- Inline `<style>` blocks in Login/Settings instead of tokens.
- History rows link to `/deliveries/[id]` — fine, but the detail page for a completed job shows the stale action bar area rather than a receipt-style summary.

**375px overflow pass**: Login **verified live — zero horizontal overflow** (screenshot taken).
All 9 authed screens audited statically: every view uses `ContentWrap` (`max-w-[820px] px-5`),
no `<table>`s, grids are `grid-cols-2/3` with `sm:` upgrades, overlays are `w-[290px]`/`max-w-[380px]`,
the timer fits. **No overflow expected, but the logged-in 375×812 pass on all 9 screens is the
Phase 1+ hard gate** (needs Dilip's test-rider session per `docs/HANDOFF-agent-testing.md`).

---

## D. Security & data

✅ **Solid overall — the 017 lesson stuck.**
- Every rider write goes through a SECURITY DEFINER RPC (availability, accept, pickup, delivered, complete, claim, decline, release, profile). No self-privilege UPDATE policy on `riders` (the `riders_update_own` bug is confirmed dropped in 017; nothing reintroduced it).
- Money scoping is correct: earnings derive from `deliveries.rider_id = me` joins; `agent_payouts_select_rider` is own-rows-only; a rider cannot see another rider's jobs or money.
- Rider read policies on `orders`/`order_items`/`try_sessions` are join-gated to own deliveries.
- No service-role key in `apps/agent` (anon + cookie session only). ✓

Findings:
- **D1 (Major, privacy). `available_deliveries()` leaks full customer PII pre-claim** — it returns the complete `drop_address` JSONB (name, **phone**, full street address) for every unclaimed order to **every verified rider polling the feed**, even though the card renders only city + pincode. Benchmarks reveal exact address/phone only after accept. Fix in the same migration that reworks the feed (033): return a redacted area (city/pincode/landmark) until claim.
- **D2 (Major, integrity). `rider_complete_delivery` (014, re-affirmed in 027) has no status guard** — `WHERE id = … AND rider_id = v_rider`, no `status IN (…)`, no order-state check. A rider can call the RPC from the console the moment he accepts, skipping pickup/delivery/try-window entirely: order → `completed`, `total_deliveries++`, delivery fee earned. Own-delivery only, so it's earnings-integrity rather than data theft — but it's the money path. Guard on `status='arrived'` + order in `delivered`/`try_window_active`/expired.
- **D3 (Minor, integrity).** `rider_mark_delivered` accepts from `'accepted'` (pickup skippable); `rider_mark_picked_up` doesn't require the store's `prepared_at`. Tighten alongside D2/§B7.
- **D4 (Minor).** `notifications_update` policy lets a user edit any column of their own notifications (title/body/data, not just `is_read`). Harmless today; note for later column-restriction.
- New tables this rework adds (bank/KYC, issue reports if new) get RLS from birth, mirroring `store_business_details`.

---

## E. TOP 10 fixes, ranked by rider-impact ÷ effort

| # | Fix | Why it wins |
|---|---|---|
| 1 | **Pickup store on offer + delivery detail** (populate `pickup_address` at delivery creation; store name/address card + Maps link; flag multi-store orders) | Unblocks the literal job. Small migration + UI. |
| 2 | **Migration 033: rework `available_deliveries()`** — cap 1 concurrent job, redact drop PII pre-claim (D1), add store + order-age fields for the card | Three audit items, one idempotent migration. |
| 3 | **Offer card v2** — store, area, rider fee, item count, order age; bigger buttons | The decide-in-3-seconds moment, fixed with data from #2. |
| 4 | **Bad-day exits**: report-issue per delivery (complaints reuse), can't-reach-customer flow, post-pickup abandon-with-reason → admin queue | Converts every dead-end into a path. |
| 5 | **Status-guard the money RPC** (D2) + pickup gated on store readiness (D3/B7) | Earnings integrity; small migration bundled with #2. |
| 6 | **Design-system port + mobile-first shell** (paper/ink/gold tokens, SVG icons, ≥44px targets, big header toggle, sticky actions) | One product family; fixes M1/M3/M5 wholesale. |
| 7 | **PWA manifest + icons + wake-lock during active delivery** | Home-screen app; screen stays on for the 7-min wait. Cheap. |
| 8 | **Error/loading standard + vibration on chime + one mute** (M2/M4/M7) | Flaky-network honesty; alerts that actually alert. |
| 9 | **Bank/UPI + KYC capture** + destination on Admin > Agent Payouts | Makes payouts real (Phase 3 anchor). |
| 10 | **Doorstep OTP handover** | Proof-of-delivery, benchmark standard. |

**Decisions I need from you before Phase 1:**
1. **COD** (B1): hide it at checkout for now (my rec), or build the rider cash path this rework?
2. **Doorstep OTP** (#10): in scope, or park it?
3. **Fake 5.00 rating**: hide until real, or keep displaying?
4. Confirm the BUILD/SIMPLIFY/SKIP calls in §B, then Phase 1 starts.
