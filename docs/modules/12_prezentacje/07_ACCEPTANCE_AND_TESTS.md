---
module_id: MODULE_PRESENTATIONS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Prezentacje / Generator Lane

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.

## Required Checks

- [ ] Route opens documented runtime (`workspace` or `placeholder`) exactly as specified.
- [ ] AppView enum and route mapping are consistent in `src/types/core.ts` and `routeConfig.ts`.
- [ ] No contradiction with global ownership decisions in module docs and global docs.
- [ ] If module is placeholder, UI communicates not-ready state explicitly.

## Current Gate Expectation

- Expected gate result today: `NEEDS_OWNER_DECISION for docs clarity; BLOCKED_P1 for standalone lane runtime.`
- This is As-Is readiness, not target-state implementation readiness.
- Hard-rule closure note: Teresa deck-work execution doctrine is tracked as `EXPLICIT_OWNER_DECISION_REQUIRED` (impact source: `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`).

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `PR_GEN_PLACEHOLDER` | `/prezentacje` mounts honest placeholder runtime and explicit ownership handoff posture | `AppRoutes.tsx` -> `V4ComingSoonView`; `V4ComingSoonView.tsx` copy model | `pass_with_p0_gap` (handoff copy not explicit) |
| `PR_GEN_RUNTIME_TARGET` | Target generator runtime remains documented as not mounted | `PrezentacjeView` imported, not route-mounted | pass (`partial`) |
| `PR_OUTPUTS_OWNERSHIP_BOUNDARY` | Ownership split (`/prezentacje` vs `/presentations`) is explicit | codemap + route ownership evidence | pass |

## Owner Decision Register (Hard Rules)

| Decision ID | Rule | Status | Closure options |
| --- | --- | --- | --- |
| `OWNER-TERESA-12-001` | Teresa deck-work execution doctrine for module 12 | `PENDING_OWNER_DECISION` | `OPTION_A_CLOSE_IMPACT_ONLY` or `OPTION_B_BIND_MANDATORY_FOR_TARGET_RUNTIME` |

## Stage 1.5 Ultra-Deep Acceptance Matrix (2026-05-11)

Source: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`.

| Acceptance area | Required result | Evidence | Current gate |
| --- | --- | --- | --- |
| Runtime ownership map | `/prezentacje` belongs to lane 12; `/presentations` belongs to lane 09 active Outputs runtime | `routeConfig.ts`, `AppRoutes.tsx`, `menuConfig.ts` | `PASS` |
| `/prezentacje` placeholder honesty | placeholder is allowed only if it avoids fake runtime claims and points to active ownership path | docs updated; runtime copy handoff remains `NOT_DONE` | `PASS_WITH_P0_GAP` |
| Active `/presentations` runtime classification | hub/wizard/builder remain 09 runtime and cannot be claimed as shipped lane-12 runtime | `ReportsAndPresentationsHub`, `PresentationWizard`, `DeckBuilder` | `PASS` |
| Menu 3/right-side only | contextual AI actions must be in Menu 3/right-side slot; no duplicate canvas toolbar | global rule + module docs; builder-specific proof future | `PASS_WITH_P1_GAP` |
| High-impact export/share/publish | must require review/approval/audit posture before final delivery claims | product RAW + builder export/share evidence; full gate future | `PASS_WITH_P0_GAP` |
| Teresa deck-work execution | must be closed or explicit owner decision | `OWNER-TERESA-12-001` | `NEEDS_OWNER_DECISION` |
| Visual/MELS evidence | must be sourced or marked `NOT_DONE` | source paths unavailable in this pass | `NOT_DONE` |

## Stage 1.5 Normalized Backlog

### P0

| Gap ID | Gap | Closure target | Status |
| --- | --- | --- | --- |
| `PR-S15-P0-001` | `/prezentacje` placeholder contract needs explicit active `/presentations` ownership handoff | docs synchronized; runtime copy remains future work | `READY_DOCS` |
| `PR-S15-P0-002` | export/share/publish claims need function-level approval/audit gate | functions/cards synchronized in this pass | `READY_DOCS` |

### P1

| Gap ID | Gap | Closure target | Status |
| --- | --- | --- | --- |
| `PR-S15-P1-001` | Teresa deck-work execution doctrine is not closed for module 12 | owner decision required | `NEEDS_OWNER_DECISION` |
| `PR-S15-P1-002` | Menu 3/right-side proof is incomplete at function/builder level | future verification checklist | `READY_DOCS` |
| `PR-S15-P1-003` | runtime state evidence needs per-function binding | function/card synchronization | `READY_DOCS` |

### P2

| Gap ID | Gap | Closure target | Status |
| --- | --- | --- | --- |
| `PR-S15-P2-001` | screenshot visual evidence unavailable | provide asset or approved replacement | `NOT_DONE` |
| `PR-S15-P2-002` | MELS source unavailable at expected path | restore source or owner-defer | `NOT_DONE` |

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `tests/unit/routes/routeConfig.test.ts`
- `tests/e2e/smoke/outputs-library-canonical-artifacts.spec.ts`
- `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`

## Stage 1.5 Final Gate

- docs-only synchronization: `PASS`
- runtime validation: `NOT_RUN` (out of scope)
- final result: `NEEDS_OWNER_DECISION`
