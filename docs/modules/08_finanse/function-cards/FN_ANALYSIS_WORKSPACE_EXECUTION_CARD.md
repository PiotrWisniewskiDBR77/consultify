---
module_id: MODULE_FINANCE
function_id: FN_ANALYSIS_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — FN_ANALYSIS_WORKSPACE

## 1. Metadata

- scope_anchor: `08_finanse/FN_ANALYSIS_WORKSPACE`
- primary_module: `08_finanse`
- primary_function: `FN_ANALYSIS_WORKSPACE`
- work_type: `docs-only`

## 2. Scope Anchor

- in scope: `functions/FN_ANALYSIS_WORKSPACE.md`, `IMPLEMENTATION_TASK_BOARD.md`, this execution card
- out of scope: runtime/API/component edits and other finance functions as primary scope
- forbidden: cross-module primary changes; hidden runtime mutations

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `03_BEHAVIOR.md` | source reference for runtime behavior assertions | expanding behavior scope to other functions |
| `04_UI_UX.md` | Menu 3 placement and review/approval assertions | introducing new UI scope outside analysis function contract |
| `07_ACCEPTANCE_AND_TESTS.md` | acceptance/test evidence baseline and gap tracking | editing test scope as runtime implementation plan |

## 4. Source Inputs

- `docs/modules/08_finanse/functions/FN_ANALYSIS_WORKSPACE.md`
- `docs/modules/08_finanse/03_BEHAVIOR.md`
- `docs/modules/08_finanse/04_UI_UX.md`
- `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md`
- `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/modules/08_finanse/RAW_INPUT.md`
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
- `docs/modules/ECONOMICS_MODULE.md`

## 5. Decision Matrix (As-Is vs RAW)

| Topic | As-Is | RAW target | Delta | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| explainability in analysis artifacts | analysis runtime exists with global explainability intent | explainability is mandatory per critical claim with evidence context | function-level explainability contract was not explicit enough | `ENHANCE` | align to AI-as-analyst doctrine and auditable interpretation |
| source lineage for analysis claims | provenance is described module-wide | each critical claim has lineage/confidence or explicit `NOT_DONE` | no dedicated claim-level ledger in analysis function docs | `NEW` | close trust gap for high-impact finance claims |
| high-impact approvals | review/approval rules exist globally | explicit human approval checkpoints before final truth use | analysis-specific checkpoint normalization missing | `ENHANCE` | remove ambiguity for CFO-grade outputs |
| no hidden writes | hidden mutation prohibition exists in governance docs | no silent write path for high-impact analysis actions | function-level acceptance wording needed | `ENHANCE` | enforce auditable user-confirmed flow |
| decision readiness before final business truth use | explicit-review doctrine exists at module level | high-impact analysis requires explicit review checkpoint before final use | analysis-specific decision-readiness evidence was not explicit in one table | `ENHANCE` | close governance ambiguity for board/CFO usage |
| Menu 3 AI placement | module-level Menu 3 rule exists | right-side command row, no duplicated AI toolbar | no blocker; keep and track evidence | `KEEP` | doctrine already valid; only function-level evidence sync needed |
| dedicated analysis regression evidence | module-level tests mention lane runtime only | dedicated analysis probes for explainability/lineage/approval | no function-specific matrix yet | `DEFER` | tracked as `NOT_DONE` pending dedicated test scope |

## 6. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `FN-ANL-P0-001` | `P0` | `docs` | close explainability + source-lineage baseline for critical analysis claims (`RAW source + decision + evidence` or `NOT_DONE`) | owner docs acceptance | claim ledger complete and auditable | contract complete |
| `FN-ANL-P1-001` | `P1` | `docs` | normalize high-impact approval gates and no-hidden-writes guardrails for analysis lane | `FN-ANL-P0-001` | explicit approval/no-hidden-write evidence hooks | waits for P0 closure |
| `FN-ANL-P2-001` | `P2` | `docs/test` | publish dedicated analysis acceptance probes with unresolved rows marked `NOT_DONE` | `FN-ANL-P0-001`,`FN-ANL-P1-001` | analysis-specific acceptance/test addendum in module docs | waits for P0/P1 closure |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| analysis tab is anchored in finance routes | `/economics`, `/finance` routing through `EconomicsView` | `FinanceHub` analysis tab runtime | finance API boundary references in module contracts | module route smoke references | `PASS` |
| explainability is visible for critical outputs | analysis runtime entry + view states | analysis narrative/driver sections in finance surfaces | computed-analysis boundaries and service contracts | dedicated analysis explainability test probe missing | `PASS_WITH_P1` |
| source lineage is explicit | analysis flow references in function contract | source/confidence/lineage posture references | lineage/provenance contract boundaries | dedicated lineage regression not linked | `PASS_WITH_P1` |
| high-impact approvals are explicit | finance review path references | analysis review/approve controls and policy | approval boundary ownership refs | dedicated no-hidden-approval probe missing | `PASS_WITH_P1` |
| no hidden writes doctrine is explicit | explicit user-triggered action model | AI proposal + user confirmation posture | no hidden mutation path references | dedicated mutation-guard probe missing | `PASS_WITH_P1` |
| dedicated analysis regression matrix exists | n/a | n/a | n/a | function-specific suite | `NOT_DONE` |

## 8. Cross-Module Impact

- primary module: `08_finanse`
- impact-only references: `FINANCIAL_ANALYSIS_V3` and `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8` for governance alignment
- ownership impact: none outside `FN_ANALYSIS_WORKSPACE`
- security/tenant impact: no policy changes, guardrails unchanged

## 9. Done Gate

- function contract complete: `PASS`
- taskboard + execution card synchronized: `PASS`
- blocked scope drift: `NO`
- owner acceptance: `PENDING`
- rerun rule: if primary scope moves beyond anchor, stop with `BLOCKED_SCOPE_DRIFT`
