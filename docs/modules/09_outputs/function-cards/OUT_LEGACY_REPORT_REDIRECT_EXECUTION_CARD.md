---
module_id: MODULE_OUTPUTS
function_id: OUT_LEGACY_REPORT_REDIRECT
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
work_type: docs-only
---

# Function Execution Card — OUT_LEGACY_REPORT_REDIRECT

## 1. Metadata

- scope_anchor: `09_outputs/OUT_LEGACY_REPORT_REDIRECT`
- primary_module: `09_outputs`
- primary_function: `OUT_LEGACY_REPORT_REDIRECT`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope:
  - legacy route bridge contract and anti-duplication ownership rule
  - deterministic redirect path into canonical outputs tabs
  - migration-risk visibility in integration backlog
- Out of scope:
  - redirect implementation changes
  - removing legacy routes in this cycle

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `03_BEHAVIOR.md` | redirect bridge truth and route mapping | claiming legacy route as independent module owner |
| `MODULE_INTERACTION_GRAPH.md` | route-level ownership transfer context | adding/removing interaction edges without scope approval |

## 4. Source Inputs

- `docs/modules/09_outputs/functions/OUT_LEGACY_REPORT_REDIRECT.md`
- `docs/modules/09_outputs/03_BEHAVIOR.md`
- `docs/modules/09_outputs/04_UI_UX.md`
- `docs/modules/09_outputs/07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/MODULE_INTERACTION_GRAPH.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`

## 5. RAW -> Decision -> Evidence Chain

| Task ID | RAW requirement | Decision | Evidence |
| --- | --- | --- | --- |
| `OUT-LEGACY-P0-001` | one canonical outputs home, no parallel lane ownership | `KEEP + ENHANCE` | `03_BEHAVIOR.md`, V8.1 docs |
| `OUT-LEGACY-P1-001` | legacy entry must not reintroduce split truth or hidden behavior | `ENHANCE` | docs-level contract present; runtime redirect regression proof `NOT_DONE` |
| `OUT-LEGACY-P2-001` | migration path should keep user guidance and deprecation clarity | `DEFER` | no full migration evidence pack in this cycle |

## 6. Gap Register

| Task ID | Priority | Gap | Status |
| --- | --- | --- | --- |
| `OUT-LEGACY-P0-001` | `P0` | no execution card tying legacy redirect function to module integration packet | `READY` |
| `OUT-LEGACY-P1-001` | `P1` | missing dedicated redirect coherence and ownership-regression test evidence | `WAITING_P0` |
| `OUT-LEGACY-P2-001` | `P2` | deprecation/migration readiness evidence not consolidated | `WAITING_P0` |

## 7. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Legacy routes deterministically redirect into outputs tabs. | `/reports`, `/reports/management` route entries | redirect bridge logic | n/a | redirect smoke tests | `PASS_DOCS` |
| Redirect does not create duplicate ownership semantics. | route contract + outputs shell mapping | post-redirect tab context | n/a | route/ownership regression tests | `NOT_DONE` |
| Legacy migration remains user-safe with clear next action. | route contract notes | post-redirect guidance UI | n/a | UX migration checks | `NOT_DONE` |

## 8. Done Gate

- contract complete: `PASS`
- RAW alignment complete: `PASS`
- evidence complete: `PASS_WITH_P1`
- owner acceptance: `PENDING`

