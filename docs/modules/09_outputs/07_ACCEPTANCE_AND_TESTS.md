---
module_id: MODULE_OUTPUTS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Outputs Library

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Outputs -> `/presentations` | `menuConfig.ts` + `AppRoutes.tsx` | pass |
| Legacy reports routes into outputs tabs | redirects from `/reports` + `/reports/management` | pass (`duplicate` bridge) |
| Report builder path | `/reports/builder` -> `ReportBuilderView` | pass |
| Presentation creation/edit paths | `/presentations/wizard`, `/presentations/builder/:deckId` | pass |
| Module-local outputs hub tests | not found | gap (`code_gap`) |

## Confirmed Automated Evidence (As-Is)

- No dedicated automated test file found for `ReportsAndPresentationsHub` in module folder scan.

## Known Gaps / Blockers

- `code_gap`: no direct regression tests for outputs tab switching, filtering, and redirect coherence.
- `doc_gap`: no linked UI evidence captures in this file.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
