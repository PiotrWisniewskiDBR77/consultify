---
module_id: MODULE_INITIATIVES
doc_kind: DATA
version: 2.0
owner: user
status: review
last_updated: 2026-05-10
---

# Data & Integrations — Inicjatywy

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Initiative, source links, decisions, gates, roles, capabilities, risks, tasks and benefit links.
- Initiative source envelope: auditable wrapper around the originating evidence when the source is not a native ToolSession or AssessmentReport.

## Function Data Responsibility Map

- `IN_PORTFOLIO_HUB`: primary initiative lifecycle/status datasets and previews.
- `IN_ANALYSIS_WORKSPACE`: analysis subview data (resources, feasibility, logic, timeline, completeness).
- `IN_ROADMAP_VIEW` / `IN_PORTFOLIO_VIEW` / `IN_ROI_VIEW`: route-specific read/write boundaries with explicit handoffs.

| Function | Inputs | Outputs | Owner boundary | Evidence status |
| --- | --- | --- | --- | --- |
| `IN_PORTFOLIO_HUB` | Initiative records, source links, capabilities, lifecycle metadata, planning snapshots, filters. | Initiative updates, transition requests, previews, task/decision/RAID create requests, downstream links. | Owns initiative truth only. | route/component/API `PASS_DOC`; test `NOT_DONE` |
| `IN_ANALYSIS_WORKSPACE` | Planning snapshots, feasibility/resource/timeline/completeness data, decision chain context. | Analysis conclusions, readiness gaps, recommendations, explicit next-action routing. | Supports decisions; does not silently mutate downstream truth. | route/component/API `PASS_DOC`; test `NOT_DONE` |
| `IN_ROADMAP_VIEW` | Approved/scheduled initiatives, timeline and dependency metadata. | Roadmap schedule projection and scheduling context. | Does not own execution task truth. | route/component/API `PASS_DOC`; test `NOT_DONE` |
| `IN_PORTFOLIO_VIEW` | Portfolio rollups, health, status, value and prioritization metadata. | Portfolio projection and drill-through links. | Does not create duplicate initiative object. | route/component/API `PASS_DOC`; test `NOT_DONE` |
| `IN_ROI_VIEW` | Value hypotheses, KPI/benefit links, ROI assumptions/evidence. | ROI/value context and finance/results handoff links. | Finance owns assumptions/models; Results owns realized KPI/benefits. | route/component/API `PASS_DOC`; test `NOT_DONE` |

## Initiative Transfer Source Map

The initiative is the transfer backbone across discovery, diagnosis, planning, execution and results. The data contract must support more than the older ToolSession/AssessmentReport-only source doctrine.

| Source family | Runtime evidence | Data rule | Gap status |
| --- | --- | --- | --- |
| Tools | `Api.generateToolInitiatives`, `Api.getToolGeneratedInitiatives` | One tool output may produce many initiatives; preserve method/config/evidence. | partial-pass |
| Assessment | `Api.generateAssessmentInitiatives`, `assessment-workflow-v2/*/generate-initiatives` | One approved assessment may produce many initiatives; preserve assessment/report/gap references. | pass-partial |
| Interview | `InsightViewer`, `V8InterviewApi.handoffFinding`, `Api.interviewPromoteFinding` | Finding/insight may create or link initiative; source envelope must preserve interview evidence refs. | gap: not yet documented as smart generator |
| Conversation / Teresa | `teresaCopilotService`, `teresaCopilotCanon`, `UnifiedChatPanel` | Conversation can seed initiative only with auditable excerpt/context envelope. | partial-pass |
| MyWork / ideas | `my-work.routes.ts` outcome conversion, `IdeaMapWorkspace`, `IdeaTableTool` | Idea/notebook/table/mindmap item can convert to initiative with source envelope. | partial-pass |
| Finance analysis | `V8FinanceApi.getInitiativeProposals`, `V8FinanceApi.createInitiativesFromAnalysis` | Finance analysis can propose/create initiatives; preserve analysis/proposal IDs and assumptions. | partial-pass |
| KPI / Results | `ResultsInitiativesView`, `ResultsKpisTableV3`, `resultsGetROIEvidence` | KPI/result evidence can justify an initiative, but generation path must be explicit and approved. | gap |

Conflict resolution note: `docs/product/SOURCE_TRACEABILITY_SPEC.md` must be updated before implementation to avoid blocking these valid source families. Until then, use the Initiative Card contract as the module-local finding: every source must be wrapped, not ignored.

## Task And Decision Execution Backbone

After initiative validation, execution is managed mostly through tasks and decisions.

- Initiative owner/sponsor/manager are accountability roles, not automatic task assignees.
- Tasks linked to an initiative must have independent `assigneeId` / `assignee_id` support.
- Decisions linked to an initiative must remain decision artefacts with their own decider/workflow, not inline initiative fields.
- Initiative sheets/cards may summarize task/decision state, but task and decision canonical state remains in their modules.

Evidence pointers:

| Evidence type | Pointer |
| --- | --- |
| Task API evidence | `Api.getInitiativeTasks`, `Api.createPersonalTask`, `/api/tasks?initiativeId=`. |
| Task UI evidence | `TasksMilestonesSection`, `TaskDetailView` with `initiativeId`, `assigneeId`, `ownerId`. |
| Decision API evidence | `Api.governanceLinkDecision`, `Api.governanceGetDecisions`, `/api/decisions`. |
| Decision UI evidence | `DecisionDetailView` has initiative parent state and decider state. |
| Assignment evidence | `server/src/routes/my-work.routes.ts` reads/writes `tasks.assignee_id` independently of initiative owner fields. |

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.
- MUST preserve one-to-many source-to-initiative generation.
- MUST support per-task assignment independent of initiative owner/manager.
- MUST keep task and decision truth linked to, but not duplicated inside, the initiative.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.
- MUST NOT force low-quality initiatives from every source; generator output may be zero initiatives.
- MUST NOT treat the initiative owner as default executor for every task.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Initiative Card System Data Contract

`INITIATIVE_CARD_SYSTEM_CONTRACT.md` defines the card read model. The card is a projection of Initiative plus backend capabilities, source links and evidence/readiness metadata; it is not a separate durable object.

Required card identity fields:

- `id`
- `title` / `name`
- `status`
- source/provenance indicator or explicit missing-evidence state
- capability state before any edit, transition, create or AI action

Backend capability fields are read-only to the UI:

- `capabilities.topBar.*`
- `capabilities.cards.canEditCards`
- `capabilities.ctaBar.workflowActions`
- `capabilities.ctaBar.contextCreateActions`
- `capabilities.ctaBar.canUseAi`
- `capabilities.ctaBar.aiAllowedSectionKeys`

Evidence pointers:

| Evidence type | Pointer |
| --- | --- |
| Data/API evidence | `GET /api/initiatives/:id/gate-readiness-check` in `docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`. |
| Source/provenance evidence | `docs/product/SOURCE_TRACEABILITY_SPEC.md` requires ToolSession or AssessmentReport source links. |
| Cross-module evidence | `server/src/services/initiative/initiativeLifecycleCanon.ts` defines bounded handoff payloads without duplicating initiative truth. |

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.
- [ ] Assessment/tools/interview generator or handoff flows preserve source envelope and support one-to-many outcomes where applicable.
- [ ] Finance/KPI-originated initiatives have explicit source envelopes before becoming canonical.
- [ ] Initiative-linked tasks can be assigned to individual users independently of initiative owner.
- [ ] Initiative-linked decisions have explicit decision owner/decider/workflow and remain auditable.

## Related Sources

- `DRD/consultify/docs/product/INITIATIVE_GOVERNANCE_MODEL.md`
- `DRD/consultify/docs/product/INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`
- `DRD/consultify/docs/product/INITIATIVE_CAPABILITIES_SYSTEM.md`
- `DRD/consultify/docs/product/GATE_DEFINITION_OF_DONE.md`
- `DRD/consultify/docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `DRD/consultify/docs/product/ROLES_MODEL.md`
- `DRD/consultify/docs/product/PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md`
- `DRD/consultify/docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`

## Module Integration Data Baseline

Integration decision for `05_inicjatywy/MODULE_INTEGRATION`: no new cross-module edge or artifact type is introduced in this cycle.

| Object / edge | Owner | Integration rule | Evidence status |
| --- | --- | --- | --- |
| `Initiative` / initiative dossier | `05_inicjatywy` | Initiative remains the canonical object for what/why, readiness, governance and planning context. | `PASS_DOC` |
| Task / execution work | `06_realizacja` and task runtime | Initiative may link or request task creation, but task assignee, progress and execution truth remain outside module 05. | `PASS_DOC_WITH_GAPS` |
| Decision / gate record | Decision/governance runtime | Gate decisions remain auditable decision artefacts, not inline hidden analysis fields. | `PASS_DOC_WITH_GAPS` |
| KPI / benefits | `07_rezultaty` | Module 05 carries targets/hypotheses and links; realized value is Results truth. | `PASS_DOC_WITH_GAPS` |
| Finance model / assumptions | `08_finanse` | Module 05 carries budget envelope/value context and links; finance owns model calculations. | `PASS_DOC_WITH_GAPS` |
| Source envelope | `05_inicjatywy` for initiative wrapper; upstream module for source truth | Every valid source family must be wrapped with provenance; taxonomy remains open before runtime `DONE`. | `OPEN_QUESTION` |

System documents checked: `MODULE_INTERACTION_GRAPH.md` and `ARTIFACT_LINEAGE_MATRIX.md` already cover existing module 05 edges and `Initiative dossier`; no update is required unless future work adds a new edge or artifact type.
