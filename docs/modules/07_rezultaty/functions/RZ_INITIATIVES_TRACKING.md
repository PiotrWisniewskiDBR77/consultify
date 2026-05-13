---
module_id: MODULE_RESULTS
function_id: RZ_INITIATIVES_TRACKING
function_name: Results — Initiatives Tracking
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — Initiatives Tracking

## 1. Function Identity
- Function ID: `RZ_INITIATIVES_TRACKING`
- Runtime anchor: `ResultsHub` tab `results_initiatives`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_INITIATIVES_TRACKING`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/07_rezultaty/03_BEHAVIOR.md`
  - `docs/modules/07_rezultaty/04_UI_UX.md`
  - `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`

## 2. User Job and Business Outcome
- Purpose: track initiative realization and status progression in one Results workspace, with visible value context.
- Primary user question: "Ktore inicjatywy dowoza wartosc i jaki jest ich aktualny status realizacji?"
- Business outcome: reliable initiative-level status + value tracking in `/benefits` without creating a second source of initiative truth.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=results_initiatives` is a valid and defaulted `ResultsHub` tab.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `results_initiatives`.
- `ResultsInitiativesView` is rendered when `activeTab === 'results_initiatives'`.
- Initiative status updates are user-triggered via `onChangeInitiativeStatus`.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: `initiativeId`, `initiativeName`, `initiativeStatus`, KPI linkage and value fields delivered to tracked initiatives list.
- Upstream dependencies:
  - planning/execution initiative lifecycle (status truth),
  - results dashboard snapshot for initiative/value aggregation.
- API/service evidence:
  - `src/services/api/v8/results.ts` (`V8ResultsApi.getDashboard` with `snapshot.initiatives`),
  - `src/services/initiativeWriteTruth.ts` (`updateInitiativeStatusWriteTruth`),
  - legacy fallback boundary in `ResultsHub` (`Api.get('/benefits/*')`).

## 6. Outputs and Side Effects
- Output artifacts: tracked initiative rows, filters, status badges, and links to KPI/report lanes.
- Side effects:
  - explicit status mutation via `updateInitiativeStatusWriteTruth`,
  - local row/document state refresh,
  - user toast feedback success/failure.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns initiative realization presentation in Results.
- `05_inicjatywy` and `06_realizacja` remain lifecycle owners for upstream initiative planning/execution truth.
- Forbidden ownership: this function does not own initiative strategy definition or hidden background writes.

## 8. Runtime States and UX Behavior
- Loading: route and tab load shows loading state before tracked initiatives render.
- Empty: no-linked-initiatives state must clearly indicate missing links/data.
- Error: failed loads or mutation errors surface visible feedback (`toast`).
- Degraded: fallback/partial results are visible as non-authoritative state.
- Success: rows, status controls and drill-in actions are available in `results_initiatives`.
- Next action guidance: user can pivot to KPI lane or reports lane from initiative actions.

## 9. AI, Source, Evidence, Approval
- AI placement requirement: contextual AI remains in Menu 3 / right command area, without canvas duplication.
- Source visibility: initiative value/status claims must expose source context and not mask fallback/degraded state.
- Approval: status mutation is explicit user action; no hidden transitions.
- Audit evidence: mutation path goes through governed write helper and refresh read-back.

## 10. Security, Roles, and Tenancy
- Allowed roles: tenant members with access to results and initiative visibility.
- Denied roles: unauthorized users and foreign-tenant identities.
- ACL boundary: tenant-scoped initiative/result data only.
- Failure behavior: deny-by-default when tenant or permission context is missing.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` is anchored at `/benefits`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS='/benefits'`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}`) | `src/components/Results/ResultsHub.tsx` mounted in `AppRoutes` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| Tab `results_initiatives` is a real runtime branch in `ResultsHub`. | `/benefits` route hosts `ResultsHub` | `ResultsHub.tsx` (`VALID_TABS`, default tab fallback, `activeTab === 'results_initiatives'` -> `ResultsInitiativesView`) | n/a | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (ResultsHub runtime behavior baseline; no dedicated initiatives-tab assertion) | `PASS_WITH_P2` |
| Initiative status update is explicit and not hidden. | `/benefits` user action context | `ResultsHub.tsx` `handleInitiativeStatusChange` triggered by `onChangeInitiativeStatus` | `src/services/initiativeWriteTruth.ts` -> `Api.patch('/initiatives/:id/status')` and read-back refresh | `tests/unit/services/initiativeWriteTruth.test.ts`, `tests/e2e/full-flow.spec.ts` transition validation for `PATCH /api/initiatives/:id/status` | `PASS` |
| Initiative/value rows come from governed results data contracts. | `/benefits` runtime | `ResultsHub.tsx` loads and maps tracked initiatives before rendering tab content | `src/services/api/v8/results.ts` (`V8ResultsApi.getDashboard`), legacy fallback path support in runtime | `tests/unit/services/v8-results-api.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |

## 12. As-Is -> Delta

### As-Is
- Route and component anchors are real and active.
- API layer includes governed V8 results reads and governed initiative status write helper.
- Cross-suite tests exist for route mapping, smoke navigation, V8 API client and initiative write truth.

### Delta Closed In This Pass
- Added function-level evidence matrix with mandatory `route + component + API + test` references.
- Normalized explicit scope anchor and docs-only work type.
- Prepared task-ready rows (`RZ-INI-P0-001`, `RZ-INI-P1-001`, `RZ-INI-P2-001`) for module board sync.

## 12A. GAP Summary (Behavior / UX / Evidence / Governance / Ownership)

### P0 (must close in docs gate)
- Behavior gap: no single function-level narrative previously connected initiatives lane to closed-loop value realization doctrine.
- UX gap: initiatives lane contract did not explicitly bind world-class target posture from RAW input (stage, health, evidence confidence, next action).
- Evidence gap: mandatory `route + component + API + test` binding for each critical claim was incomplete before closeout.
- Governance gap: explicit distinction between declared/calculated/verified benefit posture was not formalized for this function card.
- Ownership gap: Results-vs-Initiatives/Execution boundaries were present but not framed as non-negotiable handoff doctrine for this function.

### P1 (client expectation uplift)
- Behavior: no explicit function-level cadence/review contract for initiative realization checks.
- UX: no explicit matrix for "initiatives without KPI" and "initiatives without evidence" as first-class governance states.
- Evidence: dedicated initiatives-tab regression assertion is still indirect in current suite.
- Governance: confidence posture is not yet represented as explicit function acceptance checkpoint.
- Ownership: cross-module handoff evidence to Finance reconciliation is documented at module/SSOT level, but not deepened at function operation checklist level.

### P2 (premium/world-class differentiators)
- Behavior: no explicit function-level decomposition of closed loop `deviation -> corrective action -> verified improvement`.
- UX: no premium cockpit-level operator signals codified directly in this function card.
- Evidence: no dedicated lineage-depth evidence pack for degraded/fallback provenance in initiatives lane.
- Governance: no function-specific approval/diff matrix for high-impact initiative value claims.
- Ownership: no explicit escalation matrix when ownership boundaries are violated (e.g., silent overwrite risk).

## 13. Task Board Ready Rows (RZ-INI)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-INI-P0-001` | `07_rezultaty/RZ_INITIATIVES_TRACKING` | `P0` | `READY` | `docs` | owner acceptance | route `/benefits`; component `ResultsHub` + `ResultsInitiativesView`; API `initiativeWriteTruth` + V8 dashboard; tests routeMapping + sidebar smoke + initiativeWriteTruth + v8-results-api | `functions/RZ_INITIATIVES_TRACKING.md` |
| `RZ-INI-P1-001` | `07_rezultaty/RZ_INITIATIVES_TRACKING` | `P1` | `WAITING_P0` | `test/docs` | `RZ-INI-P0-001` | route `/benefits`; component `results_initiatives` tab branch; API initiative status patch path; add dedicated tab regression evidence | `functions/RZ_INITIATIVES_TRACKING.md` |
| `RZ-INI-P2-001` | `07_rezultaty/RZ_INITIATIVES_TRACKING` | `P2` | `WAITING_P0` | `docs` | `RZ-INI-P0-001`,`RZ-INI-P1-001` | route `/benefits`; component-level lineage/empty/degraded UX assertions; API fallback/degraded evidence; e2e/visual evidence links | `functions/RZ_INITIATIVES_TRACKING.md` |

## 14. Unified Development Plan (single sequence)

1. `RZ-INI-P0-001` - lock function doctrine and hard evidence contract.
   - Acceptance: all critical claims mapped to `route + component + API + test`; gap taxonomy documented; ownership and governance clauses explicit.
   - Evidence: `RZ_INITIATIVES_TRACKING.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md`, board row status.
2. `RZ-INI-P1-001` - raise client expectation baseline for runtime confidence.
   - Acceptance: dedicated initiatives-tab assertion coverage defined; explicit UX posture for `without KPI`, `without evidence`, and review cadence prepared.
   - Evidence: acceptance matrix expansion and board dependency trace from P0.
3. `RZ-INI-P2-001` - premium/world-class differentiation package.
   - Acceptance: lineage-depth/degraded-state evidence model and premium operator expectations documented as follow-up contract.
   - Evidence: RAW target delta mapping + premium backlog references in packet and acceptance docs.

Dependency rule: `P1` and `P2` stay blocked by design until `P0` is accepted and marked docs-complete.

## 12. Open Risks and Change Log
- `P0`: none in docs closeout.
- `P1`: no hard blocker found for docs gate.
- `P2`: no dedicated automated assertion for `results_initiatives` branch behavior in current `ResultsHub` component tests.

## 15. Approval + Unblock Decision

- `P0`: none in docs closeout.
- `P1`: no hard blocker found for docs gate.
- `P2`: no dedicated automated assertion for `results_initiatives` branch behavior in current `ResultsHub` component tests.

- Decision: `APPROVED_FOR_DOCS`.
- Unblock action: scope anchor `07_rezultaty/RZ_INITIATIVES_TRACKING` is unblocked for docs-delivery continuation.
- Operational interpretation:
  - `RZ-INI-P0-001` is approved as active baseline row.
  - `RZ-INI-P1-001` and `RZ-INI-P2-001` remain intentionally queued behind P0 completion.
