---
module_id: MODULE_MY_WORK
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Moja Praca / My Work

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar My Work -> `/my-work/*` | `menuConfig.ts` + `AppRoutes.tsx` -> `MyWorkView` | pass |
| Route shell | `MyWorkView.tsx` mounts `MyWorkHub` in `SplitLayout` | pass |
| Main personal orchestration workspace | `MyWorkHub.tsx` tab runtime + open-document state | pass |
| Module-level automated tests | only table-platform test under MyWork path | partial |
| End-to-end My Work hub regression tests | no dedicated suite found | gap (`code_gap`) |

## Confirmed Automated Evidence (As-Is)

- `src/components/MyWork/table/__tests__/TablePlatformFrontend.test.tsx`

## Known Gaps / Blockers

- `code_gap`: no dedicated integration tests for My Work tab switching and command-row actions.
- `doc_gap`: no module-local UI recording links currently embedded in this file.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
