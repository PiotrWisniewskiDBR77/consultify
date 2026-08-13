# Pakiet G — Prediction (scenario builder + Modele/Wyniki) — raport końcowy

Data: 2026-08-12. Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-g-prediction`, gałąź
`codex/fv3p-g-prediction`, baza `49071c3e2d`.

**Końcowy SHA: `278d00ac1e`** (jeden commit, `feat(finance-v3/pkg-g): prediction scenario builder —
domain model + API client + UI shell`).

Ten raport jest daną wejściową dla niezależnej weryfikacji — nie zawyżam. Sekcja "Czego NIE
dostarczono" jest tak samo ważna jak sekcja "Co dostarczono".

## Commity

```
278d00ac1e feat(finance-v3/pkg-g): prediction scenario builder — domain model + API client + UI shell
```

Jeden commit (13 plików, +2987/-0) — hooki pre-commit (`check-list-canon.sh`, `check-artefakt.sh`,
`check-triada.sh`, `check-gestosc.sh`, `check-focus-canon.sh`) wszystkie przeszły, dług nie wzrósł
ponad baseline dla żadnego z nich.

## `git diff --stat` (49071c3e2d..HEAD)

```
 .claude/launch.json                                |  13 +
 dev-render/main.tsx                                |   5 +
 dev-render/screens/finance-prediction-workspace.tsx | 126 +++
 src/components/Finance/Prediction/PredictionWorkspace.tsx     | 110 +++
 src/components/Finance/Prediction/ScenarioAssumptionsView.tsx | 464 ++++++++++
 src/components/Finance/Prediction/ScenarioResultsView.tsx     | 157 ++++
 src/components/Finance/Prediction/__tests__/PredictionWorkspace.test.tsx      |  56 ++
 src/components/Finance/Prediction/__tests__/predictionScenarioModel.test.ts   | 776 +++++++++++++++++
 src/components/Finance/Prediction/predictionScenarioModel.ts                  | 966 +++++++++++++++++++++
 src/components/Finance/Prediction/predictionWorkspaceBarConfig.ts             | 106 +++
 src/hooks/useFinancePredictionWorkspaceFlag.ts     |  48 +
 src/services/api/financeV2.api.ts                  |  64 ++
 src/services/api/financeV2.types.ts                |  96 ++
 13 files changed, 2987 insertions(+)
```

`.claude/launch.json` and `dev-render/main.tsx` are the only touches outside the strict allowlist —
both are additive registrations for my own dev-render harness entry (a new vite-server config entry
and a new `SCREENS` registry line), following the exact pattern every prior package in this program
used for its own dev-render screen. No existing entry was modified.

## Inwentaryzacja PRZED kodem (co zastałem)

Grep-verified before writing anything, per the brief's explicit instruction:

- **Backend prediction engines: fully implemented and HTTP-mounted.**
  `server/src/services/finance/canonical/predictionPreflightService.ts` (549 lines) and
  `predictionComputeService.ts` (844 lines) are complete. `server/src/routes/v8/finance-v2/prediction.routes.ts`
  mounts exactly two endpoints, `POST /prediction/:businessVersionId/preflight` and
  `POST /prediction/:businessVersionId/calculate` — DEC-FIN-004 (two separate calls) is respected in
  the router itself, both by contract and by the router's own header comment.
- **Layer 1 double-counting is a live SQL function**, `finance_prediction_detect_overlaps()`
  (`server/migrations/20260809_finance_v3_d07_prediction_03_readiness.sql:45-98`), grouping by
  `(entity_id, canonical_line_id, period_id)` across driver_overrides + impact_chain + financing
  (closed mapping: `FACILITY_DRAWDOWN`/`DISCRETIONARY_REPAYMENT` → `LONG_TERM_DEBT`+`INTEREST_EXPENSE`,
  `DIVIDEND_DECLARATION` → `DIVIDENDS_DECLARED`+`RETAINED_EARNINGS`, `EQUITY_INJECTION`/`SHARE_BUYBACK`
  → `EQUITY`). Layer 2 (real-currency preview) lives in `predictionPreflightService.ts`.
- **Compute gate is three named checks** (`finance_prediction_readiness_check()`, same file
  lines 107-154): `HAS_CURRENT_PREFLIGHT`, `NO_OPEN_REQUIRED_RESOLUTIONS`,
  `NO_OPEN_UNDEFINED_MATH` — only the third is a genuine hard block (security/undefined-math); the
  first two gate *compute*, never assumption-building (matches DEC-FIN-004's own stated intent,
  literally quoted in the file's comments).
- **Base = Baseline is structural, not "happens to match"**: `runStandardBase()` in
  `predictionComputeService.ts` never writes an independent `finance_prediction_outputs` row for
  `STANDARD_BASE` (DB trigger `finance_prediction_forbid_standard_base_outputs()` physically forbids
  it) — the Models/Results UI reads it exclusively through `finance_prediction_outputs_effective`,
  which for `STANDARD_BASE` reads `finance_baseline_outputs` directly. There is only ever one
  underlying row.
- **What did NOT exist**: any HTTP CRUD for `finance_prediction_scenarios` /
  `_driver_overrides` / `_initiatives` / `_impact_chain` / `_financing`. `artifacts.routes.ts`'s
  generic `POST /artifacts` can create a `PREDICTION_SCENARIO` artifact/business-version row, but
  nothing writes the domain rows (scenario_mode, driver overrides, initiatives, impact chain,
  financing events) that the scenario builder needs to persist. See "Czego NIE dostarczono" below.
- **Frontend platform (Pakiet C)**: `FinanceWorkspaceBar`, `useFinanceFocusMode`,
  `FinanceErrorBoundary`, `formatFinanceValueForDisplay` all exist and are fully built/tested — but
  had **zero production callers** at the time I started (confirmed by grep: only their own
  `__tests__/` and the shared files themselves referenced them). I am the first package to actually
  mount `FinanceWorkspaceBar` in a real screen component (`PredictionWorkspace.tsx`).
- `financeV2.api.ts` had zero domain (statements/analysis/baseline/prediction/valuation) endpoints
  wired despite its own header comment claiming they "don't exist yet" — stale comment; Pakiet B2 had
  already landed them server-side, just not client-side.

## Co dopisano

### Pure domain module — `src/components/Finance/Prediction/predictionScenarioModel.ts` (966 lines)

No React, no network — fully unit-testable. Covers, in priority order from the brief:

1. **Three build tracks (A/B/C)**: `scenarioModeToTrack`, `ScenarioDraft` shaped field-for-field
   after the DB schema (`DraftDriverOverride`, `DraftInitiative`, `DraftImpact`, `DraftFinancingEvent`
   — every field cited to its migration line range).
2. **Causal chain (initiative → assumption → driver/KPI → statement line → forecast)**: `DraftImpact`
   carries timing (`startPeriodId`), ramp (`rampMonths`), duration/decay
   (`durationMonths`/`decayPctPerPeriod`), implementation cost, confidence, probability, owner (on
   the parent initiative), unit, sign, entity, source — the full list from the brief, matching the
   canonical example ("poprawa efektywności produkcji o 5%") almost verbatim as a test fixture.
3. **Double-counting detection**: `detectClientSideOverlaps()` — client-side preview, explicitly
   documented as non-authoritative, mirroring the server's exact grouping key and financing-line
   mapping (same three test cases: two initiatives on one cell, driver-override + impact on one cell,
   financing + driver-override on one cell — all detected; different line / different period —
   correctly NOT flagged; deterministic regardless of array insertion order).
4. **Base == Baseline**: `isBaseModeStructurallyPassthrough()` (empty overrides/impacts/financing
   under `STANDARD_BASE`) + `assertBaseEqualsBaseline()` (deep value-map comparator).
5. **Two-stage preflight/calculate**: not re-implemented (the real gate lives server-side) — the
   frontend calls the two real endpoints (`runFinancePredictionPreflight`/`runFinancePredictionCalculate`)
   and never fuses them.
6. **Comparisons**: `computeScenarioComparison`/`Cell` (absolute/Δ/%, `null` — never `0` — for
   undefined baseline-zero-percent or missing values), `computeLiquidityHeadroom`,
   `computeCovenantHeadroom`.
7. **DEC-FIN-009, full five-level exception ledger** (added after the coordinator's mid-task
   correction — the original brief's simplified three-case version is now a documented shortcut that
   feeds into level 2 of the full model):
   - `InfoException` (level 1, auto-registered, no fields for user action).
   - `WarningException` (level 2) + `acceptWarningException()` — rejects empty/whitespace
     justification, accepts with `{acceptedBy, justification, acceptedAt}`.
   - `MaterialException` (level 3) + `resolveMaterialException()` — rejects `preparedBy === approvedBy`
     (maker-checker) and empty impact assessment.
   - `CriticalDataException` (level 4) + `acknowledgeCriticalDataException()` — audit-only, never a
     gate.
   - `SecurityOrUndefinedMathException` (level 5) — the only level `evaluateExceptionLedgerForCompute()`
     treats as `allowed:false`.
   - `evaluateExceptionLedgerForCompute()` is the single function encoding "levels 1-4 never block,
     only level 5 does" + derives `materialStatus: clean | conditional | provisional`.
   - `buildMaterialProvenance()` — every generated material carries status, exceptions, impact,
     author, approver (per the coordinator's explicit requirement).
8. **Three-tier tolerance hierarchy** (also added after the coordinator's correction):
   `ToleranceThresholds` (technical-equation / source→canonical / analytics-materiality),
   `validateToleranceHierarchy()`, `checkBalanceSheetTie()` (uses ONLY the technical tier), and
   `isAnalyticsMaterialityMisusedForBalanceCheck()` — a direct, named guard against the exact
   anti-pattern the coordinator called out (`max(1 source unit, 0.1%)` used to prove BS equality).
9. **WP-D04 DoD extensions** (third coordinator message):
   - `computeFacilityUtilization`/`checkFacilityCompliance` — reconstructs the running facility
     balance (same floor-clamp + `DISCRETIONARY_REPAYMENT`-before-`FACILITY_DRAWDOWN` ordering as
     `predictionComputeService.ts`'s own `FINANCING_KIND_PROCESSING_RANK`) and flags a breach after
     *every* event, not just the final balance.
   - `reconcileStatementsAndSchedules()` — CF-closing-cash↔BS-cash and debt-schedule↔BS-debt tie-outs,
     using strictly the technical-equation tolerance tier.
   - `solveBreakEvenDriver()` — bisection solver for "what driver value hits this threshold"
     (reverse stress/break-even), generic over any monotonic evaluator function.
   - `verifyExactColdReopen()`/`canonicalScenarioDraftFingerprint()` — canonical, order-independent
     serialization proving a draft round-trips (close → cold-reopen) byte-identically; mirrors the
     server's own `sortByCreatedAtThenId`/`sortOverlapSourcesById` discipline at the browser-draft
     layer.
   - `SCENARIO_DEPENDENCY_COVERAGE` — a documented (not enforced) map of price/volume, capacity,
     inflation, FX, interest rates, tax against what the existing 9-value `schedule_type` enum
     actually supports (see gaps below).

### API client — `financeV2.api.ts` / `financeV2.types.ts`, `// --- PKG-G Prediction ---` blocks

Purely additive (new named exports only, `FinanceV2Api` object gained three new keys via hoisted
function references — no existing export touched):

- `runFinancePredictionPreflight` → `POST /prediction/:businessVersionId/preflight`.
- `runFinancePredictionCalculate` → `POST /prediction/:businessVersionId/calculate` (both modes,
  `STANDARD_BASE`/`COMPUTED`, typed as a discriminated union).
- `listFinanceExceptionsOpen` → `GET /exceptions/open` (generic endpoint, had no client yet; needed
  by the Modele/Wyniki view's exception registry).
- Types: `FinancePredictionPreflightResultDto`, `FinancePredictionCalculateResultDto`
  (`StandardBase`/`Computed` variants), `CanonicalCode` (ported from
  `baselineComputeService.ts:112-120`), `FinanceExceptionOpenDto`.

### UI shell (flagged OFF, not wired into any route)

- `useFinancePredictionWorkspaceFlag.ts` — `financePredictionWorkspaceV1`, default OFF, same pattern
  as Pakiet C's `useFinanceWorkspacePlatformFlag.ts`.
- `predictionWorkspaceBarConfig.ts` — builds a real `WorkspaceBarConfig` (two views: "Budowa założeń"
  / "Modele/Wyniki", `moduleId: 'prediction'`).
- `PredictionWorkspace.tsx` — mounts the real `FinanceWorkspaceBar` + `useFinanceFocusMode` +
  `FinanceErrorBoundary` (I am the first caller of all three in a real screen), switches between the
  two views, wires the primary/secondary bar actions to the two real endpoints, shows an honest-UI
  message instead of faking success when there is no persisted `businessVersionId` yet.
- `ScenarioAssumptionsView.tsx` — the three-tab (A/B/C) builder: standard preset picker, a driver-
  override grid (add/remove rows), and the fundamental-initiative panel (initiative cards + impact
  rows with every causal-chain field, plus a live client-side overlap-warning banner).
- `ScenarioResultsView.tsx` — comparison table (absolute/Δ/%), liquidity headroom, covenant headroom
  (surfaces the `MathUndefinedError` hard block visibly, not silently), freshness/stale badge,
  material-status badge (clean/conditional/provisional), exception registry list.
- `dev-render/screens/finance-prediction-workspace.tsx` + `dev-render/main.tsx` registration — a
  harness entry (`?screen=finance-prediction-workspace&mode=A|B|C`) for my own local screenshot/sanity
  checks, per CLAUDE.md rule #7 (Piotr never sees this until flag-gated acceptance).
- Two tables (driver-override grid, comparison grid) are marked `§27-exempt` per
  `docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md` (Decyzja 07-13) — these are Excel/platform-table
  archetypes (editable grid / P&L-line-by-period comparison), not entity lists; `check-list-canon.sh`
  confirmed zero new violations after marking.

## Testy — wyniki i exit code

```
$ npx vitest run src/components/Finance/Prediction --maxWorkers=2
 Test Files  2 passed (2)
      Tests  75 passed (75)
EXIT=0
```

- `predictionScenarioModel.test.ts` — 70 tests, pure logic, no DOM.
- `PredictionWorkspace.test.tsx` — 5 tests, `@vitest-environment jsdom` + `@testing-library/react`,
  actually mounts `<PredictionWorkspace>` (proves it renders the real `FinanceWorkspaceBar`, switches
  views, renders the fundamental-mode panel, and shows an honest-UI message instead of a fake success
  when there's no persisted scenario).

Run from repo root (per this program's known pitfall — `vitest` from `server/` silently reports "No
test files found" + exit 1). `--maxWorkers=2` used throughout per the mid-task load-crisis directive
(machine load hit 362 with six parallel agents contending).

## Kontrole negatywne (manualnie zweryfikowane, każda cofnięta po potwierdzeniu czerwieni)

Machine-load discipline from the brief followed literally — break, run the *specific* test group,
confirm red, revert from a clean backup, re-run the *full* suite to confirm 70/70 (or 75/75) green
again:

1. **Double-counting grouping filter killed** (`detectClientSideOverlaps`'s `sources.length <= 1`
   check forced to always `continue`) → 3 of the double-counting tests failed as expected
   (`expected [] to have a length of 1 but got +0`, etc.). Reverted, re-confirmed 70/70 green.
2. **Level 4 wrongly made blocking** (`evaluateExceptionLedgerForCompute` changed to also set
   `allowed:false` on `CRITICAL_DATA`, mimicking the exact wrong implementation the coordinator
   warned is the most common mistake) → both core level-4 tests failed
   (`expected false to be true`). Reverted, re-confirmed green. This is the test that specifically
   proves "compute passes and produces a provisional-marked result, not a block" — per the
   coordinator's explicit instruction.
3. **Division-by-zero guard removed** from `computeCovenantHeadroom` → both hard-block tests failed
   (`expected function to throw an error, but it didn't`). Reverted, re-confirmed green.
4. **Facility-limit check hardcoded to `true`** → the mid-horizon-breach-then-repaid test failed as
   expected (proves the check inspects every event, not just the final balance). Reverted.
5. **Reconciliation `cashTies` hardcoded to `true`** → the cash-mismatch-detection test failed as
   expected. Reverted, final 70/70 confirmed clean before moving on.

Every negative control was performed on a copy backed up with `cp` before mutation and restored the
same way (never `git checkout --`/`git stash`, per the ZAKAZANE list) — final state verified against
the backup byte-for-byte via a full clean test run (70 passed) before the file was ever staged.

## Dowody per priorytet z brifu

| # | Wymóg | Status | Dowód |
|---|---|---|---|
| 1 | Trzy tryby A/B/C | PASS | `scenarioModeToTrack`, `ScenarioAssumptionsView` three-tab UI, 3 tests |
| 2 | Łańcuch przyczynowy + double counting | PASS | `DraftImpact` full field set, `detectClientSideOverlaps` + 7 tests incl. 2 negative controls; authoritative Layer 1/2 confirmed already live server-side (inventory) |
| 3 | Base == Baseline | PASS | `isBaseModeStructurallyPassthrough`/`assertBaseEqualsBaseline` + 4 tests; server-side structural guarantee confirmed by inventory (no independent recompute possible for STANDARD_BASE) |
| 4 | Preflight przed compute | PASS (wired, not newly built) | `runFinancePredictionPreflight`/`runFinancePredictionCalculate` as two separate calls in `financeV2.api.ts`; server gate (`finance_prediction_can_start_compute`) already confirmed live |
| 5 | Porównania (absolutne/Δ/%) + płynność/covenant | PASS | `computeScenarioComparison(Cell)`, `computeLiquidityHeadroom`, `computeCovenantHeadroom` + 8 tests |
| — | DEC-FIN-009 5 poziomów | PASS | full ledger + `evaluateExceptionLedgerForCompute` + 15 tests covering all 5 levels, negative controls on levels 4/5 |
| — | Tolerancje trójstopniowe | PASS | `ToleranceThresholds`/`validateToleranceHierarchy`/`checkBalanceSheetTie`/anti-pattern guard + 6 tests |
| — | Financing respektuje FACILITY | PASS | `computeFacilityUtilization`/`checkFacilityCompliance` + 4 tests incl. mid-horizon-breach negative control |
| — | Statements/schedules RECONCILE | PASS | `reconcileStatementsAndSchedules` + 4 tests |
| — | Reverse stress / break-even | PASS | `solveBreakEvenDriver` (bisection) + 3 tests |
| — | Exact cold reopen | PARTIAL | Proven at the **draft-model layer** (canonical fingerprint round-trip, 3 tests) — proves the local data structure and its serialization are deterministic and order-independent. Proof at the **persisted** layer (close app, reopen from DB, same computed numbers) is `BLOCKED_EXTERNAL` — there is no write endpoint to persist a draft yet, so there is nothing to "cold reopen" from a real database round-trip. The server's *own* determinism discipline for its own compute path (`sortByCreatedAtThenId`, `sortOverlapSourcesById`, `buildAssumptionSetSemanticHash`, `contentSemanticHash`) is already live and cited from `predictionComputeService.ts`/`predictionPreflightService.ts`, but I did not re-run those tests myself (out of allowlist, server/**). |
| — | Scenario→actual benefits feedback | **EVIDENCE_MISSING** | No backend table/service exists for tracking realized-vs-planned initiative benefits; this is a new data model, not something the existing schema supports even partially. Not attempted — genuinely out of scope for a frontend-plus-additive-client package. |
| — | Zależności: price/volume/capacity/inflation/FX/rates/tax | PARTIAL, documented | `SCENARIO_DEPENDENCY_COVERAGE` const: price/volume (via `revenue_pvm`, aggregated growth rate, no separate price-vs-volume driver), interest rates (`debt_maturity` + `financing.payload.rate`), tax (`tax_nol`) are covered by the existing 9-value `schedule_type` enum. **Capacity** has a schema field (`impact_chain.capacity_constraint_ref` JSONB) but it is explicitly documented in the ADR as *not* trigger-validated — soft only. **Inflation** and **FX** have no dedicated driver/schedule_type at all — the enum would need a server-side change (out of this package's allowlist) to model them. |

## Czego NIE dostarczono, i dlaczego

1. **HTTP CRUD for the four assumption tables + scenario creation — `BLOCKED_EXTERNAL`.** This is the
   single biggest gap. `server/src/routes/v8/finance-v2/prediction.routes.ts` only exposes
   `preflight`/`calculate`; there is no `POST`/`PATCH` for `finance_prediction_scenarios`,
   `_driver_overrides`, `_initiatives`, `_impact_chain`, or `_financing`. My allowlist explicitly
   forbids touching `server/**` without clear need, and adding backend CRUD is exactly the kind of
   "clear need" the brief told me to *report*, not silently build. **Consequence**: the scenario
   builder UI is fully functional against local draft state (add/edit/remove initiatives, impacts,
   driver overrides — all covered by real event handlers, not stubs) but there is no way to persist a
   built scenario to the database through this package alone, and therefore no way to run a REAL
   end-to-end preflight/calculate against user-entered assumptions (only against an
   already-existing, externally-seeded `businessVersionId`). The two client functions
   (`runFinancePredictionPreflight`/`runFinancePredictionCalculate`) are real and will work the
   moment a scenario with a real `businessVersionId` exists.
2. **Persisted-layer exact-cold-reopen** — see table above, `PARTIAL`, blocked by the same CRUD gap.
3. **Scenario→actual benefits feedback loop** — `EVIDENCE_MISSING`, no existing data model to build
   against, genuinely new scope.
4. **Inflation/FX as first-class scenario drivers** — `EVIDENCE_MISSING`/schema gap, requires a
   server-side enum change outside this package's allowlist. Documented, not silently dropped.
5. **No visual acceptance screenshots for Piotr** — per CLAUDE.md rule #7 this is correct (flag OFF,
   not to be shown to the owner yet), but I was also unable to get a clean self-screenshot through the
   shared browser-preview tooling in this environment: `preview_start` with a raw `url:` parameter
   attached my request to a stray, already-running dev server in a **different** package's worktree
   (`fv3p-h-valuation`) rather than the vite process I started myself on port 58028 (confirmed booting
   correctly via `curl -o /dev/null -w '%{http_code}' → 200`). I stopped pursuing this once the
   coordinator's load-crisis message arrived (machine load 362) rather than fight the tooling further;
   the component-level smoke test (`PredictionWorkspace.test.tsx`, jsdom + Testing Library, 5 tests)
   is the substitute evidence that the real component actually renders without crashing, switches
   views, and reacts to real props — not a screenshot, but not "trust me" either.
6. **Full-project `tsc --noEmit`** — started (`NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit
   -p tsconfig.json`), but killed unfinished (after ~9 minutes, still running) once the coordinator's
   load-crisis message arrived asking to stop running heavy commands. Type-safety evidence instead
   comes from: (a) `npx esbuild` per-file bundling of every new file (syntax + module-resolution
   check, all clean, ran individually per CLAUDE.md's own "esbuild per file" discipline for workers),
   and (b) successful `vitest` execution of all 75 tests (vitest's esbuild transform also fails loudly
   on TS syntax errors). This is **not** a full type-check and could theoretically miss a type error
   that doesn't manifest as a runtime/syntax failure — flagged honestly as a gap, not claimed as
   equivalent to `tsc`.

## Status podsumowujący (dla orkiestratora)

| Element | Status |
|---|---|
| Inwentaryzacja przed kodem | PASS |
| Trzy tryby A/B/C | PASS |
| Łańcuch przyczynowy + double counting (client preview) | PASS |
| Base == Baseline (frontend invariant; server structural guarantee confirmed by inventory) | PASS |
| Preflight/calculate — dwa osobne wywołania | PASS |
| Porównania + płynność/covenant headroom | PASS |
| DEC-FIN-009 pełna, pięciopoziomowa wersja | PASS |
| Tolerancje trójstopniowe (nie mieszać) | PASS |
| Financing respektuje FACILITY | PASS |
| Statements/schedules RECONCILE | PASS |
| Reverse stress / break-even | PASS |
| Exact cold reopen | PARTIAL (draft layer only) |
| Scenario→actual benefits feedback | EVIDENCE_MISSING |
| Zależności inflacja/FX | EVIDENCE_MISSING (schema gap, poza allowlistą) |
| Zależności capacity (twarda walidacja) | EVIDENCE_MISSING (miękkie pole istnieje, walidacja nie) |
| HTTP CRUD zapisu scenariusza/założeń | BLOCKED_EXTERNAL (poza allowlistą server/**, zaraportowane) |
| Testy: 75/75, exit 0 | PASS |
| Kontrole negatywne (5, manualne) | PASS |
| Kanon UI (hooki pre-commit) | PASS, zero nowego długu |
| Flaga domyślnie OFF, brak podłączenia produkcyjnego | PASS |
| Zrzut wizualny dla Piotra | Świadomie NIE dostarczony (rule #7) |
| Zrzut własny (sanity) | EVIDENCE_MISSING (tooling issue, patrz wyżej) — zastąpiony testem renderującym |
| Pełny `tsc --noEmit` | EVIDENCE_MISSING (przerwany z powodu kryzysu obciążenia maszyny) |
