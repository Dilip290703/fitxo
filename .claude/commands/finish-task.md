---
description: Finish the current task — verify, update PROGRESS.md, and commit
---

The current screen/task is complete. Do the following in order, stopping to report if any step fails:

1. Run typecheck and lint. Fix anything you introduced.
2. Run the tests relevant to what changed (prefer the single screen's tests, not the whole suite).
   If there are no tests for this screen, write a minimal smoke test that renders it and
   checks the main action works.
3. Update `docs/PROGRESS.md`:
   - Flip this screen's checkbox to `[x]` (or `[T]` if it has passing tests).
   - Set the "Last updated" line to today's date.
   - If you made any non-obvious decision, add one line to the Decisions log.
   - If you left anything incomplete, add it to Known issues / TODO.
4. Stage everything and create a conventional commit:
   `type(scope): short summary` (e.g. `feat(customer): try-window countdown on order tracking`).
5. Print the branch name and remind me to push + open a PR (do NOT push to main, do NOT merge).

Keep PROGRESS.md honest — only mark done what is actually working.
