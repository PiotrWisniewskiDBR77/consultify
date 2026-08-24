# Initiatives — current-HEAD reconciliation after expert review

Date: 2026-08-24  
Module: `INI`  
Documentation HEAD: `79be2f32ae`  
Latest browser-qualified product SHA: `e04797f99335f8e268e4dc5153c4bd2dd7a2b725`  
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

| Package | Current state | Current evidence | Remaining boundary |
|---|---|---|---|
| `INI-C01` / `INI-TECH-001` | `SUPERSEDED_BY_LATER_FIX / SOURCE_AND_TEST_PASS` | `InitiativesHub` admits sample data only through `shouldAllowDemoData()`, renders a visible `SAMPLE DATA` marker and fails closed on canonical API failure. Focused suite includes the blocking-error/no-fallback case. | Owner acceptance and full browser matrix remain open. |
| `INI-C02` / `INI-TECH-002` | `SUPERSEDED_BY_LATER_FIX / REALDB_AND_BROWSER_PASS` | Plan and Capacity receive `demoMode={allowDemoData}`; ordinary local review uses canonical APIs. Earlier disposable-PostgreSQL evidence proved create/version/publish/readback and browser reopen. | Product UX requested in `INI-C06`/`INI-C07` is not delivered by this technical closure. |
| `INI-C03` / `INI-TECH-004` | `SUPERSEDED_BY_LATER_EVIDENCE / EXACT_IDENTITY_PASS` | Exact-SHA `e04797f993` evidence proves the same canonical Initiative identity in Initiatives and Execution, stable local DB readback, non-empty downstream projections and readable actors. | Owner retest remains open; this is not release evidence. |
| `INI-C08` / `INI-TECH-003` | `SUPERSEDED_BY_LATER_FIX / SOURCE_AND_TEST_PASS` | `canonicalInitiativeMatchesRegisterFilters` applies project and priority scope before the visible projection; mixed-scope focused tests pass. | Full browser counter/filter matrix remains part of owner qualification. |
| `INI-C04` | `PARTIAL_EXACT_SHA_PASS` | Product SHA `e04797f993` was verified in browser on client/server `4007/4006`; local DB manifest records 834 migrations and deterministic counts. Execution regression evidence is indexed under `current-sha-e04797f9-2026-08-24`. | Full 21-gate Initiatives package and owner verdict are not complete. |
| `INI-C05` | `OPEN_PRODUCT_WORK` | Premise-first creation components and tests exist. | Complete AI proposal, human review, assumptions/source retention and idempotent save/readback still require end-to-end qualification. |
| `INI-C06` | `PARTIAL_PRODUCT_IMPLEMENTATION` | Versioned Plan domain and API foundation exist. The current working candidate removes raw period JSON from plan creation/workbench, generates a bounded weekly horizon from business inputs, and allows readable period add/edit/remove before save. Focused Plan regression: `2 files / 7 tests PASS`. | Status/include selection, governed AI proposal, visual editable weekly Gantt, comparison, browser qualification and cold reopen remain open. |
| `INI-C07` | `OPEN_PRODUCT_WORK` | Versioned Capacity domain and API foundation exist. | Multiple analyses per Plan, person/team saturation, governed recommendations and independent cold readback remain open. |
| `INI-C09` | `OPEN_SHARED_UI_WORK` | Shared table/preview primitives are present. | One canonical preview, concise row menu, reachable bulk selection, tablet/keyboard verification and owner visual acceptance remain open. |
| `INI-C10` | `OPEN_PRODUCT_WORK` | Versioned report definitions/runs exist in the backend foundation. | Final Plan/Capacity decision-report workflow, lineage UI and export/readback remain open. |
| `INI-C11`–`INI-C13` | `OPEN_HARDENING_WORK` | Partial error, locale and component coverage exists. | Supporting-data error taxonomy, dead-branch isolation, PL/EN, responsive and accessibility gates remain open. |

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

Result: `2 files / 7 tests PASS`. This is source/component evidence only. It
does not upgrade `C06` to browser-qualified, owner-accepted or complete Gantt
behavior.

Limitations: React `act(...)` warnings remain in the New-Initiative accessibility
test lane. They are test-quality debt and are not promoted to an owner/browser
pass. The expected fail-closed test logs the canonical API error by design.

## Current denominator and next implementation order

The consolidated denominator remains 13 closure packages. Four earlier
technical defects/gates (`C01`, `C02`, `C03`, `C08`) now have later source or
runtime evidence; `C04` is partial. The decisive product work remains:

1. `C05` — one governed premise-to-AI-draft creation flow;
2. `C06` — finish the now-readable Plan what-if with include/status selection,
   governed AI proposal, visual weekly Gantt, comparison and cold reopen;
3. `C07` — Plan-bound multi-analysis Capacity workspace;
4. `C09` — canonical preview/menu/selection behavior;
5. `C10` — versioned decision reports with lineage;
6. `C11`–`C13` — error semantics, branch isolation, locale, responsive and a11y;
7. freeze one candidate, finish `C04`, then run guided owner retest.

No package is `OWNER_ACCEPTED`, `RELEASE_READY` or `PRODUCTION_VERIFIED`.
