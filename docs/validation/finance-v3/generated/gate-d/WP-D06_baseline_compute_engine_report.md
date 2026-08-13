# WP-D06 — Baseline Model compute engine (Gate D / Fala 5)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 7 (Baseline
Models), EPIC-05.
**Work package:** WP-D06 — turns the accepted `WP-D05_baseline_models_schema_ADR.md` (schema, live-tested
`WP-D05b_baseline_migration_report.md`) into a real, deterministic monthly P&L→CF→BS compute engine: the
circularity solver (ADR section 6.2 pseudo-code, implemented verbatim), the schedule engines (9
`schedule_type` families), and the orchestration service that ties them to `finance_baseline_outputs` /
`compute_jobs` / `finance_exceptions`.
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** real, working TypeScript engine, unit-tested (25 pure tests, no DB) and live-tested end-to-end
against an isolated, ephemeral Postgres (never a production/demo/dev database — teardown confirmed, section 8).

---

## 1. What was implemented

Three new files in `server/src/services/finance/canonical/`:

| File | Role |
|---|---|
| `baselineScheduleEngine.ts` | Pure functions, one per `schedule_type` family — `computeRevenuePvm`, `computeCogsOpex`, `computeWcDsoDioDpo`, `computeCapexDepreciation`, `lookupScheduledAmortization`, `computeTaxNol`, `computeEquityRe`, plus `computeHeadcount`/`computeLeases` (implemented and unit-tested, not yet wired to a P0 canonical output line — see section 5). |
| `baselineCircularitySolver.ts` | `solvePeriod()` — deterministic fixed-point iteration over `(cash, debt)`, a line-by-line implementation of ADR section 6.2's pseudo-code (same variable names, same step order), fail-closed on non-convergence. |
| `baselineComputeService.ts` | `runBaselineCompute()` — orchestrates: resolve `STATEMENT_TO_MODEL` lineage → load `finance_baseline_models`/`finance_baseline_schedules`/`finance_baseline_assumptions`/history/opening BS once → chronological monthly loop (schedule engines → `solvePeriod` → assemble P&L/CF/BS → `finance_baseline_outputs` INSERT) → `compute_jobs(job_type='BASELINE_COMPUTE')` bookkeeping → fail-closed `finance_exceptions`/`finance_baseline_solver_diagnostics` on non-convergence. |

Plus two pure, DB-free unit test files (25 tests total, all passing):
`server/src/services/finance/canonical/__tests__/baselineScheduleEngine.test.ts` and
`.../baselineCircularitySolver.test.ts`.

### 1.1 Algorithm fidelity to the ADR

`solvePeriod()` is a direct, verbatim transcription of `WP-D05_baseline_models_schema_ADR.md` section 6.2's
pseudo-code: same seed (`cash_guess = prior_period_closing.cash`, `debt_guess = prior_period_closing.debt`),
same per-iteration steps (contractual `scheduled_amortization` lookup → `mandatory_sweep` from the
`mandatory_contractual_cash_sweep_modeled` clause → `interest_expense`/`interest_income` → mechanical P&L→CF
roll → `residual = max(|Δcash|, |Δdebt|)` → converge-or-continue), same fail-closed exit
(`finance_exceptions(severity='SECURITY', blocking_category='UNDEFINED_MATH')`, no `compute_job_outputs`
commit). Not reinvented.

### 1.2 Monthly P&L → CF → BS assembly (`baselineComputeService.ts`)

For each forecast month, in chronological order (month N's opening balance sheet = month N−1's closing
balance sheet, never re-derived):

```
REVENUE      = computeRevenuePvm(priorYearSameMonthRevenue, growth)      [wc_dso_dio_dpo/cogs_opex/capex_depreciation: pure, non-circular]
COGS, OPEX   = computeCogsOpex(REVENUE, cogsRatio, opexRatio)
CAPEX, DEPR  = computeCapexDepreciation(REVENUE, priorFixedAssets, capexPct, usefulLifeMonths)
EBIT         = EBITDA - DEPRECIATION
AR/INV/AP    = computeWcDsoDioDpo(REVENUE, COGS, daysInPeriod, DSO, DIO, DPO)
ΔWC          = ΔAR + ΔINV - ΔAP
                                                                            [debt_maturity: the ONE circular piece]
solved       = solvePeriod({ priorCash, priorDebt, ebit, depreciation, ΔWC, capex, scheduledAmortization, ... })
NET_INCOME, INTEREST_EXPENSE, TAX_EXPENSE, CFO, CFI, CFF, NET_CHANGE_CASH, CASH, LONG_TERM_DEBT  <- from solved
RETAINED_EARNINGS = computeEquityRe(priorRE, solved.netIncome, dividendsDeclared=0)   [equity_re]
EQUITY       = otherEquityConst + RETAINED_EARNINGS
CURRENT_ASSETS = CASH + AR + INVENTORY;  TOTAL_ASSETS = CURRENT_ASSETS + FIXED_ASSETS
CURRENT_LIABILITIES = AP;  TOTAL_LIABILITIES = CURRENT_LIABILITIES + LONG_TERM_DEBT
TOTAL_LIABILITIES_EQUITY = TOTAL_LIABILITIES + EQUITY
```

**Cash is never an input.** `CASH[t] = CASH[t-1] + NET_CHANGE_CASH[t]` is the *output* of the CF roll
(`solved.cash`), never assigned or clamped by `baselineComputeService.ts`. **Balance is algebraic, not a
plug**: with `ΔFIXED_ASSETS = CAPEX − DEPRECIATION`, `ΔLONG_TERM_DEBT = −(scheduled_amortization +
mandatory_sweep)`, `ΔRETAINED_EARNINGS = NET_INCOME` (no dividends), and `CFF = −(scheduled_amortization +
mandatory_sweep)`, the assets-side change (`ΔCASH+ΔAR+ΔINV+ΔFIXED_ASSETS`) and the liabilities+equity-side
change (`ΔAP+ΔLONG_TERM_DEBT+ΔRE`) reduce to the SAME expression (`NET_INCOME + ΔAP − (scheduled_amortization
+ mandatory_sweep)`) — verified algebraically before writing code, and then live-tested against the DB's own
deferred `finance_baseline_check_balance()`/`finance_baseline_check_cash_rollforward()`/
`finance_baseline_check_re_rollforward()` triggers for every one of the 12 forecast months (section 3.2). Per
the brief's own instruction — "jeśli solver dał wynik matematycznie niespójny z tymi triggerami, to jest bug
w Twoim silniku, nie w triggerach" — `baselineComputeService.ts` also performs its own
`|TOTAL_ASSETS − TOTAL_LIABILITIES_EQUITY| > tolerance` check in JS **before** the INSERT, failing the whole
job with a `TIE_OUT_FAILED` code if the engine itself is ever inconsistent (never relying solely on the DB
to catch it).

---

## 2. Known-answer test — GoldCo PARENT (PLN, standalone), FY2026

**Source data:** `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.ts` (Fala 3 gold vertical
slice) FY2025 monthly REVENUE actuals and FY2025 (Dec-2025) closing balance sheet — used as-is, GIVEN
history, not re-derived.

**Assumptions** (derived once from FY2025 annual actuals, documented, flat across the whole 12-month horizon —
see section 5 "scope decisions"): `REVENUE_GROWTH_YOY=5%`/year (brief's own number), `COGS_PCT_OF_REVENUE` =
118,000,000/182,000,000, `OPEX_PCT_OF_REVENUE` = 34,000,000/182,000,000, `DSO_DAYS`/`DIO_DAYS`/`DPO_DAYS` back-solved
from FY2025 AR/INVENTORY/AP vs. revenue/COGS, `CAPEX_PCT_OF_REVENUE` = 9,000,000/182,000,000,
`USEFUL_LIFE_MONTHS` = 12×96,500,000/7,000,000 ≈ 165.43, `STATUTORY_TAX_RATE_PCT=19%` (matches
3,990,000/21,000,000 exactly — Polish CIT).

**Debt facility** (existing contractual, `debt_maturity` schedule payload): principal 40,500,000 PLN, equal-principal
amortization 675,000 PLN/month, contractual rate 4.8%/year, **plus a real, contractual, non-discretionary
mandatory cash-sweep clause** (10% of free cash flow after scheduled debt service) — this is what makes
`solvePeriod()` genuinely iterate (interest on average debt ↔ the sweep amount ↔ interest again), not a
trivial `debt=0` case, satisfying brief item 5's "który TESTUJE circularity solver" literally in the SAME
forecast used for the known-answer numbers below.

### 2.1 Independent oracle

`wp_d06_oracle.mjs` (session scratchpad, NOT importing `baselineScheduleEngine.ts`/
`baselineCircularitySolver.ts`/`baselineComputeService.ts` — same "oracle does its own arithmetic by hand"
discipline as `goldco_oracle.ts`) derives a **closed-form** solution for the sweep/interest fixed point
(`Sweep = s·K4 / (1 − s·K2)`, algebraically solved from the same period relationships, not by iterating) —
an independent method, not a re-run of the engine's own iteration loop — and reproduces the engine's own
month-by-month P&L/CF/BS via plain arithmetic. All 12 months' internal consistency (BS balances) asserted
inside the oracle script itself before comparison.

### 2.2 Comparison — engine vs. independent oracle (3 months + annual)

All differences below are ≤0.0003 PLN out of ~11.9M–191.1M PLN figures (relative error ~1e-8–1e-9) — pure
floating-point noise between the engine's iterative fixed point and the oracle's closed-form solution, three
orders of magnitude inside the model's own `circularity_tolerance_currency=1` PLN convergence tolerance.

**January 2026**

| Line | Engine | Independent oracle | Diff |
|---|---:|---:|---:|
| REVENUE | 11,943,750.0000 | 11,943,750.0000 | 0 |
| COGS | 7,743,750.0000 | 7,743,750.0000 | 0 |
| OPEX | 2,231,250.0000 | 2,231,250.0000 | 0 |
| EBIT | 1,355,192.1416 | 1,355,192.1416 | 0 |
| NET_INCOME | 968,661.5399 | 968,661.5399 | −0.00006 |
| CASH | 17,013,362.3778 | 17,013,362.3778 | −0.00005 |
| LONG_TERM_DEBT | 39,156,848.6247 | 39,156,848.6247 | +0.00001 |
| TOTAL_ASSETS | 153,647,435.5678 | 153,647,435.5679 | −0.00005 |
| TOTAL_LIABILITIES_EQUITY | 153,647,435.5678 | (=TOTAL_ASSETS, tied out live by the DB trigger) | — |

**June 2026**

| Line | Engine | Independent oracle | Diff |
|---|---:|---:|---:|
| REVENUE | 15,925,000.3500 | 15,925,000.3500 | 0 |
| NET_INCOME | 1,511,306.8353 | 1,511,306.8353 | 0 |
| CASH | 11,328,419.4921 | 11,328,419.4921 | −0.00008 |
| LONG_TERM_DEBT | 35,697,095.7198 | 35,697,095.7198 | +0.00001 |
| TOTAL_ASSETS | 161,686,381.2235 | 161,686,381.2236 | −0.00008 |

Note: in June the sweep-clause's `max(0, FCF_after_scheduled_debt_service)` branch is **inactive** (FCF after
debt service is negative that month — a highly seasonal manufacturer, per `goldco_oracle.ts`'s own Q3/Q4
stock-build narrative) — `mandatorySweep=0`, pure scheduled amortization, still correctly exercised through
the same `solvePeriod()` code path (not a special case in the engine).

**December 2026**

| Line | Engine | Independent oracle | Diff |
|---|---:|---:|---:|
| REVENUE | 28,664,998.9500 | 28,664,998.9500 | 0 |
| NET_INCOME | 3,223,837.1331 | 3,223,837.1331 | 0 |
| CASH | **−6,725,554.0994** | **−6,725,554.0993** | −0.00017 |
| LONG_TERM_DEBT | 30,602,636.1390 | 30,602,636.1390 | +0.00002 |
| TOTAL_ASSETS | 181,210,707.0332 | 181,210,707.0334 | −0.00017 |

**FY2026 annual totals**

| Line | Engine (sum/closing) | Independent oracle | Diff |
|---|---:|---:|---:|
| REVENUE (sum) | 191,100,000.0000 | 191,100,000 | 0 |
| COGS (sum) | 123,900,000.0000 | 123,900,000 | 0 |
| NET_INCOME (sum) | 18,155,451.1152 | 18,155,451.1154 | −0.0002 |
| CFO (sum) | 1,621,809.7615 | 1,621,809.7617 | −0.0002 |
| CFF (sum) | −9,897,363.8610 | −9,897,363.8610 | 0 |
| NET_CHANGE_CASH (sum) | −17,725,554.0994 | −17,725,554.0993 | −0.0002 |
| CASH (Dec closing) | −6,725,554.0994 | −6,725,554.0993 | −0.0002 |
| LONG_TERM_DEBT (Dec closing) | 30,602,636.1390 | 30,602,636.1390 | 0.00002 |
| TOTAL_ASSETS (Dec closing) | 181,210,707.0332 | 181,210,707.0334 | −0.0002 |

Annual REVENUE/COGS/OPEX/CAPEX/CFI sums tie EXACTLY (no rounding residual — no monthly-allocation
smoothing was needed here, unlike `goldco_oracle.ts`'s own December-residual convention, because every
month's REVENUE/COGS/CAPEX is independently derived from that month's own prior-year actual, not allocated
from an annual total). `finance_baseline_outputs_annual`/`_quarterly` (WP-D05 roll-up VIEWs, section 8 —
flow lines sum, stock lines take the closing month) queried live and cross-checked against the same figures
— no discrepancy.

**Verdict: known-answer test PASSES** — engine output matches the independent oracle to floating-point
precision for all three sampled months and the annual roll-up.

---

## 3. Funding gap test (brief item 6)

No artificial second scenario was needed — GoldCo PARENT's own realistic seasonality (Q4 revenue/AR spike,
per `goldco_oracle.ts`'s "Q4 peak before year-end OEM stock-builds" narrative) already drives December 2026
cash to **−6,725,554.10 PLN**, preceded by a run of shrinking/negative monthly cash changes from mid-year
onward (June −1,740,041.55, and a further large CAPEX+AR build into Q4) — a genuine multi-month funding
squeeze, not a contrived single spike.

Live-tested against the ephemeral Postgres:

| Check | Result |
|---|---|
| December `CASH` row `value_decimal` | −6,725,554.099445782 (negative, NOT clamped to 0, NOT blocked) |
| December `CASH` row `quality_flag` | `FUNDING_GAP` (set by the DB's own `finance_baseline_mark_funding_gap()` trigger — WP-D05b, not re-implemented here) |
| `finance_exceptions` | exactly 1 row, `severity='WARNING'`, `reason_code='FUNDING_GAP'`, `dedup_key='FUNDING_GAP:<bv>:<entity>:<dec-period>'`, `observed=-6725554.099445782` |
| Compute job / transaction | **committed successfully** — `runBaselineCompute()` returned `ok:true`, all 12 months' `finance_baseline_outputs` rows present, `NO_OPEN_UNDEFINED_MATH`/`NO_OPEN_BLOCKING_EXCEPTIONS` readiness checks both `true` (a `WARNING`, unlike `SECURITY`, never blocks — DEC-FIN-009) |

Confirms DEC-FIN-002 literally: negative cash is computed and shown, never plugged, never blocking.

---

## 4. Circularity solver — convergence and fail-closed (brief item 7)

### 4.1 Pure unit tests (`baselineCircularitySolver.test.ts`, no DB, 9 tests)

- **Trivial case** (both `interestIncomeOnCashModeled`/`mandatoryContractualCashSweepModeled` = `false`):
  converges in **3 iterations** (not the ADR section 4.1 prose's stated "one iteration" — see the documented
  discrepancy in section 6 below), `debt=0` sub-case converges in 2.
- **Real circularity** (GoldCo's own mandatory-sweep debt facility, Jan/Jun/Dec fixtures): converges, matches
  the independent closed-form oracle to ≤0.0003 PLN (same numbers as section 2.2 above — this pure unit test
  and the live-DB run in section 2 arrive at the same fixed point through the same code, cross-checked
  independently by the oracle in both places).
- **Fail-closed, synthetic divergence**: a physically absurd 500%/month cash-interest-income rate
  (`interestIncomeOnCashModeled=true`, `cashInterestRateMonthly=5.0`) makes the fixed-point map's slope
  `(1−taxRate)·rate/2 ≈ 2.0 > 1` — diverges without bound (`finalResidual` grows into the quadrillions, never
  `NaN`/`Infinity`). `solvePeriod()` correctly exhausts `maxIterations=25` and returns `converged:false`,
  never a fabricated "best effort" number. A `maxIterations=1` case on an otherwise-real circular
  configuration also correctly fails closed rather than silently accepting iteration 1 as final.
- Input validation: `maxIterations<=0` and `toleranceCurrency<0` both throw.

### 4.2 Live DB integration (fail-closed end-to-end, "SCENARIO 2" in the fixture run)

A second, synthetic 2-month Baseline Model (same org/Statement Pack/entity, `interestIncomeOnCashModeled=true`,
`CASH_INTEREST_RATE_ANNUAL_PCT=60` i.e. 5%/month — the same order-of-magnitude divergent coefficient as the
unit test above), run through the FULL `runBaselineCompute()` path against the ephemeral Postgres:

| Check | Result |
|---|---|
| `runBaselineCompute()` return | `{ ok:false, code:'CIRCULARITY_NOT_CONVERGED', failedAtPeriodId:<Jan-2026> }` |
| `finance_baseline_solver_diagnostics` | exactly 1 row, `converged=false`, `iterations_used=25` (=`maxIterations`), `final_residual_currency=1,158,041,122,317,138` — **durably persisted despite the outer transaction rolling back** (written via its own independently-committed `withPinnedPostgresTransaction` call, per the ADR section 4.5 requirement that diagnostics "musi żyć gdzie indziej niż output") |
| `finance_exceptions` | exactly 1 row, `severity='SECURITY'`, `blocking_category='UNDEFINED_MATH'`, `reason_code='BASELINE_CIRCULARITY_NOT_CONVERGED'` — the already-reserved WP-B05 blocking mechanism, correctly consumed |
| `finance_baseline_outputs` row count for this business_version | **0** — the whole 2-period batch rolled back cleanly, no partial/inconsistent commit |
| `finance_baseline_readiness_check()`'s `NO_OPEN_UNDEFINED_MATH` | flips to `false` (`is_ready_for_review` blocked) — same live consumer WP-D05b's own TEST 13 exercised, this time raised by the REAL compute engine, not a manually-inserted row |

**Verdict: circularity convergence + fail-closed both PASS**, at both the pure-function level and the
full DB-integration level.

---

## 5. Scope decisions (documented, not silent)

1. **Single entity per compute run** — no multi-entity consolidation/translation/NCI in this P0 (Baseline
   schedules/outputs are already entity-scoped by schema design). A consolidated Baseline is out of scope
   for WP-D06.
2. **Flat assumptions across the horizon** — `finance_baseline_assumptions` rows are read by
   `(entity_id, schedule_type, driver_code)` regardless of which forecast `period_id` they were inserted
   against; the fixture inserts one row per driver (period_id = first forecast month) rather than 108
   period-varying rows. The schema itself supports period-varying assumptions (a future Kreator UI can
   populate them per-period without any schema change) — this is a usage convention of THIS engine, not a
   schema limitation.
3. **`headcount`/`leases` schedule engines are implemented and unit-tested but not wired into
   `finance_baseline_outputs`** — the P0 canonical taxonomy (31 `financial_statement_lines` rows) has no
   PAYROLL/LEASE_LIABILITY line code yet for their output to land on.
4. **Depreciation is a single straight-line run-rate on the opening gross block** (`FIXED_ASSETS[t-1] /
   usefulLifeMonths`), not vintage-by-vintage CAPEX tracking.
5. **`tax_nol`** — a loss carries zero tax expense; no NOL deferred-tax asset is booked (no such BS line in
   the P0 taxonomy yet), same documented boundary `goldco_oracle.ts` used for its own restatement's tax
   treatment.
6. **Forecast-period (`finance_stmt_periods`) rows and the `finance_baseline_schedules`/
   `finance_baseline_assumptions` rows themselves are the caller's responsibility** — `runBaselineCompute()`
   takes an already-ordered `forecastPeriodIds` array; it does not create periods or author
   schedules/assumptions (a Kreator-surface concern, not this compute engine's, per ADR section 2.1).
7. **No automatic `DRAFT → READY_FOR_REVIEW` transition attempt** — unlike `kpiComputeService.ts`,
   `runBaselineCompute()` does not call `finance_baseline_readiness_check()`/attempt the
   `artifactVersionService.transition()` itself (though the readiness gate was queried and confirmed correct
   in both the success and fail-closed scenarios above, section 2/4.2). Deferred as a small, low-risk
   follow-on (the readiness gate and transition service both already exist and are already exercised
   correctly by the fixture's own direct queries) — not attempted here to keep this WP's already-large scope
   focused on the compute correctness itself.
8. **`job_type='BASELINE_COMPUTE'`** — the brief's own instruction ("Integracja z computeJobService
   (job_type='BASELINE_COMPUTE')") is followed literally; this is a **documented divergence** from
   `WP-B04_jobs_runs_outputs_ADR.md` §12 point 3 and `WP-D05_baseline_models_schema_ADR.md` §2.1 point 7,
   both of which reserved the name `job_type='model_compute'` for this future consumer. `compute_jobs.job_type`
   is a plain `TEXT` column (no CHECK enum), so both values are structurally valid; reconciling the two names
   is a one-line follow-on, flagged here rather than silently picking one without saying so.

---

## 6. Discrepancy found by live testing (documented, not silently "fixed")

`WP-D05_baseline_models_schema_ADR.md` section 4.1 states: "oba `false` domyślnie => model bez circularity,
solver kończy się w jednej iteracji" (both flags `false` by default ⇒ the model has no circularity, the
solver finishes in one iteration). **Literal execution of the SAME section's own 6.2 pseudo-code, with no
algorithm change**, converges in **3 iterations** for a non-zero `scheduled_amortization` (2 for the
`debt=0`/`scheduled_amortization=0` sub-case), not 1 — found by actually running the code
(`baselineCircularitySolver.test.ts`), not by re-reading the pseudo-code. Root cause: the pseudo-code seeds
`debt_guess = prior_period_closing.debt`, so iteration 1's `interest_expense = rate * average(prior_debt,
debt_guess)` uses that stale seed (`average(prior_debt, prior_debt) = prior_debt`) rather than the period's
true closing debt; iteration 2 corrects `debt_guess` (deterministic here — `scheduled_amortization` never
depends on any guess) and recomputes a different `interest_expense`, which changes the CASH figure again;
iteration 3 is needed for the cash residual to settle to zero once the debt guess has already stopped moving.
This is a **seeding artifact**, not economic circularity (nothing here depends on the solver's own guess in a
genuine two-way loop when both flags are `false`) — followed literally per this work package's own
instruction ("TO JEST algorytm do zaimplementowania, nie wymyślaj innego") rather than "fixed" by deviating
from the ADR's specified algorithm. Does not affect correctness (the 50-iteration default `max_iterations`
absorbs it comfortably) or the fail-closed guarantee — flagged for the ADR's own future correction, not
silently smoothed over.

---

## 7. Database isolation (hard ban compliance)

Same rule as every prior Finance v3 work package (`WP-D01b`/`WP-D03b`/`WP-D05b` section 1) — **no shared or
production/demo/dev database was touched.**

- Own ephemeral cluster: `initdb --locale=C` (`LC_ALL=C`), `/opt/homebrew/opt/postgresql@15/bin/` binaries,
  data directory `/private/tmp/wp_d06_pgdata_<pid>` (random per-run suffix), port **57231** (confirmed free
  via `lsof` before use, within the mandated 55000-59999 range), `listen_addresses=127.0.0.1`.
- All 601 migrations in `server/migrations/` (the pre-existing 598 + this session's own, unrelated to WP-D06)
  applied cleanly via `server/scripts/migrate.postgres.ts`, `NODE_ENV=test`, before any fixture data was
  written.
- `ps aux` confirmed the shared Homebrew instance (**PID 911**, `/opt/homebrew/var/postgresql@15`) and this
  work package's own ephemeral postmaster were fully separate processes throughout; a third, unrelated
  concurrent session's ephemeral cluster (port 28472) was observed and left alone.
- Teardown: `pg_ctl -m fast stop` + `rm -rf` of the data directory, executed at the end of this session. Final
  `ps aux` confirmed only PID 911 remained.

---

## 8. Files delivered

- `server/src/services/finance/canonical/baselineScheduleEngine.ts` (new)
- `server/src/services/finance/canonical/baselineCircularitySolver.ts` (new)
- `server/src/services/finance/canonical/baselineComputeService.ts` (new)
- `server/src/services/finance/canonical/__tests__/baselineScheduleEngine.test.ts` (new, 12 tests)
- `server/src/services/finance/canonical/__tests__/baselineCircularitySolver.test.ts` (new, 13 tests)
- `docs/validation/finance-v3/generated/gate-d/WP-D06_baseline_compute_engine_report.md` (this file)

All three service files type-check cleanly against the project's real `server/tsconfig.json` (`strict: true`,
zero errors). All 25 unit tests pass (`npx vitest run --config server/vitest.config.ts` from `server/`).
Fixture/oracle scripts used for the live-DB validation above (`wp_d06_fixture_and_run.ts`, `wp_d06_oracle.mjs`)
live in the session scratchpad, not the repo — same convention every prior WP-D0*b migration report in this
program already established for its own throwaway fixtures.

## 9. Escalations

None required — the circularity solver did not need deeper mathematics than the specified fixed-point
iteration; it converges correctly for a real (sweep-driven) circular configuration and fails closed correctly
for a synthetic divergent one, at both the pure-function and live-DB-integration levels. The only open items
are the documented scope decisions (section 5) and the one documented ADR-prose-vs-pseudocode discrepancy
(section 6), neither of which blocks this work package's own deliverable.
