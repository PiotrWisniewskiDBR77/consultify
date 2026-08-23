# Initiatives — independent technical and integration review

Date: 2026-08-24  
Repository: `/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823`  
Exact reviewed HEAD: `2cf780d62f9a421ec4b372e8168b247435c464ec`  
Evidence class: `SOURCE_ONLY`  

## Verdict

`SOURCE_ARCHITECTURE_SUBSTANTIAL / ACCEPTANCE_NO_GO`

The current source contains a substantial canonical Initiative + Execution implementation: authenticated and organization-scoped `runtime-v1` routes, versioned material commands, audit/outbox/idempotency tables, initiative cards, governed gates, plan and capacity scenarios, execution cases, work, reports and an explicit Initiative → Execution deep link. This is not “only a mock frontend”.

It is **not acceptable as a proven integrated module at this SHA**. In every Vite development build the Initiatives register, Plan and Capacity are forced into demo behavior. The register additionally replaces a failed canonical read with apparently valid demo rows. Therefore a populated local screen cannot prove that the backend, schema, persistence, tenant boundary or Initiative → Execution readback works. Requested planning/capacity AI workflows also remain explicitly disabled in the source.

This review does **not** claim runtime, browser, database migration, persistence/readback, owner acceptance or release evidence.

## What exists in current source

| Layer | Exact source evidence | Classification |
|---|---|---|
| Canonical route | `src/routes/AppRoutes.tsx:107-109,2175`; `src/views/FullInitiativesView.tsx:4-13` | Real frontend mount: `/initiatives` → `InitiativesHub`. |
| Canonical top-level IA | `src/components/Initiatives/InitiativesHub.tsx:237-241,664-683,688-698` | Real frontend: only Initiatives, Plan, Capacity; invalid historical tab query is normalized. |
| Register read | `src/components/Initiatives/InitiativesHub.tsx:449-525`; `src/services/initiatives-execution/runtimeApi.ts:986-995` | Real API client: `GET /api/initiatives/runtime-v1/initiatives`. |
| Canonical server router | `server/src/routes/pmo/initiatives.routes.ts:141-158`; `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1724-1741` | Real backend: authenticated/org membership middleware plus per-project `initiative.view` authorization. |
| Material-command store | `server/migrations/932_initiatives_execution_material_commands.sql:1-3,33-40,68-129` | Real schema migration: aggregate state, idempotency receipts, audit, outbox and relations. Applied state was not checked. |
| Cards and governance | `server/migrations/933_initiative_card_versions.sql:6-80`; `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1855-2645` | Real backend/schema for selection, publication, review and definition/analysis gates. |
| Plan | `src/components/Initiatives/PlanScenarioSurface.tsx:171-221`; `src/services/initiatives-execution/runtimeApi.ts:780+` | Real API-backed scenario register/read/write exists, but is bypassed in DEV (finding INI-TECH-002). |
| Capacity | `src/components/Initiatives/CapacityScenarioSurface.tsx:314-344`; `src/services/initiatives-execution/runtimeApi.ts:128+,1555-1565` | Real API-backed capacity scenario/options/commitment implementation exists, but is bypassed in DEV. |
| Initiative → Execution UI | `src/components/Initiatives/InitiativesHub.tsx:1695-1703`; `src/components/Initiatives/CanonicalInitiativeCardWorkspace.tsx:1272-1277` | Real deep link: canonical card opens `/execution?tab=list&open=<executionCaseId>`. |
| Execution server read | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:3667-3735` | Real organization/project-authorized execution-case list, detail and initiative link. |
| Identity seam | `server/migrations/20260927_runtime_v1_execution_identity_seam.sql:1-35` | Source migration defines unique Runtime-v1 initiative/case identity. Applied state was not checked. |
| Governed auto-start | `server/src/jobs/initiativeAutoStartJob.ts:9-31,119-130` | Real source uses the canonical transition engine rather than a raw lifecycle update. |
| Deterministic review fixtures | `src/components/Initiatives/initiativesDemoData.ts:767-815`; `src/components/Initiatives/PlanScenarioSurface.tsx:148-169`; `src/components/Initiatives/CapacityScenarioSurface.tsx:288-312` | Mock/sample data only; not persistence evidence. |
| Deprecated compatibility UI | `src/views/InitiativeManagementView.tsx:1-13,102,187-194` | Legacy source remains, including a direct EXECUTING transition pattern; not the canonical route. |

## Findings

### INI-TECH-001 — implicit DEV fixtures mask canonical API failure

- Priority: **P0**
- Literal evidence:
  - `src/components/Initiatives/InitiativesHub.tsx:358-361` sets `allowDemoData = import.meta.env.DEV || shouldAllowDemoData()`.
  - `src/components/Initiatives/InitiativesHub.tsx:385-397` always appends demo initiatives when that flag is true.
  - `src/components/Initiatives/InitiativesHub.tsx:525-564` replaces an exhausted canonical fetch failure with demo rows, clears `loadError`/`loadErrorCode`, and only sets an internal degraded flag.
- Impact: a local reviewer sees a populated and coherent register even when `/runtime-v1/initiatives` is unavailable. Backend, auth, tenant, schema and persistence failures can be misreported as a working module.
- Testable gate:
  1. With no explicit sample-data switch and the runtime API returning 500/network failure, the screen shows a blocking canonical-data error and zero unlabelled demo rows.
  2. Demo rows appear only after an explicit fixture mode, carry a persistent visible `SAMPLE DATA` marker, and never merge with canonical rows.
  3. Production and ordinary DEV paths share the same fail-closed source selection contract.

### INI-TECH-002 — ordinary DEV never exercises real Plan or Capacity backends

- Priority: **P0**
- Literal evidence:
  - `InitiativesHub` passes `demoMode={allowDemoData}` to Plan and Capacity at `src/components/Initiatives/InitiativesHub.tsx:1648-1666`.
  - `allowDemoData` is unconditionally true in DEV at `InitiativesHub.tsx:358-361`.
  - Plan returns a hard-coded scenario before calling the API at `src/components/Initiatives/PlanScenarioSurface.tsx:146-170`; API code begins only at line 171.
  - Capacity returns a hard-coded scenario before calling the API at `src/components/Initiatives/CapacityScenarioSurface.tsx:286-313`; API calls begin at lines 314-318.
- Impact: the exact local environment used for owner review cannot validate scenario listing, create/edit, conflict handling, versioning, cold readback or association with canonical initiatives/plans.
- Testable gate:
  1. DEV without an explicit fixture flag calls `listPlanScenarioRegister()` and `listCapacityScenarioRegister()`.
  2. An explicit fixture-mode contract test proves mocks; a separate integration test proves the real endpoints and persisted reopen after refresh.
  3. UI visibly identifies which source is active.

### INI-TECH-003 — constructed register query is discarded; project and priority filtering are not enforced client-side

- Priority: **P1**
- Literal evidence:
  - `src/components/Initiatives/InitiativesHub.tsx:460-472` builds `projectId`, status, priority and search parameters.
  - Line 474 calls `listRegisteredInitiatives()` with no parameters; `runtimeApi.ts:986-995` exposes only an optional abort signal and sends no query.
  - The local filter at `InitiativesHub.tsx:483-514` checks scope/status/lifecycle/search, but not `currentProjectId` or `filters.priority`.
  - Server `GET /initiatives` returns every organization row individually authorized for view at `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1724-1740`; it does not narrow by requested project.
- Impact: a selected-project or priority view can contain more initiatives than requested. This undermines counters, plan input selection and duplicate review; it is also a least-data-display issue even though server-side project authorization exists.
- Testable gate:
  1. Seed two authorized projects and two priorities; selecting one project/priority returns only the exact expected IDs and reconciled counts.
  2. Either pass validated query filters to the server or apply all filters explicitly client-side; test both API request and rendered denominator.

### INI-TECH-004 — Initiative → Execution has source wiring but no exact-SHA integration proof

- Priority: **P1 release gate**
- Literal evidence:
  - UI deep link exists at `src/components/Initiatives/InitiativesHub.tsx:1695-1703`.
  - Server organization/project-authorized execution reads exist at `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:3667-3735`.
  - Unique Runtime-v1 identity constraints are defined by `server/migrations/20260927_runtime_v1_execution_identity_seam.sql:19-35`.
  - Real-PG suites exist, including `tests/integration/initiatives-execution/goldenThread.http.realdb.test.ts` and `server/src/services/__tests__/initiativeRuntimeExecutionSeam.pg.test.ts`; they were not executed in this source-only audit.
- Impact: source plausibility is high, but the decisive contract—one initiative identity, one execution case, consistent lifecycle and cold readback—remains unproven for this HEAD and actual database.
- Testable gate:
  1. Register one source proposal; approve required gates; create/open exactly one execution case.
  2. Verify the same initiative ID/case ID from Initiatives and Execution after process restart and cold readback.
  3. Verify foreign-organization/project denial and zero duplicate/shadow rows.
  4. Prove task/decision/resource updates project back to the same Initiative without a second status truth.

### INI-TECH-005 — dual classic/runtime materialization remains an architectural seam

- Priority: **P1**
- Literal evidence:
  - `server/src/services/initiative/__tests__/ini-bvp-001-candidate-single-materialization.pg.test.ts:5-31` documents two independent stores: relational `initiatives` and event-sourced `ie_aggregate_state`, plus the historical double-materialization failure and its guards.
  - `server/src/routes/pmo/initiatives.routes.ts:152-158` declares Runtime-v1 the sole writer and places a compatibility writer guard before legacy CRUD.
  - Deprecated UI still contains classic reads/writes and a direct EXECUTING transition pattern at `src/views/InitiativeManagementView.tsx:102,187-194`.
- Impact: the current design includes defensive reconciliation, but any accidental legacy mount/import or unguarded service call can recreate split identities/statuses.
- Testable gate:
  1. Mounted-route test proves every legacy material writer returns the canonical cutover error.
  2. Concurrent classic/runtime registration converges to one canonical identity with no second initiative row.
  3. Static reachability gate proves the deprecated view is not imported by any active route/bundle entry; remove it once compatibility is no longer required.

### INI-TECH-006 — requested AI planning/capacity mechanics are present only as disabled affordances

- Priority: **P1**
- Literal evidence:
  - Plan source has no Gantt/drag implementation; its AI menu item is disabled with `AI suggestions require an explicit governed analysis request` at `src/components/Initiatives/PlanScenarioSurface.tsx:625`.
  - Capacity exposes the same disabled explanation at `src/components/Initiatives/CapacityScenarioSurface.tsx:556`.
  - Owner contract remains `SPECIFIED / IMPLEMENTATION_PENDING` for editable What-If/Gantt and multi-analysis capacity at `docs/program/waves/WAVE_03_ACCEPTANCE/modules/05_INITIATIVES/MODULE_ACCEPTANCE.md:77-78`.
- Impact: saved scenario primitives exist, but the promised workflow—include/exclude, AI sequencing, editable Gantt, multiple capacity analyses and human-approved reallocation—is not deliverable from the current UI.
- Testable gate:
  1. Plan: create scenario, choose status/initiative set, include/exclude rows, run governed analysis, drag dates, save version, reload exact arrangement.
  2. Capacity: select a saved plan, create two independent versioned analyses, show person/team saturation with uncertainty, request suggestions, approve/reject, reload.
  3. AI never mutates canonical initiative dates/resources without an explicit human-approved material command.

### INI-TECH-007 — supporting data failures collapse to empty/absent state

- Priority: **P2**
- Literal evidence:
  - Pending planning decisions catch every error and set `[]` at `src/components/Initiatives/InitiativesHub.tsx:400-408`.
  - V8 initiative snapshot catches every error and sets `null` at `InitiativesHub.tsx:416-442`.
- Impact: “nothing pending” and “snapshot unavailable” are indistinguishable. Readiness/next-action UI can look complete while integration data is missing.
- Testable gate: mocked 403, 404, 500 and network failures render distinct explicit states; only a successful empty response renders “none”. Telemetry carries endpoint and stable error code without secrets.

### INI-TECH-008 — dead historical branches increase regression surface

- Priority: **P2**
- Literal evidence:
  - Canonical tab set is only `list`, `plan`, `capacity` at `InitiativesHub.tsx:237-241` and invalid query tabs are normalized at lines 688-698.
  - The same component retains full branches for `candidates` and `portfolio` at `InitiativesHub.tsx:1538-1613,1629-1646` plus historical states such as `observability`/`portfolioHealth`.
  - `src/views/InitiativeManagementView.tsx:1-13` is deprecated but remains a large alternate implementation.
- Impact: multiple dormant interaction models make future edits likely to patch the wrong surface or accidentally re-enable noncanonical writers/navigation.
- Testable gate: dependency/reachability report proves only the canonical surface is routable; delete or isolate historical UI behind a clearly named nonproduction package after preserving any required read-only compatibility.

### INI-TECH-009 — migration presence is not migration readiness

- Priority: **P1 release gate**
- Literal evidence:
  - Runtime foundation is in `server/migrations/932_initiatives_execution_material_commands.sql`; card schema in `933_initiative_card_versions.sql`; time basis in `935_plan_scenario_time_basis.sql`; execution identity seam in `20260927_runtime_v1_execution_identity_seam.sql`.
  - Initiative SQL also exists under the explicitly non-applied directory, e.g. `server/migrations/never-ran/003_add_initiative_progress.sql.sql`, `011_initiative_generator.sql.sql`, `617_initiative_dependencies_source_id.sql`, `670_initiative_kpi_assignment_runtime.sql`.
- Impact: file existence cannot prove the target DB supports the exact code. Confusing `never-ran` assets with applied migrations can cause missing-column failures or unsafe ad-hoc repair.
- Testable gate: against a disposable database created by the canonical migration runner, prove the exact applied ledger, required tables/constraints/indexes and a full Initiative → Execution transaction; then compare the intended target database read-only. No manual DDL.

## Focused source-test result

Command executed without database or browser:

```text
npx vitest run src/routes/__tests__/initiativesCanonicalRoute.test.ts \
  src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx \
  --maxWorkers=1 --maxConcurrency=1 --reporter=dot
```

Result: `2 test files passed; 19 tests passed` in 4.77 s.

What this proves: canonical route mapping, basic Hub mounting, selected mocked register/deep-link behavior and wizard affordance at this working tree.  
What this does not prove: real server reachability, migration state, Postgres semantics, auth/tenant boundary, persistence/readback, Plan/Capacity real endpoints, browser layout, Initiative → Execution integration or owner acceptance.

## Minimum closure order

1. **Truthful local data source (P0):** remove implicit DEV fixture behavior and stop masking API failure.
2. **Real Plan/Capacity local path (P0):** require explicit fixture mode; ordinary local review must hit canonical endpoints.
3. **Register scope correctness (P1):** enforce project and priority filters with reconciled counters.
4. **Exact identity golden thread (P1 gate):** disposable-Postgres Initiative → Execution creation, authorization, restart and cold readback.
5. **Complete product flow (P1):** governed Analyze AI, editable What-If/Gantt and versioned capacity analyses.
6. **Reduce ambiguity (P2):** explicit auxiliary-error states and isolation/removal of dead historical branches.
7. Only then perform current-SHA browser/visual review and owner acceptance against the canonical, nonfixture path.

## Final evidence boundary

- `SOURCE`: inspected at exact HEAD stated above.
- `UNIT/COMPONENT`: only the focused 19-test command stated above.
- `RUNTIME`: `NOT VERIFIED`.
- `BROWSER`: `NOT VERIFIED`.
- `DATABASE / MIGRATIONS APPLIED`: `NOT VERIFIED`.
- `PERSISTENCE / COLD READBACK`: `NOT VERIFIED`.
- `INITIATIVE → EXECUTION GOLDEN THREAD`: `NOT VERIFIED`.
- `OWNER_ACCEPTED`: `NO / PENDING`.
- `RELEASE_READY`: `NO`.
