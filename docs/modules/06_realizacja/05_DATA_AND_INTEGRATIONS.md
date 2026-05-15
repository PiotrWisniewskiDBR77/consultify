---
module_id: MODULE_EXECUTION
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Data & Integrations — Realizacja / Implementation & PMO

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Tasks, decisions, blockers, dependencies, schedule baseline, capacity records, delivery risks and reports.

## Function Data Responsibility Map

- `RL_EXECUTION_PORTFOLIO`: task/decision/blocker runtime and planning sync context.
- `RL_EXECUTION_REPORTS`: report catalog data, quality flags and generated output lineage.
- `RL_EXECUTION_MANAGER`: manager action metrics and workload signals.
- `RL_FULL_EXECUTION_VIEW` / `RL_ROLLOUT_VIEW`: route-level execution and rollout context boundaries.

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.

## Related Sources

- `DRD/consultify/docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `DRD/consultify/docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `DRD/consultify/docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
- `DRD/consultify/docs/product/EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`
- `DRD/consultify/docs/product/EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md`
- `DRD/consultify/docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`
- `DRD/consultify/docs/UI_UX/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`

## Contract 2.0 Handoff And Lineage Baseline

| Artifact / object | Owner | Upstream source | Downstream handoff | Required lineage fields | Evidence baseline |
| --- | --- | --- | --- | --- | --- |
| `Execution task bundle` | `06_realizacja` | approved initiative and scope from `05_inicjatywy` | `07_rezultaty`, `13_meeting`, `02_moja-praca` derived work pointers | `artifactId`, `tenantId`, `ownerModule`, `sourceRefs`, `evidenceRefs`, `approvalRefs`, `status`, `downstreamRefs` | `ARTIFACT_LINEAGE_MATRIX.md`, `MODULE_INTERACTION_GRAPH.md` |
| `Execution report package` | `06_realizacja` until explicit output handoff | execution initiatives, tasks, decisions, risks, blockers, capacity, budget and timeline signals | `09_outputs`, `13_meeting`, owner download/export | report definition/run, data sources, data quality posture, approval state, export refs | `functions/RL_EXECUTION_REPORTS.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| `Manager intervention record` | `06_realizacja` for intervention action; source object stays with canonical owner | manager problem rows, source entity, affected entities, AI recommendation, user decision | source module, `02_moja-praca`, meeting follow-up, Results evidence where relevant | action type, actor, source entity, affected entities, before/after or verification status | `functions/RL_EXECUTION_MANAGER.md`, V8 manager API tests |
| `Rollout intervention proposal` | `06_realizacja` | rollout baseline/current/forecast/conflict data | approved timeline update, rebaseline proposal, Results/Finance impact context | baseline diff, conflict source, affected dates/owners/dependencies, approval refs | `functions/RL_ROLLOUT_VIEW.md`, V8 timeline API evidence |

## Cross-Module Integration Rules

- `05_inicjatywy -> 06_realizacja`: Execution receives approved initiative scope; it does not re-own initial initiative planning.
- `06_realizacja -> 07_rezultaty`: Results receives delivery evidence/status; Results owns realized KPI/ROI truth.
- `06_realizacja -> 09_outputs`: Execution report packages may be handed off for packaging/export only after explicit user action and provenance retention.
- `06_realizacja -> 13_meeting`: blockers, decisions and follow-up actions may seed meetings, but source execution objects remain owned by Execution or their upstream canonical owner.
- `02_moja-praca` may surface derived execution action pointers, not mutate Execution truth directly.

## Registry Sync Data Annex — `RL_EXECUTION_REPORTS`

Scope anchor: `06_realizacja/RL_EXECUTION_REPORTS`.

| Task ID | Data / integration requirement | Required lineage | Evidence gate | Status |
| --- | --- | --- | --- | --- |
| `RL-REP-P0-001` | Reports without required source families must resolve to `missing_evidence`, not success/finalized. | report definition/run, source family refs, data-quality posture, missing-source reason, blocked finalization status | API/source context and UI/test evidence proving no source-less success | `READY` |
| `RL-REP-P1-001` | Report runtime must preserve explicit state transitions for loading, empty, error, degraded, `missing_evidence` and success. | report state, refresh timestamp, degraded flags, source availability, fallback posture | state matrix evidence tied to route/component/API/test | `WAITING_P0` |
| `RL-REP-P2-001` | Visual/manual evidence for table, grid and document states must reference the same source context and provenance footer. | report id, selected view, data sources, quality flags, evidence artifact refs | evidence links in `07_ACCEPTANCE_AND_TESTS.md` | `WAITING_P0` |

Dependency impact remains read/impact-only for `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_MANAGER` and `07_rezultaty/RE_RESULTS_HUB`; this annex does not redefine their data ownership.
