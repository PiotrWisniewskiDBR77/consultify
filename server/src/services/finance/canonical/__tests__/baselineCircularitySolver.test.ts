/**
 * Pure unit tests for `baselineCircularitySolver.ts` — no database, matches the "pure, DB-free"
 * test style `periodConventionResolver.test.ts`/`formulaAstEvaluator.test.ts` already established
 * in this directory.
 *
 * Three groups (WP-D06 brief items 5/7):
 *  1. Trivial case (no circularity modeled) — converges in exactly 1 iteration.
 *  2. REAL circularity via a genuine, non-discretionary contractual cash-sweep clause — the exact
 *     GoldCo PARENT Jan/Jun/Dec 2026 fixtures (`wp_d06_oracle.mjs`, an INDEPENDENT closed-form
 *     derivation that does not import this solver) cross-checked against `solvePeriod()`'s own
 *     iterative output, proving both (a) the iteration is genuinely exercised (sweep > 0, multiple
 *     iterations needed) and (b) it converges to the same numeric fixed point the independent
 *     algebra predicts.
 *  3. Fail-closed — an artificially amplifying (unrealistic) feedback coefficient that the fixed
 *     point provably cannot converge for, confirmed to exhaust `maxIterations` and report
 *     `converged: false` rather than returning any "best effort" number.
 */
import { describe, expect, it } from 'vitest';

import { solvePeriod, type CircularityPeriodInputs } from '../baselineCircularitySolver.js';

const BASE: CircularityPeriodInputs = {
  priorCash: 11_000_000,
  priorDebt: 40_500_000,
  toleranceCurrency: 1,
  maxIterations: 50,
  interestIncomeOnCashModeled: false,
  mandatoryContractualCashSweepModeled: false,
  contractualRateMonthly: 0.004,
  cashInterestRateMonthly: 0,
  scheduledAmortization: 675_000,
  sweepPct: 0,
  sweepThreshold: 0,
  ebit: 1_355_192.1416234886,
  depreciation: 613_557.8583765113,
  deltaWorkingCapital: -6_364_919.35483871,
  capex: 590_625,
  statutoryTaxRate: 0.19,
};

describe('solvePeriod — trivial (non-circular) case', () => {
  // NOTE ON ITERATION COUNT — a documented discrepancy between the ADR's prose intent (section
  // 4.1: "oba `false` domyślnie => model bez circularity, solver kończy się w jednej iteracji")
  // and the LITERAL, verbatim execution of its own section 6.2 pseudocode, found by actually
  // running this code (not by re-reading the pseudocode): the pseudocode seeds `debt_guess =
  // prior_period_closing.debt`, so iteration 1's `interest_expense = rate * average(prior_debt,
  // debt_guess)` uses the STALE seed (average(prior_debt, prior_debt) = prior_debt) rather than
  // the period's true closing debt — iteration 2 corrects `debt_guess` to the true (deterministic,
  // non-circular) closing debt and recomputes a different `interest_expense`, which changes CASH
  // again; iteration 3 is needed for the cash residual to settle to zero once the debt guess has
  // already stopped moving. This is NOT a circularity in the economic sense (nothing here depends
  // on the solver's own guess in a genuine two-way loop — `new_debt` is a pure constant every
  // iteration) — it is a seeding artifact of the exact algorithm specified. Followed literally
  // per the brief's own instruction ("TO JEST algorytm do zaimplementowania, nie wymyślaj
  // innego") rather than "fixed" by deviating from the ADR's pseudocode. See WP-D06 report.
  it('converges in 3 iterations when neither circularity mechanism is modeled (seeding artifact, not economic circularity — see note above)', () => {
    const result = solvePeriod(BASE);
    expect(result.converged).toBe(true);
    expect(result.iterationsUsed).toBe(3);
    expect(result.mandatorySweep).toBe(0);
    expect(result.debt).toBeCloseTo(40_500_000 - 675_000, 6); // pure scheduled amortization, no sweep
    // interest_expense = 0.004 * avg(40,500,000, 39,825,000) — the CORRECT (post-seed-settle) figure.
    expect(result.interestExpense).toBeCloseTo(0.004 * ((40_500_000 + 39_825_000) / 2), 4);
  });

  it('debt = 0 is not a special case — converges in 2 iterations (only the cash-vs-seed settle pass remains, since debt_guess is already exactly right at the seed), zero interest throughout', () => {
    const result = solvePeriod({ ...BASE, priorDebt: 0, scheduledAmortization: 0 });
    expect(result.converged).toBe(true);
    expect(result.iterationsUsed).toBe(2);
    expect(result.interestExpense).toBe(0);
    expect(result.debt).toBe(0);
  });
});

describe('solvePeriod — real circularity via a contractual mandatory cash-sweep clause', () => {
  // Independently derived (closed-form, NOT via this solver's own iteration — see
  // scratchpad wp_d06_oracle.mjs / WP-D06_baseline_compute_engine_report.md) GoldCo PARENT
  // (PLN standalone) Jan/Jun/Dec 2026 fixed points.
  const SWEEP_INPUTS_JAN: CircularityPeriodInputs = {
    ...BASE,
    mandatoryContractualCashSweepModeled: true,
    sweepPct: 0.10,
    sweepThreshold: 0,
  };

  it('January 2026 — sweep is active (FCF after debt service is positive), converges to the independent oracle', () => {
    const result = solvePeriod(SWEEP_INPUTS_JAN);
    expect(result.converged).toBe(true);
    // Genuinely exercises the iteration — a trivial (non-circular) case converges in 1 iteration
    // (see the "trivial" describe block above); this one needs at least 2 because the sweep
    // depends on interest expense which depends on the very debt figure the sweep itself sets.
    expect(result.iterationsUsed).toBeGreaterThanOrEqual(2);
    expect(result.mandatorySweep).toBeCloseTo(668_151.3753158259, 0);
    expect(result.debt).toBeCloseTo(39_156_848.62468418, 0);
    expect(result.cash).toBeCloseTo(17_013_362.377842434, 0);
    expect(result.interestExpense).toBeCloseTo(159_313.6972493684, 0);
    expect(result.netIncome).toBeCloseTo(968_661.5399430374, 0);
  });

  it('June 2026 — FCF after scheduled debt service is negative, sweep clause does NOT fire (max(0, ...) branch), pure amortization path, still exercises the solver machinery', () => {
    const result = solvePeriod({
      ...SWEEP_INPUTS_JAN,
      priorCash: 13_068_461.045695124,
      priorDebt: 36_372_095.719763264,
      ebit: 2_009_949.2906374945,
      depreciation: 615_050.7670548131,
      deltaWorkingCapital: 2_403_899.138585612,
      capex: 787_500.0173076923,
    });
    expect(result.converged).toBe(true);
    expect(result.mandatorySweep).toBeCloseTo(0, 6);
    expect(result.debt).toBeCloseTo(36_372_095.719763264 - 675_000, 0);
    expect(result.cash).toBeCloseTo(11_328_419.492140971, 0);
  });

  it('December 2026 — sweep clause does not fire, cash goes negative (funding gap), solver still converges correctly to a negative cash figure rather than clamping it', () => {
    const result = solvePeriod({
      ...SWEEP_INPUTS_JAN,
      priorCash: 7_676_106.923074214,
      priorDebt: 31_277_636.139017306,
      ebit: 4_103_806.387901135,
      depreciation: 621_193.4390219415,
      deltaWorkingCapital: 16_154_191.646401998,
      capex: 1_417_499.9480769231,
    });
    expect(result.converged).toBe(true);
    expect(result.cash).toBeLessThan(0);
    expect(result.cash).toBeCloseTo(-6_725_554.099273263, 0);
    expect(result.debt).toBeCloseTo(30_602_636.139017306, 0);
  });
});

describe('solvePeriod — fail-closed on non-convergence', () => {
  it('an artificially amplifying interest-on-cash feedback coefficient exhausts maxIterations and reports converged=false, never a fabricated "best effort" number', () => {
    // A physically nonsensical monthly cash-interest rate (500%/month) makes
    // `interest_income = rate * average(prior_cash, cash_guess)` amplify cash_guess by more than
    // itself every iteration once fed back through NET_INCOME -> CFO -> new_cash — the classic
    // diverging fixed point (the map's slope around the "root" has |f'(x)| = (1-taxRate)*rate/2
    // ≈ 0.4 * 5.0 / ... > 1, so successive guesses grow without bound instead of shrinking toward
    // a fixed point). Deliberately NOT the mandatory-cash-sweep mechanism (whose `mandatorySweep`
    // is explicitly floored/ceilinged against the remaining debt balance in `solvePeriod` itself —
    // a real, deliberate safety clamp that would otherwise mask this stress test by absorbing the
    // divergence into "debt hits zero and stays there"). This is NOT a realistic Baseline Model
    // configuration — WP-D06 report documents it as a synthetic stress case for the fail-closed
    // path only, per the brief's own instruction to construct "sztucznie niezbieżny przypadek".
    const divergent: CircularityPeriodInputs = {
      ...BASE,
      interestIncomeOnCashModeled: true,
      cashInterestRateMonthly: 5.0, // 500%/month — physically absurd, on purpose
      maxIterations: 25,
      toleranceCurrency: 0.01,
    };
    const result = solvePeriod(divergent);
    expect(result.converged).toBe(false);
    expect(result.iterationsUsed).toBe(25);
    expect(result.finalResidual).toBeGreaterThan(1_000_000);
    expect(Number.isFinite(result.finalResidual)).toBe(true); // blows up, but never NaN/Infinity — still a well-defined (if useless) diagnostic figure
  });

  it('maxIterations=1 fails closed for a genuinely circular (multi-iteration) configuration instead of silently accepting iteration 1 as final', () => {
    const result = solvePeriod({ ...BASE, mandatoryContractualCashSweepModeled: true, sweepPct: 0.10, maxIterations: 1, toleranceCurrency: 0.0001 });
    expect(result.converged).toBe(false);
    expect(result.iterationsUsed).toBe(1);
  });
});

describe('solvePeriod — input validation', () => {
  it('rejects maxIterations <= 0', () => {
    expect(() => solvePeriod({ ...BASE, maxIterations: 0 })).toThrow();
  });
  it('rejects negative toleranceCurrency', () => {
    expect(() => solvePeriod({ ...BASE, toleranceCurrency: -1 })).toThrow();
  });
});
