---
doc_kind: UNIFIED_IMPLEMENTATION_LIST
status: draft
owner: user
last_updated: 2026-05-10
source_mode: ROW interpreted as RAW files; no literal ROW files found
work_type: docs-only
---

# RAW-Inspired Unified Implementation List

## 1. Purpose

This document merges inspiration from the `RAW` files with the current gap/task-board material into one implementation list for Consultify.

It is not a runtime authorization. Every runtime row still needs its own scoped contract, single `scope_anchor`, acceptance evidence and owner approval before implementation.

## 2. Source Set

Primary RAW sources:

- `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- `docs/UI_UX/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`
- `docs/UI_UX/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`
- `docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`
- `docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
- `docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
- `docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`
- `docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`
- `docs/UI_UX/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`
- `docs/UI_UX/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`
- `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`

Current gap/task-board sources:

- `docs/modules/01_czat/07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/02_moja-praca/WHITEBOARD_RAW_GAP_ANALYSIS_AND_ROADMAP.md`
- `docs/modules/05_inicjatywy/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/05_inicjatywy/INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md`
- `docs/modules/06_realizacja/RAW_TARGET_STATE_2_0_PACKET.md`
- `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`

## 3. Merge Principles

- RAW is inspiration and target-state material, not an implementation contract.
- Existing gap rows keep their module ownership and `scope_anchor`; this document groups them into product-level delivery waves.
- Cross-module rows are dependency/impact only unless a later contract explicitly changes ownership.
- High-impact actions require explicit user approval, provenance, tenant scope and read-back.
- No AI action may silently create, approve, mutate, rebaseline, rebalance, publish or report success without evidence.
- Menu 3/right-side/local command-row placement remains the default for contextual AI actions.
- Deny-by-default applies when source, authorization, tenant scope or approval state is uncertain.

## 4. Unified Implementation List

| ID | Priority | Theme | Implementation item | Existing gap/backlog merged | Primary scope anchors | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `RAW-UNI-P0-001` | `P0` | Delivery governance | Enforce one delivery packet pattern for RAW-to-contract conversion: As-Is evidence, target, delta, source files, acceptance matrix, hard stops and single `scope_anchor`. | RAW packet playbook, module task-board scope rules, `BLOCKED_SCOPE_DRIFT` guard. | all modules, docs-only first | module packet with route/component/API/test evidence and owner acceptance. |
| `RAW-UNI-P0-002` | `P0` | Source/provenance backbone | Create one auditable source envelope doctrine for initiatives, artifacts, tasks, decisions and conversions. | `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS` source-family conflict; chat/canvas source-scope gaps; whiteboard evidence pack. | `05_inicjatywy/MODULE_INTEGRATION`, `01_czat/CZ_CHAT_ENGINE`, `02_moja-praca/*` | source envelope fields, source refs, tenant/project scope, accepted-by/read-back evidence. |
| `RAW-UNI-P0-003` | `P0` | Artifact graph | Establish canonical artifact links: chat/workbench/document/table/deck/whiteboard/process/notebook -> decision/task/initiative/result/report. | Teresa RAW, Workbench RAW, Document Studio RAW, Canvas `NO_GO`, initiative transfer gaps. | `01_czat/CZ_CANVAS_WORKSPACE`, `10_dokumenty`, `11_tabele`, `12_prezentacje`, `05_inicjatywy` | one e2e artifact-to-owner-lane chain with source, approval and read-back. |
| `RAW-UNI-P0-004` | `P0` | Review and mutation safety | Standardize diff/accept/reject/rollback/read-back for every high-impact action and generated artifact. | Canvas diff gaps, whiteboard diff/read-back, execution manager approval/read-back, rollout proposal/review gaps. | `01_czat/CZ_CANVAS_WORKSPACE`, `02_moja-praca/MW_IDEAS_WHITEBOARD`, `06_realizacja/*` | failed/partial/success states tested; no fake success; owner module confirms mutation. |
| `RAW-UNI-P0-005` | `P0` | Teresa startup and Canvas honesty | Finish user-facing Canvas startup path: open from conversation, empty state, draft candidate, review-required state, accept/reject and owner-lane read-back. | `CZ_CANVAS_WORKSPACE` `NO_GO`, startup gap, bridge gap, artifact-source review gaps. | `01_czat/CZ_CANVAS_WORKSPACE` | P0 Canvas acceptance matrix passes; no misleading gated shell. |
| `RAW-UNI-P0-006` | `P0` | Menu 3 compliance | Audit and fix contextual AI/action placement across Chat, Canvas, Initiatives, MyWork, Execution, Rollout and Manager lanes. | repeated `ui_gate_gap`, Menu 3 rules, execution/whiteboard/portfolio/manager placement blockers. | cross-module impact; one module per sprint | UI smoke evidence proving no duplicate canvas toolbar and correct right-side/local action placement. |
| `RAW-UNI-P0-007` | `P0` | Initiative transfer backbone | Normalize every "Create/Promote Initiative" CTA to one payload contract with evidence refs, source family, dedupe/merge warning, user confirmation and success read-back. | initiative source envelope gaps, smart-generator gaps, CTA gaps, Teresa/MyWork/finance/results handoff gaps. | `05_inicjatywy/MODULE_INTEGRATION` plus source modules impact-only | one shared CTA contract and at least one proven source family end-to-end. |
| `RAW-UNI-P0-008` | `P0` | Task/decision executable standard | Require executable task/decision shape: owner/assignee, due date, status, dependency/blocker, acceptance, source evidence and explicit decision owner. | task management benchmark, initiative task/decision backbone gaps, MyWork tasks/decisions board rows. | `02_moja-praca/MW_TASKS`, `02_moja-praca/MW_DECISIONS`, `05_inicjatywy` | task/decision creation and readiness checks reject incomplete high-impact work. |
| `RAW-UNI-P0-009` | `P0` | Execution trust | Close Execution runtime evidence blockers: report `missing_evidence`, Manager provenance/approval/read-back, rollout proposal/review, Menu 3, state matrices. | `06_realizacja` RAW packet, `07_ACCEPTANCE_AND_TESTS`, `RL-*` P0/P1 rows. | `06_realizacja/RL_EXECUTION_REPORTS`, `RL_EXECUTION_MANAGER`, `RL_ROLLOUT_VIEW`, `RL_EXECUTION_PORTFOLIO` | runtime gate moves from `BLOCKED_P1` to passing evidence for high-impact flows. |
| `RAW-UNI-P0-010` | `P0` | Trust taxonomy | Adopt common AI/output classification labels: `fact`, `assumption`, `interpretation`, `recommendation`, `risk`, plus confidence and missing evidence. | whiteboard QA taxonomy, Workbench fact/inference split, report missing-evidence, AI citation requirements. | `02_moja-praca/MW_IDEAS_WHITEBOARD`, `01_czat`, `10_dokumenty`, `06_realizacja` | visible labels in at least one artifact flow and one execution/report flow. |
| `RAW-UNI-P1-001` | `P1` | Conversational Work OS | Expand Teresa from Q&A to operational work OS: conversation -> context -> artifact -> decision/task -> execution/report, with visible model, mode, data scope and citations. | Teresa RAW 104, chat market-parity target, attachment/source-scope gaps. | `01_czat/CZ_CHAT_ENGINE` | work-mode tests, source-scope guard, project instructions/shared chat evidence. |
| `RAW-UNI-P1-002` | `P1` | Workbench side workspace | Build governed side workspace for live artifacts: edit, diff, approve, export and hand off to owner modules. | Workbench RAW 102, Canvas and Document Studio target gaps. | `01_czat/CZ_CANVAS_WORKSPACE`, `10_dokumenty`, `09_outputs` | dual-pane artifact workflow with diff/approval and export/handoff evidence. |
| `RAW-UNI-P1-003` | `P1` | Whiteboard workshop OS | Add workshop orchestration: agenda, phases, facilitator controls, private/reveal, summary closure and degraded/recovery states. | whiteboard RAW gap roadmap P1. | `02_moja-praca/MW_IDEAS_WHITEBOARD` | workshop e2e with summary artifact and role-sensitive controls. |
| `RAW-UNI-P1-004` | `P1` | Whiteboard synthesis and source-to-board | Add prompt/source-to-board ingestion, clustering, contradiction detection, gap prompts and approved action/decision extraction. | whiteboard RAW P1, notebook/process/table RAW patterns. | `02_moja-praca/MW_IDEAS_WHITEBOARD`, `MW_NOTEBOOK`, `MW_IDEAS_PROCESS_FLOW`, `MW_IDEAS_TABLE` | source-to-board works for at least three source types with evidence packs. |
| `RAW-UNI-P1-005` | `P1` | Ideas table as decision matrix | Upgrade ideas table into structured thinking engine: scoring, decision register, provenance, promote row to initiative/task/doc/deck. | Ideas Tables RAW, MyWork table P1 rows, initiative transfer gaps. | `02_moja-praca/MW_IDEAS_TABLE`, `05_inicjatywy` | row-level provenance and promotion read-back to owner lane. |
| `RAW-UNI-P1-006` | `P1` | Notebook context engine | Add fast capture -> enrichment -> source linking -> extract idea/task/initiative/artifact, with private/project/client scope. | Notebook RAW, MyWork notebook task-board rows. | `02_moja-praca/MW_NOTEBOOK` | scoped note conversion with source envelope and no-retention/private guard. |
| `RAW-UNI-P1-007` | `P1` | Process intelligence | Store process as structured data, not only canvas pixels; support text/interview/workshop -> process model -> diagnosis -> initiative/task/SOP/deck. | Process Flow RAW, MyWork process-flow rows. | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | process model has source refs, conversion targets and approval gate. |
| `RAW-UNI-P1-008` | `P1` | Calendar/workday orchestration | Merge external calendars with tasks, decisions, initiatives and reviews; add focus time, overload detection, meeting prep and post-meeting outcomes. | Calendar RAW 109, MyWork calendar P1 rows, execution handoff to meetings. | `02_moja-praca/MW_CALENDAR`, `13_meeting`, `06_realizacja` | meeting prep/outcome creates proposal-only tasks/decisions with read-back. |
| `RAW-UNI-P1-009` | `P1` | Results value loop | Implement value loop primitives: KPI definition, baseline, target, actual, deviation, explanation, corrective action, realized ROI and reconciliation. | Results RAW 105, initiative KPI/result gaps, execution -> results handoff. | `07_rezultaty`, `05_inicjatywy`, `06_realizacja` | KPI/ROI evidence links to initiative and corrective workflow. |
| `RAW-UNI-P1-010` | `P1` | Finance semantic layer | Normalize finance inputs into assumptions, models, variance explanations, forecast/ROI links and audit trail without replacing ERP/BI. | Finance RAW 106, finance-to-initiative source envelope gaps. | `08_finanse`, `05_inicjatywy`, `07_rezultaty` | finance proposal creates initiative/result evidence only after explicit approval. |
| `RAW-UNI-P1-011` | `P1` | Manager/control tower | Complete Manager lane as decisions/risks/workload/people-change control tower with lane cards, provenance and approval evidence. | `RL_EXECUTION_MANAGER` closeout, RAW 103/107 manager/control tower ideas. | `06_realizacja/RL_EXECUTION_MANAGER` | six lanes have UI evidence for source, action, approval and read-back. |
| `RAW-UNI-P2-001` | `P2` | Template catalogs | Add canonical templates for documents, whiteboards, strategy canvases, decision boards, risk boards, initiative boards and reports. | Document Studio RAW, Whiteboard P2, Workbench/Artifact patterns. | `10_dokumenty`, `02_moja-praca/MW_IDEAS_WHITEBOARD`, `09_outputs` | templates include quality rules, source requirements and export tests. |
| `RAW-UNI-P2-002` | `P2` | Memory and knowledge graph | Add durable memory packs for conversations, notebooks, workshops, artifacts and project decisions with retention and tenant controls. | Teresa memory governance, whiteboard memory pack, notebook context engine. | `01_czat`, `02_moja-praca`, `16_organizacja`, `18_ustawienia` | memory scope, retention and no-retention behavior tested. |
| `RAW-UNI-P2-003` | `P2` | Radar intelligence | Build Radar as pre-initiative intelligence: signal -> relevance -> maturity/KPI/role fit -> hype risk -> suggested next step. | Radar RAW 108, MyWork radar rows. | `02_moja-praca/MW_HOME_RADAR`, future radar module impact | no task/initiative hidden write; output is educated next step or approved draft. |
| `RAW-UNI-P2-004` | `P2` | Conversion fabric expansion | Expand conversion rules across board/table/notebook/process/chat/doc/deck into initiatives, tasks, documents, presentations, tables and roadmaps. | whiteboard P2, Workbench RAW, Ideas Table RAW, initiative transfer gaps. | cross-module, one source lane per sprint | conversion quality threshold, owner acceptance and read-back evidence. |
| `RAW-UNI-P2-005` | `P2` | Portfolio roll-ups | Add portfolio roll-ups for execution, value, finance and repeated initiative blueprints without averaging away blockers or provenance. | Execution RAW, Results RAW, Finance RAW. | `06_realizacja`, `07_rezultaty`, `08_finanse`, `05_inicjatywy` | roll-up rows trace down to source objects and expose degraded/missing evidence. |

## 5. Recommended Wave Order

### Wave 0 — Contract And Trust Baseline

1. `RAW-UNI-P0-001`
2. `RAW-UNI-P0-002`
3. `RAW-UNI-P0-004`
4. `RAW-UNI-P0-006`
5. `RAW-UNI-P0-010`

Rationale: without packet discipline, provenance, approval/read-back, Menu 3 and trust taxonomy, later product work risks hidden mutation, duplicated UI controls and unverifiable success.

### Wave 1 — Operational Spine

1. `RAW-UNI-P0-003`
2. `RAW-UNI-P0-005`
3. `RAW-UNI-P0-007`
4. `RAW-UNI-P0-008`
5. `RAW-UNI-P0-009`

Rationale: this establishes the end-to-end work graph from Teresa/artifact through initiative, task, decision and execution.

### Wave 2 — Daily Work And Execution Intelligence

1. `RAW-UNI-P1-001`
2. `RAW-UNI-P1-002`
3. `RAW-UNI-P1-008`
4. `RAW-UNI-P1-011`
5. `RAW-UNI-P1-009`

Rationale: once the spine exists, the application can become a real work OS instead of isolated modules.

### Wave 3 — Consulting Artifact Engines

1. `RAW-UNI-P1-003`
2. `RAW-UNI-P1-004`
3. `RAW-UNI-P1-005`
4. `RAW-UNI-P1-006`
5. `RAW-UNI-P1-007`

Rationale: whiteboard, table, notebook and process features should share the same source/evidence/conversion rules.

### Wave 4 — Completion And Differentiation

1. `RAW-UNI-P1-010`
2. `RAW-UNI-P2-001`
3. `RAW-UNI-P2-002`
4. `RAW-UNI-P2-003`
5. `RAW-UNI-P2-004`
6. `RAW-UNI-P2-005`

Rationale: finance, templates, memory, radar and portfolio roll-ups become strongest after core objects and governance are stable.

## 6. Current Gap Themes Merged

| Gap theme | Merged into |
| --- | --- |
| Canvas startup `NO_GO` and artifact bridge gaps | `RAW-UNI-P0-003`, `RAW-UNI-P0-005`, `RAW-UNI-P1-002` |
| Attachment/source-scope and no-retention gaps | `RAW-UNI-P0-002`, `RAW-UNI-P1-001`, `RAW-UNI-P2-002` |
| Initiative source doctrine conflict | `RAW-UNI-P0-002`, `RAW-UNI-P0-007` |
| Smart generator quality/dedupe/acceptance gaps | `RAW-UNI-P0-007`, `RAW-UNI-P1-005` |
| Task/decision readiness gaps | `RAW-UNI-P0-008` |
| Execution Menu 3, missing evidence, approval/read-back gaps | `RAW-UNI-P0-006`, `RAW-UNI-P0-009`, `RAW-UNI-P1-011` |
| Whiteboard evidence pack, diff, workshop OS gaps | `RAW-UNI-P0-004`, `RAW-UNI-P0-010`, `RAW-UNI-P1-003`, `RAW-UNI-P1-004` |
| Results/KPI/ROI and finance linkage gaps | `RAW-UNI-P1-009`, `RAW-UNI-P1-010`, `RAW-UNI-P2-005` |
| Calendar/workday integration gaps | `RAW-UNI-P1-008` |
| Radar and pre-initiative intelligence gaps | `RAW-UNI-P2-003` |

## 7. Hard Stops

- Stop if a row cannot name one primary `scope_anchor`.
- Stop if implementation would silently mutate canonical objects.
- Stop if source/provenance cannot be shown or explicitly marked missing.
- Stop if tenant/project/role scope is uncertain.
- Stop if success cannot be verified by owner-lane read-back for high-impact flows.
- Stop if AI actions would be duplicated outside Menu 3/right-side/local command-row or row-scoped controls.

## 8. Gate Verdict

- Unified list readiness: `APPROVED_FOR_PLANNING`
- Runtime readiness: `NOT_AUTHORIZED_BY_THIS_DOC`
- Remaining risk: the list is intentionally cross-module; each row must be decomposed into module contracts before implementation.
