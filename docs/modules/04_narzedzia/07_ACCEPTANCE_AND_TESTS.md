---
module_id: MODULE_TOOLS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Narzędzia / Tools

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Tools -> `/discovery-tools` | `menuConfig.ts` + `AppRoutes.tsx` (`DiscoveryToolsHub`) | pass |
| Assessment entry via sidebar sub-item | `AppView.ASSESSMENT_OVERVIEW` + `/assessment/*` routes | pass |
| Legacy `/licensed-tools/*` alias | explicit redirect component in routes | pass (`duplicate` alias path) |
| Megatrends canonical path | `/discovery-tools/strategic/megatrends` -> `MegatrendsWorkspace` | pass |
| Module-local frontend tests for tools/assessment hubs | not found in component folders | gap (`code_gap`) |

## Confirmed Automated Evidence (As-Is)

- No dedicated automated test file found for `DiscoveryToolsHub` or `AssessmentHub`.

## Known Gaps / Blockers

- `code_gap`: missing hub-level regression tests for routing + tab/filter behavior.
- `doc_gap`: no in-file screenshots/recordings linked yet for tools and assessment runtime states.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
