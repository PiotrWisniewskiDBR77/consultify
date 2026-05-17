---
module_id: MODULE_EXECUTION
function_id: RL_FULL_EXECUTION_VIEW
function_name: Execution — Full Execution Route
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Full Execution Route

## 1. Function Identity
- Function ID: `RL_FULL_EXECUTION_VIEW`
- Route: `/execution`
- Runtime anchor: `FullExecutionView`
- Feature state: `real`
- Scope anchor: `06_realizacja/RL_FULL_EXECUTION_VIEW`
- Work type: docs-only closeout

## 1.1 Route Contract

`/execution` is an active full execution route in the `06_realizacja` lane. Its route contract is to expose the execution operating surface through `FullExecutionView`, which currently delegates to the shared `ExecutionHub` runtime rather than creating a second execution runtime.

The route is therefore a compatibility/full-view entry into the same execution truth used by the module route family. It must not introduce a separate status taxonomy, owner/deadline truth, execution object model, report runtime or manager intervention model.

| Contract point | Binding | Evidence status |
| --- | --- | --- |
| Public route | `/execution` | route constant and AppView mapping documented in `src/routes/routeConfig.ts` |
| AppView | `AppView.FULL_STEP5_EXECUTION` | reverse mapping from path to AppView documented in `src/routes/routeConfig.ts` |
| Render owner | `FullExecutionView` | lazy route render documented in `src/routes/AppRoutes.tsx` |
| Runtime anchor | `ExecutionHub` via `FullExecutionView` | wrapper implementation documented in `src/views/FullExecutionView.tsx` |
| Route shell | `MainLayout`, `ProductionModuleGate`, `RouteErrorBoundary`, `Suspense` | route composition documented in `src/routes/AppRoutes.tsx` |
| Source-of-truth model | shared execution truth, not route-local truth | product rule in `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md` |

## 2. User Job and Business Outcome
- Purpose: give users a full execution route that opens the active realization surface without forcing them through the `/implementation` route identity.
- Business outcome: users can enter execution work from legacy/full-step navigation while still seeing the same governed portfolio/report/manager execution runtime and state posture.
- Non-goal: `/execution` is not a second execution product, a separate planning module or a shadow version of `Portfolio`, `Raporty` or `Manager`.

## 3. Trigger and Entry Points
- Primary trigger: direct navigation to `/execution`.
- AppView trigger: navigation to `AppView.FULL_STEP5_EXECUTION`.
- Sidebar/module-family context: `06_realizacja` includes `/execution`, `/implementation` and `/rollout`; sidebar launch may point to implementation identity while `/execution` remains an active related/full-step surface.
- Deep-link expectation: `/execution` must resolve to the execution lane shell and must not silently redirect to an unrelated module.

### Entry Conditions

- User/session must satisfy the protected route and production module gating applied by the route shell.
- Tenant/project/role context must be resolved before protected execution data or mutation controls are exposed.
- When a gate denies access or disables the module, the route must show an explicit safe state rather than leaking underlying data or pretending success.
- When shared execution data is partial, stale or unavailable, the route must present degraded/empty/error states through the shared runtime.

## 4. UI Component Footprint
- Route shell: `MainLayout` with execution breadcrumbs.
- Guarding shell: `ProductionModuleGate`, `RouteErrorBoundary`, `Suspense` with loading fallback.
- Route component: `FullExecutionView`.
- Runtime component: `ExecutionHub`.
- UI placement: route-level contextual actions must follow the `06_realizacja` Menu 3/right-side or row-scoped action rule; the wrapper may not add a duplicate toolbar.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: authenticated user context, tenant/project scope, route path `/execution`, AppView mapping and shared execution runtime state.
- Shared execution truth: initiatives, tasks, decisions, blockers, dependencies, baselines, forecasts, workload/capacity, risks and reports.
- API/service boundary: shared execution APIs and V8 execution-control contracts where used by `ExecutionHub`.
- Dependency boundary: `/execution` depends on `ExecutionHub` for runtime behavior and on product rules in `EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md` for the one-runtime model.

## 6. Outputs and Side Effects
- Outputs: visible execution route surface, active execution state, navigation affordances and explicit action visibility.
- Side effects: the route wrapper itself must not perform hidden writes. Any write side effects must be user-triggered through the shared runtime and governed by the execution write/approval rules.
- Navigation output: users may move from the full execution route into portfolio/report/manager/rollout contexts only through visible navigation or command-row actions.

## 7. Ownership and Handoff Boundaries
- `RL_FULL_EXECUTION_VIEW` owns route entry, route shell expectations and the compatibility/full-view contract for `/execution`.
- `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS` and `RL_EXECUTION_MANAGER` own the active tab/surface contracts inside the shared runtime.
- `RL_ROLLOUT_VIEW` owns the `/rollout` route companion surface.
- `Initiatives`, `Reports`, `KPI`, `Finance` and `Calendar` remain authoritative for their own objects; `/execution` may consume their signals but must not duplicate their ownership.
- Handoff must preserve source/provenance and should prefer links to owner modules over copied data.

## 8. Runtime States and UX Behavior
- Loading: route suspense and shared runtime loaders must identify that execution data or module shell is loading.
- Empty: the route must distinguish no execution work, no matching filters and unavailable data where the shared runtime can tell the difference.
- Error: route errors must be caught by the route error boundary or surfaced by shared runtime feedback/toasts.
- Degraded: missing baseline, missing estimate, stale data, partial refresh failure or legacy fallback must be visible as degraded, not as successful truth.
- Success: task/status/report/intervention outcomes must be confirmed by the shared runtime with clear next-step guidance.

### State Model

| State | Route-level expectation | Evidence binding |
| --- | --- | --- |
| `loading` | `Suspense` fallback and runtime loaders protect the route while code/data loads. | `src/routes/AppRoutes.tsx`, `ExecutionHub` runtime loaders |
| `ready` | `FullExecutionView` renders `ExecutionHub` as the active execution surface. | `src/views/FullExecutionView.tsx`, `src/components/Execution/ExecutionHub.tsx` |
| `empty` | Empty execution results are explained by data absence or filters, not hidden. | shared `ExecutionHub` contract; route-specific UI smoke still required |
| `error` | Route shell and runtime feedback catch rendering/load/action failures. | `RouteErrorBoundary` in `src/routes/AppRoutes.tsx`; runtime toasts/errors in `ExecutionHub` |
| `degraded` | Partial/stale/fallback execution truth is disclosed. | V8/fallback execution-control contracts; no route-specific degraded UI evidence captured |
| `success` | User-triggered actions show visible completion/next action. | shared execution runtime contract; route-specific mutation evidence still required |

## 9. AI, Source, Evidence, Approval
- AI actions must be placed in Menu 3/right-side or row-scoped controls inherited from the shared runtime; `/execution` may not add a second contextual AI toolbar.
- Source/provenance must be visible for execution reports, generated summaries, blockers, risks and signals.
- High-impact mutations require explicit user action, review/approval where applicable and audit/read-back evidence where supported.
- No runtime success, approval or test-pass claim is valid for this route unless tied to code, automated test output, manual UI smoke evidence or acceptance evidence.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- Protected route and production-module gates apply before sensitive execution content is displayed.
- Unauthorized users must receive a safe locked/denied state without secrets, raw internals, stack traces or cross-tenant payloads.
- Read access and mutation/approval access are separate capabilities; route visibility does not imply write permission.

## 11. Acceptance Criteria and Test Evidence

- `/execution` is declared as `ROUTES.EXECUTION` and maps to `AppView.FULL_STEP5_EXECUTION`.
- `/execution` is rendered through `FullExecutionView` inside the protected/production-gated route shell.
- `FullExecutionView` delegates to `ExecutionHub`, preserving one execution runtime.
- Entry conditions, route denial, loading, empty, error, degraded and success states are explicit.
- Navigation keeps `/execution`, `/implementation` and `/rollout` as related execution-lane routes without redefining surface ownership.
- AI actions and workflow actions follow Menu 3/right-side or row-scoped placement and are not duplicated by the route wrapper.
- Evidence and source/provenance are exposed for execution reports/signals; missing evidence is disclosed.
- High-impact writes are explicit and governed by the shared execution write/approval rules.

### Evidence Binding

| Claim | Route evidence | Component evidence | API/service evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `/execution` is an active route for `AppView.FULL_STEP5_EXECUTION`. | `src/routes/routeConfig.ts` declares `ROUTES.EXECUTION` and maps `AppView.FULL_STEP5_EXECUTION` to it. | n/a | n/a | `tests/e2e/smoke/wave1-module-closeout.spec.ts` includes `/execution` in protected route smoke list; not rerun in this docs-only closeout. | `PASS_WITH_P2` |
| `/execution` renders `FullExecutionView` behind route shell gates. | `src/routes/AppRoutes.tsx` lazy-loads and renders `FullExecutionView` under `MainLayout`, `ProductionModuleGate`, `RouteErrorBoundary`, `Suspense`. | `src/views/FullExecutionView.tsx` | protected gate utility path is route-shell level; no route-local API. | route-specific fresh runtime evidence not captured in this session. | `PASS_WITH_P2` |
| `FullExecutionView` uses the shared execution runtime. | `/execution` render map in `AppRoutes.tsx`. | `FullExecutionView` returns `<ExecutionHub />`. | shared runtime uses execution APIs/V8 execution-control where applicable. | `tests/e2e/execution-center.spec.ts` targets `/execution`; current pass/fail not asserted here. | `PASS_WITH_P2` |
| `/execution` does not create a parallel execution truth. | route wrapper delegates to shared runtime. | `ExecutionHub` is shared with module execution surfaces. | `src/services/api/v8/execution-control.ts`, `src/services/executionWriteTruth.ts` are shared runtime dependencies. | no route-specific assertion proving absence of duplicated truth. | `PASS_WITH_P2` |
| Runtime states are explicit. | route shell has suspense/error boundary. | `ExecutionHub` owns loading/empty/error/degraded/success behavior. | V8/fallback execution-control contracts cover service-level degraded behavior. | no full route state matrix evidence captured. | `PASS_WITH_P2` |
| AI/menu placement remains governed by Menu 3/right-side or row-scoped rules. | route wrapper adds no AI toolbar. | placement must be validated in `ExecutionHub` command row/row actions. | governed chat runtime outside this route contract. | no route-specific AI placement regression found. | `BLOCKED_P1` until UI placement evidence is captured. |
| High-impact writes remain explicit and governed. | route wrapper has no hidden writes. | writes occur in shared runtime controls where present. | `src/services/executionWriteTruth.ts`, V8 execution-control write endpoints where used. | `tests/unit/services/executionWriteTruth.test.ts`; no `/execution` route write smoke captured. | `PASS_WITH_P2` |

## 12. Open Risks and Change Log
- Risk: `/execution`, `/implementation` and `/rollout` can confuse canonical entry expectations unless navigation labels and route ownership stay explicit.
- Risk: `FullExecutionView` is a wrapper over `ExecutionHub`; any future divergence could accidentally create a second execution runtime.
- Risk: AI placement remains blocked until runtime UI evidence proves no duplicate contextual toolbar on `/execution`.
- Risk: current evidence is mostly code/doc/test-reference evidence; no fresh runtime/test output was produced by this docs-only closeout.
- Risk: execution-center e2e expectations may lag the current `ExecutionHub` allowed-view contract and need QA reconciliation before final runtime signoff.

### Open Questions

1. Should `/execution` remain a first-class full-step route long term, or be documented as legacy-compatible alias once `/implementation` is the canonical sidebar launch?
2. Which current QA smoke should be canonical for route-level `/execution` evidence: protected route smoke, execution-center e2e, or a new focused route contract test?
3. Do all AI/chat actions rendered through `ExecutionHub` on `/execution` satisfy the row-scoped/Menu 3 rule, or is a placement change required?

### Change Log

- 2026-05-10: Docs-only closeout expanded route contract, entry conditions, state model, navigation, acceptance/evidence binding, risks and open questions.
