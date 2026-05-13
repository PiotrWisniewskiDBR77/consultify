---
module_id: MODULE_EXECUTION
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Behavior — Realizacja / Implementation & PMO

## Runtime Behavior (As-Is)

- Execution lane uses three active routes: `/execution`, `/implementation`, `/rollout`.
- `ExecutionHub` implements the unified execution center (initiative/task views, RAID/decisions, management/reporting interactions).
- Runtime pulls execution risk/delay/budget/manager lane data through V8 execution-control contracts when available, with fallback handling.

## Function Runtime Breakdown

- `RL_EXECUTION_PORTFOLIO`: execution tasks/decisions/blockers operating lane in `ExecutionHub`.
- `RL_EXECUTION_REPORTS`: report generation and reporting review lane.
- `RL_EXECUTION_MANAGER`: manager-specific lane for signal triage and recommendation actions.
- `RL_FULL_EXECUTION_VIEW` and `RL_ROLLOUT_VIEW`: route companion functions for lane-specific execution surfaces.

## State Handling (As-Is)

- Hub maintains explicit state for view modes, filters, drag-and-drop kanban context, timeline signals, and report generation.
- Loading and error handling are explicit with toasts and guarded fallback logic.
- Route-level wrappers apply production gating and protected access for this lane.

## Security / Tenant / Governance (As-Is)

- High-impact updates (status/timeline/budget/mitigation) are routed through service methods and guarded API calls.
- No hidden route-level mutation exists; execution actions are user-triggered from visible controls.
- Role/pilot gating utilities are imported and used in execution runtime.

## Contract 2.0 Function Integration

| Function | Runtime behavior contract | Evidence binding | Gate |
| --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | Owns live Portfolio operation in `ExecutionHub` tab `list`; allowed views are table, kanban and timeline. | Route: `/implementation`; component: `ExecutionHub`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView`; API: shared `Api` and V8 execution-control where used; tests: V8 client/backend and write-truth helper tests. | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` for UI placement/state evidence. |
| `RL_EXECUTION_REPORTS` | Owns fixed execution report catalog, generation/review posture and report provenance; source-less report output is not clean success. | Route: `/implementation`; component: `ExecutionHub`, `ReportDocumentView`; API: `ReportDataContext`, V8 execution-control and shared API inputs; tests: API evidence only. | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` for `missing_evidence` and state-matrix proof. |
| `RL_EXECUTION_MANAGER` | Owns manager/control-tower lanes for action queue, decisions, blockers, risk, workload and people/change interventions. | Route: `/implementation`; component: `ExecutionManagementView`, `ManagerModuleView`, `AiRecommendationPanel`; API: manager problem/action/AI V8 routes; tests: `p03-manager-routes`. | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` for approval, provenance and read-back evidence. |
| `RL_FULL_EXECUTION_VIEW` | Owns `/execution` full-step route continuity and must delegate to the shared execution runtime. | Route: `/execution`; component: `FullExecutionView` -> `ExecutionHub`; API: shared runtime only; tests: existing e2e/smoke references. | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` for fresh route-state and AI placement evidence. |
| `RL_ROLLOUT_VIEW` | Owns rollout baseline/current/forecast/intervention framing on `/rollout`; high-impact actions are proposal/review flows. | Route: `/rollout`; component: `FullRolloutView`, `FullRolloutWorkspace`; API: V8 timeline/delay/capacity/update contracts where wired; tests: route protection and V8 API tests. | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` for Menu 3, proposal/review and degraded-state evidence. |

## Integration Behavior Rules

- `Execution` remains one operating system with route companions, not five separate runtimes.
- `/execution` and `/implementation` must not diverge into separate execution truth models.
- `/rollout` may provide rollout-specific schedule framing, but it cannot silently mutate canonical Portfolio, Manager, Reports, Results, Finance or organization capacity truth.
- Reports, AI readouts, manager recommendations and rollout proposals must disclose source/provenance or missing evidence.
- Handoffs out of this module must carry `sourceRefs`, `evidenceRefs` and `approvalState` when impact is material.

## `RL_EXECUTION_PORTFOLIO` Registry Sync Note

Registry sync completed for locked scope `06_realizacja/RL_EXECUTION_PORTFOLIO` on 2026-05-10. Active future task rows are limited to `RL-PORT-P0-001`, `RL-PORT-P1-001` and `RL-PORT-P2-001`; each keeps the same scope anchor and evidence bound to route/component/API/test. Owner acceptance recommendation: approve these rows for future registry execution before runtime work starts.
