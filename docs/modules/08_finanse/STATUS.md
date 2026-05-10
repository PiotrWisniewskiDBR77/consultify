---
module_id: MODULE_FINANCE
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Finanse / Finance & Intelligence

## Status Tags (As-Is)

- `real`: `/economics` and `/finance` routes are active and map to `EconomicsView`.
- `real`: sidebar mapping to `AppView.ECONOMICS` is active.
- `partial`: finance runtime includes V8 mode with legacy fallback toggles.
- `real`: finance detail routes (`/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`) are wired.
- `code_gap`: no dedicated automated tests for `FinanceHub`/`EconomicsView`.
- `doc_gap`: prior baseline did not include alias/detail route evidence.
