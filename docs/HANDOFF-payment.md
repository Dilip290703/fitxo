# Handoff — Razorpay "Keep" Payment (#13)

Built 2026-06-19 by Jay, on branch `feat/customer-payment`.
This explains what changed and exactly what a teammate (Dilip) needs to do to run it.
We share the **same git repo** and the **same Supabase project**, so most of the DB
work is already live for everyone — see "What you do NOT need to redo" below.

---

## What this feature does

In the try-at-home loop, after delivery the customer opens the **order-tracking page**
and decides per item. Tapping **Keep** now opens **Razorpay Checkout** and charges for
that single item. Only after the payment is verified does the item flip to "Keeping" and
the order's `payment_status` become `paid`. **Return** is unchanged (no payment).

> Note: payment is **per item** (one Checkout per kept item), by product decision.

## The flow (how it works)

1. **`createKeepPayment(orderItemId, orderId)`** (server action, `app/order-tracking/[orderId]/actions.ts`)
   - re-computes the amount **server-side from the DB** (never trusts the client),
   - creates a Razorpay order via the SDK (`lib/razorpay.ts`),
   - inserts a `payments` row (`status='initiated'`, `razorpay_order_id`, `order_item_id`).
2. **Client** (`OrderTrackingView.tsx`) loads Razorpay Checkout and opens the modal.
3. On success → **`confirmKeepPayment(...)`** verifies the HMAC signature in Node, then calls
4. **RPC `confirm_keep_payment`** (migration 009) — re-verifies the HMAC **inside Postgres**
   and is the *only* thing that writes `success`/`paid`. This is required because the
   customer app has only the anon key (no service-role), and RLS forbids customers updating
   `payments`. The RPC can't be forged because a valid signature needs the secret.

## Files changed

| File | What |
|---|---|
| `apps/customer/lib/razorpay.ts` | **new** — server-only Razorpay client + signature verify |
| `apps/customer/app/order-tracking/[orderId]/actions.ts` | `createKeepPayment` + `confirmKeepPayment` (replaced the free `keepItem`) |
| `apps/customer/app/order-tracking/[orderId]/OrderTrackingView.tsx` | Keep button → Razorpay Checkout modal |
| `apps/customer/components/cart/LoginRequiredModal.tsx` | **new** — login-required modal at checkout |
| `apps/customer/components/cart/CelebrationOverlay.tsx` | **new** — confetti on successful order |
| `apps/customer/components/cart/CheckoutPageView.tsx` | wires the modal + celebration; auth-gates Place Order |
| `apps/customer/components/Navbar.tsx` | reads the **real Supabase session** (was a mock localStorage flag) |
| `apps/customer/app/checkout/actions.ts` | resilient variant resolver (no more "Colour not found") |
| `packages/supabase/migrations/009_keep_payment.sql` | **new** — `payments.order_item_id` + `confirm_keep_payment` RPC |
| `packages/supabase/migrations/010_restore_try_loop_policies.sql` | **new** — restores RLS policies that were missing in the live DB |

---

## ✅ What you do NOT need to redo (shared Supabase project)

Because we use the **same Supabase database**, these are already applied for everyone:

- migration **009** (the `confirm_keep_payment` RPC + `payments.order_item_id`)
- migration **010** (restored RLS policies on `try_sessions`/`returns`/`payments`/`payouts`)
- migration **005** (RLS re-enabled)
- the Razorpay secret in **Supabase Vault** (`razorpay_key_secret`)

Don't re-run these unless we move to a different/new Supabase project.

## 🛠️ What you DO need to do locally

1. **Pull the branch**
   ```bash
   git fetch && git checkout feat/customer-payment
   ```
2. **Install deps** (a new `razorpay` package was added)
   ```bash
   pnpm install
   ```
3. **Add the Razorpay keys to your own `apps/customer/.env.local`** — `.env.local` is
   **gitignored**, so it does NOT come through git. Add these two lines (get the actual
   TEST values from Jay / the Razorpay dashboard → Test Mode → API Keys):
   ```
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxx
   ```
   (Your existing Supabase keys stay as they are.)
4. **Run it**
   ```bash
   pnpm dev:customer        # http://localhost:3000
   ```
   ⚠️ Next.js only reads `.env.local` **at startup** — if you add the keys while it's
   running, **restart** the dev server.

## How to test the payment

The rider app that moves an order into the try-window doesn't exist yet, so push an order
there manually (Supabase SQL editor), after placing an order while logged in:
```sql
UPDATE orders SET status='try_window_active'
 WHERE id=(SELECT id FROM orders ORDER BY created_at DESC LIMIT 1);
UPDATE try_sessions SET status='active', started_at=now(), deadline_at=now()+interval '24 hours'
 WHERE order_id=(SELECT id FROM orders ORDER BY created_at DESC LIMIT 1);
```
Then: order-tracking page → **Keep** → in the Razorpay modal pick **UPI** → `success@razorpay`.
(International test cards like `4111…` are off on this account — use UPI, or the domestic
test card `5267 3181 8797 5449`.)

## Gotchas we hit (so you don't)

- Site runs on **:3000**, not :3002.
- Use **UPI `success@razorpay`** in test mode (international cards disabled).
- Razorpay `receipt` must be ≤ 40 chars (we use `k_<uuid>`).
- If checkout fails with an RLS error, a migration policy is missing — see migration 010.

## Still TODO (not done yet)

- **Model change:** try window is moving from 24h at-home → **~5–7 min on-the-spot while
  the rider waits**. Timer constant + customer copy + `CLAUDE.md` premise to update.
- Razorpay **payout** to stores/agents.
- A **`payment.captured` webhook** (today success is confirmed only client-side; if the
  customer closes the tab right after paying, the order won't be marked paid).
- Return Pickup (#14), Checkout Time Slot (#8).
- **Regenerate the test secret before going live** (it was shared in chat).
