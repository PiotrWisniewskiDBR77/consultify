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

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `NZ_DISCOVERY_LIBRARY` | tool/framework library browse and selection behavior | `DiscoveryToolsHub.tsx` library tab | pass |
| `NZ_DISCOVERY_SESSIONS` | combined discovery+assessment sessions lane | `DiscoveryToolsHub.tsx` sessions tab/runtime loaders | pass |
| `NZ_DISCOVERY_OUTPUTS` | merged outputs lane and owner-route handoffs | `DiscoveryToolsHub.tsx` outputs tab | pass |
| `NZ_DISCOVERY_INITIATIVES` | initiatives sourced from tools/assessment with traceability | `DiscoveryToolsHub.tsx`, initiative lifecycle helpers | pass |
| `NZ_ASSESSMENT_HUB` | assessment/report/initiative tabbed runtime under `/assessment/*` | `AssessmentHub.tsx`, `AppRoutes.tsx` | pass |
| `NZ_MEGATRENDS_WORKSPACE` | canonical megatrends strategic workspace route | `AppRoutes.tsx`, `MegatrendsWorkspace.tsx` | pass |

## Confirmed Automated Evidence (As-Is)

- No dedicated automated test file found for `DiscoveryToolsHub` or `AssessmentHub`.

## Known Gaps / Blockers

- `code_gap`: missing hub-level regression tests for routing + tab/filter behavior.
- `doc_gap`: no in-file screenshots/recordings linked yet for tools and assessment runtime states.
- `code_gap`: no consolidated end-to-end suite that validates all six documented Tools functions.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
