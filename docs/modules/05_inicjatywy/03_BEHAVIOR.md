---
module_id: MODULE_INITIATIVES
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Inicjatywy

## Runtime Behavior (As-Is)

- Core initiatives flow runs in `InitiativesHub` with view modes (kanban/list/timeline/grid), filter chips, and preview/document interactions.
- Hub uses explicit lifecycle transitions and status metadata from initiative lifecycle services.
- Planning and governance context is loaded from V8 planning API contracts for decision chains and initiative snapshots.
- Cross-module handoff to execution/results is route- and status-driven, not implicit in hidden background jobs.

## State Handling (As-Is)

- Runtime tracks active tab/view/filter/scope, selected initiative sets, deep-link opens, and open document state.
- Loading/refresh/error state is explicitly maintained in hub state (`isLoading`, `isRefreshing`, `loadError`).
- Bulk operations and create/edit actions are explicit UI pathways with user-triggered controls.

## Security / Tenant / Governance (As-Is)

- Write operations are routed through governance helpers (`initiativeWriteTruth`) and shared API context.
- Pilot/role restrictions are checked in runtime via guard utilities.
- No separate route bypass exists for initiative status changes; transitions happen via explicit in-module actions.
