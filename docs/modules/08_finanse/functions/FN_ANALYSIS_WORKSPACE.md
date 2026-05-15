---
module_id: MODULE_FINANCE
function_id: FN_ANALYSIS_WORKSPACE
function_name: Finance — Analysis Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Analysis Workspace

## 1. Function Identity

- function ID: `FN_ANALYSIS_WORKSPACE`
- immutable scope anchor: `08_finanse/FN_ANALYSIS_WORKSPACE`
- runtime anchor: `FinanceHub` tab `analysis`
- route scope: `/economics`, `/finance`
- feature state: `real`
- work mode in this cycle: `docs-only`

## 2. User Job and Business Outcome

Analysis workspace must turn financial data into explainable, auditable insight artifacts with explicit review boundaries. The lane is valid only when source lineage, explainability, and approval posture are visible for high-impact outputs.

## 3. Trigger and Entry Points

- module entry: finance routes mounted through `EconomicsView` and `FinanceHub`
- function entry: tab `analysis` in `FinanceHub`
- allowed high-impact actions: explicit user-triggered analyze/review/approve/export actions only

## 4. UI Component Footprint

- analysis workspace in `FinanceHub` with ratio/trend/variance/anomaly views
- command-row/Menu 3 right-side controls for contextual AI + workflow actions
- preview/detail surfaces that expose evidence, confidence, and review state for analysis artifacts

## 5. Inputs, Data Contracts, and Dependencies

- inputs: statement/model-derived financial data, ratio computations, anomaly/variance context
- provenance envelope: source references, confidence posture, lineage markers for each critical claim
- dependencies:
  - `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`
  - RAW source packets:
    - `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
    - `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
    - `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md`
    - `docs/modules/08_finanse/RAW_INPUT.md`
  - product SSOTs:
    - `docs/product/FINANCIAL_ANALYSIS_V3.md`
    - `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`
    - `docs/modules/ECONOMICS_MODULE.md`

## 6. Outputs and Side Effects

- explicit outputs only: analysis runs, explainability narratives, review/approval checkpoints, linkage-ready insights for downstream Results/KPI contexts
- forbidden behavior: hidden writes, silent approval transitions, hidden AI-driven high-impact mutations

## 7. Ownership and Handoff Boundaries

- analysis lane owns interpretation of finance model/statement signals
- Results/KPI linkage remains governed and optional; no silent truth replacement outside ownership boundaries
- no bypass of explicit human review on high-impact analysis outcomes

## 8. Runtime States and UX Behavior

Mandatory visible states:

- loading: analysis run or evidence context loading
- empty: no analysis run or filter-empty context with next-step guidance
- error: business-readable failure with retry path
- degraded: confidence/coverage constraints visible before trust decisions
- success: analysis completion and review status explicitly confirmed

## 9. AI, Source, Evidence, Approval

- Menu 3 placement rule: contextual AI actions must stay in right-side command row / row actions (no duplicate toolbar under canvas)
- explainability rule: analysis outputs must include interpretable drivers, assumptions, and evidence context
- lineage rule: each critical analysis claim maps to source lineage (`source -> transformation -> output`) or explicit `NOT_DONE`
- approval rule: high-impact analysis outcomes require explicit review/approval before being treated as final business truth
- no-hidden-writes rule: AI may propose; user confirms. No hidden persistence path for high-impact analysis mutations

## 10. Security, Roles, and Tenancy

- deny-by-default for unauthorized actions
- tenant/ACL boundaries are non-negotiable
- no sensitive payload leakage in docs/runtime evidence claims

## 11. Acceptance Criteria and Test Evidence

| Criterion | Evidence expectation | Current status | Evidence link |
| --- | --- | --- | --- |
| analysis route and tab entry are explicit | route + component evidence | `PASS` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` |
| explainability is explicit in analysis artifacts | narrative + driver/explanation evidence | `PASS_WITH_P1` | `docs/product/FINANCIAL_ANALYSIS_V3.md` |
| source lineage is explicit for critical claims | source/confidence/lineage mapping or `NOT_DONE` | `PASS_WITH_P1` | section 14 + `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` |
| high-impact analysis uses explicit review/approval | approval boundary evidence with no hidden finalization | `PASS_WITH_P1` | `docs/modules/08_finanse/04_UI_UX.md` |
| no hidden writes posture is explicit | AI propose/confirm contract + visible action path | `PASS_WITH_P1` | section 9 + section 12 (`FN-ANL-P1-001`) |
| dedicated analysis regression evidence exists | route/component/API/test probes specific to analysis lane | `NOT_DONE` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` |

## 12. Step 1 — As-Is Gap Audit (priority-coded)

| Gap ID | Area | As-Is finding | Priority | Required closure |
| --- | --- | --- | --- | --- |
| `FN-ANL-P0-001` | explainability + source lineage | analysis lane is present, but critical-claim explainability and lineage contract are not normalized in one function-level ledger | `P0` | lock explainability + lineage baseline (`RAW source + decision + evidence` or explicit `NOT_DONE`) |
| `FN-ANL-P1-001` | approvals + no hidden writes | high-impact review/approval and no-hidden-writes doctrine are stated globally, but function-level analysis checkpoints are not centralized | `P1` | normalize explicit approval gates and hidden-write guardrails for high-impact analysis actions |
| `FN-ANL-P2-001` | acceptance evidence depth | analysis lane has module-level evidence, but no dedicated function-level regression matrix for explainability/lineage/approval probes | `P2` | publish analysis-specific acceptance probes and unresolved rows as `NOT_DONE` |

## 13. Step 2 — RAW Comparison Matrix (`must/should/out`)

| Topic | Classification | As-Is | RAW target | Delta | Decision | RAW source | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| analysis as decision engine (not commentary) | `must` | analysis tab exists and runs financial analyses | AI acts as active analyst with governed workflow and evidence-backed interpretation | workflow intent present but function contract was too thin | `ENHANCE` | `docs/product/FINANCIAL_ANALYSIS_V3.md` | sections 2, 6, 9 |
| explainability for critical analysis claims | `must` | explainability implied but not normalized per claim | CFO-grade explainability with quantified drivers and citations | missing function-level claim ledger | `NEW` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 14 + gap `FN-ANL-P0-001` |
| source lineage and confidence posture | `must` | provenance described at module level | every critical claim references source lineage and confidence | normalization incomplete at analysis-function granularity | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 5 + section 14 |
| high-impact analysis approvals | `must` | review/approval rule exists globally | explicit human review/approval before final business truth | function-level checkpoints incomplete | `ENHANCE` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 9 + gap `FN-ANL-P1-001` |
| no hidden writes | `must` | no-hidden-mutation principle exists in governance docs | no silent writes for high-impact analysis outcomes | function contract lacked explicit no-hidden-writes acceptance hook | `ENHANCE` | `docs/product/FINANCIAL_ANALYSIS_V3.md` | section 9 + section 11 |
| Menu 3 AI placement | `should` | Menu 3 rule already documented in module UI contract | contextual AI on right-side command row with no duplication in canvas | no blocker; evidence normalization needed | `KEEP` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 9 + `04_UI_UX.md` |
| autonomous finance truth merge into KPI truth | `out` | Results/Finance dual ownership is documented | linkage remains optional and governed; no silent truth collapse | already aligned with RAW and product linkage doctrine | `DEFER` | `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | section 7 (`OUT_OF_SCOPE_FOR_THIS_CYCLE`) |

## 13A. RAW Synthesis Snapshot (`must/should/out`)

| Bucket | Scope item | RAW source | Decision | Evidence |
| --- | --- | --- | --- | --- |
| `must` | explainable analysis outputs (driver-aware, evidence-backed) | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `ENHANCE` | sections 11, 13, 14 |
| `must` | source lineage for critical analysis claims | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `NEW` | sections 11, 12, 14 |
| `must` | decision readiness before final truth use (`explicit review`) | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | sections 11, 14 (`decision readiness` row) |
| `must` | no hidden write/finalization path for high-impact outcomes | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `ENHANCE` | sections 9, 11, 14 |
| `should` | Menu 3 contextual AI placement without duplication | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` | `KEEP` | section 9 + `04_UI_UX.md` |
| `out` | collapse KPI truth into Finance truth | `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | `DEFER` | section 13 (`out`) |

## 13B. Decision Table (`KEEP/ENHANCE/NEW/DEFER`)

| Decision | Topic | Why |
| --- | --- | --- |
| `KEEP` | Menu 3 AI placement doctrine | already aligned with RAW and module UI rules |
| `ENHANCE` | explainability + explicit review + no-hidden-write evidence depth | present conceptually, insufficiently normalized in one analysis contract |
| `NEW` | critical-claim lineage ledger discipline | needed to guarantee RAW source + decision + evidence/`NOT_DONE` per thesis |
| `DEFER` | deep regression coverage and out-of-scope KPI truth merge | requires dedicated test work and cross-module runtime alignment |

## 14. Critical Claims Ledger (RAW + decision + evidence)

| Critical claim | RAW source | Decision | Evidence |
| --- | --- | --- | --- |
| Analysis output must be explainable, not just generated text | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `ENHANCE` | sections 2, 9, 13 |
| Every critical analysis claim requires source lineage/confidence context | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `NEW` | section 11 + section 12 (`FN-ANL-P0-001`) |
| Decision readiness is mandatory: analysis cannot be used as final business truth without explicit review | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 11 (`high-impact analysis uses explicit review/approval`) + `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` |
| High-impact analysis requires explicit review/approval | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 9 + section 12 (`FN-ANL-P1-001`) |
| No hidden writes for high-impact analysis mutations | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `ENHANCE` | section 6 + section 9 |
| KPI/Finance linkage remains governed and optional | `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | `KEEP` | section 7 + section 13 (`out`) |

## 15. Backlog Sync Contract

Execution backlog is synchronized via:

- `docs/modules/08_finanse/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/08_finanse/function-cards/FN_ANALYSIS_WORKSPACE_EXECUTION_CARD.md`

Mandatory rows in this cycle:

- `FN-ANL-P0-001`
- `FN-ANL-P1-001`
- `FN-ANL-P2-001`

## 12. Open Risks and Change Log

- analysis confidence may be overestimated if lineage evidence remains partial
- high-impact approval path ambiguity can create governance risk until `FN-ANL-P1-001` is closed
- missing dedicated analysis regression remains a controlled risk until `FN-ANL-P2-001` is closed
- if scope expands beyond `08_finanse/FN_ANALYSIS_WORKSPACE`, stop with `BLOCKED_SCOPE_DRIFT`
