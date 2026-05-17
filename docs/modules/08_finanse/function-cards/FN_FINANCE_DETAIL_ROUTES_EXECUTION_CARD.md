---
module_id: MODULE_FINANCE
function_id: FN_FINANCE_DETAIL_ROUTES
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
work_type: docs-only
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — FN_FINANCE_DETAIL_ROUTES

## Scope Anchor

- scope_anchor: `08_finanse/FN_FINANCE_DETAIL_ROUTES`
- scope mode: `impact-only companion verification`
- in scope: `functions/FN_FINANCE_DETAIL_ROUTES.md`, `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, this card
- out of scope: new routes and runtime behavior changes

## Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `FN-DTL-P0-001` | `P0` | route-param integrity + explicit no hidden route-mutation doctrine | `READY` |
| `FN-DTL-P1-001` | `P1` | detail-context parity with parent finance tabs and states | `WAITING_P0` |
| `FN-DTL-P2-001` | `P2` | dedicated detail-route regression matrix | `WAITING_P0` |

## Evidence Plan

| Claim | Route | Component | API | Test | Gate |
| --- | --- | --- | --- | --- | --- |
| detail routes are mounted and resolved | `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id` | `EconomicsView -> FinanceHub` | shared finance API boundary | route mapping evidence only | `PASS_WITH_P2` |
| detail routes do not bypass explicit approvals | detail route action entry | parent lane controls | shared approval boundary | dedicated probe missing | `PASS_WITH_P2` |
| dedicated detail-route regression matrix exists | n/a | n/a | n/a | missing | `NOT_DONE` |

## Verdict

- docs verdict: `APPROVED_FOR_DOCS`
- companion runtime gate: `PASS_WITH_P2` (impact-only verification, dedicated tests still `NOT_DONE`)
