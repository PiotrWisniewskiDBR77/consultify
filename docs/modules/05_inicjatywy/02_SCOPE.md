---
module_id: MODULE_INITIATIVES
doc_kind: SCOPE
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Scope — Inicjatywy

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Initiative identity, lifecycle, gates, roles, decisions and planning.
- Source traceability from tools/interview/chat/artifacts.
- Capability-driven UI and status/role CTA matrix.
- Handoff to Execution and Results.
- Function set: `IN_PORTFOLIO_HUB`, `IN_ANALYSIS_WORKSPACE`, `IN_ROADMAP_VIEW`, `IN_PORTFOLIO_VIEW`, `IN_ROI_VIEW`.
- Backend capability-driven action rendering for editability, workflow CTAs, context create actions and AI availability.
- Explicit source envelope/provenance requirement for initiatives from tools, assessment, interview, chat/MyWork, finance and KPI/results contexts.

## Out Of Scope (Must Not)

- Execution task management as primary owner.
- Results/KPI ownership after realization tracking starts.
- Finance model ownership.
- Hidden AI writes, hidden learning, or AI gate approval.
- Runtime implementation changes in the 2026-05-10 Contract 2.0 documentation cycle.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Function Boundary Matrix

| Function | Scope in | Scope out | Boundary owner |
| --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Initiative identity, lifecycle, cards, preview/detail, governed create/edit/transition requests. | Executing tasks or owning KPI/finance truth. | `05_inicjatywy` owns initiative truth; `06`, `07`, `08` own downstream truth. |
| `IN_ANALYSIS_WORKSPACE` | Analysis of feasibility, resources, logic, timeline and completeness. | Silent mutation of downstream modules. | Recommendations require explicit user action and owner module acceptance. |
| `IN_ROADMAP_VIEW` | Scheduling/roadmap view for initiative sequencing. | Duplicate initiative lifecycle owner. | Roadmap lane visualizes schedule context; initiative and execution owners persist. |
| `IN_PORTFOLIO_VIEW` | Portfolio rollup and prioritization view. | Separate portfolio initiative source of truth. | Projection only; drill-through returns to initiative truth. |
| `IN_ROI_VIEW` | ROI/value context and evidence links. | Finance model or benefits measurement ownership. | Finance owns assumptions/models; Results owns realized KPI/benefits. |

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
- [ ] Any handoff boundary change updates `MODULE_INTERACTION_GRAPH.md` and/or `ARTIFACT_LINEAGE_MATRIX.md` before runtime implementation.
