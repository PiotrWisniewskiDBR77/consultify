---
doc_id: QUALITY_GATE_RERUN_CHAT_MYWORK_2026_05_10
doc_kind: QUALITY_GATE
owner: user
status: active
last_updated: 2026-05-10
---

# Quality Gate Rerun — `01_czat` and `02_moja-praca`

## Purpose

Rerun quality gate for two modules after function-level contract expansion:

- `01_czat`
- `02_moja-praca`

Scope includes module-level contract files and function-level contracts under `functions/`.

## Gate 1 — Structural Completeness

Checks:

- module files present (`SSOT`, `CODEMAP`, `STATUS`, `00-07`, `RAW_INPUT`, `CHANGELOG`),
- `04_UI_UX.md` includes required contract sections,
- function contracts exist in `functions/`.

### Result

- `01_czat`: PASS (`2/2` target functions documented)
- `02_moja-praca`: PASS (`12/12` target functions documented)

Gate 1 result: **PASS**

## Gate 2 — Content Specificity

Checks:

- function-level purpose/input/output/handoff/boundary/security/acceptance are explicit,
- UI Component Footprint is concrete per function,
- doc/code gaps are explicit (no hidden assumptions).

### Result

- `01_czat`: PASS (chat and canvas/workspace split documented with explicit partial status for canvas exposure)
- `02_moja-praca`: PASS (core functions + 4 Ideas subfunctions documented separately with concrete component maps)

Gate 2 result: **PASS**

## Gate 3 — Code Alignment

Cross-check basis:

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/IdeaWorkspaceToolbar.tsx`

### Confirmed alignment

- Chat routes:
  - `/chat` -> `AIChatWelcomeView`
  - `/chat/:conversationId` -> `UnifiedChatPanel`
  - `/internal/v10-runtime` -> `V10RuntimeWorkspaceView`
- My Work route:
  - `/my-work/*` -> `MyWorkView` -> `MyWorkHub`
- My Work tab set in runtime:
  - `home`, `ideas`, `notebook`, `inbox`, `calendar`, `tasks`, `decisions`, `manager`
- Ideas subtools in runtime switcher:
  - `mindmap`, `whiteboard`, `process_flow`, `table`

### Known alignment caveats (explicit)

- `CZ_CANVAS_WORKSPACE` remains `partial` because internal/runtime bridge exists, while some lane routes are still exposed as coming-soon.
- Automated acceptance depth is still uneven; function contracts are complete, but full e2e suites are not complete.

Gate 3 result: **PASS with explicit known caveats**

## Function Coverage Gate (Module + Function Layer)

| Module | Required functions | Documented | Result |
| --- | ---: | ---: | --- |
| `01_czat` | 2 | 2 | PASS |
| `02_moja-praca` | 12 | 12 | PASS |

Function gate result: **PASS**

## Final Decision (Scoped Rerun)

- Gate 1: PASS
- Gate 2: PASS
- Gate 3: PASS (with explicit caveats)
- Function coverage: PASS

Scoped rerun decision for `01_czat` and `02_moja-praca`: **GO (PASS_WITH_P2)**.

## Remaining P2 Follow-ups

1. Add route-level e2e acceptance for `/chat` and `/chat/:conversationId` continuity.
2. Add module-level regression suite for My Work full tab/function journeys.
3. Add deeper acceptance coverage for chat-canvas bridge and lane handoff boundaries.

## P2 Execution Addendum (Added)

### P2-A — Chat Route Continuity Pack

- Scope:
  - `/chat` boot path,
  - transition to `/chat/:conversationId`,
  - `ConversationRouteSync` continuity and fallback handling.
- Minimum evidence:
  - one e2e scenario for create/open/continue conversation,
  - one failure/degraded scenario with explicit user guidance assertion.
- Exit criterion:
  - route continuity can be validated without manual UI inspection.

### P2-B — My Work Function Regression Pack

- Scope:
  - all documented My Work function entries (`MW_*`) including Ideas subfunctions.
- Minimum evidence:
  - tab switch and command-row interaction coverage,
  - at least one smoke path per Ideas subtool (`mindmap`, `table`, `process_flow`, `whiteboard`),
  - role-gate assertion for `MW_MANAGER`.
- Exit criterion:
  - function matrix can be revalidated by automated runs for core journeys.

### P2-C — Chat -> Canvas Bridge Acceptance

- Scope:
  - governed artifact run controls,
  - internal runtime bridge state,
  - lane handoff semantics (`partial` clarity preserved until full exposure).
- Minimum evidence:
  - one acceptance path for plan -> review -> materialize flow assertions,
  - one assertion that blocked/coming-soon lanes are represented honestly (no shipped claim).
- Exit criterion:
  - `CZ_CANVAS_WORKSPACE` status can be upgraded from `partial` only with route/runtime evidence.

## P2 Tracking Status

| P2 item | Priority | Current status | Target gate effect |
| --- | --- | --- | --- |
| `P2-A Chat Route Continuity Pack` | P2 | planned | strengthen Gate 3 and function acceptance confidence |
| `P2-B My Work Function Regression Pack` | P2 | planned | reduce `code_gap` for module 2 function journeys |
| `P2-C Chat -> Canvas Bridge Acceptance` | P2 | planned | de-risk `CZ_CANVAS_WORKSPACE` partial caveat |
