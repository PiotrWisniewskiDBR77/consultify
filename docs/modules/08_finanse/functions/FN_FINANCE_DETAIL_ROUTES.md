---
module_id: MODULE_FINANCE
function_id: FN_FINANCE_DETAIL_ROUTES
function_name: Finance — Detail Route Surfaces
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Detail Route Surfaces

## 1. Function Identity
- Function ID: `FN_FINANCE_DETAIL_ROUTES`
- Routes: `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`
- Runtime anchor: `EconomicsView` -> `FinanceHub`
- Feature state: `real`
- Scope mode: `impact-only companion verification`

## 2. User Job and Business Outcome
- Purpose: provide reliable deep-link entry for statement/model/analysis contexts without introducing hidden mutation paths or ownership drift.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: route id params and resolved finance entities.

## 6. Outputs and Side Effects
- Outputs: explicit open/edit/review actions within governed finance runtime.

## 7. Ownership and Handoff Boundaries
- Boundaries: detail routes are entry surfaces, not hidden mutation channels.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `08_finanse` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `08_finanse` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `08_finanse` user flows.

## 12. Open Risks and Change Log
## 12. Step 1 — As-Is Gap Audit (priority-coded)

| Gap ID | Area | As-Is finding | Priority | Required closure |
| --- | --- | --- | --- | --- |
| `FN-DTL-P0-001` | detail route integrity | detail routes exist but function-level route-param and no-hidden-mutation contract is too generic | `P0` | normalize route-param integrity + explicit no hidden mutation statement |
| `FN-DTL-P1-001` | companion parity | detail routes resolve into parent runtime, but parent-state parity (loading/error/degraded/review cues) is not documented in one place | `P1` | codify companion parity with parent function states and approval cues |
| `FN-DTL-P2-001` | evidence depth | no detail-route-specific route/component/API/test matrix linked as dedicated proof | `P2` | add dedicated detail-route matrix and mark unresolved probes `NOT_DONE` |

## 13. Step 2 — RAW Comparison Matrix (`must/should/out`)

| Topic | Classification | As-Is | RAW target | Delta | Decision | RAW source | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| deep-link into finance object context | `must` | deep links are mounted and route to finance runtime | detail routes must preserve context and state semantics without hidden route-side effects | function contract lacked explicit companion constraints | `ENHANCE` | `docs/RAW/finance/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 11 + section 12 |
| no hidden writes from route entry | `must` | global doctrine exists, route-level expression is thin | detail route entry cannot bypass approval or mutate silently | route-specific posture under-specified | `ENHANCE` | `docs/UI_UX/106_RAW_FINANCE_INTELLIGENCE_ENGINE_2026-05-09.md` | section 7 + section 12 |
| dedicated detail-route tests | `should` | general finance route evidence exists | dedicated route/component/API/test matrix for detail-path regressions | dedicated matrix missing | `DEFER` | `docs/product/FINANCIAL_ANALYSIS_V3.md` | `NOT_DONE` |
| new detail-route ownership behavior | `out` | none introduced | no new object ownership from companion route surfaces | already aligned | `KEEP` | `docs/modules/MODULE_INTERACTION_GRAPH.md` | `NO_NEW_EDGE` |

## 14. Evidence Map (Route/Component/API/Test)

| Surface | Evidence intent | Current state |
| --- | --- | --- |
| route | detail routes are mounted and resolve correct entity context | `PASS` |
| component | detail route loads parent finance runtime and preserves state cues | `PASS_WITH_P2` |
| API | detail context reads respect shared finance boundary and ACL | `PASS_WITH_P2` |
| tests | dedicated detail-route regression matrix | `NOT_DONE` |

## 15. Open Risks

- Risk: deep-link state mismatch if parent tab/selection sync regresses.
- Risk: missing dedicated detail-route probes can hide route-context regressions until `FN-DTL-P2-001` closes.
