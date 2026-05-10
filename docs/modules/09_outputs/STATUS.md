---
module_id: MODULE_OUTPUTS
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Outputs Library

## Status Tags (As-Is)

- `real`: `/presentations` route mounts `ReportsAndPresentationsHub`.
- `real`: sidebar mapping to `AppView.PRESENTATIONS` is active.
- `real`: report/presentation builder routes are mounted and operationally connected to outputs lane.
- `duplicate`: legacy `/reports` and `/reports/management` routes redirect to outputs library tabs.
- `partial`: route family mixes hub and specialized builder pages.
- `code_gap`: no dedicated automated tests for `ReportsAndPresentationsHub`.
- `doc_gap`: previous baseline did not include explicit redirect/alias facts.

## Function Coverage Status

- Required functions documented: `6/6`.
- Covered: `OUT_LIBRARY_HUB`, `OUT_REPORT_BUILDER`, `OUT_PRESENTATION_WIZARD`, `OUT_DECK_BUILDER`, `OUT_SHARED_PRESENTATION`, `OUT_LEGACY_REPORT_REDIRECT`.
