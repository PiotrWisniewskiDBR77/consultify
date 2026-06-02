---
module_id: MODULE_INITIATIVES
function_id: IN_ROI_VIEW
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — IN_ROI_VIEW

## 1. Metadata

- scope_anchor: `05_inicjatywy/IN_ROI_VIEW`
- primary_module: `05_inicjatywy`
- primary_function: `IN_ROI_VIEW`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: `/roi` lane boundary/read-back evidence with finance/results ownership preserved.
- Out of scope: financial model ownership and results truth mutation.
- Immutable rule: one scope anchor only.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `08_finanse` | impact-only for ownership boundary | editing finance as primary scope |
| `07_rezultaty` | impact-only for realized-value boundary | editing results as primary scope |

## 4. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN-ROI-P1-001` | `P1` | `docs/runtime/test` | Add ROI assumptions/read-back boundary with finance/results ownership preserved. | `IN-HUB-P0-*` | route/component/API/test | waiting for P0 close |

## 5. Done Gate

- contract complete: `PASS`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING_FOR_RUNTIME_ROWS`
