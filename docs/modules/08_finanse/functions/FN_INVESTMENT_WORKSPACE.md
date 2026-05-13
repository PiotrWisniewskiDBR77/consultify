---
module_id: MODULE_FINANCE
function_id: FN_INVESTMENT_WORKSPACE
function_name: Finance — Investment Analysis Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Investment Analysis Workspace

## 1. Function Identity

- function ID: `FN_INVESTMENT_WORKSPACE`
- immutable scope anchor: `08_finanse/FN_INVESTMENT_WORKSPACE`
- runtime anchor: `FinanceHub` tab `investment`
- route scope: `/economics`, `/finance`
- feature state: `real`
- work mode in this cycle: `docs-only`

## 2. User Job and Business Outcome

Investment workspace must produce auditable go/no-go investment decisions with explicit traceability from assumptions and risk posture to final recommendation. The lane is valid only when decision lineage, risk assumptions, and approval boundaries are visible and reviewable.

## 3. Trigger and Entry Points

- module entry: finance routes mounted through `EconomicsView` and `FinanceHub`
- function entry: tab `investment` in `FinanceHub`
- allowed high-impact actions: explicit user-triggered create/review/approve/export actions only

## 4. UI Component Footprint

- investment-case workspace in `FinanceHub` with NPV/IRR/payback/ROI/risk-fit decision surfaces
- command-row/Menu 3 right-side controls for contextual AI + workflow actions
- review/approval surfaces showing decision status and risk assumptions before finalization

## 5. Inputs, Data Contracts, and Dependencies

- inputs: initiative/business-case context, model/forecast/valuation outputs, investment assumptions, risk posture metadata
- mandatory traceability envelope: source references + assumption origin + confidence/risk posture per critical decision claim
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

## 6. Outputs and Side Effects

- explicit outputs only: investment case artifacts (NPV/IRR/payback/ROI/risk/fit), recommendation narrative, approval state, linkage-ready evidence for Results/ROI
- forbidden behavior: hidden finalization, silent approval transitions, hidden AI-driven high-impact mutations

## 7. Ownership and Handoff Boundaries

- investment lane owns finance-side investment interpretation and recommendation artifacts
- Results/KPI truth ownership remains external; linkage is optional and governed, never silent replacement
- final recommendation usage for high-impact decisions requires explicit human approval

## 8. Runtime States and UX Behavior

Mandatory visible states:

- loading: investment case or evidence context loading
- empty: no investment case or filter-empty with next-step guidance
- error: business-readable failure with retry/recovery path
- degraded: low-confidence/partial-data markers visible before trusting recommendation
- success: recommendation and approval state explicitly visible

## 9. AI, Source, Evidence, Approval

- Menu 3 placement rule: contextual AI actions stay in right-side command row / row actions (no duplicate toolbar under canvas)
- traceability rule: each critical recommendation claim maps to `source -> assumption -> transformation -> output` or explicit `NOT_DONE`
- risk assumptions rule: recommendation must expose risk assumptions and confidence posture before any go/no-go suggestion
- explicit-approval rule: no final recommendation state without visible approval step
- no-hidden-finalization rule: AI may propose; user confirms. No hidden persistence path for final investment decision

## 10. Security, Roles, and Tenancy

- deny-by-default for unauthorized actions
- tenant/ACL boundaries are non-negotiable
- no sensitive payload leakage in docs/runtime evidence claims

## 11. Acceptance Criteria and Test Evidence

| Criterion | Evidence expectation | Current status | Evidence link |
| --- | --- | --- | --- |
| investment route and tab entry are explicit | route + component evidence | `PASS` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` |
| investment recommendation includes decision traceability | source/assumption/transformation/output mapping | `PASS_WITH_P1` | section 14 + `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` |
| risk assumptions are explicit before recommendation | risk score/fit/confidence posture visible | `PASS_WITH_P1` | `docs/product/FINANCIAL_ANALYSIS_V3.md` |
| explicit approval gate exists for high-impact finalization | visible review/approval path and no silent finalize | `BLOCKED_P1` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (`FN-INV-P1-001` probe not fully evidenced) |
| no hidden finalization posture is explicit | AI propose/confirm contract + visible action path | `BLOCKED_P1` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` (`FN-INV-P1-001` probe not fully evidenced) |
| dedicated investment regression evidence exists | route/component/API/test probes specific to investment lane | `NOT_DONE` | `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md` |

Hard enforcement:

- any high-impact claim without dedicated evidence must remain `NOT_DONE` or `BLOCKED_P1`
- docs-only completion cannot upgrade runtime confidence while `BLOCKED_P1`/`NOT_DONE` rows remain open

## 12. Step 1 — As-Is Gap Audit (priority-coded)

| Gap ID | Area | As-Is finding | Priority | Required closure |
| --- | --- | --- | --- | --- |
| `FN-INV-P0-001` | investment decision traceability | investment lane exists, but critical recommendation claims were not normalized in one function-level traceability ledger | `P0` | lock recommendation traceability baseline (`RAW source + decision + evidence` or explicit `NOT_DONE`) |
| `FN-INV-P1-001` | risk assumptions + explicit approval | risk and approval doctrines exist globally, but investment-specific assumptions and finalization checkpoints were dispersed | `P1` | normalize risk-assumption envelope and explicit approval/no-hidden-finalization rules |
| `FN-INV-P2-001` | acceptance evidence depth | investment lane has module-level evidence, but no dedicated function-level regression matrix for traceability/risk/approval probes | `P2` | publish investment-specific acceptance probes and unresolved rows as `NOT_DONE` |

## 13. Step 2 — RAW Comparison Matrix (`must/should/out`)

| Topic | Classification | As-Is | RAW target | Delta | Decision | RAW source | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| investment analysis as decision engine | `must` | investment tab exists and computes decision metrics | investment engine delivers auditable go/no-go with explicit rationale | function contract was too thin on decision protocol | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | sections 2, 6, 14 |
| recommendation traceability | `must` | recommendation is referenced, trace chain not normalized | each critical recommendation must expose source + assumptions + transformation | no single function-level claim ledger | `NEW` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 14 + gap `FN-INV-P0-001` |
| risk assumptions before go/no-go | `must` | risk score exists in doctrine, assumptions posture scattered | recommendation must carry explicit risk assumptions/confidence posture | assumptions governance at investment-lane granularity incomplete | `ENHANCE` | `docs/product/FINANCIAL_ANALYSIS_V3.md` | sections 9, 14 |
| explicit approval / no hidden finalization | `must` | review/approval exists globally | no final recommendation without visible human approval step | investment-specific gate semantics incomplete | `ENHANCE` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 9 + gap `FN-INV-P1-001` |
| Menu 3 AI placement anti-duplication | `should` | Menu 3 rule already documented in module UI contract | contextual AI in right-side command row with no canvas duplication | no blocker; evidence normalization needed | `KEEP` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 9 + `04_UI_UX.md` |
| KPI/Finance truth merge | `out` | Results/Finance dual ownership is documented | linkage remains optional and governed; no silent truth collapse | already aligned with linkage doctrine | `DEFER` | `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | section 7 (`OUT_OF_SCOPE_FOR_THIS_CYCLE`) |
| investment-to-Results evidence linkage | `must` | linkage intent exists, but investment-lane operator wording was limited | recommendation/evidence must be linkable without replacing Results truth | linkage semantics needed stronger function-level wording | `ENHANCE` | `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | section 7 + section 14 |

## 14. Critical Claims Ledger (RAW + decision + evidence)

| Critical claim | RAW source | Decision | Evidence |
| --- | --- | --- | --- |
| Investment recommendation must be auditable, not only descriptive | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | sections 2, 6, 13 |
| Every critical recommendation requires source/assumption traceability | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `NEW` | section 11 + section 12 (`FN-INV-P0-001`) |
| Risk assumptions must be explicit before go/no-go recommendation | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `ENHANCE` | section 9 + section 12 (`FN-INV-P1-001`) |
| High-impact investment output requires explicit human approval | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 9 + section 11 |
| No hidden finalization path is allowed | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `ENHANCE` | section 6 + section 9 |
| Finance-to-Results linkage remains governed and optional | `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` | `KEEP` | section 7 + section 13 (`out`) |

## 15. Backlog Sync Contract

Execution backlog is synchronized via:

- `docs/modules/08_finanse/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/08_finanse/function-cards/FN_INVESTMENT_WORKSPACE_EXECUTION_CARD.md`

Mandatory rows in this cycle:

- `FN-INV-P0-001`
- `FN-INV-P1-001`
- `FN-INV-P2-001`

## 12. Open Risks and Change Log

- recommendation trust can be overstated if traceability remains partial
- missing explicit investment-lane approval probes can create governance risk until `FN-INV-P1-001` is closed
- missing dedicated investment regression remains controlled risk until `FN-INV-P2-001` is closed
- if scope expands beyond `08_finanse/FN_INVESTMENT_WORKSPACE`, stop with `BLOCKED_SCOPE_DRIFT`
