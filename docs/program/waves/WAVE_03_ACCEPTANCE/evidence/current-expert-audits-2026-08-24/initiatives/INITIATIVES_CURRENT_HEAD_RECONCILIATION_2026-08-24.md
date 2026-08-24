# Initiatives — current-HEAD reconciliation after expert review

Date: 2026-08-24  
Module: `INI`  
Documentation HEAD: `8a3fc80deb`
Latest browser-qualified product SHA: `e04797f99335f8e268e4dc5153c4bd2dd7a2b725`  
Latest exact-SHA runtime-qualified candidate: `8a3fc80deb6283e25e944aa2f29c006197cd8105`
Decision: `NO-GO_FOR_OWNER_ACCEPTANCE / REMEDIATION_REQUIRED`

## Purpose and evidence boundary

The three expert reports inspected source at
`2cf780d62f9a421ec4b372e8168b247435c464ec`. They remain preserved as the
independent review record. This reconciliation prevents findings already fixed
on later commits from being treated as current source defects. It does not
replace the expert reports, close owner findings, or qualify release.

The runtime evidence below used only a disposable local PostgreSQL database,
real local authentication and the clean integration checkout. Railway and
production were not changed.

## Reconciled closure packages

| Package                    | Current state                                        | Current evidence                                                                                                                                                                                                                                                                                                                                                                 | Remaining boundary                                                                                                                       |
| -------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `INI-C01` / `INI-TECH-001` | `SUPERSEDED_BY_LATER_FIX / SOURCE_AND_TEST_PASS`     | `InitiativesHub` admits sample data only through `shouldAllowDemoData()`, renders a visible `SAMPLE DATA` marker and fails closed on canonical API failure. Focused suite includes the blocking-error/no-fallback case.                                                                                                                                                          | Owner acceptance and full browser matrix remain open.                                                                                    |
| `INI-C02` / `INI-TECH-002` | `SUPERSEDED_BY_LATER_FIX / REALDB_AND_BROWSER_PASS`  | Plan and Capacity receive `demoMode={allowDemoData}`; ordinary local review uses canonical APIs. Earlier disposable-PostgreSQL evidence proved create/version/publish/readback and browser reopen.                                                                                                                                                                               | Product UX requested in `INI-C06`/`INI-C07` is not delivered by this technical closure.                                                  |
| `INI-C03` / `INI-TECH-004` | `SUPERSEDED_BY_LATER_EVIDENCE / EXACT_IDENTITY_PASS` | Exact-SHA `e04797f993` evidence proves the same canonical Initiative identity in Initiatives and Execution, stable local DB readback, non-empty downstream projections and readable actors.                                                                                                                                                                                      | Owner retest remains open; this is not release evidence.                                                                                 |
| `INI-C08` / `INI-TECH-003` | `SUPERSEDED_BY_LATER_FIX / SOURCE_AND_TEST_PASS`     | `canonicalInitiativeMatchesRegisterFilters` applies project and priority scope before the visible projection; mixed-scope focused tests pass.                                                                                                                                                                                                                                    | Full browser counter/filter matrix remains part of owner qualification.                                                                  |
| `INI-C04`                  | `PARTIAL_EXACT_SHA_PASS`                             | Product SHA `e04797f993` was verified in browser on client/server `4007/4006`; local DB manifest records 834 migrations and deterministic counts. Execution regression evidence is indexed under `current-sha-e04797f9-2026-08-24`.                                                                                                                                              | Full 21-gate Initiatives package and owner verdict are not complete.                                                                     |
| `INI-C05`                  | `OPEN_PRODUCT_WORK`                                  | Premise-first creation components and tests exist.                                                                                                                                                                                                                                                                                                                               | Complete AI proposal, human review, assumptions/source retention and idempotent save/readback still require end-to-end qualification.    |
| `INI-C06`                  | `PARTIAL_PRODUCT_IMPLEMENTATION / EXACT_SHA_RUNTIME_PASS` | Versioned Plan domain and API foundation exist. Commits `1dc1761cfd` and `02aca5ee25` remove raw period JSON, generate and edit a bounded weekly horizon, expose lifecycle/status filtering and include/exclude selection, and render a clickable weekly timeline with one-period movement. Commit `22ce590d7a` connects persistent scenario history/diff to explicit read-only comparison. Commit `a5a2f427fe` adds an event-stored Plan-analysis proposal pinned to exact aggregate/scenario versions, explicit assumptions/rationale/conflicts, human Accept/Reject review and before/after changes. Accept applies only to the unsaved UI draft; Save and Publish remain separate decisions. The proposal engine is currently deterministic dependency ordering and is not misrepresented as provider-backed AI. Focused Plan regression: `2 files / 9 tests PASS`; touched-file lint has zero errors. Candidate `a5a2f427fe` passed the isolated owner-runtime contract on server/client `4046/4047`: health, readiness, frontend and transformed client marker all returned the exact candidate SHA; both migration ledgers were green with 834 migrations and the marked Initiatives fixture database was preserved. | Provider-backed AI/provenance, richer Gantt interaction, authenticated visible browser replay and independent cold reopen remain open. |
| `INI-C07`                  | `PARTIAL_PRODUCT_IMPLEMENTATION / EXACT_SHA_RUNTIME_PASS` | Commit `8a3fc80deb` adds an explicit New Analysis flow bound to an exact published Plan/version, independent DRAFT analysis identity, readable person/team saturation ranges, preserved `UNKNOWN` demand/supply states and the existing versioned Capacity register/write contract. Focused Capacity regression: `2 files / 5 tests PASS`; touched-file lint has zero errors. The same SHA passed the isolated owner-runtime contract on server/client `4056/4057` with 834 migrations and the preserved marked fixture database. | The retained fixture contains no Plan/Capacity aggregates, so two-analysis persistent cold readback is still `EVIDENCE_MISSING`. Provider-backed AI, explicit governed proposal acceptance and authenticated browser replay also remain open. |
| `INI-C09`                  | `OPEN_SHARED_UI_WORK`                                | Shared table/preview primitives are present.                                                                                                                                                                                                                                                                                                                                     | One canonical preview, concise row menu, reachable bulk selection, tablet/keyboard verification and owner visual acceptance remain open. |
| `INI-C10`                  | `OPEN_PRODUCT_WORK`                                  | Versioned report definitions/runs exist in the backend foundation.                                                                                                                                                                                                                                                                                                               | Final Plan/Capacity decision-report workflow, lineage UI and export/readback remain open.                                                |
| `INI-C11`–`INI-C13`        | `OPEN_HARDENING_WORK`                                | Partial error, locale and component coverage exists.                                                                                                                                                                                                                                                                                                                             | Supporting-data error taxonomy, dead-branch isolation, PL/EN, responsive and accessibility gates remain open.                            |

## Current focused regression

Command:

```text
npx vitest run \
  src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx \
  src/components/Initiatives/__tests__/initiativeRegisterProjection.scope.test.ts \
  src/components/Initiatives/__tests__/InitiativesHub.newModalA11y.test.tsx \
  src/components/Initiatives/__tests__/InitiativesHub.previewDetails.t25.test.tsx \
  --maxWorkers=1 --maxConcurrency=1 --reporter=dot
```

Result: `4 files / 136 tests PASS`.

Current bounded Plan increment:

```text
npx vitest run \
  tests/unit/initiatives-execution/planScenario.test.ts \
  tests/unit/initiatives-execution/planScenarioSurface.test.tsx
```

Result: `2 files / 7 tests PASS`. Component lint: zero findings. This is
source/component evidence only. It does not upgrade `C06` to browser-qualified,
owner-accepted or complete Gantt behavior.

Current bounded scenario-comparison increment:

```text
npx vitest run \
  tests/unit/initiatives-execution/planScenarioSurface.test.tsx
```

Result: `1 file / 6 tests PASS`. Component lint: zero findings. The isolated
exact-SHA runtime on `4036/4037` qualified product SHA `22ce590d7a`, both
migration ledgers and the preserved fixture database. The runtime was then
stopped through the canonical stop contract; only owned process groups were
terminated, ports were released and the database/catalog were preserved.

The full TypeScript check completed with a larger heap and reported five
pre-existing errors outside the touched component: four in
`initiativeRegisterProjection.scope.test.ts` and one in `InitiativesHub.tsx`.
They remain explicit repository debt and are not misreported as caused or fixed
by this bounded C06 increment.

Current governed-analysis increment:

```text
npx vitest run \
  tests/unit/initiatives-execution/planScenarioSurface.test.tsx \
  tests/unit/initiatives-execution/planScenario.test.ts
```

Result: `2 files / 9 tests PASS`. Touched-file lint: zero errors. Exact-SHA
runtime `a5a2f427fe` passed on `4046/4047` with 834 migrations, correct client
marker and preserved marked fixture database. Visible browser navigation reached
the real login gate on the same SHA; because the runtime correctly had no test
auth bypass, the authenticated Analyze/Accept/Reject replay remains
`PENDING`, not passed. The canonical stop contract terminated only owned process
groups, released both ports and preserved the database/catalog.

Current bounded Capacity increment:

```text
pnpm exec vitest run \
  tests/unit/initiatives-execution/capacityScenarioSurface.test.tsx \
  tests/unit/initiatives-execution/capacityScenario.test.ts
```

Result: `2 files / 5 tests PASS`. Touched-file lint: zero errors and four
pre-existing warnings. Exact-SHA runtime `8a3fc80deb` passed on `4056/4057`:
health, authoritative readiness, frontend and transformed client marker matched
the candidate; both migration ledgers were green with 834 migrations; the
marked Initiatives fixture database was preserved. Normal browser navigation
reached the real login gate with all test auth bypasses disabled. A direct
read-only database check found no `plan_scenario` or `capacity_scenario`
aggregates in that retained Execution fixture. Therefore authenticated UI replay
and persistent independent multi-analysis cold readback remain explicitly
pending. The canonical stop contract terminated only owned process groups,
released both ports and preserved the database/catalog.

Limitations: React `act(...)` warnings remain in the New-Initiative accessibility
test lane. They are test-quality debt and are not promoted to an owner/browser
pass. The expected fail-closed test logs the canonical API error by design.

## Current denominator and next implementation order

The consolidated denominator remains 13 closure packages. Four earlier
technical defects/gates (`C01`, `C02`, `C03`, `C08`) now have later source or
runtime evidence; `C04` is partial. The decisive product work remains:

1. `C05` — one governed premise-to-AI-draft creation flow;
2. `C06` — qualify and finish the now-readable Plan what-if: governed AI
   proposal, richer weekly Gantt interaction and cold reopen;
3. `C07` — finish provider-backed governed recommendations, authenticated replay
   and two independent cold-reopened analyses for the now Plan-bound Capacity
   workspace;
4. `C09` — canonical preview/menu/selection behavior;
5. `C10` — versioned decision reports with lineage;
6. `C11`–`C13` — error semantics, branch isolation, locale, responsive and a11y;
7. freeze one candidate, finish `C04`, then run guided owner retest.

No package is `OWNER_ACCEPTED`, `RELEASE_READY` or `PRODUCTION_VERIFIED`.
