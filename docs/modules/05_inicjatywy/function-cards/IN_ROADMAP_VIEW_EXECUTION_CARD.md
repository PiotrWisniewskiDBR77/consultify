---
module_id: MODULE_INITIATIVES
function_id: IN_ROADMAP_VIEW
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — IN_ROADMAP_VIEW

## 1. Metadata

- scope_anchor: `05_inicjatywy/IN_ROADMAP_VIEW`
- primary_module: `05_inicjatywy`
- primary_function: `IN_ROADMAP_VIEW`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: `/roadmap` lane smoke and projection/handoff evidence.
- Out of scope: initiative truth mutation in non-roadmap surfaces.
- Immutable rule: one scope anchor only.

## 3. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `IN-ROAD-P1-001` | `P1` | `test` | Add `/roadmap` lane smoke proving projection/handoff behavior with no duplicate initiative truth. | `IN-HUB-P0-001` | route/component/API/test | waiting for P0 close |

## 4. Done Gate

- contract complete: `PASS`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING_FOR_RUNTIME_ROWS`
