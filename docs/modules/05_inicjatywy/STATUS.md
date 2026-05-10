---
module_id: MODULE_INITIATIVES
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Status — Inicjatywy

## Status Tags (As-Is)

- `real`: `/initiatives` route mounts `InitiativesHub`.
- `real`: related route family (`/roadmap`, `/portfolio`, `/roi`) is active in `AppRoutes.tsx`.
- `partial`: sidebar maps initiatives entry to `AppView.PORTFOLIO_ROADMAP`, while lane route entry is `/initiatives` (explicit mapping present).
- `real`: lifecycle/governance helpers are wired (`initiativeLifecycle`, `initiativeWriteTruth`, `v8/planning`).
- `code_gap`: no dedicated automated tests in `src/components/Initiatives`.
- `doc_gap`: prior baseline did not specify route family and governance service files.

## Function Coverage Status

- Required functions documented: `5/5`.
- Covered: `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`.
