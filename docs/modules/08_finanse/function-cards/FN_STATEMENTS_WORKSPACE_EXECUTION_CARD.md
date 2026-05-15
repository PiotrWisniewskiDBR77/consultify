---
module_id: MODULE_FINANCE
function_id: FN_STATEMENTS_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — FN_STATEMENTS_WORKSPACE

## 1. Metadata

- scope_anchor: `08_finanse/FN_STATEMENTS_WORKSPACE`
- primary_module: `08_finanse`
- primary_function: `FN_STATEMENTS_WORKSPACE`
- work_type: `docs-only`

## 2. Scope Anchor

- in scope: `functions/FN_STATEMENTS_WORKSPACE.md`, `IMPLEMENTATION_TASK_BOARD.md`, this execution card
- out of scope: runtime/API/component edits and other finance functions as primary scope
- forbidden: cross-module primary changes; hidden runtime mutations

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `03_BEHAVIOR.md` | source reference for state and runtime behavior assertions | expanding behavior scope to other functions |
| `04_UI_UX.md` | Menu 3 placement and UI evidence reference | introducing new UI scope outside statements function contract |
| `07_ACCEPTANCE_AND_TESTS.md` | acceptance/test evidence baseline and gap tracking | editing test scope as runtime implementation plan |

## 4. Source Inputs

- `docs/modules/08_finanse/functions/FN_STATEMENTS_WORKSPACE.md`
- `docs/modules/08_finanse/03_BEHAVIOR.md`
- `docs/modules/08_finanse/04_UI_UX.md`
- `docs/modules/08_finanse/07_ACCEPTANCE_AND_TESTS.md`
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` (`canonical_source`)
- `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09 2.md` (`mirror_source`, identical)
- `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md`
- `docs/modules/08_finanse/RAW_INPUT.md`
- `docs/product/FINANCIAL_ANALYSIS_V3.md`
- `docs/modules/ECONOMICS_MODULE.md`

## 4A. RAW Reconciliation Gate

| Check | Result | Action |
| --- | --- | --- |
| `UI_UX 106` vs `UI_UX 106 2` | `PASS_IDENTICAL` | keep `...2026-05-09.md` as `canonical_source`; use `...2026-05-09 2.md` as mirror |
| RAW conflicts for statements scope | `NO_CONFLICT_DETECTED` | no `OPEN_QUESTION` raised in this pass |

## 5. Decision Matrix (As-Is vs RAW)

| Topic | As-Is | RAW target | Delta | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| statements role in finance loop | statements mostly documented as workspace/table/import entry | statements as trust gateway in full finance loop with auditability | contract lacked explicit loop linkage | `ENHANCE` | align function purpose to RAW finance loop |
| source/provenance contract | generic provenance wording in module docs | source/confidence/lineage required per critical claim | no normalized claim ledger in function contract | `NEW` | enforce auditable source envelope |
| state and approval governance | states described globally | status semantics + explicit statement approval gate | evidence not centralized at function level | `ENHANCE` | reduce ambiguous interpretation risk |
| Menu 3 AI placement | module-level rule present | right-side Menu 3, no duplicate AI toolbar | statements-specific evidence hook missing | `KEEP` | rule already valid; only evidence normalization needed |
| dedicated statements regression evidence | known finance test gap | auditable test evidence for function gates | no dedicated statements matrix | `DEFER` | keep as explicit `NOT_DONE` until test work |

## 6. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `FN-STM-P0-001` | `P0` | `docs` | close source/provenance baseline for statements claims (`source -> decision -> evidence`) and lock critical-claims ledger | owner docs acceptance | RAW source + decision + evidence/`NOT_DONE` per claim | contract complete |
| `FN-STM-P1-001` | `P1` | `docs` | normalize state semantics, degraded visibility, explicit review before high-impact export/use, and Menu 3 anti-duplication evidence for statements lane | `FN-STM-P0-001` | route/component/API/test hooks + UI contract alignment | waits for P0 closure |
| `FN-STM-P2-001` | `P2` | `docs/test` | publish dedicated statements test evidence matrix and unresolved probes as `NOT_DONE` | `FN-STM-P0-001`,`FN-STM-P1-001` | function-level test matrix tied to acceptance doc | waits for P0/P1 closure |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| statements tab is anchored in finance routes | `/economics`, `/finance` routing through `EconomicsView` | `FinanceHub` statements tab runtime | finance API boundary references in module contracts | module route smoke references | `PASS` |
| statements quality states are explicit and actionable | statements route context | status chips and state UX in finance views | ingestion/quality API boundary references | no dedicated statements suite yet | `PASS_WITH_P2` |
| statement claims must carry source/provenance envelope | statement detail/source UI references | source/lineage/confidence surfaces | ingestion/mapping provenance contract refs | dedicated provenance regression not linked | `PASS_WITH_P1` |
| review/approval transitions are explicit and auditable | statement review path references | review/approve controls and audit posture | approval boundary ownership refs | dedicated no-hidden-approval probe missing | `PASS_WITH_P1` |
| Menu 3 AI placement has no duplicates | finance route/top-bar context | right-side command-row and row action controls | n/a | dedicated anti-duplication test evidence missing | `PASS_WITH_P1` |
| dedicated statements regression matrix exists | n/a | n/a | n/a | function-specific suite | `NOT_DONE` |

## 8. Cross-Module Impact

- primary module: `08_finanse`
- impact-only references: `FINANCIAL_ANALYSIS_V3` and `ECONOMICS_MODULE` for governance alignment
- ownership impact: none outside `FN_STATEMENTS_WORKSPACE`
- security/tenant impact: no policy changes, guardrails unchanged

## 9. Done Gate

- function contract complete: `PASS`
- taskboard + execution card synchronized: `PASS`
- blocked scope drift: `NO`
- owner acceptance: `PENDING`
- rerun rule: if primary scope moves beyond anchor, stop with `BLOCKED_SCOPE_DRIFT`
