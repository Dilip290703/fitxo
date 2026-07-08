# Test data seed

`seed-test-data.mjs` populates the shared Supabase DB with **login-able** dummy data:
**5 stores** (approved + verified, in Pune) × **10 products** each = **50 products**
(real colours, S/M/L or waist variants, live stock, primary + back image), plus
**4 verified riders** with payout details on file.

## Run

```bash
# from repo root — reads apps/admin/.env.local for the service-role key
node packages/supabase/seed/seed-test-data.mjs

# delete every @fitzo.test account + their stores/products
node packages/supabase/seed/seed-test-data.mjs --reset
```

Idempotent: re-running skips accounts that already exist and stores that already
have products. It prints a credentials table at the end.

## Accounts (all password `FitzoTest#2026`)

| Role  | Email                              | Detail |
|-------|------------------------------------|--------|
| store | `store.urban-threads@fitzo.test`   | Streetwear · 411001 |
| store | `store.bella-ethnic@fitzo.test`    | Ethnic Wear · 411004 |
| store | `store.peak-active@fitzo.test`     | Activewear · 411045 |
| store | `store.denim-depot@fitzo.test`     | Denim & Casuals · 411014 |
| store | `store.little-stars@fitzo.test`    | Kids · 411038 |
| rider | `rider.ravi@fitzo.test`            | bike |
| rider | `rider.sana@fitzo.test`            | scooter |
| rider | `rider.arjun@fitzo.test`           | bike |
| rider | `rider.neha@fitzo.test`            | cycle |

## Notes

- How it works: auth users are created via `auth.admin.createUser`, which fires the
  `handle_new_user` trigger (migration 015/029) to auto-provision `public.users` +
  a draft store (managers) or a `riders` row (riders). The script then approves +
  populates. That's why the accounts can actually log in.
- Products are **orderable via `/product/[id]`** and visible in the store/admin panels.
  They may **not** appear on the customer `/products` or `/search` lists yet — those
  still render static placeholder cards (tracked in the customer-panel rework).
- Riders start **offline** (`is_available=false`) — toggle them online in the agent app
  to receive offers. Having 4 verified riders lets you test the "first rider wins" claim
  race and the 1-concurrent-job cap.
