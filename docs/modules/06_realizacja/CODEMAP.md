---
module_id: MODULE_EXECUTION
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Realizacja / Implementation & PMO

## Route / AppView / Sidebar (As-Is)

- Sidebar entry `MODULE_EXECUTION` maps to `AppView.IMPLEMENTATION` in `menuConfig.ts`.
- Canonical and related routes in `routeConfig.ts`: `/execution`, `/implementation`, `/rollout`.
- Route render map in `AppRoutes.tsx`:
  - `/execution` -> `FullExecutionView`
  - `/implementation` -> `ExecutionHub`
  - `/rollout` -> `FullRolloutView`

## Main Component Paths (As-Is)

- `src/components/Execution/ExecutionHub.tsx` — unified execution center runtime.
- `src/views/FullExecutionView.tsx`, `src/views/ImplementationView.tsx`, `src/views/FullRolloutView.tsx` — route surfaces in the same lane.

## API / Services / Models (Confirmable)

- Shared API usage: `src/services/api.ts`.
- Execution V8 contracts: `src/services/api/v8/execution-control.ts`.
- Lifecycle and write-governance helpers: `src/services/initiativeLifecycle.ts`, `src/services/executionWriteTruth.ts`.
- Initiative/task types consumed in execution runtime: `src/types/index.ts`, `src/types/initiative.ts`.

## Test / Evidence References (Confirmable)

- No dedicated `src/components/Execution/*test*` files found.

## Known Gaps (As-Is)

- Route family is active, but module-local frontend test coverage for `ExecutionHub` interactions is missing (`code_gap`).
- Sidebar AppView points to implementation route identity while full lane includes `/execution` and `/rollout` (`partial`, explicit mapping).
