---
module_id: MODULE_FINANCE
function_id: FN_STATEMENTS_WORKSPACE
function_name: Finance — Statements Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Statements Workspace

## 1. Function Identity

- function ID: `FN_STATEMENTS_WORKSPACE`
- immutable scope anchor: `08_finanse/FN_STATEMENTS_WORKSPACE`
- runtime anchor: `FinanceHub` tab `statements`
- route scope: `/economics`, `/finance`
- feature state: `real`
- work mode in this cycle: `docs-only`

## 2. User Job and Business Outcome

Statements workspace is a decision-ready gateway to the finance loop. The user must be able to move from statement ingestion quality to downstream analysis/model readiness with explicit source lineage and approval visibility, not a files-only list.

## 3. Trigger and Entry Points

- module entry: finance routes mounted through `EconomicsView` and `FinanceHub`
- function entry: tab `statements` in `FinanceHub`
- allowed high-impact actions: explicit user-triggered import/analyze/create-model/approve/review actions

## 4. UI Component Footprint

- statements table/grid/preview and import flows in `FinanceHub`
- status chips and action controls for ingestion/gate posture (`Rejected Imports`, `Recovery Queue`, `Ready Statements`, `Unlinked`, `Stale`, etc.)
- command-row/Menu 3 contract for contextual AI and workflow controls on the right side

## 5. Inputs, Data Contracts, and Dependencies

- statement artifacts: PDF/Excel/CSV/manual records and metadata (entity, period, currency)
- ingestion outputs: parser status, confidence, extraction/mapping status, quality-gate outcomes
- lineage envelope: source documents + source references + confidence + approval/review status
- dependencies:
  - `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`
  - RAW source packet: `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
  - product SSOTs: `docs/product/FINANCIAL_ANALYSIS_V3.md`, `docs/modules/ECONOMICS_MODULE.md`

## 6. Outputs and Side Effects

- explicit outputs only: statement record updates, ingestion status visibility, statement approval transitions, downstream handoff readiness for model/analysis flows
- forbidden behavior: hidden writes, silent approvals, hidden AI-driven mutations

## 7. Ownership and Handoff Boundaries

- Statements workspace owns statement-level ingestion/normalization/quality/readiness posture
- downstream model/analysis/valuation/investment lanes consume only explicit and reviewable statement readiness
- ownership must remain auditable with source and approval metadata

## 8. Runtime States and UX Behavior

Mandatory visible states:

- loading: statement/ingestion/review context loading in progress
- empty: no statements or filter-empty result with next action guidance
- error: business-readable error with retry/recovery action
- degraded: fallback/quality-restricted mode is explicit before trust decisions
- success: import/review/approval outcomes explicitly confirmed

## 9. AI, Source, Evidence, Approval

- Menu 3 placement rule: contextual AI actions must be in right-side command row or row/action scope (no duplicate toolbar under canvas)
- AI guardrail: AI proposes and explains; it does not silently approve or silently write high-impact state
- provenance rule: every critical statement claim must be tied to source/confidence/lineage and marked when missing
- review/approval rule: statement readiness and high-impact transitions require explicit human review/approval

## 10. Security, Roles, and Tenancy

- deny-by-default for unauthorized operations
- tenant and ACL boundaries must remain explicit
- no raw sensitive payload leakage in UI/log evidence claims

## 11. Acceptance Criteria and Test Evidence

| Criterion | Evidence expectation | Current status |
| --- | --- | --- |
| statements route and tab entry are explicit | route + component evidence | `PASS` |
| loading/empty/error/degraded/success states are explicit | behavior/UI evidence + state mapping | `PASS_WITH_P2` |
| source/provenance envelope is visible for critical claims | source line + confidence + lineage references | `PASS_WITH_P1` |
| review/approval boundary is explicit before high-impact export/use | approval-state and no-hidden-approval evidence | `PASS_WITH_P1` |
| Menu 3 AI placement has no duplication | Menu 3/right-side evidence and anti-duplication evidence | `PASS_WITH_P1` |
| dedicated regression evidence for statements lane exists | route/component/API/test proof | `NOT_DONE` |

## 11A. RAW Source Reconciliation (Phase 2)

| Source set | Result | Contract action |
| --- | --- | --- |
| `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` vs `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` | identical content (`diff -q` no differences) | canonical source locked to `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`; secondary file treated as mirror |
| UI_UX RAW vs finance RAW packet | no blocking contradiction for Statements scope | no `OPEN_QUESTION` required in this pass |

## 11B. RAW Synthesis (must/should/out)

### Must

- Statements must behave as a decision workspace, not a file repository.
- Every high-impact statement claim must show source/provenance (`source`, `confidence`, `lineage`) or explicit `NOT_DONE`.
- Explicit human review/approval is required before high-impact export/use of statement-derived outputs.
- Degraded state must be visible before the user can trust downstream decisions.

### Should

- Statements lane should expose actionable quality statuses (`Rejected`, `Recovery`, `Ready`, `Unlinked`, `Stale`) with next steps.
- Menu 3 AI controls should stay right-side and non-duplicated with row/action context.

### Out

- Runtime/API/component implementation changes.
- Cross-function backlog expansion beyond `FN-STM-P0/1/2-001`.

## 12. Step 1 — As-Is Gap Audit (priority-coded)

| Gap ID | Area | As-Is finding | Priority | Required closure |
| --- | --- | --- | --- | --- |
| `FN-STM-P0-001` | source/provenance | docs state provenance intent, but function-level proof of source envelope, confidence and lineage per critical statement claim is incomplete | `P0` | lock minimum provenance contract + evidence map (`RAW source + doc evidence or NOT_DONE`) |
| `FN-STM-P1-001` | states + review/approval + Menu 3 | state vocabulary exists, but statements-specific evidence for explicit review/approval transitions and Menu 3 anti-duplication posture is not normalized in one contract | `P1` | normalize state/approval/Menu 3 assertions with evidence hooks and anti-pattern guard |
| `FN-STM-P2-001` | test evidence | module-level test gap is acknowledged; no dedicated statements regression matrix tied to this function contract | `P2` | add canonical test evidence placeholders and mark missing probes as `NOT_DONE` |

## 13. Step 2 — As-Is vs RAW Target vs Delta

| Topic | As-Is | RAW target | Delta | Decision | RAW source | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| finance role of statements | workspace described as table/import surface | statements are decision gateway in loop `statement -> ... -> Results/ROI`, not files repository | intent present but contract was too thin | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | this contract sections 2, 4, 6 |
| source/provenance | source requirements are generic | every number/claim tied to source/confidence/lineage | function evidence baseline incomplete | `NEW` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 11 + gap `FN-STM-P0-001` |
| high-impact export/use requires explicit review | explicit actions are documented, but export/use checkpoint is not normalized for statements function | review/approval before high-impact output use | checkpoint wording and evidence map needed | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 11 criterion + section 14 ledger |
| ingestion and quality states | states referenced globally | explicit statuses and action semantics (`Rejected`, `Recovery`, `Ready`, `Unlinked`, `Stale`, gate pass) | semantics partially captured, not fully normalized at function level | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | sections 4, 8, 12 |
| degraded state visibility | degraded behavior exists at module level | degraded state must be explicit before trust decisions | statements-specific degraded evidence needs direct mapping | `ENHANCE` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 8 + gap `FN-STM-P1-001` |
| review/approval governance | approval intention exists | explicit statement approval engine and auditable review path | evidence contract incomplete | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | sections 9, 11, 12 |
| Menu 3 AI placement | module UI doc defines Menu 3 principle | contextual AI on right-side command row, no duplicated toolbar | statements-specific proof path not explicit | `KEEP` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (canonical), mirror: `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` | section 9 + task `FN-STM-P1-001` |
| dedicated tests for statements flow | finance docs report missing dedicated test suite | auditable gates must have repeatable evidence | dedicated regression not present | `DEFER` | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `NOT_DONE` (captured in section 11 and task `FN-STM-P2-001`) |

## 14. Critical Claims Ledger (RAW + decision + evidence)

| Critical claim | RAW source | Decision | Evidence |
| --- | --- | --- | --- |
| Statements workspace must feed the closed finance decision loop and not behave as a file repository | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 2 and section 13 |
| Statement claims require source traceability and confidence posture | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `NEW` | section 5 lineage envelope + section 11 acceptance |
| High-impact export/use needs explicit review before final use | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 11 criterion + section 13 decision row |
| Degraded state must be visible before trust decisions | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 8 + section 13 decision row |
| High-impact statement transitions require explicit review/approval | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `ENHANCE` | section 9 review rule + section 12 gap `FN-STM-P1-001` |
| Contextual AI action must remain in Menu 3/right slot and not duplicate in canvas | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | `KEEP` | section 9 + `04_UI_UX.md` finance Menu 3 contract |
| Statements function needs dedicated regression evidence | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `DEFER` | `NOT_DONE` |

## 15. Backlog Sync Contract

Execution backlog is synchronized via:

- `docs/modules/08_finanse/IMPLEMENTATION_TASK_BOARD.md`
- `docs/modules/08_finanse/function-cards/FN_STATEMENTS_WORKSPACE_EXECUTION_CARD.md`

Mandatory rows in this cycle:

- `FN-STM-P0-001`
- `FN-STM-P1-001`
- `FN-STM-P2-001`

## 12. Open Risks and Change Log

- wrong interpretation of statement readiness can pollute downstream models and reports
- missing dedicated statements regression remains a controlled risk until task `FN-STM-P2-001` is closed
- if scope expands beyond `08_finanse/FN_STATEMENTS_WORKSPACE`, stop with `BLOCKED_SCOPE_DRIFT`
