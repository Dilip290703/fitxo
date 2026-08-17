---
description: Audit the codebase against the Fitxo workflow spec and report what's done vs pending
---

You are auditing the Fitxo codebase against the product spec. Do a thorough, honest pass —
do not assume a screen is done just because a file exists; verify it actually implements the
behaviour.

Steps:

1. Read `docs/PROGRESS.md` and `CLAUDE.md` for current claimed status and project context.

2. Walk the actual repo. For each of the 4 panels (Customer 25, Agent 12, Store 14, Admin 21),
   inventory which screens have real implementations. For each screen check:
   - Does the route/page component exist and render?
   - Are the key touch/actions from the spec wired up (not just placeholders)?
   - Is it connected to Supabase where it needs data, or still mocked?
   - Does it have any tests?

3. Cross-check the critical flows specifically, since these are the product:
   - Order → Checkout (address + delivery-slot booking) → Confirmation → Tracking
   - Rider delivers at slot → 15–30 min try window (rider waits) → Keep/Return on the spot → Payment (Razorpay) for kept items
   - Store: Add/Edit Product → appears in Customer catalog
   - Payouts: Razorpay Payouts to stores + agents
   - AI skin-tone endpoint exists and Product Detail consumes it
   - RLS exists on every user-data table

4. Produce a report with these sections:
   - **Summary**: X of 72 screens actually built (be strict), grouped by panel.
   - **Discrepancies**: screens PROGRESS.md marks done that aren't really done, and vice versa.
   - **Foundation gaps**: missing schema tables, missing RLS, missing integrations.
   - **Critical-path blockers**: anything stopping the order→try→keep/return loop from working end to end.
   - **Recommended next 5 tasks**, ordered by what unblocks the most.

5. Update `docs/PROGRESS.md` checkboxes to match what you actually found (mark the date),
   and append any new issues to its "Known issues / TODO" section. Do not invent progress.

Be concise and specific. Reference file paths. Flag anything risky (hardcoded keys,
missing RLS, hand-rolled payment logic).
