---
module_id: MODULE_FINANCE
function_id: FN_VALUATION_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — FN_VALUATION_WORKSPACE

## 1. Metadata

- scope_anchor: `08_finanse/FN_VALUATION_WORKSPACE`
- primary_module: `08_finanse`
- primary_function: `FN_VALUATION_WORKSPACE`
- work_type: `docs-only`

## 2. Scope Anchor

- in scope: `functions/FN_VALUATION_WORKSPACE.md`, `IMPLEMENTATION_TASK_BOARD.md`, this execution card
- out of scope: runtime/API/component edits and other finance functions as primary scope
- forbidden: cross-module primary changes; hidden runtime mutations

## 3. Source Inputs

- `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md`
- `docs/modules/08_finanse/RAW_INPUT.md`
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/modules/08_finanse/functions/FN_VALUATION_WORKSPACE.md`
- `docs/modules/08_finanse/04_UI_UX.md`
- `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/08_finanse/IMPLEMENTATION_TASK_BOARD.md`

## 4. Phase 2 RAW Synthesis (A: must/should/out)

| Class | Requirement | Task linkage | RAW source reference |
| --- | --- | --- | --- |
| `MUST` | assumptions envelope is explicit (`owner/source/confidence/status`) before valuation trust | `FN-VLU-P0-001` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12, req 966-971) |
| `MUST` | valuation claims are source-backed with lineage and confidence | `FN-VLU-P1-001` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine; req 1048-1049) |
| `MUST` | explicit review/approval before final claim/export | `FN-VLU-P1-001` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, req 1024) |
| `SHOULD` | valuation-specific route/component/API/test evidence matrix | `FN-VLU-P2-001` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (valuation addendum, known evidence gap) |
| `OUT` | runtime implementation and automated test delivery in this pass | n/a | `docs/modules/08_finanse/RAW_INPUT.md` (baseline migrated; this phase is docs-only) |

## 5. As-Is vs Target vs Delta (B) + Decision Table (C)

| Topic | As-Is | Target | Delta | Decision | Rationale | RAW source reference |
| --- | --- | --- | --- | --- | --- | --- |
| assumptions transparency | assumptions exist but are not normalized per valuation claim | explicit assumptions envelope for each valuation claim/output | inconsistent normalization | `ENHANCE` | remove ambiguity before decision-grade usage | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12; req 966-971), `docs/product/FINANCIAL_ANALYSIS_V3.md` (2.5.3) |
| provenance and source backing | provenance doctrine exists at module level | valuation-level lineage from model snapshot to claim | claim-level mapping partial | `NEW` | enforce auditable valuation chain | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine; req 1048-1049), `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` (Valuation View doctrine) |
| review before final claim/export | explicit actions exist but gate is distributed | centralized explicit review/approval before final claim/export | checkpoint wording fragmented | `ENHANCE` | prevent non-approved outputs from being treated as final truth | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, req 1024), `docs/product/FINANCIAL_ANALYSIS_V3.md` (Valuation status flow) |
| Menu 3 placement | already governed in module UX | right-side command-row/no canvas duplication | no contradiction | `KEEP` | policy is already aligned | `docs/modules/08_finanse/04_UI_UX.md` (Menu 3 + AI placement) |
| dedicated valuation matrix | valuation evidence remains partially linked | dedicated function-level route/component/API/test matrix | dedicated matrix missing | `DEFER` | keep unresolved probes explicit as `NOT_DONE` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (valuation addendum) |

## 6. Evidence Mapping (D)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status | RAW source reference |
| --- | --- | --- | --- | --- | --- | --- |
| valuation assumptions are explicit | valuation route/tab is mounted in finance runtime | valuation UI requires assumptions envelope visibility | assumptions metadata is part of valuation payload contract | valuation-only assumption probe missing | `PASS_WITH_P1` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 12, req 966-971) |
| valuation output is source-backed | valuation runtime entry is explicit | valuation summary/memo requires source confidence markers | lineage/provenance boundary is required | valuation-only provenance probe missing | `PASS_WITH_P1` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Company Valuation Engine; req 1048-1049) |
| explicit review gate before final claim/export | valuation actions are user-triggered | review/approval checkpoint documented before export/final claim | approval-status boundary is required | valuation-only export-gate probe missing | `PASS_WITH_P1` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (Workflow 26, Workflow 28, req 1024) |
| dedicated valuation matrix exists | n/a | n/a | n/a | dedicated suite unresolved | `NOT_DONE` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (valuation addendum) |

## 7. Task Rows (E)

| Task ID | Priority | Scope | Status | Definition |
| --- | --- | --- | --- | --- |
| `FN-VLU-P0-001` | `P0` | assumptions envelope normalization | `READY` | every valuation claim uses explicit assumptions envelope with RAW-backed requirement chain |
| `FN-VLU-P1-001` | `P1` | provenance + explicit review gate normalization | `WAITING_P0` | valuation claim lineage and pre-export approval checkpoint are normalized with references |
| `FN-VLU-P2-001` | `P2` | dedicated valuation route/component/API/test evidence matrix | `WAITING_P0` | unresolved probes remain explicit as `NOT_DONE` until evidence appears |

## 8. Final Outcome Gate

- hard-gate check (`no new thesis without RAW source reference`): `PASS`
- docs verdict: `APPROVED_FOR_DOCS`
- runtime/test hold: `BLOCKED_P1` (`FN-VLU-P2-001`)
- owner decision required: `NO`
