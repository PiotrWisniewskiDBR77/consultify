---
doc_id: RAW_AND_GAP_UNIFIED_IMPLEMENTATION_BACKLOG
doc_kind: IMPLEMENTATION_BACKLOG
owner: user
status: draft
last_updated: 2026-05-10
---

# RAW + Gap Unified Implementation Backlog

## Purpose

This document is one implementation list that connects:

- RAW/ROW inspirations from `docs/UI_UX/*_RAW_*.md`, `docs/RAW/**/*.md` and `docs/modules/*/RAW_INPUT.md`,
- current module task boards (`IMPLEMENTATION_TASK_BOARD.md`),
- current gap backlog and gap matrices.

It does not replace module contracts, function contracts or ROW boards. It is an intake and sequencing layer for future implementation work.

## Source Stack

| Source group | Files / examples | Role in this list |
| --- | --- | --- |
| RAW conversion method | `docs/modules/_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`, `docs/modules/_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md` | Governance: RAW is input, not contract truth. |
| Current gap backlog | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md` | Existing P0/P1/P2 product gaps. |
| Gap matrices | `CHAT_V8_GAP_MATRIX.md`, `AGENT_EXECUTION_V8_GAP_MATRIX.md`, `MYWORK_CALENDAR_V8_GAP_MATRIX.md`, `INITIATIVE_ELEMENT_COVERAGE_AND_GAP_MATRIX_V8.md`, `PREZENTACJE_V8_GAP_MATRIX.md`, `NOTATKA_V8_GAP_MATRIX.md`, `KNOWLEDGE_RAG_V8_GAP_MATRIX.md` | Module/family gap detail. |
| ROW / module boards | `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`, `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`, `docs/modules/05_inicjatywy/IMPLEMENTATION_TASK_BOARD.md` | Deployable task registry with immutable `scope_anchor`. |
| RAW inspiration pack | `104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`, `102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`, `103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`, `107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`, `101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`, `95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`, `98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`, `109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`, `108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`, `105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`, `106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | Product patterns worth converting into contract-backed implementation tasks. |

## Working Principles To Transfer Into Consultify

1. RAW is not implementation truth. Every RAW inspiration must become `As-Is -> Target -> Delta -> Contract -> Evidence` before runtime work.
2. One agent/task gets one immutable `scope_anchor`; cross-module work is dependency/impact only.
3. Every critical claim requires route/component/API/test or explicit manual evidence.
4. AI must operate through proposal -> approval -> execution -> audit for writes and high-impact changes.
5. Artifact work must preserve source, version, diff, approval, export and lineage.
6. Execution work must connect decision, task, owner, blocker, schedule, report and result.
7. Degraded data must be labelled honestly; missing source, stale data and partial sync are not success.
8. AI actions belong in Menu 3/right-side or row-scoped controls; no duplicated canvas AI toolbar.
9. Every module should answer "what next?" with a bounded action, not only display information.
10. Outcomes matter: initiative progress, task completion and realized ROI are different states.

## Unified Implementation Queue

| ID | Priority | Theme | Implementation item | RAW inspiration | Existing gap / ROW linkage | Primary scope anchor | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `UGB-P0-001` | `P0` | Conversational Work OS | Close one explicit conversation -> context -> artifact -> decision/task -> execution -> report lifecycle contract. | Teresa RAW: `conversation -> context -> artifact -> decision -> task -> execution -> report` | Wave2 `P0-01` ArtifactRun lifecycle; `CHAT_V8_GAP_MATRIX.md` | `01_czat/CZ_CHAT_ENGINE` | route/component/API/test for artifact run, approval and materialization. |
| `UGB-P0-002` | `P0` | Artifact trust | Normalize provenance, visibility, review state and export trust badges across artifact families. | Teresa + Workbench RAW: sources, citations, approval, audit | Wave2 `P0-02`; object-linked outputs gaps | `09_outputs/OUTPUTS_LIBRARY` | visible trust-state panel plus API/test evidence. |
| `UGB-P0-003` | `P0` | Workbench | Build/contract dual-pane Workbench: left Teresa, right live artifact with source, version, diff and approval. | Workbench RAW: chat + artifact + sources + versions + diff + approval | Wave2 `P1-01`, `P1-02`, `P1-03`; chat/artifact gaps | `01_czat/CZ_CANVAS_WORKSPACE` | component evidence for dual pane, diff accept/reject, artifact save. |
| `UGB-P0-004` | `P0` | AI write governance | Enforce proposal -> approval -> execution -> audit for all AI-created tasks, decisions, artifacts and execution actions. | Teresa RAW ToolCall `waiting_for_approval`; Workbench diff/approval | Wave2 `P0-05`; `AGENT_EXECUTION_V8_GAP_MATRIX.md` | `01_czat/CZ_CHAT_ENGINE` | backend audit test plus UI approval evidence. |
| `UGB-P0-005` | `P0` | Execution Hub | Convert execution from task board into governed execution lifecycle: initiative -> plan -> stages -> gates -> tasks -> decisions -> risks -> PMO report -> Results/ROI. | Execution Hub RAW; Implementation PMO RAW | `06_realizacja` gaps; `RL_EXECUTION_PORTFOLIO` P0/P1 rows | `06_realizacja/RL_EXECUTION_PORTFOLIO` | route/component/API/test matrix for portfolio, gates and read-back. |
| `UGB-P0-006` | `P0` | Menu 3 AI placement | Audit every contextual AI action and move duplicates into Menu 3/right-side or row-scoped controls only. | Global AI action rule; Workbench/Cursor pattern | Current module P0s: `RL-PORT-P0-001`, `IN-ANL-P0-002` | cross-module, dispatch per function | UI smoke evidence per module; no duplicate AI toolbar. |
| `UGB-P0-007` | `P0` | Evidence gates | Add missing UI state evidence for core modules: loading, empty, error, degraded, success, read-back. | RAW playbook acceptance rule | ROW boards requiring route/component/API/test | per function board row | test/manual evidence linked in module acceptance docs. |
| `UGB-P0-008` | `P0` | My Work operating layer | Close Daily Ops loop across inbox, tasks, decisions and manager action center. | Execution Hub RAW: task/decision/calendar/inbox/communication/report | `02_moja-praca` board `MW-INBOX-*`, `MW-TASKS-*`, `MW-DEC-*`, `MW-MGR-*` | `02_moja-praca/MW_TASKS` and sibling anchors | route/component/API/test for handoffs and owner read-back. |
| `UGB-P0-009` | `P0` | Interview to initiative | Make interview outputs convert into decisions, insights and initiative candidates with traceable source and owner handoff. | Teresa/Workbench RAW: transcript -> artifact -> task/decision | `03_wywiad` board `WY-INS-*`, `WY-INI-*` | `03_wywiad/WY_INITIATIVES` | source-linked conversion evidence and acceptance docs. |
| `UGB-P0-010` | `P0` | Initiative execution backbone | Stabilize initiative planning -> analysis -> execution handoff with readiness, dependency and route evidence. | Execution Hub + PMO RAW | `05_inicjatywy` board `IN-HUB-*`, `IN-ANL-*`, `IN-INT-*` | `05_inicjatywy/MODULE_INTEGRATION` | route/component/API/test plus owner acceptance. |
| `UGB-P1-001` | `P1` | Ideas Tables | Treat tables as structured thinking artifacts, not mini-Excel: row/field provenance, scoring, decision and initiative/task conversion. | Ideas Tables RAW | `02_moja-praca` board `MW-TABLE-*`; Wave2 Sheet gap `P1-03` | `02_moja-praca/MW_IDEAS_TABLE` | table artifact contract, source field evidence, conversion test. |
| `UGB-P1-002` | `P1` | Whiteboard | Convert whiteboard from canvas into workshop intelligence artifact: cluster, summarize, vote, decide, create initiative/task. | Whiteboard RAW | `02_moja-praca` board `MW-WB-*`; whiteboard gap roadmap | `02_moja-praca/MW_IDEAS_WHITEBOARD` | selected-board -> decision/task evidence, no silent AI mutation. |
| `UGB-P1-003` | `P1` | Process Flow | Store process as data/model, not only diagram; support current/future state, bottlenecks, risk, SOP, initiative/task export. | Process Flow RAW | `02_moja-praca` board `MW-FLOW-*`; tools/process gaps | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | process model schema, route/component/API/test evidence. |
| `UGB-P1-004` | `P1` | Calendar workday engine | Move Calendar from date grid to time + work orchestration: My Day, focus blocks, meeting prep, follow-up, conflict detection. | Calendar RAW | `02_moja-praca` board `MW-CAL-*`; `MYWORK_CALENDAR_V8_GAP_MATRIX.md` | `02_moja-praca/MW_CALENDAR` | external event + internal task/decision evidence, approval for external writes. |
| `UGB-P1-005` | `P1` | Meeting intelligence | Convert transcript/meeting recap into decisions, tasks, artifacts and next review with owner read-back. | Calendar RAW; Teresa RAW Teams/Slack lessons | `13_meeting/RAW_INPUT.md`; My Work/Interview boards | `13_meeting/MEETING_INTELLIGENCE` | transcript -> action evidence with audit and source links. |
| `UGB-P1-006` | `P1` | Radar | Build Radar as role-aware technology/transformation intelligence, not news feed: fit, hype risk, first sensible step. | Radar RAW | `02_moja-praca` board `MW-RADAR-*`; future module `Radar` | `02_moja-praca/MW_HOME_RADAR` | role/context personalization evidence and source citations. |
| `UGB-P1-007` | `P1` | Results | Make Results a value realization system: initiative -> KPI -> baseline -> actual -> deviation -> corrective action -> verified ROI. | Results RAW | `07_rezultaty` module gaps; Wave2 value/output gaps | `07_rezultaty/RZ_INITIATIVES_TRACKING` | KPI baseline/actual/evidence route/API/test. |
| `UGB-P1-008` | `P1` | Finance | Create finance intelligence loop: statement import -> normalization -> model -> analysis -> forecast -> decision -> Results/ROI. | Finance RAW | Finance module gaps; Wave2 object-linked outputs | `08_finanse/FN_ANALYSIS_WORKSPACE` | statement source, assumptions, approval and report evidence. |
| `UGB-P1-009` | `P1` | Reports and presentations continuity | Ensure report/deck artifacts can continue, review, export and link back to source object. | Workbench RAW; Results/Finance RAW | Wave2 `P1-01`, `P1-02`, `P2-01`, `P2-02`; presentation gap matrix | `12_prezentacje/PRESENTATION_CONTINUITY` | reopen/continue/review/export evidence. |
| `UGB-P1-010` | `P1` | Help and learning product | Package Help/KB as context-aware product guidance and learning runtime, not thin docs. | Teresa RAW project/workspace context | Wave2 `P0-06`; knowledge RAG gap matrix | `HELP_KNOWLEDGE_RUNTIME` | contextual help route/component/API/test evidence. |
| `UGB-P2-001` | `P2` | Cross-artifact consistency | Add consistency checks across document, table, deck, process, whiteboard and initiative claims. | Workbench RAW: cross-artifact consistency | artifact family gaps | `09_outputs/ARTIFACT_GRAPH` | consistency report with source/diff evidence. |
| `UGB-P2-002` | `P2` | Artifact graph | Expose artifact -> decision -> initiative -> task -> result lineage as navigable graph. | Teresa/Workbench RAW object links | Wave2 object-linked outputs; `ARTIFACT_LINEAGE_MATRIX` | `09_outputs/ARTIFACT_LINEAGE` | graph UI + API lineage tests. |
| `UGB-P2-003` | `P2` | Client-ready package | Package approved artifacts into client-ready/internal modes with export governance. | Workbench RAW lifecycle | Wave2 Outputs Library; report/presentation gaps | `09_outputs/CLIENT_READY_PACKAGE` | internal/client-ready visibility and export audit evidence. |
| `UGB-P2-004` | `P2` | Prompt/mode OS | Normalize chat modes, prompt suggestions, model profiles and data scopes into one visible AI OS product grammar. | Teresa RAW conceptual model | Wave2 `P0-05`, `P2-03`; chat prompt gap matrix | `01_czat/CZ_CHAT_ENGINE` | mode selector/data scope/test evidence. |
| `UGB-P2-005` | `P2` | Organization context graph | Strengthen org/project/user context graph used by Teresa, Radar, Calendar, Finance and Execution. | Teresa RAW ProjectContext; Radar role lens | Wave2 `P0-11`; organization module gaps | `16_organizacja/ORG_CONTEXT_GRAPH` | tenant-safe context API and permission tests. |
| `UGB-P2-006` | `P2` | Admin/control plane | Consolidate admin/settings/superadmin controls for AI, connectors, visibility, retention and audit. | Teresa RAW governance; Workbench enterprise audit | Wave2 `P0-12`, `P0-13`, `P0-14` | `17_panel-administratora/ADMIN_CONTROL_PLANE` | deny-by-default and audit evidence. |
| `UGB-P2-007` | `P2` | Easy sync shell | Turn sync into provider onboarding and lifecycle, not hidden connector plumbing. | Calendar/Meeting/Finance RAW external integrations | Wave2 `P0-09` | `SYNC_PROVIDER_ONBOARDING` | provider connect/degraded/retry evidence. |
| `UGB-P2-008` | `P2` | Communication surface | Define communication as source of work truth: message/thread -> decision/task/risk/artifact. | Teresa RAW Slack/Teams lessons | Wave2 `P0-10` | `COMMUNICATION_SURFACE_MODEL` | message-to-work source evidence and approval gate. |
| `UGB-P2-009` | `P2` | Mobile scope honesty | Define mobile support matrix by flow, including what is read-only, write-capable or out of scope. | RAW workday/execution patterns | Wave2 `P0-15` | `MOBILE_SCOPE_STATEMENT` | support matrix and smoke evidence. |
| `UGB-P2-010` | `P2` | Partner lifecycle | Extend partner portal from shell to lifecycle: enablement, tasks, outputs, reporting and operator controls. | Workbench/Help/Outputs principles | Wave2 `P1-06` | `19_portal-partnerski/PARTNER_LIFECYCLE` | route/component/API/test evidence. |

## Merge Rules For Existing Boards

- Do not copy every ROW board row into this file. Link them by `scope_anchor`.
- If a unified backlog row becomes executable, create or update the matching function execution card and module `IMPLEMENTATION_TASK_BOARD.md`.
- If the work spans modules, split it into child rows before runtime work starts.
- If a RAW idea lacks route/component/API/test evidence, keep it as `TARGET_DELTA` until the contract is approved.
- P0 rows must close before P1/P2 expansion in the same product theme.

## Suggested Next Dispatch Order

1. `UGB-P0-001` and `UGB-P0-004`: close governed AI action/run lifecycle first.
2. `UGB-P0-003`: make Workbench the artifact-working surface for the lifecycle.
3. `UGB-P0-005` and `UGB-P0-008`: connect execution truth across Portfolio and Daily Ops.
4. `UGB-P0-009` and `UGB-P0-010`: harden Interview/Initiatives handoff into execution.
5. `UGB-P1-001` to `UGB-P1-004`: expand structured work surfaces after governance is stable.

## Open Questions

1. Should this unified backlog become the canonical product intake queue, or remain an analysis document until owner approval?
2. Which theme should own Workbench runtime: `01_czat`, `09_outputs`, or a cross-module artifact substrate?
3. Should `06_realizacja` receive a new `RAW_TARGET_STATE_2_0_PACKET.md` before runtime work starts, or should `RL_EXECUTION_PORTFOLIO` continue function-by-function first?
