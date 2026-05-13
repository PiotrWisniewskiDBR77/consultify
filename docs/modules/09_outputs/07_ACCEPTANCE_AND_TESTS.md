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
| Outputs appview ownership signal | Stage 1.5 docs split canonical shell `AppView.PRESENTATIONS` -> `/presentations` from builder entry `AppView.FULL_STEP6_REPORTS` -> `/reports/builder` | docs updated; runtime/product semantics watch |
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

## Board -> Cards -> Functions Coherence (Deep RAW Audit)

| Coherence check | Evidence | Result |
| --- | --- | --- |
| Every `OUT_*` function has one execution card | `function-cards/*_EXECUTION_CARD.md` | `PASS` |
| Every card function appears in board rows | `IMPLEMENTATION_TASK_BOARD.md` task index | `PASS` |
| Every cross-module claim maps to evidence or `NOT_DONE` | packet + cards RAW chains | `PASS_WITH_P1` |
| Builder entry semantics explicitly represented in backlog | packet gap `OUT-INT-P1-004` and `OUT-HUB-P1-002` | `PASS_DOCS_UPDATED` |

## Confirmed Automated Evidence (As-Is)

- No dedicated automated test file found for `ReportsAndPresentationsHub` in module folder scan.

## Known Gaps / Blockers

- `code_gap`: no direct regression tests for outputs tab switching, filtering, and redirect coherence.
- `builder_entry_watch`: direct builder entry (`FULL_STEP6_REPORTS` -> `/reports/builder`) still needs owner/runtime evidence to confirm it does not create a second canonical shell.
- `dormant_runtime_gap`: lane runtime views (`WordyView`, `ExceleView`, `PrezentacjeView`) are import-visible but not mounted on `/wordy`, `/excele`, `/prezentacje`; docs truth depends on explicit placeholder framing.
- `doc_gap`: no linked UI evidence captures in this file.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
