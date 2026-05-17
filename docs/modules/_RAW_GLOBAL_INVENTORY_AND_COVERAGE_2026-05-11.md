---
doc_id: RAW_GLOBAL_INVENTORY_AND_COVERAGE_2026_05_11
doc_kind: GLOBAL_RAW_AUDITOR_PRECHECK
owner: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
runtime_edits: none
---

# RAW Global Inventory And Coverage — 2026-05-11

## 1. Scope

Role: `GLOBAL RAW AUDITOR — PRECHECK`.

Mode: docs-only, no runtime edits.

Goal: create a full RAW inventory and source mapping before module audits.

Hard gates:

- `G1`: every file under `docs/RAW/**` must have exactly one row in this matrix.
- `G2`: every `docs/RAW/**` file must have status `USED`, `IMPACT_ONLY`, or `OUT_OF_SCOPE`.
- `G3`: every `USED` row must map to module, function/scope anchor, contract files, and contract sections.
- `G4`: missing mapping is `FAIL`.

## 2. Mandatory Source Inventory

| Source bucket | Count | Files |
| --- | ---: | --- |
| `docs/RAW/**/*.md` | 18 | See section 3. |
| `docs/UI_UX/*RAW*.md` | 32 | See section 5. |
| `docs/modules/*/RAW_INPUT.md` | 19 | `01_czat`, `02_moja-praca`, `03_wywiad`, `04_narzedzia`, `05_inicjatywy`, `06_realizacja`, `07_rezultaty`, `08_finanse`, `09_outputs`, `10_dokumenty`, `11_tabele`, `12_prezentacje`, `13_meeting`, `14_mcp-iris`, `15_mcp-marketplace`, `16_organizacja`, `17_panel-administratora`, `18_ustawienia`, `19_portal-partnerski`. |
| `docs/modules/*/RAW_TARGET_STATE_2_0_PACKET.md` | 13 | `01_czat`, `02_moja-praca`, `03_wywiad`, `05_inicjatywy`, `06_realizacja`, `07_rezultaty`, `08_finanse`, `09_outputs`, `10_dokumenty`, `11_tabele`, `12_prezentacje`, `17_panel-administratora`, `18_ustawienia`. |
| `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | 1 | System-level requirement-to-runtime traceability matrix. |

### `docs/RAW/**/*.md` File List

1. `docs/RAW/99_RAW_INPUT 2.md`
2. `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md`
3. `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`
4. `docs/RAW/document-studio/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`
5. `docs/RAW/document-studio/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`
6. `docs/RAW/document-studio/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md`
7. `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`
8. `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
9. `docs/RAW/idea-notebook/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md`
10. `docs/RAW/ideas-tables/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`
11. `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`
12. `docs/RAW/presentation-studio/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`
13. `docs/RAW/process-flow/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`
14. `docs/RAW/radar/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md`
15. `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md`
16. `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
17. `docs/RAW/whiteboard/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`
18. `docs/RAW/workbench/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`

## 3. RAW Coverage Matrix

| raw_file | status | mapped_module | mapped_function_or_scope_anchor | mapped_contract_files | mapped_sections | rationale | evidence_or_NOT_DONE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docs/RAW/99_RAW_INPUT 2.md` | `IMPACT_ONLY` | `GLOBAL` | `RAW_INDEX` | `docs/modules/_RAW_COVERAGE_AND_DEPTH_AUDIT_2026-05-11.md`; module packets as applicable | RAW inventory / source-index rows | Global RAW index and author input bundle, not a product lane target by itself. | `PASS_IMPACT_ONLY`: mapped as source index; no direct module function required. |
| `docs/RAW/110_RAW_INTERVIEW_DISCOVERY_ENGINE_2026-05-11.md` | `USED` | `03_wywiad` | `WY_*`; `03_wywiad/MODULE_INTEGRATION` | `docs/modules/03_wywiad/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/03_wywiad/04_UI_UX.md`; `docs/modules/03_wywiad/07_ACCEPTANCE_AND_TESTS.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | packet RAW sources and RAW annex; discovery row in system traceability | Canonical interview/discovery RAW source for discovery, diagnosis, findings, and candidate initiative handoff. | `PASS_WITH_NOT_DONE`: module/function mapping exists; traceability matrix records missing full journey/read-back evidence as `NOT_DONE`. |
| `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md` | `USED` | `02_moja-praca` | `MW_CALENDAR` | `docs/modules/02_moja-praca/function-cards/MW_CALENDAR_EXECUTION_CARD.md`; `docs/modules/_RAW_COVERAGE_AND_DEPTH_AUDIT_2026-05-11.md` | function execution card source list; audit matrix | Calendar/workday orchestration belongs to My Work, but the main `02_moja-praca` packet section `1. RAW Sources` does not list the `docs/RAW/calendar/109...` path. | `FAIL_DIRECT_PACKET_ANCHOR`: partial mapping exists through execution card; primary module packet and function contract anchor are too thin for G3 closure. |
| `docs/RAW/document-studio/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md` | `USED` | `10_dokumenty` | `DOC_*`; `10_dokumenty/MODULE_INTEGRATION` | `docs/modules/10_dokumenty/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/10_dokumenty/03_BEHAVIOR.md`; `docs/modules/10_dokumenty/04_UI_UX.md`; `docs/modules/10_dokumenty/function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` | section `1` source list; behavior table; UI/UX RAW mapping; execution card P0 rows | Document Studio research RAW is primary input for artifact-native document flow, governance, diff/review, and approval-before-export doctrine. | `PASS_WITH_NOT_DONE`: mapped in module 10; mounted runtime proof remains `NOT_DONE` where declared. |
| `docs/RAW/document-studio/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md` | `USED` | `10_dokumenty` | `DOC_*`; `10_dokumenty/MODULE_INTEGRATION` | `docs/modules/10_dokumenty/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/10_dokumenty/03_BEHAVIOR.md`; `docs/modules/10_dokumenty/04_UI_UX.md`; `docs/modules/10_dokumenty/function-cards/DOC_STUDIO_RUNTIME_TARGET_EXECUTION_CARD.md` | section `1` source list; behavior table; UI/UX RAW mapping; execution card P0 rows | Document Studio analysis RAW defines analysis, source lineage, document artifact governance, and placeholder-vs-runtime truthfulness. | `PASS_WITH_NOT_DONE`: mapped in module 10; full route/runtime proof remains `NOT_DONE`. |
| `docs/RAW/document-studio/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md` | `USED` | `10_dokumenty`; impact to `09_outputs` | `DOC_*`; `OUT_*` | `docs/modules/10_dokumenty/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/09_outputs/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/09_outputs/05_DATA_AND_INTEGRATIONS.md` | module 10 section `1`; module 9 source list and data/integration impact rows | Native artifact engine RAW anchors document artifact ownership and output-package handoff. | `PASS_WITH_NOT_DONE`: direct module mapping exists; output-library ownership evidence remains partially `NOT_DONE`. |
| `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md` | `USED` | `06_realizacja` | `RL_*`; `06_realizacja/MODULE_INTEGRATION` | `docs/modules/06_realizacja/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/06_realizacja/04_UI_UX.md`; `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`; `docs/modules/06_realizacja/functions/RL_*.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | RAW depth annex; decision table; execution evidence matrix; system traceability execution row | Primary execution hub RAW for execution portfolio, PMO reports, manager intervention, blockers, and rollout posture. | `PASS_WITH_NOT_DONE`: module/function mapping exists; Menu 3 evidence, missing-evidence guard, manager/rollout approval/read-back remain `NOT_DONE` where declared. |
| `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `USED` | `08_finanse`; impact to `05_inicjatywy` and `07_rezultaty` | `FN_STATEMENTS_WORKSPACE`; `FN_MODELS_WORKSPACE`; `FN_ANALYSIS_WORKSPACE`; `FN_PREDICTION_WORKSPACE`; `FN_VALUATION_WORKSPACE`; `FN_INVESTMENT_WORKSPACE` | `docs/modules/08_finanse/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/08_finanse/functions/FN_*.md`; `docs/modules/05_inicjatywy/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/07_rezultaty/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | module 8 section `1` mandatory RAW baselines; section `3` RAW synthesis; finance function MUST tables; results/finance system traceability row | Finance RAW is canonical for the finance reasoning loop, source lineage, confidence, valuation and investment approval. | `PASS_WITH_CONTRADICTION`: module 8 maps it as mandatory baseline; older `_RAW_COVERAGE_AND_DEPTH_AUDIT_2026-05-11.md` labels it `IMPACT_ONLY`, so global audit canon is inconsistent. |
| `docs/RAW/idea-notebook/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md` | `USED` | `02_moja-praca` | `MW_IDEAS`; `MW_IDEAS_MINDMAP`; ideas family | `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/02_moja-praca/functions/MW_IDEAS*.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | section `1` RAW Sources; sections `11`-`14` idea-family addenda; idea family traceability row | Primary source for idea notebook context, idea workspace, and cross-format handoff. | `PASS_WITH_NOT_DONE`: mapping exists; owner read-back E2E remains `NOT_DONE` in system traceability. |
| `docs/RAW/ideas-tables/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md` | `USED` | `02_moja-praca`; `11_tabele` | `MW_IDEAS_TABLE`; `TB_*` | `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/11_tabele/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/11_tabele/DEEP_RAW_GAP_AUDIT_2026-05-11.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | module 2 section `1`; module 11 section `1.3 RAW Sources`; table coverage matrix | Structured thinking/table RAW is primary for idea-table workspace and module 11 table doctrine. | `PASS_WITH_NOT_DONE`: direct mapping exists; downstream cross-lane read-back evidence remains `NOT_DONE` where declared. |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | `USED` | `06_realizacja` | `RL_*`; `06_realizacja/MODULE_INTEGRATION` | `docs/modules/06_realizacja/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/06_realizacja/04_UI_UX.md`; `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`; `docs/modules/06_realizacja/functions/RL_*.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | RAW depth annex; decision table; execution evidence matrix; system traceability execution row | Implementation PMO RAW is primary for implementation control, PMO governance, interventions, and rollout. | `PASS_WITH_NOT_DONE`: module/function mapping exists; several P1 runtime/UI proof rows remain `NOT_DONE`. |
| `docs/RAW/presentation-studio/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md` | `USED` | `12_prezentacje`; impact to `09_outputs` | `PR_*`; `OUT_DECK_BUILDER`; `OUT_PRESENTATION_WIZARD` | `docs/modules/12_prezentacje/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/12_prezentacje/DEEP_RAW_GAP_AUDIT_2026-05-11.md`; `docs/modules/12_prezentacje/function-cards/PR_GEN_RUNTIME_TARGET_EXECUTION_CARD.md`; `docs/modules/09_outputs/RAW_TARGET_STATE_2_0_PACKET.md` | module 12 source list; deep audit thesis table; presentation runtime card; module 9 source list | Presentation Studio RAW anchors deck/artifact governance, not a simple slide generator, with output package handoff. | `PASS_WITH_CONTRADICTION`: module 12 maps it as primary; older `_RAW_COVERAGE_AND_DEPTH_AUDIT_2026-05-11.md` labels it `OUT_OF_SCOPE`. |
| `docs/RAW/process-flow/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md` | `USED` | `02_moja-praca` | `MW_IDEAS_PROCESS_FLOW`; ideas family | `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/02_moja-praca/functions/MW_IDEAS*.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | section `1` RAW Sources; section `14`; idea family traceability row | Process-flow RAW drives the process-flow format inside My Work ideas. | `PASS_WITH_NOT_DONE`: mapping exists; format-specific read-back remains partially `NOT_DONE`. |
| `docs/RAW/radar/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md` | `USED` | `02_moja-praca` | `MW_HOME_RADAR` | `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/02_moja-praca/04_UI_UX.md`; `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`; `docs/modules/02_moja-praca/functions/MW_HOME_RADAR.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | section `1` RAW Sources; RAW extraction sections; decision table; acceptance/gap matrix | Radar RAW anchors pre-initiative intelligence and My Work radar surface. | `PASS_WITH_NOT_DONE`: module/function mapping exists; E2E read-back remains `NOT_DONE` where declared. |
| `docs/RAW/results/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` | `USED` | `07_rezultaty`; impact to `05_inicjatywy`, `06_realizacja`, `08_finanse` | `RZ_*`; `07_rezultaty/MODULE_INTEGRATION` | `docs/modules/07_rezultaty/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`; `docs/modules/07_rezultaty/functions/RZ_*.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | RAW hard gate coverage; function map; results/finance system traceability row | Results RAW is primary for value realization, KPI, ROI, benefit evidence, and executive result reporting. | `PASS_WITH_NOT_DONE`: module mapping exists; P1/P2 results evidence remains `NOT_DONE` where declared. |
| `docs/RAW/teresa-chat/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `USED` | `01_czat`; impact to `09_outputs`, `10_dokumenty`, `11_tabele`, `12_prezentacje` | `CZ_CHAT_ENGINE`; `CZ_CANVAS_WORKSPACE` | `docs/modules/01_czat/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/01_czat/07_ACCEPTANCE_AND_TESTS.md`; `docs/modules/01_czat/functions/CZ_CHAT_ENGINE.md`; `docs/modules/01_czat/functions/CZ_CANVAS_WORKSPACE.md`; impact rows in artifact modules | module 1 RAW sources and canvas decision table, but source list cites `docs/UI_UX/104...`; artifact modules cite Teresa as impact-only | Teresa RAW is canonical for conversational work OS, chat/canvas governance, approval discipline, source trust, and owner-lane handoff. | `FAIL_DIRECT_RAW_PATH`: semantic mapping exists, but primary module 1 packet section `1. RAW Sources` lists the `docs/UI_UX/104...` alias and not the `docs/RAW/teresa-chat/104...` file required by this precheck. |
| `docs/RAW/whiteboard/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md` | `USED` | `02_moja-praca` | `MW_IDEAS_WHITEBOARD`; ideas family | `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/02_moja-praca/functions/MW_IDEAS*.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | section `1` RAW Sources; section `13`; idea family traceability row | Whiteboard RAW drives the collaborative whiteboard format inside My Work ideas. | `PASS_WITH_NOT_DONE`: mapping exists; format-specific read-back remains partially `NOT_DONE`. |
| `docs/RAW/workbench/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md` | `USED` | `02_moja-praca`; impact to `11_tabele` | `MW_IDEAS`; ideas family; `TB_*` impact-only | `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/02_moja-praca/functions/MW_IDEAS*.md`; `docs/modules/11_tabele/RAW_TARGET_STATE_2_0_PACKET.md`; `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` | module 2 section `1`; module 11 section `1.3` impact-only matrix; idea family traceability row | Workbench RAW anchors side-workspace, dual-pane review, and artifact lifecycle posture. | `PASS_WITH_NOT_DONE`: direct My Work mapping exists; table impact is explicitly impact-only. |

## 4. Gate Results

| Gate | Result | Evidence |
| --- | --- | --- |
| `G1` every `docs/RAW/**` file has one row | `PASS` | Section 3 contains 18 rows for 18 discovered files. |
| `G2` every row has allowed status | `PASS` | All section 3 rows use `USED` or `IMPACT_ONLY`; no unclassified row remains. |
| `G3` every `USED` row maps to module + function/scope + contract files + contract sections | `FAIL` | `docs/RAW/calendar/109...` is not anchored in the primary `02_moja-praca` packet section `1`; `docs/RAW/teresa-chat/104...` is represented in `01_czat` through the `docs/UI_UX/104...` alias rather than direct `docs/RAW` path. |
| `G4` no mapping missing | `FAIL` | No total orphan exists, but direct per-file mapping is incomplete for two `USED` rows, and global audit canon has contradictions for finance/document/presentation status. |

RAW_COVERAGE_COMPLETE = `NO`

Final gate: `NO_GO`

## 5. `docs/UI_UX/*RAW*.md` Duplicate Detection

### Inventory

`docs/UI_UX/*RAW*.md` contains 32 files:

- 15 base RAW UI/UX files: `92`, `93`, `94`, `95`, `96`, `97`, `98`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, `108`.
- 15 duplicate-suffixed files with ` 2.md`: `92`, `93`, `94`, `95`, `96`, `97`, `98`, `101`, `102`, `103`, `104`, `105`, `106`, `107`, `108`.
- 1 calendar base file: `109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md`.
- 1 index-style file: `99_RAW_INPUT 2.md`.

### Duplicate Pairs

| Base file | Duplicate file | Policy |
| --- | --- | --- |
| `docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md` | `docs/UI_UX/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md` | `docs/UI_UX/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md` | `docs/UI_UX/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md` | `docs/UI_UX/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md` | `docs/UI_UX/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09.md` | `docs/UI_UX/97_RAW_IDEA_NOTEBOOK_CONTEXT_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md` | `docs/UI_UX/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md` | `docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md` | `docs/UI_UX/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md` | `docs/UI_UX/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09.md` | `docs/UI_UX/105_RAW_RESULTS_VALUE_REALIZATION_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | `docs/UI_UX/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |
| `docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09.md` | `docs/UI_UX/108_RAW_RADAR_TECHNOLOGY_TRANSFORMATION_INTELLIGENCE_2026-05-09 2.md` | Base file is canonical unless a module contract explicitly cites the ` 2.md` variant. |

### Asymmetric RAW UI/UX Sources

| File | Finding | Policy |
| --- | --- | --- |
| `docs/UI_UX/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md` | No ` 2.md` duplicate found. | Base file is canonical; module 2 still needs a direct packet anchor for `docs/RAW/calendar/109...`. |
| `docs/UI_UX/99_RAW_INPUT 2.md` | No base `docs/UI_UX/99_RAW_INPUT.md` found; mirrors `docs/RAW/99_RAW_INPUT 2.md` naming. | Treat as non-canonical index mirror until a base canonical index is created or explicitly declared. |

### Canonical Source Policy

1. For global RAW coverage gates, `docs/RAW/**/*.md` is canonical because G1-G4 are defined over `docs/RAW/**`.
2. For UI/UX-specific doctrine, the unsuffixed `docs/UI_UX/*RAW*.md` file is canonical when a matching ` 2.md` duplicate exists.
3. `docs/UI_UX/* 2.md` files are duplicate mirrors and must not be used as primary contract sources unless a module contract explicitly cites them and records why.
4. When a module packet cites `docs/UI_UX/...` but the corresponding `docs/RAW/...` file exists, the module packet should list both or declare the alias relationship in its RAW source section.
5. `docs/modules/SYSTEM_TRACEABILITY_MATRIX.md` remains system traceability, not a replacement for per-file RAW source rows.

## 6. Blind Spots

| Blind spot | Impact | Required closure before module audits |
| --- | --- | --- |
| `docs/RAW/teresa-chat/104...` is not directly listed in `docs/modules/01_czat/RAW_TARGET_STATE_2_0_PACKET.md` section `1. RAW Sources`; the packet lists `docs/UI_UX/104...`. | Fails strict `docs/RAW/**` direct-path traceability for the primary chat module. | Add direct `docs/RAW/teresa-chat/104...` source row or an explicit alias declaration in module 1 contract. |
| `docs/RAW/calendar/109...` is absent from `docs/modules/02_moja-praca/RAW_TARGET_STATE_2_0_PACKET.md` section `1. RAW Sources`; calendar is only thinly anchored through execution-card/audit material. | Fails deep G3 closure for `MW_CALENDAR`. | Add calendar RAW to module 2 packet and bind it to `MW_CALENDAR` function contract sections. |
| `_RAW_COVERAGE_AND_DEPTH_AUDIT_2026-05-11.md` says `RAW_TARGET_STATE_2_0_PACKET.md` count is `7`; actual inventory is `13`. | Existing audit count is stale and cannot be used as global SSOT without reconciliation. | Update or supersede the older audit after this precheck. |
| `_RAW_COVERAGE_AND_DEPTH_AUDIT_2026-05-11.md` marks finance/document/presentation RAW rows as `IMPACT_ONLY` or `OUT_OF_SCOPE` despite module 8/10/12 packets using them as primary sources. | Conflicting status canon creates audit ambiguity. | Align statuses with the latest module packets or mark the old audit as superseded. |
| `docs/modules/*/RAW_INPUT.md` files are mostly module-local shells or migrated inputs rather than active per-file RAW traceability sources. | They cannot prove per-file coverage for `docs/RAW/**`. | Module audits must use RAW target packets/function contracts, not RAW_INPUT alone. |
| Modules `04_narzedzia`, `13_meeting`, `14_mcp-iris`, `15_mcp-marketplace`, `16_organizacja`, and `19_portal-partnerski` have `RAW_INPUT.md` but no `RAW_TARGET_STATE_2_0_PACKET.md`. | Later module audits lack a packet-level target-state anchor. | Create packet or explicitly defer these modules before claiming global module readiness. |

## 7. Final

RAW_COVERAGE_COMPLETE = `NO`

Result: `NO_GO`

Reason: `docs/RAW/**` inventory is complete at 18/18 rows, but strict direct-path mapping is not complete for `104` and `109`, and existing global audit status/counts conflict with newer module packets.
