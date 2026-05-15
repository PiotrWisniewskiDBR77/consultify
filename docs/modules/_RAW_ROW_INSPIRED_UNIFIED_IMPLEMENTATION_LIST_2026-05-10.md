---
doc_id: RAW_ROW_INSPIRED_UNIFIED_IMPLEMENTATION_LIST_2026_05_10
doc_kind: UNIFIED_IMPLEMENTATION_LIST
owner: user
status: draft_for_review
last_updated: 2026-05-10
---

# RAW / ROW Inspired Unified Implementation List

## 1. Purpose

This document turns inspiration from RAW / ROW source files into one implementation list that can be merged with the current gap backlog.

It is not a runtime authorization. Every row still needs the normal contract, scope anchor, evidence and approval gates before implementation.

## 2. Sources Used

Primary RAW / ROW sources:

- `docs/RAW/**/*.md`
- `docs/UI_UX/*_RAW_*.md`
- `docs/modules/*/RAW_INPUT.md`
- `docs/modules/*/RAW_TARGET_STATE_2_0_PACKET.md`
- `docs/modules/_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`
- `docs/modules/_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`

Current gap and backlog sources:

- `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md`
- `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/05_inicjatywy/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/05_inicjatywy/INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS.md`
- `docs/modules/02_moja-praca/WHITEBOARD_RAW_GAP_ANALYSIS_AND_ROADMAP.md`
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Merge Rules

- One implementation row must map to one primary `scope_anchor`.
- Cross-module impact is dependency only, unless owner approves a broader module contract.
- Existing Wave IDs must not be reused without prefixing, because Wave 1 and Wave 2 both use `P0-01`, `P1-01`, etc.
- `POST_V81_*` items are historical unless revalidated against current contracts.
- RAW inspiration does not bypass the RAW Conversion Gate in `SYSTEM_TRACEABILITY_MATRIX.md`.
- P0 closes trust, governance, source truth and believable E2E. P1 expands product capability. P2 adds parity, polish and breadth.
- High-impact actions follow `proposal -> approval -> execution -> audit`.
- No row is `DONE` without route/component/API/test evidence or an accepted `DEFERRED_P2` decision.

## 4. Unified Implementation List

| Unified ID | Priority | Target scope anchor | Inspiration to transfer | Current gap/backlog to merge with | Type | Required evidence gate | Dependencies / notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RAW-UNI-P0-001` | `P0` | `global/TRACEABILITY_AND_SOURCE_ENVELOPE` | One source envelope for every critical object: chat, idea, interview, finance, KPI, import and manual exception. | `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS`; `SYSTEM_TRACEABILITY_MATRIX`; Wave 2 provenance/review gap. | governance / data contract | Traceability row; owner object; API/source envelope contract; test for accepted/rejected/missing evidence. | Must resolve conflict with narrow `SOURCE_TRACEABILITY_SPEC` before runtime expansion. |
| `RAW-UNI-P0-002` | `P0` | `01_czat/CZ_CANVAS_WORKSPACE` | Conversation -> artifact -> decision -> task -> execution -> report as one work chain. | Wave 2 `ArtifactRun z czatu`; `01_czat/RAW_TARGET_STATE_2_0_PACKET.md`. | feature / workflow | Route/component/API/test for plan, draft, review, approve, export/materialize and rerun. | AI cannot silently create durable objects. |
| `RAW-UNI-P0-003` | `P0` | `01_czat/CZ_CANVAS_WORKSPACE` | Workbench split UI with artifact lifecycle: draft, edit, diff, approve, export, execution handoff. | Wave 2 artifact trust-state baseline; Chat Canvas P0 startup gap. | UX / artifact governance | Component evidence for split workbench; diff/approval test; source refs and missing-input labels. | Align with Menu 3 and no duplicate AI toolbar. |
| `RAW-UNI-P0-004` | `P0` | `02_moja-praca/MW_HOME_RADAR` | Radar as company/role/KPI-aware signal intelligence with confidence, freshness and hype-risk labels. | Wave 1 Radar decision-support gap; `MW-RADAR-P0-*`. | feature / AI behavior | Radar route/component evidence; source/confidence/freshness UI; handoff read-back test. | Radar recommends and handoffs; it must not mutate canonical initiative/execution truth. |
| `RAW-UNI-P0-005` | `P0` | `02_moja-praca/MW_IDEAS` | Idea family integration: notebook, table, map, flow and whiteboard transform into candidates with source refs. | `02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; owner read-back `code_gap`; Wave 1 idea tool gaps. | governance / workflow | Cross-tool transform tests; owner module read-back e2e; sourceRefs preserved. | Merge duplicate idea-family rows under one owner evidence model. |
| `RAW-UNI-P0-006` | `P0` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | Whiteboard outcome evidence pack, AI QA labels and owner read-back before conversion success. | `WHITEBOARD_RAW_GAP_ANALYSIS_AND_ROADMAP.md`; Wave 1 Whiteboard facilitation gap; `MW-WB-P0-*`. | governance / testing | Evidence pack schema; QA labels; whiteboard -> owner read-back e2e; Menu 3 placement evidence. | Must close before workshop intelligence P1. |
| `RAW-UNI-P0-007` | `P0` | `05_inicjatywy/MODULE_INTEGRATION` | Initiative transfer backbone: source evidence -> candidate -> validation sheet -> approved initiative -> tasks/decisions/RAID/milestones -> execution -> KPI/ROI. | `INITIATIVE_TRANSFER_BACKBONE_GAP_ANALYSIS`; Wave 1 Initiative write-family gap; `IN-INT-P0-*`. | governance / workflow | Source envelope contract; initiative validation sheet evidence; duplicate/merge policy; acceptance/read-back tests. | Blocks broad source-to-initiative generators. |
| `RAW-UNI-P0-008` | `P0` | `05_inicjatywy/IN_ANALYSIS_WORKSPACE` | Analysis cockpit readiness: workload/resources, feasibility, logic/dependencies, timeline, completeness and degraded states. | `05_inicjatywy/RAW_TARGET_STATE_2_0_PACKET.md`; `IN-ANL-P0-*`; traceability NOT_DONE UI tests. | feature / UX / testing | Route `/initiatives`; five subview component evidence; readiness APIs; loading/empty/error/degraded/success tests. | Product naming decision needed for `workload` vs `resources`. |
| `RAW-UNI-P0-009` | `P0` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | One execution truth for Portfolio, Reports, Manager and Rollout; no second task manager. | Wave 1 execution write continuity gap; `06_realizacja` contracts. | governance / runtime continuity | Route/component/API/test matrix for shared execution writes and read-back. | Must preserve tenant/ACL and no hidden writes. |
| `RAW-UNI-P0-010` | `P0` | `06_realizacja/RL_ROLLOUT_VIEW` | Baseline -> current reality -> forecast -> intervention -> updated credible path. | `RL_ROLLOUT_VIEW` docs closeout; on-time delivery V8 doctrine. | feature / governance | Route/component/API/test for baseline, forecast confidence, conflict and degraded/partial data states. | High-impact auto-schedule/rebaseline/conflict actions require explicit review. |
| `RAW-UNI-P0-011` | `P0` | `07_rezultaty/RZ_VALUE_REALIZATION` | Results as value loop: initiative -> KPI -> baseline/target/actual -> deviation -> corrective action -> verified ROI. | Wave 1 KPI+Finance fragmented truth gap; Results RAW. | feature / governance | KPI baseline/target/actual API evidence; corrective-action handoff; ROI evidence test. | Must not be only a dashboard. |
| `RAW-UNI-P0-012` | `P0` | `08_finanse/FN_FINANCE_INTELLIGENCE` | Finance truth with assumptions, reconciliation, variance explanation and links to ROI/results. | Wave 1 KPI+Finance runtime unification; Wave 1 Finance mutation parity. | feature / governance | Finance model/source evidence; assumptions provenance; variance tests; link to results/initiative. | Avoid duplicating KPI truth. |
| `RAW-UNI-P0-013` | `P0` | `09_outputs/ARTIFACT_FAMILY` | One artifact trust grammar: provenance, review state, visibility, export audit and reopen/reuse semantics. | Wave 2 provenance/review/visibility; Outputs Library taxonomy. | governance / artifact runtime | Trust badge/panel evidence across library and source-object surfaces; export audit tests. | Some Wave 2 rows are partly closed; revalidate before adding runtime work. |
| `RAW-UNI-P0-014` | `P0` | `16_organizacja/ORG_CONTEXT` | Organization as canonical tenant context reused by all modules. | Wave 2 Organization, Settings, Admin gaps. | governance / platform | Tenant identity contract; deny-by-default tests; route/API references for org context usage. | Required before broad admin/settings hardening. |
| `RAW-UNI-P0-015` | `P0` | `global/EVIDENCE_AND_MENU3_GATE` | All contextual AI actions live in Menu 3/right-side or accepted row-scoped actions; all critical claims bind route/component/API/test. | UI governance rules; multiple module UI gate gaps. | evidence / UX governance | UI smoke or component tests for placement; traceability row for each critical claim. | Apply before declaring runtime done for AI-heavy modules. |
| `RAW-UNI-P1-001` | `P1` | `02_moja-praca/MW_CALENDAR` | AI workday/project calendar: external sync, prep/follow-up, conflict detection and overload scoring. | Wave 1 Calendar external parity; `MW-CAL-P1-*`. | feature / workflow | Provider sync lifecycle evidence; conflict/overload API; meeting prep/follow-up tests. | P0 calendar docs rows exist; runtime parity still needs validation. |
| `RAW-UNI-P1-002` | `P1` | `02_moja-praca/MW_NOTEBOOK` | Notebook as context engine: capture, enrichment, linking and conversion into idea/initiative/output. | Wave 1 Notebook adjunct breadth; `MW-NB-P1-*`. | feature / workflow | Note sourceRefs; attachment/upload evidence; conversion read-back tests. | Depends on source envelope and owner read-back model. |
| `RAW-UNI-P1-003` | `P1` | `02_moja-praca/MW_IDEAS_TABLE` | Structured thinking tables: scoring, decision rows, owner fields, provenance per field/row. | Wave 1 Table relational grammar; `MW-TABLE-P1-*`. | feature / governance | Table field provenance; scoring tests; conversion to initiative/task with read-back. | Not a mini-Excel; align with artifact/table lane. |
| `RAW-UNI-P1-004` | `P1` | `02_moja-praca/MW_IDEAS_PROCESS_FLOW` | Process flow as data and diagnosis: versions, AI analysis and conversion to SOP/initiative/task. | Wave 1 Process flow semantic depth; `MW-FLOW-P1-*`. | feature / AI behavior | Flow schema/version test; diagnosis evidence; conversion mapping and approval. | P1 after idea-family transform proof. |
| `RAW-UNI-P1-005` | `P1` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | Workshop OS: agenda, phases, facilitator controls, private/reveal, voting and summary closure. | Whiteboard roadmap P1; Wave 1 Whiteboard facilitation. | feature / UX | Workshop session component tests; role/degraded state evidence; summary artifact output. | Requires `RAW-UNI-P0-006`. |
| `RAW-UNI-P1-006` | `P1` | `03_wywiad/WY_INSIGHTS` | Interview insights as structured action artifacts with create/link/handoff to initiatives. | Wave 1 Interview insight structure; `03_wywiad` task board. | feature / workflow | Insight source evidence; handoff/read-back route/API/test; rejected/deferred states. | Must keep interview source ownership clear. |
| `RAW-UNI-P1-007` | `P1` | `05_inicjatywy/MODULE_INTEGRATION` | Smart initiative generators for tools, assessment and interview, supporting 0..N candidates. | Backbone generator contract gaps; `IN-INT-P1/P2` policy rows. | feature / governance | Generator run audit; candidate quality score; dedupe/merge; human acceptance tests. | Requires source envelope decision from `RAW-UNI-P0-001`. |
| `RAW-UNI-P1-008` | `P1` | `06_realizacja/RL_EXECUTION_MANAGER` | Manager cockpit for decisions, blockers, action queue, workload, risk and people/change with source provenance. | Manager lane evidence gaps; PMO RAW. | feature / workflow | Manager lane component tests; action approval/read-back; provenance UI evidence. | High-impact manager actions need explicit diff/approval. |
| `RAW-UNI-P1-009` | `P1` | `06_realizacja/RL_EXECUTION_REPORTS` | PMO reports disclose source lineage or `missing_evidence`, not clean success without proof. | PMO RAW; execution report source/provenance gaps. | governance / artifact | Report generation test with source refs and missing evidence; export audit. | Align with Outputs artifact trust grammar. |
| `RAW-UNI-P1-010` | `P1` | `10_dokumenty/DOC_STUDIO` | Document artifact engine: schema, source pack, missing inputs, narrative planner, QA layer and DOCX/PDF audit. | Wave 2 Document artifact-family closure; Document RAW. | feature / artifact governance | Document schema/source pack tests; missing-input UI; export audit evidence. | Depends on artifact trust grammar. |
| `RAW-UNI-P1-011` | `P1` | `12_prezentacje/PR_DECK_STUDIO` | Gamma-class deck artifact: source per thesis, convert-to-deck, diff/approval and PPTX delivery. | Wave 2 Presentation continuity; Presentation RAW. | feature / UX / artifact | Deck continuation/review tests; source-per-claim evidence; PPTX export audit. | Depends on artifact trust grammar. |
| `RAW-UNI-P1-012` | `P1` | `14_mcp-iris/MCP_CONTROL_PLANE` | Connector execution reports, capability listings and safe marketplace-style install/usage flow. | Wave 2 sync/tools/admin gaps; MCP RAW_INPUT lanes. | platform / integration | Connector lifecycle tests; permission/tenant gates; evidence for degraded connector states. | Must not expose secrets in UI/logs. |
| `RAW-UNI-P1-013` | `P1` | `17_panel-administratora/ADM_OPERATOR_COCKPIT` | Tenant admin as one operator cockpit, not collected fragments. | Wave 2 Admin and Superadmin gaps. | platform / governance | Admin route/API test; policy ownership; audit evidence for high-impact mutations. | Depends on org/settings taxonomy. |
| `RAW-UNI-P2-001` | `P2` | `01_czat/CZ_CHAT_ENGINE` | Project instructions, shared project chat, agent run plan, versioning/diff/rollback and knowledge lifecycle. | Chat RAW market parity; Wave 2 AI OS product identity. | feature / AI OS | Project context tests; run-plan UI; rollback/version evidence. | After P0 artifact lifecycle. |
| `RAW-UNI-P2-002` | `P2` | `02_moja-praca/MW_HOME_RADAR` | Radar explainability, downstream action continuity and portfolio signal drill-down. | Wave 1 Radar P2 explainability. | UX / AI behavior | Explainability panel; accepted/rejected recommendation evidence; downstream read-back. | After Radar decision-support P0. |
| `RAW-UNI-P2-003` | `P2` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | Template catalog and strategy canvases: BMC, VPC, transformation, AI adoption, risk and opportunity boards. | Whiteboard roadmap P2; Wave 1 Whiteboard templates/library. | feature / content system | Template registry tests; import/export consistency; template quality rules. | After workshop OS. |
| `RAW-UNI-P2-004` | `P2` | `02_moja-praca/MW_IDEAS_WHITEBOARD` | Whiteboard memory packs and searchable workshop history with retention metadata. | Whiteboard RAW memory gap. | feature / knowledge lifecycle | Memory pack schema; tenant-safe search; retention tests. | Needs org/data governance. |
| `RAW-UNI-P2-005` | `P2` | `02_moja-praca/MW_IDEAS_MINDMAP` | Mind map interaction calmness, collaboration confidence and AI sidekick polish. | Wave 1 Mind map P1/P2 gaps. | UX / collaboration | Interaction regression; branch-work state evidence; AI sidekick placement test. | Do not mix with Daily Ops scope. |
| `RAW-UNI-P2-006` | `P2` | `08_finanse/FN_FINANCE_INTELLIGENCE` | Statements, models, scenario/valuation breadth and reconciliation maturity. | Wave 1 Finance P2; Finance RAW. | feature / parity | Statement import/model tests; valuation scenario evidence; reconciliation audit. | Follows finance/result truth P0. |
| `RAW-UNI-P2-007` | `P2` | `09_outputs/ARTIFACT_FAMILY` | Report -> Presentation promotion as visible deterministic workflow. | Wave 2 P2 promotion flow. | artifact workflow | Promotion diff/preview; source lineage preserved; presentation read-back. | Requires artifact trust grammar. |
| `RAW-UNI-P2-008` | `P2` | `13_meeting/ME_MEETING_INTELLIGENCE` | Meeting recap -> artifacts, decisions, tasks and initiative candidates. | Chat RAW market parity; Calendar RAW meeting prep/follow-up. | feature / workflow | Transcript/source evidence; recap artifact; task/decision/initiative handoff tests. | Must respect participant/tenant data boundaries. |
| `RAW-UNI-P2-009` | `P2` | `18_ustawienia/SET_TAXONOMY` | One settings taxonomy for user, tenant, module and platform controls. | Wave 2 Settings taxonomy. | platform / governance | Settings ownership matrix; route/API tests for high-impact settings; audit evidence. | Depends on Organization canon. |
| `RAW-UNI-P2-010` | `P2` | `19_portal-partnerski/PART_LIFECYCLE` | Partner lifecycle: onboarding, enablement, deliverables, payouts and operator control. | Wave 2 Partner lifecycle; Wave 1 context appendix. | feature / ecosystem | Partner route/API tests; statement source evidence; tenant/client access gates. | Revalidate partner scope before runtime work. |

## 5. Recommended Execution Order

1. Close global trust foundations:
   - `RAW-UNI-P0-001`
   - `RAW-UNI-P0-013`
   - `RAW-UNI-P0-015`
   - `RAW-UNI-P0-014`
2. Close the work creation spine:
   - `RAW-UNI-P0-002`
   - `RAW-UNI-P0-003`
   - `RAW-UNI-P0-005`
   - `RAW-UNI-P0-007`
3. Close operating surfaces that make the spine credible:
   - `RAW-UNI-P0-004`
   - `RAW-UNI-P0-008`
   - `RAW-UNI-P0-009`
   - `RAW-UNI-P0-010`
   - `RAW-UNI-P0-011`
   - `RAW-UNI-P0-012`
4. Start P1 capability expansion only after relevant P0 rows have evidence.
5. Treat P2 as parity/polish unless owner explicitly upgrades a row because it blocks a signed delivery.

## 6. Duplicate Merge Map

| Duplicate theme | Merge target | Do not duplicate as |
| --- | --- | --- |
| Whiteboard facilitation, templates, conversion and memory | `RAW-UNI-P0-006`, `RAW-UNI-P1-005`, `RAW-UNI-P2-003`, `RAW-UNI-P2-004` | Separate Wave 1 + module-board + RAW rows without one whiteboard owner evidence chain. |
| Initiative transfer, source envelope and generators | `RAW-UNI-P0-001`, `RAW-UNI-P0-007`, `RAW-UNI-P1-007` | Separate Tools/Assessment/Interview/Chat CTA work without shared source envelope. |
| Artifact trust, outputs, documents and presentations | `RAW-UNI-P0-013`, `RAW-UNI-P1-010`, `RAW-UNI-P1-011`, `RAW-UNI-P2-007` | Independent document/deck/export trust semantics. |
| Execution write continuity, rollout forecast and PMO reports | `RAW-UNI-P0-009`, `RAW-UNI-P0-010`, `RAW-UNI-P1-008`, `RAW-UNI-P1-009` | Separate execution submodule writes without one shared approval/read-back rule. |
| KPI, ROI and finance consequence management | `RAW-UNI-P0-011`, `RAW-UNI-P0-012`, `RAW-UNI-P2-006` | Dashboard-only KPI or finance-only forecast work without value loop. |
| Calendar, meeting and workday orchestration | `RAW-UNI-P1-001`, `RAW-UNI-P2-008` | Smart calendar work that cannot create governed tasks/decisions/artifacts. |

## 7. Gate Verdict

Current verdict: `READY_FOR_OWNER_REVIEW`.

Runtime verdict: `NO_GO_RUNTIME`.

Reason: this document is a consolidated implementation list. Runtime work requires selecting one row, locking one `scope_anchor`, completing the module/function contract inputs and producing route/component/API/test evidence.

## 8. Open Risks

- Some current backlog items are historical or already partly closed; revalidate before adding runtime work.
- Source envelope doctrine must be resolved before broad initiative generators and CTA work.
- UI Menu 3 compliance appears repeatedly across modules and should be treated as a shared gate, not local polish.
- Existing module boards use local P0/P1/P2 semantics; this document uses unified product priority. Keep both priorities visible when merging.
- Cross-module rows can cause scope drift. Execution agents should receive only one primary scope anchor.
