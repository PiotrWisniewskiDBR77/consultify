/**
 * Finance v3 canonical — Baseline Model circularity solver (Gate D / Fala 5, WP-D06).
 *
 * Implements, VERBATIM in structure, the pseudo-code in
 * `docs/validation/finance-v3/generated/gate-d/WP-D05_baseline_models_schema_ADR.md` section 6.2
 * ("Algorytm (pseudo-kod)") — deterministic fixed-point iteration over (cash, debt), seeded from
 * the prior period's closing balances, converging when `max(|Δcash|, |Δdebt|) <= tolerance` or
 * failing CLOSED (never returning a "best effort" number) once `max_iterations` is exhausted.
 *
 * PURE module: zero DB imports. `baselineComputeService.ts` is the only caller — on
 * `converged: false` it is responsible for raising
 * `finance_exceptions(severity='SECURITY', blocking_category='UNDEFINED_MATH')` (the
 * already-reserved WP-B05 blocking mechanism, ADR section 6.2's own instruction) and for NOT
 * committing `compute_job_outputs`/`finance_baseline_outputs` for the period that failed —
 * this module itself never touches a database and never decides policy beyond "did it converge".
 *
 * WHY there is circularity here at all, even with a purely contractual debt facility (ADR
 * section 6.1): this solver supports two independently-toggleable, non-discretionary mechanisms —
 *   1. `interestIncomeOnCashModeled` — interest income = rate * average(cash_opening, cash_closing);
 *      cash_closing depends on net_income (via CFO), net_income depends on interest_income — a loop
 *      even with zero debt.
 *   2. `mandatoryContractualCashSweepModeled` — a CONTRACTUAL (not discretionary — see
 *      `baselineScheduleEngine.ts`'s debt_maturity comment and ADR section 5.2's payload
 *      allowlist) cash-sweep clause: sweep = sweepPct * max(0, FCF_after_scheduled_debt_service -
 *      threshold); FCF depends on interest_expense (via NET_INCOME -> CFO), interest_expense
 *      depends on average debt, average debt depends on the sweep amount itself — a loop THROUGH
 *      debt, the literal "odsetki od średniego zadłużenia rozwiązane iteracyjnie" case WP-D06's
 *      brief item 7 asks for.
 * Both flags default to disabled at the call site when the caller's `finance_baseline_models` row
 * has them `false` (ADR section 4.1) — a model with both off has NO circularity and this solver
 * converges in exactly one iteration (residual is computed from a fixed point that never moves),
 * which is itself a documented, intentional trivial case, not a special-cased short-circuit.
 */

export interface CircularityPeriodInputs {
  /** Prior period's closing CASH balance (or the opening balance sheet's CASH for the very first forecast period). */
  priorCash: number;
  /** Prior period's closing LONG_TERM_DEBT balance. */
  priorDebt: number;

  toleranceCurrency: number;
  maxIterations: number;

  interestIncomeOnCashModeled: boolean;
  mandatoryContractualCashSweepModeled: boolean;

  /** Contractual annual rate / 12, already resolved to a per-period rate by the caller. */
  contractualRateMonthly: number;
  /** Only consulted when `interestIncomeOnCashModeled`. */
  cashInterestRateMonthly: number;

  /** CONTRACTUAL, non-discretionary — `baselineScheduleEngine.lookupScheduledAmortization()`'s output for this period. Never depends on the solver's own guesses (ADR section 6.2: "scheduled_amortization ... driven ENTIRELY by debt_maturity.payload.amortization_schedule"). */
  scheduledAmortization: number;
  /** Only consulted when `mandatoryContractualCashSweepModeled`. */
  sweepPct: number;
  sweepThreshold: number;

  // Everything below is this period's OTHER P&L/CF components, already resolved by
  // `baselineScheduleEngine.ts` from the other 7 (non-circular-by-construction) schedule types —
  // EBIT, depreciation, ΔWC, CAPEX do not depend on interest/cash/debt.
  ebit: number;
  depreciation: number;
  deltaWorkingCapital: number;
  capex: number;
  statutoryTaxRate: number;
}

export interface CircularityPeriodResult {
  converged: boolean;
  iterationsUsed: number;
  finalResidual: number;
  cash: number;
  debt: number;
  interestExpense: number;
  interestIncome: number;
  scheduledAmortization: number;
  mandatorySweep: number;
  pretaxIncome: number;
  taxExpense: number;
  netIncome: number;
  cfo: number;
  cfi: number;
  cff: number;
  netChangeCash: number;
}

/**
 * ADR section 6.2, `solve_period`. One call = one forecast period (month). Chronological ordering
 * across periods (period N's `priorCash`/`priorDebt` = period N-1's already-solved `cash`/`debt`)
 * is the CALLER's responsibility (`baselineComputeService.ts`) — this function has no notion of a
 * period id or a horizon, by design (pure, one-period-at-a-time, unit-testable in isolation).
 */
export function solvePeriod(inputs: CircularityPeriodInputs): CircularityPeriodResult {
  const { priorCash, priorDebt, toleranceCurrency, maxIterations } = inputs;
  if (maxIterations <= 0) throw new Error('solvePeriod: maxIterations must be > 0');
  if (toleranceCurrency < 0) throw new Error('solvePeriod: toleranceCurrency must be >= 0');

  // Seed guesses from the prior period's closing balances (ADR section 6.2 comment, verbatim intent).
  let cashGuess = priorCash;
  let debtGuess = priorDebt;

  let last: {
    newCash: number;
    newDebt: number;
    interestExpense: number;
    interestIncome: number;
    mandatorySweep: number;
    pretaxIncome: number;
    taxExpense: number;
    netIncome: number;
    cfo: number;
    cfi: number;
    cff: number;
    netChangeCash: number;
    residual: number;
  } | null = null;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    // 1. Contractual, non-discretionary debt movement for this period (ADR 6.2 step 1).
    const scheduledAmortization = inputs.scheduledAmortization;

    const interestExpense = inputs.contractualRateMonthly * ((priorDebt + debtGuess) / 2);
    const interestIncome = inputs.interestIncomeOnCashModeled
      ? inputs.cashInterestRateMonthly * ((priorCash + cashGuess) / 2)
      : 0;

    // 2. Mechanical P&L -> CF roll (ADR 6.2 step 2). EBIT/depreciation/ΔWC/CAPEX are already
    //    resolved by the other, non-circular schedule types (module header).
    const pretaxIncome = inputs.ebit - interestExpense + interestIncome;
    const taxExpense = Math.max(0, pretaxIncome) * inputs.statutoryTaxRate;
    const netIncome = pretaxIncome - taxExpense;

    const cfo = netIncome + inputs.depreciation - inputs.deltaWorkingCapital;
    const cfi = -inputs.capex;

    let mandatorySweep = 0;
    if (inputs.mandatoryContractualCashSweepModeled) {
      const fcfAfterScheduledDebtService = cfo + cfi - scheduledAmortization;
      mandatorySweep = inputs.sweepPct * Math.max(0, fcfAfterScheduledDebtService - inputs.sweepThreshold);
      // Never sweep more principal than remains after the scheduled payment — a contractual sweep
      // clause cannot manufacture negative debt (fail-closed floor, not a silent clamp of a bug).
      mandatorySweep = Math.min(mandatorySweep, Math.max(0, priorDebt - scheduledAmortization));
    }

    const cff = -scheduledAmortization - mandatorySweep;
    const netChangeCash = cfo + cfi + cff;

    const newCash = priorCash + netChangeCash;
    const newDebt = priorDebt - scheduledAmortization - mandatorySweep;

    const residual = Math.max(Math.abs(newCash - cashGuess), Math.abs(newDebt - debtGuess));

    cashGuess = newCash;
    debtGuess = newDebt;

    last = {
      newCash, newDebt, interestExpense, interestIncome, mandatorySweep,
      pretaxIncome, taxExpense, netIncome, cfo, cfi, cff, netChangeCash, residual,
    };

    if (residual <= toleranceCurrency) {
      return {
        converged: true,
        iterationsUsed: iteration,
        finalResidual: residual,
        cash: newCash,
        debt: newDebt,
        interestExpense,
        interestIncome,
        scheduledAmortization,
        mandatorySweep,
        pretaxIncome,
        taxExpense,
        netIncome,
        cfo,
        cfi,
        cff,
        netChangeCash,
      };
    }
  }

  // Fail-closed: did not converge within max_iterations. Still return the LAST iteration's
  // numbers for diagnostics (`finance_baseline_solver_diagnostics.final_residual_currency`) —
  // the caller MUST check `converged` before treating any of these as a usable result; they are
  // never written to `finance_baseline_outputs` (ADR section 6.2: "compute job does NOT commit
  // compute_job_outputs for this run").
  const l = last!;
  return {
    converged: false,
    iterationsUsed: maxIterations,
    finalResidual: l.residual,
    cash: l.newCash,
    debt: l.newDebt,
    interestExpense: l.interestExpense,
    interestIncome: l.interestIncome,
    scheduledAmortization: inputs.scheduledAmortization,
    mandatorySweep: l.mandatorySweep,
    pretaxIncome: l.pretaxIncome,
    taxExpense: l.taxExpense,
    netIncome: l.netIncome,
    cfo: l.cfo,
    cfi: l.cfi,
    cff: l.cff,
    netChangeCash: l.netChangeCash,
  };
}
