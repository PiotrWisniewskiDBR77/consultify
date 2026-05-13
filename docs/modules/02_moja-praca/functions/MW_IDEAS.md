---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS
function_name: Ideas / Pomysly
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Pomysly

## 1. Function Identity

- Function ID: `MW_IDEAS`
- Module: `02_moja-praca`
- UI labels/aliases: `Pomysly`, `Ideas`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas"`, `"/my-work/ideas/:ideaId"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: capture, refine, and operationalize ideas.
- Business outcome: convert early thinking into actionable items (task/decision/initiative/report).
- Non-goals: no hidden conversion without explicit user action.

### 2A. Idea Family Contract (Unified)

`MW_IDEAS` is the parent contract for one `Idea` family with four formats: `Mind Map`, `Table`, `Process Flow`, and `Whiteboard`. These formats are not separate modules and must operate inside the same `02_moja-praca` idea workspace, with shared provenance, approval and handoff rules.

Integration blueprint:

- `docs/modules/02_moja-praca/IDEA_FAMILY_INTEGRATION_BLUEPRINT.md`

Common family goal:

- turn ambiguous thinking into reviewed, source-aware work candidates;
- let the user select the best structure for the current thinking problem;
- preserve lineage while moving between formats and into owner modules;
- keep My Work as an orchestration/workspace layer, not a hidden owner of initiatives, execution, documents or outputs.

Format responsibility boundaries:

| Format | Use when | Owns inside Idea workspace | Must not own |
| --- | --- | --- | --- |
| `MW_IDEAS_MINDMAP` | Relationships, dependencies, clusters and evidence gaps matter most. | Nodes, edges, grouping, relation intent and map provenance. | Tabular scoring, executable process readiness, workshop facilitation state or downstream lifecycle objects. |
| `MW_IDEAS_TABLE` | Repeated records need fields, comparison, sorting, grouping, scoring or validation. | Rows, fields, views, filters, scores, validation posture and table provenance. | Generic spreadsheet/database scope or canonical tasks/initiatives/statuses. |
| `MW_IDEAS_PROCESS_FLOW` | The idea needs sequence, lanes, decisions, conditions, dependencies and readiness gates. | Flow nodes, edges, lanes, conditions, blockers and conversion readiness. | Silent BPM/workflow execution or owner-module status mutation. |
| `MW_IDEAS_WHITEBOARD` | Ambiguous, multi-voice or workshop material needs free-form capture, facilitation and synthesis. | Board elements, frames/clusters, session phase, outcomes, snapshots/activity and workshop provenance. | PMO/task board ownership or unreviewed downstream mutation. |

Switching and handoff rules:

- Cross-format switching is allowed only as an explicit transform from selected scope or full idea context.
- Transform payloads must preserve `ideaId`, selected object ids, source/evidence refs, provenance posture, validation/readiness state and user intent.
- If a transform loses structure, the receiving format must mark the result as `draft/needs_review`, not `approved`.
- Cross-format success means "new format context prepared"; it does not mean owner-module mutation succeeded.
- Downstream handoff to `05_inicjatywy`, `06_realizacja` or artifact lanes is always candidate/proposal handoff until the owner module performs review, mutation and read-back.

Shared invariants:

- `AI suggestion != approved truth` in every format.
- Critical claims and high-impact candidates require visible source/evidence or an explicit assumption marker.
- Contextual AI actions live in Menu 3 / command-row right-side slot; the same AI action must not be duplicated inside the canvas.
- High-impact actions follow `proposal -> approval -> execution -> audit/read-back`.
- Tenant, ACL and source-object boundaries are deny-by-default and must be visible as restricted/degraded states.
- Save state is not lifecycle approval state.

Shared anti-patterns:

- treating any Idea format as a separate module;
- using Table as a generic database or spreadsheet replacement;
- using Flow as a silent workflow executor;
- using Whiteboard as a PMO/task board;
- using Mind Map as an unreviewed recommendation truth graph;
- hiding provenance, confidence, source loss or transform degradation;
- showing downstream success before owner-module read-back.

### 2B. Conflict Review (Integrator)

| Conflict ID | Dotyczy formatow | Typ konfliktu | Severity | Rekomendowana decyzja | Status |
| --- | --- | --- | --- | --- | --- |
| `IDEA-C01` | Mind Map vs Table vs Flow vs Whiteboard | ownership | high | Wszystkie cztery sa formatami jednej rodziny `Idea` w `02_moja-praca`; zaden format nie jest osobnym modulem ani ownerem downstream lifecycle. | resolved |
| `IDEA-C02` | Table vs Flow | data | high | Table owns record/field/scoring semantics; Flow owns sequence/condition/lane/readiness semantics. Transform Table -> Flow carries selected rows, field semantics, dependencies and source refs as draft flow context. | resolved |
| `IDEA-C03` | Mind Map vs Whiteboard | UX | medium | Mind Map is relation/topology workspace; Whiteboard is facilitation/synthesis workspace. Both can show spatial content, but only Whiteboard owns session phase, voting/timer/follow and workshop outcomes. | resolved |
| `IDEA-C04` | All formats | UX | high | Contextual AI actions must live in Menu 3/right command row. Canvas controls may support editing/selection, but must not duplicate the same AI action set. Runtime audits remain P2 where coverage is incomplete. | resolved |
| `IDEA-C05` | All formats vs `05_inicjatywy` / `06_realizacja` | handoff | high | Idea formats send candidate payloads only. Owner modules perform review, canonical mutation and read-back before UI can claim downstream success. | resolved |
| `IDEA-C06` | All formats | evidence | medium | Critical elements require provenance/evidence or explicit assumption. Missing full E2E read-back tests remain `code_gap`, not a contract conflict. | resolved |
| `IDEA-C07` | Whiteboard vs Table | acceptance | low | Whiteboard outcomes can become table rows only after explicit transform; Table validation then governs row readiness. Workshop phase/activity remains Whiteboard metadata. | resolved |

## 3. Trigger and Entry Points

- Entry points: Ideas tab, deep links (`ideaId` query/path), open-document events.
- Preconditions: My Work access; idea context selected for detailed workspace.
- Blocking conditions: pilot/feature constraints can reroute user to safe tab.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- List/workspace components: `MyIdeasListContent`, `IdeaMapWorkspace`.
- Command-row components: `WorkspacePanelStrip`, ideas view-mode toggle (`table`/`grid`).
- Tool-switching components inside workspace: `IdeaWorkspaceToolbar` with 4 systems (`mindmap`, `table`, `process_flow`, `whiteboard`).
- Component ownership notes: idea workspace components are module-local; shell controls are shared in hub.

### 4A. Subfunctions (separate contracts)

- `MW_IDEAS_MINDMAP` -> `MW_IDEAS_MINDMAP.md`
- `MW_IDEAS_TABLE` -> `MW_IDEAS_TABLE.md`
- `MW_IDEAS_PROCESS_FLOW` -> `MW_IDEAS_PROCESS_FLOW.md`
- `MW_IDEAS_WHITEBOARD` -> `MW_IDEAS_WHITEBOARD.md`

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: idea record, workspace state (tool/panel/selection), search and stage filter.
- RAW family baselines: `docs/RAW/workbench/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`, `docs/RAW/ideas-tables/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`, `docs/RAW/idea-notebook/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`, `docs/RAW/process-flow/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`, `docs/RAW/whiteboard/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`.
- Upstream modules/services: event bus intents and artifact routing.
- APIs/models: shared API in `src/services/api.ts`; workspace/entity types in My Work types.
- Data freshness assumptions: list and open-document state can be refreshed independently.

## 6. Outputs and Side Effects

- Produced objects/artifacts: updated idea state, linked artifacts, conversion intents.
- Downstream handoff: to Tasks/Decisions/Initiatives/Outputs via explicit action.
- Side effects visible to user: new idea creation, opened idea workspace, panel/tool state changes.

### 6A. Family Outputs and Handoff Payload

Every format-level handoff must carry:

- `ideaId` and source format;
- selected object ids or full-context marker;
- source/evidence refs and provenance posture;
- validation/readiness state;
- target intent (`mindmap`, `table`, `process_flow`, `whiteboard`, `initiative_candidate`, `task_candidate`, `artifact_input`);
- approval state and known blockers.

Owner modules may reject or defer the handoff when required evidence, owner, ACL or review state is missing.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: idea/workspace records in My Work domain.
- Handoff contract (`from -> to`): explicit conversion action with source context preserved.
- Forbidden ownership: must not silently mutate canonical records in other module domains.

## 8. Runtime States and UX Behavior

- Loading: list/workspace lazy-loading with fallback UI.
- Empty: no-ideas state with creation CTA.
- Error: failed operations show safe messaging and retry path.
- Degraded: partial workspace tools can be unavailable without blocking list access.
- Success: save/create actions confirm and preserve active context.
- Next action guidance per state: create idea, open existing idea, convert to concrete downstream work.

### 8A. Family State Contract

All four formats must expose the same state grammar:

| State | Required user meaning | Required next-action guidance |
| --- | --- | --- |
| `loading` | Workspace, format data, AI/source context or validation is still resolving. | Wait, return to Ideas list, or switch to a stable already-loaded format if available. |
| `empty` | No usable structure exists yet for the active format. | Start from the format's starter pattern or transform from another Idea format/source pack. |
| `error` | The format cannot load/save/apply the requested operation. | Retry, reopen workspace, or continue in a safer format without raw internals. |
| `degraded` | AI/source/collaboration/validation is partial or stale. | Continue only within safe manual scope; resolve evidence/ACL/source issues before conversion. |
| `success` | Local format state is available and reviewable. | Review provenance, approve proposals, transform format, or hand off explicitly. |

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/right command-row; workspace AI context button in idea detail mode.
- Source/provenance visibility: conversions preserve origin idea context.
- Approval/diff/review requirements: cross-module high-impact writes require owner-module review.
- Audit trail/evidence: conversion event and resulting artifact linkage.

### 9A. Family Acceptance and Test Matrix

| Family requirement | Required evidence |
| --- | --- |
| All four formats are tool modes inside `MW_IDEAS`, not modules. | Route/component evidence in `MyWorkView`, `MyWorkHub`, `IdeaMapWorkspace`, `IdeaWorkspaceToolbar`; function contracts for `MW_IDEAS_*`. |
| Cross-format transforms preserve provenance and intent. | Component evidence in `crossToolTransform.ts` and `IdeaMapWorkspace`; test evidence in `tests/unit/mywork/crossToolTransform.test.ts`. |
| AI proposals remain proposals until accepted. | Component/runtime evidence in format tools and proposal/governance panels; test evidence in `tests/unit/mywork/aiProposalRuntime.test.ts` and format-specific tests. |
| Handoff to `05_inicjatywy` / `06_realizacja` is candidate-only until owner read-back. | API evidence in `server/src/routes/my-work.routes.ts` conversion endpoints plus owner-module future read-back tests. Current status: `PASS_WITH_P2` due owner read-back e2e gaps. |
| Menu 3/right-slot AI placement is the UI contract for every format. | Component evidence in `IdeaWorkspaceToolbar`; current status `PASS_WITH_P2` until runtime placement audit covers all format-specific AI actions. |

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work access.
- Denied/restricted roles: denied by ACL at tenant/user scope.
- ACL/tenant scope: tenant-isolated idea data.
- Sensitive data masking/redaction: inherited from global policy and source object ACL.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Ideas list opens in `"/my-work/ideas"` and supports table/grid view.
  - Idea detail opens in workspace mode with tool/panel control.
  - Conversion actions remain explicit and source-aware.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/MyIdeasListContent.tsx`
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- Known `doc_gap`: per-tool behavior matrix is not fully decomposed in docs.
- Known `code_gap`: no dedicated end-to-end test for full idea conversion chain.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: complex workspace state can drift from list state on heavy usage.
- Open decisions: finalize canonical naming of ideas tool families in docs.
- Change log: initial function contract created.
