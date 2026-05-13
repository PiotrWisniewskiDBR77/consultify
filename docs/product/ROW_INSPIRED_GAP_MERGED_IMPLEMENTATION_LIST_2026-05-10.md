---
doc_id: ROW_INSPIRED_GAP_MERGED_IMPLEMENTATION_LIST_2026_05_10
doc_kind: IMPLEMENTATION_BACKLOG
owner: user
status: draft_for_owner_review
last_updated: 2026-05-10
source_mode: ROW interpreted as RAW_ROW / implementation rows
work_type: docs-only
---

# ROW-Inspired Gap-Merged Implementation List

## 1. Purpose

This is the single merged implementation list requested after reviewing ROW / RAW_ROW files and the current gap backlog.

It consolidates:

- ROW / RAW_ROW implementation-row documents,
- current RAW-inspired lists,
- current gap/task-board sources,
- recurring implementation principles worth transferring into Consultify.

This document is not runtime authorization. Each row still needs one locked `scope_anchor`, module/function contract readiness, owner acceptance and route/component/API/test or accepted manual evidence before implementation.

## 2. Source Files Reviewed

| Source group | Files |
| --- | --- |
| ROW / RAW_ROW implementation lists | `docs/modules/_RAW_ROW_CONSOLIDATED_IMPLEMENTATION_LIST_2026-05-10.md`, `docs/modules/_RAW_ROW_INSPIRED_UNIFIED_IMPLEMENTATION_LIST_2026-05-10.md` |
| Current unified RAW/gap lists | `docs/product/RAW_INSPIRED_UNIFIED_IMPLEMENTATION_LIST_2026-05-10.md`, `docs/product/RAW_AND_GAP_UNIFIED_IMPLEMENTATION_BACKLOG.md` |
| Current module/gap context | `docs/modules/README.md`, module `RAW_TARGET_STATE_2_0_PACKET.md`, module `IMPLEMENTATION_TASK_BOARD.md`, gap matrices/backlogs referenced by the lists above |

## 3. Functional Inspirations Worth Transferring

| Inspiration | Product meaning for Consultify | Merge target |
| --- | --- | --- |
| Conversational Work OS | Chat is not Q&A; it is a governed work intake that can create artifacts, decisions, tasks, initiatives and reports through approval/read-back. | `MERGED-P0-001`, `MERGED-P0-004`, `MERGED-P1-001` |
| Side Workbench / Canvas | A right-side working artifact should show source, version, diff, approval, export and owner-lane handoff. | `MERGED-P0-002`, `MERGED-P1-002` |
| Source envelope | Every critical object must carry source family, source refs, tenant/project scope, missing-evidence state and acceptance/read-back metadata. | `MERGED-P0-003` |
| AI write governance | AI may propose and prepare, but writes require explicit approval, execution, audit, failure handling and owner read-back. | `MERGED-P0-004` |
| Menu 3 discipline | Contextual AI/actions live in Menu 3/right-side/local command row or row-scoped controls, never as duplicate canvas toolbars. | `MERGED-P0-005` |
| Trust taxonomy | Generated content should label `fact`, `assumption`, `interpretation`, `recommendation`, `risk`, confidence and missing evidence. | `MERGED-P0-006` |
| Initiative transfer backbone | All "create/promote initiative" flows use one payload, dedupe/merge policy, source refs, approval and read-back. | `MERGED-P0-007` |
| Executable task/decision standard | Tasks and decisions need owner, assignee/decision owner, due date, status, dependency/blocker, acceptance and evidence. | `MERGED-P0-008` |
| Execution / PMO control tower | Execution is a governed lifecycle: portfolio, reports, manager lane, rollout, blockers, decisions, risks and Results/ROI handoff. | `MERGED-P0-009`, `MERGED-P1-011` |
| Artifact family trust | Documents, tables, decks, reports, whiteboards and outputs share lifecycle, provenance, review, export and lineage grammar. | `MERGED-P0-010`, `MERGED-P1-002`, `MERGED-P1-010`, `MERGED-P1-011` |
| Daily Work OS | My Work joins inbox, tasks, decisions, calendar, notebook, ideas and manager actions as one operating layer. | `MERGED-P0-011`, `MERGED-P1-003` to `MERGED-P1-008` |
| Value loop | Initiative execution must connect to KPI, Results, Finance, variance, corrective action and realized ROI. | `MERGED-P1-012`, `MERGED-P1-013`, `MERGED-P2-005` |
| External context and sync | Calendar, meeting, enterprise search, connectors and provider health need explicit lifecycle, ACL, freshness and degraded states. | `MERGED-P1-008`, `MERGED-P1-014`, `MERGED-P2-002`, `MERGED-P2-003` |
| Radar as pre-initiative intelligence | Radar should explain relevance, maturity fit, hype risk and next step without silently creating work. | `MERGED-P2-004` |

## 4. Work Principles To Carry Forward

1. One row equals one primary `scope_anchor`; cross-module effects are dependencies unless a contract says otherwise.
2. RAW/ROW inspiration becomes runtime work only after `As-Is -> Target -> Delta -> Contract -> Evidence`.
3. Every critical claim needs route/component/API/test evidence or an explicit manual evidence record.
4. High-impact mutation follows `proposal -> approval -> execution -> audit -> read-back`.
5. Missing source, stale data, partial sync and weak confidence are degraded states, not success.
6. Owner modules remain canonical; chat, workbench, radar and meeting can propose, but owner lanes materialize durable objects.
7. AI cannot silently create, approve, mutate, rebaseline, rebalance, publish, learn or report success.
8. Menu 3/right-side/local action-zone placement is a product gate, not visual polish.
9. Runtime `DONE` requires evidence; docs-only rows can be `APPROVED_FOR_PLANNING` only.

## 5. One Merged Implementation List

| ID | Priority | Theme | Implementation item | Existing gaps merged | Primary scope anchor | Acceptance evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `MERGED-P0-001` | `P0` | Delivery governance | Enforce one RAW/ROW-to-contract packet pattern with As-Is evidence, target, delta, contract, hard stops, owner acceptance and evidence gates. | RAW playbook rows, module packets, scope-drift concerns. | `global/MODULE_DELIVERY_GOVERNANCE` | One approved packet template applied to next module wave; gate passes without scope drift. |
| `MERGED-P0-002` | `P0` | Canvas startup | Finish first believable conversation-to-artifact Canvas path: open, empty state, draft, source cards, review-required state, accept/reject and owner-lane read-back. | Canvas `NO_GO`, Workbench RAW, Wave2 ArtifactRun lifecycle, chat artifact bridge gaps. | `01_czat/CZ_CANVAS_WORKSPACE` | E2E: chat output -> draft artifact -> reject no-write and accept read-back. |
| `MERGED-P0-003` | `P0` | Source envelope | Define and adopt one source envelope for initiatives, artifacts, tasks, decisions, reports and conversions. | Initiative source doctrine conflict, chat source-scope gaps, whiteboard evidence pack, artifact lineage gaps. | `global/TRACEABILITY_AND_SOURCE_ENVELOPE` | Contract plus at least one API/component test for accepted, rejected and missing evidence. |
| `MERGED-P0-004` | `P0` | AI write governance | Standardize `ActionProposal`, approval, apply, partial failure, rollback, audit and owner read-back for AI-created or AI-assisted work. | Agent execution gap matrix, Canvas diff gaps, Manager/Rollout approval gaps, hidden mutation risks. | `platform/EXECUTION_AGENT_SPINE` | UI + backend evidence for approved write, rejected no-write, failed/partial write and read-back. |
| `MERGED-P0-005` | `P0` | Menu 3 compliance | Audit and fix contextual AI/action placement across Chat, Canvas, My Work, Initiatives, Execution, Rollout and Manager. | Repeated `ui_gate_gap`, Menu 3 rules, Execution placement blockers. | `global/EVIDENCE_AND_MENU3_GATE` | UI smoke or component assertions proving no duplicate canvas toolbar per selected module. |
| `MERGED-P0-006` | `P0` | Trust taxonomy | Apply common trust labels: `fact`, `assumption`, `interpretation`, `recommendation`, `risk`, confidence, missing evidence and degraded state. | Whiteboard QA taxonomy, report missing evidence, Workbench source trust, AI citation gaps. | `platform/TRUST_PROVENANCE_VISIBILITY` | Visible labels in at least one artifact flow and one execution/report flow. |
| `MERGED-P0-007` | `P0` | Initiative transfer | Normalize every Create/Promote Initiative CTA with source refs, selected evidence, duplicate/merge warning, approval and success read-back link. | `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS`, smart generator gaps, chat/MyWork/finance/results handoff gaps. | `05_inicjatywy/MODULE_INTEGRATION` | Shared CTA payload contract plus one source family proven end-to-end. |
| `MERGED-P0-008` | `P0` | Task/decision standard | Require executable task/decision shape with owner/assignee, due date, status, blocker/dependency, acceptance, source evidence and decision owner. | MyWork Tasks/Decisions, initiative readiness gaps, PMO execution loop gaps. | `02_moja-praca/MW_TASKS` and `02_moja-praca/MW_DECISIONS` | Incomplete high-impact task/decision rejected; complete object read back in owner lane. |
| `MERGED-P0-009` | `P0` | Execution trust | Close `06_realizacja` runtime evidence blockers: report `missing_evidence`, Manager approval/provenance/read-back, Rollout proposal/review, Menu 3 and state matrices. | `06_realizacja` RAW packet, RL function P0/P1 gaps. | `06_realizacja/MODULE_INTEGRATION` then one RL function per sprint | Runtime gate moves from `BLOCKED_P1` with evidence attached. |
| `MERGED-P0-010` | `P0` | Artifact family trust | Normalize artifact lifecycle across Outputs, Documents, Tables, Decks, Reports and Whiteboards: provenance, review state, export audit, reopen/reuse and lineage. | Outputs trust gaps, Document/Deck/Table RAW, artifact lineage matrix, Wave2 object-linked outputs. | `09_outputs/ARTIFACT_FAMILY` | Trust panel/badge + export audit + lineage API evidence on first artifact family. |
| `MERGED-P0-011` | `P0` | My Work operating layer | Close Daily Ops loop across Inbox, Tasks, Decisions and Manager action center with owner read-back and no hidden mutations. | MyWork task board rows, Execution Hub RAW daily work chain. | `02_moja-praca/MW_TASKS` plus sibling anchors | Route/component/API/test evidence for inbox/task/decision handoffs. |
| `MERGED-P0-012` | `P0` | Organization context | Define organization/tenant/project/user context as shared substrate for all modules, with deny-by-default and source policy visibility. | Organization context gaps, Chat source-scope, Radar role lens, admin/settings gaps. | `16_organizacja/ORG_CONTEXT_ENGINE` | Tenant/ACL tests plus visible effective scope/source policy in one user flow. |
| `MERGED-P1-001` | `P1` | Conversational Work OS | Expand Teresa into visible work modes with project instructions, data scope, citations, model/mode controls, run plan and work history. | Teresa RAW 104, Chat V8 gap matrix, prompt/mode OS gaps. | `01_czat/CZ_CHAT_ENGINE` | Work mode/source-scope tests and UI evidence for project context. |
| `MERGED-P1-002` | `P1` | Workbench lifecycle | Add full diff/apply/reject/rollback/version snapshots and export/handoff for side-workspace artifacts. | Workbench RAW 102, Canvas P1 diff/apply gaps, artifact trust gaps. | `01_czat/CZ_CANVAS_WORKSPACE` | Component/e2e diff tests plus rollback no-data-loss test. |
| `MERGED-P1-003` | `P1` | Whiteboard trust | Close Whiteboard outcome evidence pack, AI QA labels, approval before conversion and owner-lane read-back. | Whiteboard RAW gap roadmap P0, Wave1 Whiteboard gaps. | `02_moja-praca/MW_IDEAS_WHITEBOARD` | Whiteboard outcome -> approval -> owner conversion -> read-back e2e. |
| `MERGED-P1-004` | `P1` | Whiteboard workshop OS | Add agenda, phases, facilitator controls, private/reveal, voting, summary closure and recovery/degraded states. | Whiteboard roadmap P1, workshop OS inspiration. | `02_moja-praca/MW_IDEAS_WHITEBOARD` | Workshop e2e with role-sensitive controls and summary artifact. |
| `MERGED-P1-005` | `P1` | Ideas tables | Upgrade idea tables into structured thinking engine with row/field provenance, scoring, decision register and promote-to-owner-lane actions. | Ideas Tables RAW, MyWork table rows, initiative transfer gaps. | `02_moja-praca/MW_IDEAS_TABLE` | Row-level provenance, scoring and promotion read-back test. |
| `MERGED-P1-006` | `P1` | Notebook context | Add notebook capture -> enrichment -> source linking -> extract idea/task/initiative/artifact with private/project/client scope. | Notebook RAW, MyWork notebook task board. | `02_moja-praca/MW_NOTEBOOK` | Scoped conversion evidence and retention/no-retention guard. |
| `MERGED-P1-007` | `P1` | Process intelligence | Store process as structured model with versions, diagnosis, bottlenecks, risk, SOP/initiative/task/deck conversion. | Process Flow RAW, process-flow rows. | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | Process schema/version test plus approved conversion evidence. |
| `MERGED-P1-008` | `P1` | Calendar/workday | Merge external calendars with tasks, decisions, initiatives, focus time, overload detection, meeting prep and follow-up. | Calendar RAW 109, MyWork calendar gaps, Meeting follow-up. | `02_moja-praca/MW_CALENDAR` | Provider sync lifecycle plus meeting prep/outcome proposal with read-back. |
| `MERGED-P1-009` | `P1` | Interview handoff | Convert interviews into structured insight/action artifacts and initiative candidates with source and owner handoff. | Interview task boards, Teresa/workbench transcript-to-action inspiration. | `03_wywiad/WY_INSIGHTS` and `03_wywiad/WY_INITIATIVES` | Insight -> initiative/task proposal with accepted/rejected/deferred states. |
| `MERGED-P1-010` | `P1` | Document Studio | Package document runtime as artifact engine with schema, source pack, missing inputs, narrative planner, QA and DOCX/PDF audit. | Document Studio RAW, artifact family gaps. | `10_dokumenty/DOC_STUDIO_RUNTIME_TARGET` | Document lifecycle tests and export/source audit evidence. |
| `MERGED-P1-011` | `P1` | Deck Studio | Add source-backed deck outline, continue/review/deliver, diff/approval and PPTX export readiness. | Presentation RAW, Gamma/Copilot inspiration, Wave2 deck continuity gaps. | `12_prezentacje/PR_DECK_STUDIO` | Source-per-claim deck evidence and PPTX export audit. |
| `MERGED-P1-012` | `P1` | Results value loop | Implement KPI definition, baseline, target, actual, deviation, explanation, corrective action, realized ROI and evidence links. | Results RAW, initiative -> execution -> results handoff gaps. | `07_rezultaty/RZ_INITIATIVES_TRACKING` | KPI/ROI evidence links to initiative and corrective workflow. |
| `MERGED-P1-013` | `P1` | Finance semantic layer | Normalize finance inputs into assumptions, models, variance explanations, forecast/ROI links and audit trail without replacing ERP/BI. | Finance RAW, finance-to-initiative source envelope gaps. | `08_finanse/FN_FINANCE_INTELLIGENCE` | Finance proposal creates initiative/result evidence only after explicit approval. |
| `MERGED-P1-014` | `P1` | Integrations health | Build provider onboarding, health, logs, retry, reconnect, sync lifecycle, AI provider settings and cost/rate visibility. | Integration gap analysis, Calendar/Meeting/Finance external context RAW. | `18_ustawienia/INTEGRATIONS` | Provider connect/degraded/retry evidence and tenant-safe settings UI. |
| `MERGED-P1-015` | `P1` | Admin control plane | Create one tenant/operator cockpit for users, policy, AI usage, connector health, audit and high-impact operations. | Admin/settings/superadmin gaps, Harvey/Vault governed workflow inspiration. | `17_panel-administratora/ADMIN_CONTROL_PLANE` | Admin route/API tests, deny-by-default and audit evidence. |
| `MERGED-P2-001` | `P2` | Template catalogs | Add canonical templates for documents, whiteboards, strategy canvases, decision boards, risk boards, initiative boards and reports. | Document/Whiteboard/Workbench RAW template patterns. | `10_dokumenty`, `02_moja-praca/MW_IDEAS_WHITEBOARD`, `09_outputs` | Template registry tests with quality/source rules. |
| `MERGED-P2-002` | `P2` | Memory graph | Add memory packs for conversations, notebooks, workshops, artifacts and project decisions with retention and tenant controls. | Teresa memory, whiteboard memory, notebook context. | `01_czat`, `02_moja-praca`, `16_organizacja`, `18_ustawienia` | Memory scope, retention and no-retention tests. |
| `MERGED-P2-003` | `P2` | Enterprise search/connectors | Formalize source freshness, ACL, connector health, no false completeness and external knowledge grounding. | Copilot/Glean/Perplexity inspirations, Chat source gaps. | `platform/ENTERPRISE_SEARCH_CONNECTORS` | Connector capability matrix and source freshness UI evidence. |
| `MERGED-P2-004` | `P2` | Radar intelligence | Build Radar as pre-initiative intelligence: signal -> relevance -> maturity/KPI/role fit -> hype risk -> suggested next step. | Radar RAW 108, MyWork Radar rows. | `02_moja-praca/MW_HOME_RADAR` | Explainability panel and approved handoff/read-back, no hidden initiative write. |
| `MERGED-P2-005` | `P2` | Portfolio rollups | Add portfolio rollups for execution, value, finance and repeated initiative blueprints without averaging away blockers or provenance. | Execution/Results/Finance RAW. | `05_inicjatywy`, `06_realizacja`, `07_rezultaty`, `08_finanse` | Roll-up rows trace down to source objects and expose degraded/missing evidence. |
| `MERGED-P2-006` | `P2` | Collaboration/publishing | Add team-safe sharing, comments, publishing and client-ready collaboration lifecycle across artifacts. | Copilot Pages, Notion workspace, Claude Projects inspiration. | `09_outputs/CLIENT_READY_PACKAGE` | ACL-safe share/publish tests and audit evidence. |
| `MERGED-P2-007` | `P2` | Meeting intelligence | Convert meeting/transcript recap into decisions, tasks, artifacts and initiative candidates with approval and source boundaries. | Teams/Slack meeting-to-action inspiration, Calendar RAW. | `13_meeting/MEETING_INTELLIGENCE` | Transcript/source evidence and task/decision/artifact handoff tests. |
| `MERGED-P2-008` | `P2` | Partner lifecycle | Expand partner portal into onboarding, enablement, deliverables, payouts and operator control. | Partner lifecycle and professional workflow patterns. | `19_portal-partnerski/PARTNER_LIFECYCLE` | Partner route/API tests and tenant/client access gates. |

## 6. Recommended Execution Order

### Wave 0 — Trust And Contract Foundation

1. `MERGED-P0-001`
2. `MERGED-P0-003`
3. `MERGED-P0-004`
4. `MERGED-P0-005`
5. `MERGED-P0-006`

Rationale: these rows prevent hidden writes, unverifiable outputs, duplicated AI controls and source drift.

### Wave 1 — Work Creation Spine

1. `MERGED-P0-002`
2. `MERGED-P0-007`
3. `MERGED-P0-008`
4. `MERGED-P0-010`
5. `MERGED-P0-012`

Rationale: this creates the governed path from conversation/artifact into initiative, task, decision and owner modules.

### Wave 2 — Operating Layer

1. `MERGED-P0-009`
2. `MERGED-P0-011`
3. `MERGED-P1-001`
4. `MERGED-P1-008`
5. `MERGED-P1-012`

Rationale: this makes the application operate as work OS: chat, daily work, execution and results.

### Wave 3 — Consulting Artifact Engines

1. `MERGED-P1-003`
2. `MERGED-P1-004`
3. `MERGED-P1-005`
4. `MERGED-P1-006`
5. `MERGED-P1-007`
6. `MERGED-P1-010`
7. `MERGED-P1-011`

Rationale: whiteboard, table, notebook, process, documents and decks should share the same trust and conversion grammar.

### Wave 4 — Platform And Differentiation

1. `MERGED-P1-013`
2. `MERGED-P1-014`
3. `MERGED-P1-015`
4. `MERGED-P2-002`
5. `MERGED-P2-003`
6. `MERGED-P2-004`
7. `MERGED-P2-005`

Rationale: finance, integrations, admin, memory, enterprise search, radar and rollups compound value after the trusted work spine exists.

## 7. Duplicate Merge Map

| Duplicate / overlapping theme | Merge target rows | Rule |
| --- | --- | --- |
| Chat Canvas, Workbench, ArtifactRun, side workspace | `MERGED-P0-002`, `MERGED-P1-002` | Do not create separate chat/runtime/artifact backlogs without one Canvas owner path. |
| Source refs, initiative source envelope, whiteboard evidence pack, report source trust | `MERGED-P0-003`, `MERGED-P0-006` | Use one source envelope plus one visible trust taxonomy. |
| AI approval, diff, rollback, manager actions, rollout rebaseline | `MERGED-P0-004`, `MERGED-P0-009` | High-impact mutation has one shared approval/read-back grammar. |
| Menu 3 issues across modules | `MERGED-P0-005` | Treat as shared UI gate, not local polish. |
| Create Initiative from chat/tools/interview/finance/results/MyWork | `MERGED-P0-007` | One CTA/payload contract; source modules remain impact-only. |
| Whiteboard facilitation, templates, conversion, memory | `MERGED-P1-003`, `MERGED-P1-004`, `MERGED-P2-001`, `MERGED-P2-002` | Trust/evidence first, workshop intelligence second, catalog/memory later. |
| Outputs/Documents/Tables/Decks trust | `MERGED-P0-010`, `MERGED-P1-010`, `MERGED-P1-011` | Artifact family trust precedes family-specific runtime depth. |
| Results/KPI/Finance/Portfolio value rollups | `MERGED-P1-012`, `MERGED-P1-013`, `MERGED-P2-005` | Value truth stays in Results; Finance calculates; rollups cite source objects. |

## 8. Hard Stops

- Stop if the selected row cannot name one primary `scope_anchor`.
- Stop if the row requires hidden write, hidden approval, hidden learning or silent rebaseline.
- Stop if tenant/project/role boundary is unclear.
- Stop if source/provenance cannot be shown or explicitly marked missing.
- Stop if owner-lane read-back is not possible for a high-impact write.
- Stop if implementation touches 5+ `consultify` files without Drive sync snapshot/re-verification.

## 9. Gate Verdict

- Unified list readiness: `APPROVED_FOR_PLANNING`.
- Runtime readiness: `NOT_AUTHORIZED_BY_THIS_DOC`.
- Owner recommendation: approve this as the single merged implementation intake list, then choose exactly one `MERGED-*` row for the next scoped implementation contract.
