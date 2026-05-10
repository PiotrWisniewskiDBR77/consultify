---
module_id: MODULE_INITIATIVES
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Inicjatywy

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Initiatives -> route family | `menuConfig.ts` + routes `/initiatives`, `/roadmap`, `/portfolio`, `/roi` | pass |
| Core module workspace | `/initiatives` -> `InitiativesHub` | pass |
| Governance lifecycle integration | `initiativeLifecycle` + `initiativeWriteTruth` usage in hub | pass |
| V8 planning evidence path | `v8/planning.ts` imported and consumed | pass |
| Module-local frontend tests in initiatives folder | not found | gap (`code_gap`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Portfolio runtime and view modes are operational | `InitiativesHub.tsx` | pass |
| `IN_ANALYSIS_WORKSPACE` | Analysis subviews are present and actionable | `InitiativesHub.tsx` analysis tab/subviews | pass |
| `IN_ROADMAP_VIEW` | Roadmap route is mounted | `AppRoutes.tsx`, `FullRoadmapView.tsx` | pass |
| `IN_PORTFOLIO_VIEW` | Portfolio route is mounted | `AppRoutes.tsx`, `PortfolioView.tsx` | pass |
| `IN_ROI_VIEW` | ROI route is mounted | `AppRoutes.tsx`, `FullROIView.tsx` | pass |

## Confirmed Automated Evidence (As-Is)

- No dedicated `src/components/Initiatives/*test*` file found in current tree scan.

## Known Gaps / Blockers

- `code_gap`: missing automated regression tests for initiative lifecycle UI transitions.
- `doc_gap`: no embedded UI evidence links (recording/screenshot) in this module file yet.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
