---
description: Start a new screen/task with full context loaded and a plan before coding
---

I want to build the screen I name (I'll tell you which one). Before writing any code:

1. Read `CLAUDE.md`, `docs/PROGRESS.md`, and `docs/WORKFLOW.md`.
2. Find this screen's spec in the Fitxo workflow PDF / the screen list and restate:
   - what it leads to, every touch/action and what each should do,
   - which Supabase tables/queries it needs,
   - any integration it touches (Razorpay, AI endpoint, maps, OTP).
3. Confirm no one else has claimed this screen in PROGRESS.md. Mark it `[~]` with my initials and note that I should push that claim first.
4. Give me a short build plan (components, hooks, data, edge cases) and wait for my OK before implementing.

Then build it screen-first: structure → wire actions → connect data → handle empty/error/loading states.
