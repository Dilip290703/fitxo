# Real payout disbursement — investigation & go-live requirements

*Track A Task 5, investigated 2026-07-10. Verdict first, evidence below.*

## Verdict: don't build disbursement yet — it's blocked on business steps, not code

Fitxo cannot move real (or even honestly-simulated) payout money today, for three
independent reasons:

1. **RazorpayX needs an account we don't have.** Payouts run on RazorpayX, a
   separate product from the Payment Gateway with its own signup, its own KYC,
   and its own API keys generated from the **RazorpayX dashboard** (not the PG
   dashboard our test keys come from). Signup requires a **registered business
   entity** (Business PAN/GSTIN) and a 2–3 business-day review. RazorpayX Lite
   (the lighter wallet variant) is **closed to new merchants**; new accounts go
   the Current Account route (Axis Bank partner currently).
2. **Even sandbox integration is gated on that account.** RazorpayX has a proper
   test mode (dummy balance, contacts/fund accounts, bank+UPI payouts, webhooks
   `payout.processed`/`payout.reversed` etc.) — but the test keys are generated
   *inside* an existing RazorpayX account's dashboard. Code written today could
   not be run against anything. Per the track rule — don't fake it — nothing was
   built.
3. **Route (split settlement) is regulatorily unavailable to Fitxo.** The RBI's
   September 2025 Payment Aggregator guidelines gate Razorpay Route behind
   **domestic turnover > ₹40 lakh** (FY25/FY26), no category exemptions;
   non-compliant merchants were cut off 2026-01-01. Fitxo is pre-launch, so the
   elegant "split each Keep payment to the store's linked account minus
   commission" architecture is off the table until that scale.

**What exists instead (and was hardened in this task):** the manual ledger flow.
Money moves by hand (bank/UPI transfer by Dilip/Amit); Admin > Store Payouts and
Admin > Agent Payouts record it. Migration **042** adds a payment **reference
(UTR / UPI txn id)** and a **destination snapshot** to both ledgers so every
manual transfer is traceable and the ledger keeps saying where the money went
even after a rider/store edits their payout details.

## What going live requires (in order)

| # | Step | Owner | Notes |
|---|------|-------|-------|
| 1 | Register the business entity (Business PAN, ideally GSTIN) | Dilip + Amit | Prerequisite for everything below |
| 2 | Complete Payment Gateway **live** KYC + swap live keys, verified website, live webhook + Vault secret rotation | Dilip | Independent of payouts; already on the known-issues list |
| 3 | Sign up for **RazorpayX** (x.razorpay.com), pass the 2–3 day review | Dilip | Needs #1's documents |
| 4 | Complete RazorpayX KYC (separate from PG KYC) and fund the account | Dilip | Current Account (Axis) or whatever variant Razorpay offers at signup |
| 5 | Generate RazorpayX **test-mode** keys → build + test the integration (below) | dev (Claude/D) | This is the point where coding starts |
| 6 | Live keys, small real payout to a team member's account, then enable for stores/riders | Dilip + dev | |
| 7 | Revisit **Route** when domestic turnover crosses ₹40L | later | Would replace store payouts entirely (auto-split at capture; no payout liability) |

## Integration sketch (for step 5, ~1–2 days once keys exist)

The schema is already payout-ready — no migration needed beyond what exists:

- **Riders**: `rider_payout_details` (034) has `payout_method` ('upi'/'bank'),
  `upi_id`, `bank_account_number` + `bank_ifsc` + `bank_account_name`, PAN —
  exactly the fields RazorpayX fund accounts need.
  Flow per rider: create **Contact** (`type: employee`-ish, our rider id in
  `reference_id`) → create **Fund Account** (`vpa` from `upi_id`, or
  `bank_account` from the bank fields) → store the `fa_…` id on
  `rider_payout_details` (one new column then: `razorpay_fund_account_id`).
- **Stores**: same shape from `store_business_details` (029).
- **Payout call**: `POST /v1/payouts` with the X account number, fund account
  id, amount in paise, `mode: UPI|IMPS|NEFT`, `queue_if_low_balance: true`, and
  our ledger row id as `reference_id` (idempotency: X also supports an
  `X-Payout-Idempotency` header — use the ledger row's UUID).
- **Where it plugs in**: `recordStorePayout` / `recordAgentPayout`
  (`apps/admin/app/admin/{payouts,agent-payouts}/actions.ts`) — both already
  say "swap in the Razorpay payout call here". Insert ledger rows as
  `status: 'processing'` (enum value exists since 002), then a **payout
  webhook** route in the admin app (mirror the 039 pattern: raw-body HMAC,
  in-DB verification is unnecessary here since admin holds the service key —
  but `requireAdmin` doesn't apply to webhooks, so verify the X webhook
  signature with its own secret) flips rows `processing → paid` on
  `payout.processed` / back to outstanding on `payout.reversed`/`payout.failed`.
- **Test-mode caveat**: X test mode can't simulate the approval workflow
  (`pending`/`rejected` states) — cover those states in code review, not tests.

## Known limits of the manual flow (accepted until X exists)

- "Record payout" is bookkeeping; nothing enforces that the bank transfer
  actually happened. The reference field (042) is the audit hook — enter the
  UTR after making the transfer.
- Riders/stores with no payout details can still be marked paid (the modal
  warns loudly). Kept deliberately: cash-in-hand settlements happen at this
  scale.

## Sources

- [RazorpayX Test Mode](https://razorpay.com/docs/x/dashboard/test-mode/) — sandbox scope, dummy balance, no approval workflow
- [RazorpayX API Keys](https://razorpay.com/docs/x/dashboard/api-keys/) — keys from the X dashboard; test keys skip OTP
- [RazorpayX Account Types](https://razorpay.com/docs/x/account-types/) / [Lite](https://razorpay.com/docs/x/account-types/razorpayx-lite/) — Lite closed to new merchants; Current Account (Axis)
- [RazorpayX signup support](https://razorpayx.freshdesk.com/support/signup) — registered entity, Business PAN/GSTIN, 2–3 day review
- [Route FAQs](https://razorpay.com/docs/payments/route/faqs/) / [Route docs](https://razorpay.com/docs/payments/route/) — RBI Sept-2025 PA guidelines: >₹40L turnover, payer-payee transparency, no exemptions, cut-off 2026-01-01
