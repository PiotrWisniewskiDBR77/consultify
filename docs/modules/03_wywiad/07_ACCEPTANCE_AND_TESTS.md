---
module_id: MODULE_INTERVIEW
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Wywiad / Interview

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Interview -> `/discovery` | `menuConfig.ts` + `AppRoutes.tsx` | pass |
| `/interview` direct entry | `AppRoutes.tsx` mounts same `InterviewHub` | pass |
| `/project-intelligence` alias | route points to `InterviewHub` | pass (`duplicate` alias path) |
| Interview API contract coverage | `src/services/api/v8/interview.ts` typed entities | pass |
| Frontend module-level tests for InterviewHub | no `src/components/Interview/*test*` files found | gap (`code_gap`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `WY_MY_ASSIGNMENTS` | personal assignment queue and deep-link open | `InterviewHub.tsx`, interview API assignment calls | pass |
| `WY_MANAGED_ASSIGNMENTS` | managed workload review and overdue handling | `InterviewHub.tsx`, managed/overdue assignment loaders | pass |
| `WY_SESSIONS` | session create/open/complete and status filtering | `InterviewHub.tsx`, session API calls | pass |
| `WY_TEMPLATES` | template browse and question preview loading | `InterviewHub.tsx`, template question endpoint usage | pass |
| `WY_INSIGHTS` | insight list/report modes and deep-link open | `InterviewHub.tsx`, insight loading path | pass |
| `WY_PENDING_REVIEW` | review queue visibility and explicit review actions | `InterviewHub.tsx` pending review tab logic | pass (permission-dependent) |

## Confirmed Automated Evidence (As-Is)

- No dedicated module-local test file found for interview hub UI.

## Known Gaps / Blockers

- `code_gap`: lack of InterviewHub automated tests for assignment/review/preview transitions.
- `doc_gap`: no embedded UI evidence links for this module in current file.
- `code_gap`: no dedicated end-to-end regression covering all six Interview functions in one suite.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
