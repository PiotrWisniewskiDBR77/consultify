---
doc_id: FUNCTION_EXECUTION_CARD_TEMPLATE
doc_kind: EXECUTION_TEMPLATE
owner: user
status: active
last_updated: 2026-05-10
---

# Function Execution Card Template

Use this template for function-level documentation and implementation planning.

Recommended path:

`docs/modules/<module>/function-cards/<function_id>_EXECUTION_CARD.md`

## 1. Metadata

- `scope_anchor`:
- `primary_module`:
- `primary_function`:
- `parent_function`:
- `owner_business`:
- `owner_tech`:
- `work_type`: `docs-only | implementation-planning | runtime-implementation`
- `status`: `DRAFT | REVIEW | APPROVED | BLOCKED_SCOPE_DRIFT | DONE`

## 2. Scope Anchor

The `scope_anchor` is immutable for the whole agent run.

- in scope:
- out of scope:
- allowed global documents:
- forbidden files:

## 3. Dependency Scope

Dependency scope is read-only / impact-only unless explicitly promoted by owner decision.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
|  |  |  |

## 4. Source Inputs

- RAW sources:
- module contracts:
- function contracts:
- runtime evidence sources:
- previous decisions:

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  | `KEEP/ENHANCE/NEW/DEFER` |  |

## 6. UI/UX Component Contract

- approved shell/component family:
- Menu 2 surface:
- Menu 3 actions:
- AI action placement:
- runtime states:
- source/provenance/evidence UI:
- approval/review/diff behavior:
- anti-patterns:

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/<function_id>.md` |  |  |  |
| `03_BEHAVIOR.md` |  |  |  |
| `04_UI_UX.md` |  |  |  |
| `07_ACCEPTANCE_AND_TESTS.md` |  |  |  |
| `RAW_TARGET_STATE_2_0_PACKET.md` |  |  |  |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
|  | `P0/P1/P2` | `docs/runtime/test` |  |  | `route/component/API/test` |  |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  | `PASS/PASS_WITH_P2/MISSING` |

## 10. Cross-Module Impact

- impacted modules:
- handoff changes:
- ownership impact:
- security/tenant impact:
- E2E workflow impact:
- global contract updates needed:

## 11. Done Gate

- contract complete:
- UI/UX complete:
- evidence complete:
- implementation backlog ready:
- impact complete:
- owner acceptance:
- rerun gate:

## 12. Open Questions

Maximum 3 open questions.

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
|  |  |  | `yes/no` |
