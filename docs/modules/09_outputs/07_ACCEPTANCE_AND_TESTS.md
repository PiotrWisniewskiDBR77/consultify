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

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `OUT_LIBRARY_HUB` | Outputs library shell is mounted | `ReportsAndPresentationsHub` route mount | pass |
| `OUT_REPORT_BUILDER` | Report builder routes are mounted | `AppRoutes.tsx` + `ReportBuilderView` | pass |
| `OUT_PRESENTATION_WIZARD` | Presentation wizard route is mounted | `AppRoutes.tsx` + `PresentationWizard` | pass |
| `OUT_DECK_BUILDER` | Deck builder route is mounted | `AppRoutes.tsx` + `DeckBuilder` | pass |
| `OUT_SHARED_PRESENTATION` | Shared/embed routes are mounted | `AppRoutes.tsx` + `SharedPresentationView` | pass |
| `OUT_LEGACY_REPORT_REDIRECT` | Legacy reports redirect to outputs tabs | redirect entries in `AppRoutes.tsx` | pass (`partial`) |

## Confirmed Automated Evidence (As-Is)

- No dedicated automated test file found for `ReportsAndPresentationsHub` in module folder scan.

## Known Gaps / Blockers

- `code_gap`: no direct regression tests for outputs tab switching, filtering, and redirect coherence.
- `doc_gap`: no linked UI evidence captures in this file.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
