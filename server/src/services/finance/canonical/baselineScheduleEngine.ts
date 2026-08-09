/**
 * Finance v3 canonical — Baseline Model schedule engine (Gate D / Fala 5, WP-D06).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 7 (Baseline Models). Schema: `WP-D05_baseline_models_schema_ADR.md` section 4.2
 * (`finance_baseline_schedules`, nine `schedule_type` families) and Zalacznik B (the
 * `driver_code` catalog this module's assumption inputs are keyed by).
 *
 * PURE module: zero DB imports, zero `finance_stmt_*`/`finance_baseline_*` table knowledge —
 * same "pure math over caller-supplied inputs" discipline `formulaAstEvaluator.ts` and
 * `periodConventionResolver.ts` already established in this directory.
 * `baselineComputeService.ts` is the only module that loads assumptions/history from Postgres
 * and calls these functions.
 *
 * SCOPE — "start from PROSTE rules... to ma być poprawne i testowalne, nie maksymalnie
 * wyrafinowane" (WP-D06 brief). Every function below is one straight-line/ratio formula, each
 * independently hand-verifiable:
 *   - revenue_pvm:        REVENUE[t] = REVENUE[t-12] * (1 + annualGrowthRate)   (prior-year-same-month)
 *   - cogs_opex:           COGS[t] = REVENUE[t] * cogsRatio, OPEX[t] = REVENUE[t] * opexRatio
 *   - wc_dso_dio_dpo:       AR[t] = REVENUE[t]/daysInPeriod * DSO,  INV[t] = COGS[t]/daysInPeriod * DIO,
 *                            AP[t] = COGS[t]/daysInPeriod * DPO   (brief's own literal formula)
 *   - capex_depreciation:    CAPEX[t] = REVENUE[t] * capexPctOfRevenue,
 *                             DEPRECIATION[t] = FIXED_ASSETS[t-1] / usefulLifeMonths (straight-line
 *                             run-rate on the opening gross block — no vintage-by-vintage tracking,
 *                             documented simplification, WP-D06 report section "scope decisions")
 *   - debt_maturity:          contractual, non-discretionary only (ADR section 6.1 / 5.2 layer-2
 *                              allowlist) — scheduled amortization lookup lives here;
 *                              interest/mandatory-sweep ITERATION lives in
 *                              `baselineCircularitySolver.ts` (that is the one genuinely circular
 *                              piece, per ADR section 6.1, and is kept in its own pure module).
 *   - tax_nol:                 TAX_EXPENSE[t] = max(0, pretax[t]) * statutoryTaxRate — a loss carries
 *                               zero tax and zero NOL DEFERRED-TAX ASSET is booked (P0 taxonomy has
 *                               no NOL/deferred-tax BS line yet — same documented scope boundary
 *                               `goldco_oracle.ts` used for its own restatement's tax treatment).
 *   - equity_re:                RETAINED_EARNINGS[t] = RETAINED_EARNINGS[t-1] + NET_INCOME[t]
 *                                (no "− dividends" term with a real value — DEC-FIN-002 / ADR layer 3
 *                                already guarantees DIVIDENDS_DECLARED cannot be PRESENT_NONZERO in a
 *                                Baseline Model; this function's signature accepts a
 *                                `dividendsDeclared` parameter purely so it is not hardcoded to 0 by
 *                                fiat, but every real Baseline caller passes 0).
 *   - headcount / leases:        Implemented as pure, independently testable functions (their
 *                                 `driver_code`s exist in the ADR's Zalacznik B catalog and a real
 *                                 Kreator screen needs them), but the P0 canonical taxonomy
 *                                 (`financial_statement_lines`, 31 rows) has no PAYROLL/LEASE_LIABILITY
 *                                 line code for their output to land on yet — `baselineComputeService.ts`
 *                                 does not currently wire them into `finance_baseline_outputs` writes.
 *                                 Documented boundary, not a silent gap (WP-D06 report, "scope decisions").
 */

// ---------------------------------------------------------------------------
// revenue_pvm
// ---------------------------------------------------------------------------

export interface RevenuePvmInputs {
  /** REVENUE for the SAME calendar month one fiscal year earlier (PRIOR_YEAR_SAME_PERIOD). */
  priorYearSameMonthRevenue: number;
  /** e.g. 0.05 for +5%/year. */
  annualGrowthRate: number;
}

export function computeRevenuePvm(inputs: RevenuePvmInputs): number {
  return inputs.priorYearSameMonthRevenue * (1 + inputs.annualGrowthRate);
}

// ---------------------------------------------------------------------------
// cogs_opex
// ---------------------------------------------------------------------------

export interface CogsOpexInputs {
  revenue: number;
  /** COGS / REVENUE, historical ratio (e.g. 0.6484). */
  cogsRatio: number;
  /** OPEX / REVENUE, historical ratio. */
  opexRatio: number;
}

export interface CogsOpexResult {
  cogs: number;
  opex: number;
  grossMargin: number;
  ebitda: number;
}

export function computeCogsOpex(inputs: CogsOpexInputs): CogsOpexResult {
  const cogs = inputs.revenue * inputs.cogsRatio;
  const opex = inputs.revenue * inputs.opexRatio;
  const grossMargin = inputs.revenue - cogs;
  const ebitda = grossMargin - opex;
  return { cogs, opex, grossMargin, ebitda };
}

// ---------------------------------------------------------------------------
// wc_dso_dio_dpo
// ---------------------------------------------------------------------------

export interface WcDsoDioDpoInputs {
  revenue: number;
  cogs: number;
  daysInPeriod: number;
  dsoDays: number;
  dioDays: number;
  dpoDays: number;
}

export interface WcDsoDioDpoResult {
  ar: number;
  inventory: number;
  ap: number;
}

/** Brief's own literal formula: "DSO→AR = revenue*DSO/days_in_period". */
export function computeWcDsoDioDpo(inputs: WcDsoDioDpoInputs): WcDsoDioDpoResult {
  if (inputs.daysInPeriod <= 0) throw new Error('computeWcDsoDioDpo: daysInPeriod must be > 0');
  const ar = (inputs.revenue / inputs.daysInPeriod) * inputs.dsoDays;
  const inventory = (inputs.cogs / inputs.daysInPeriod) * inputs.dioDays;
  const ap = (inputs.cogs / inputs.daysInPeriod) * inputs.dpoDays;
  return { ar, inventory, ap };
}

// ---------------------------------------------------------------------------
// capex_depreciation
// ---------------------------------------------------------------------------

export interface CapexDepreciationInputs {
  revenue: number;
  priorFixedAssets: number;
  capexPctOfRevenue: number;
  /** Straight-line run-rate: this many months to depreciate the OPENING gross block. */
  usefulLifeMonths: number;
}

export interface CapexDepreciationResult {
  capex: number;
  depreciation: number;
  closingFixedAssets: number;
}

export function computeCapexDepreciation(inputs: CapexDepreciationInputs): CapexDepreciationResult {
  if (inputs.usefulLifeMonths <= 0) throw new Error('computeCapexDepreciation: usefulLifeMonths must be > 0');
  const capex = inputs.revenue * inputs.capexPctOfRevenue;
  const depreciation = inputs.priorFixedAssets / inputs.usefulLifeMonths;
  const closingFixedAssets = inputs.priorFixedAssets + capex - depreciation;
  return { capex, depreciation, closingFixedAssets };
}

// ---------------------------------------------------------------------------
// debt_maturity — CONTRACTUAL, non-discretionary lookup only (ADR section 5.2 debt_maturity
// payload allowlist: principal_opening/contractual_rate/amortization_schedule). The
// interest-expense ↔ average-debt ↔ mandatory-sweep FIXED POINT is NOT here — that is the one
// genuinely circular relationship in this program (ADR section 6.1) and lives in
// `baselineCircularitySolver.ts`, kept separate so this module stays a straight lookup.
// ---------------------------------------------------------------------------

export interface AmortizationSchedule {
  /** `schedule_item_code` (e.g. one facility) -> ordered list of contractual principal payments, one per forecast month, in chronological order. */
  scheduledPrincipalByMonth: readonly number[];
}

/** `periodIndex` is 0-based (0 = first forecast month of the horizon). Returns 0 once the schedule is exhausted (facility fully amortized), never a negative or fabricated figure. */
export function lookupScheduledAmortization(schedule: AmortizationSchedule, periodIndex: number): number {
  if (periodIndex < 0) throw new Error('lookupScheduledAmortization: periodIndex must be >= 0');
  return schedule.scheduledPrincipalByMonth[periodIndex] ?? 0;
}

// ---------------------------------------------------------------------------
// tax_nol
// ---------------------------------------------------------------------------

export interface TaxNolInputs {
  pretaxIncome: number;
  /** e.g. 0.19 for 19%. */
  statutoryTaxRate: number;
}

export interface TaxNolResult {
  taxExpense: number;
  netIncome: number;
}

/** A loss (`pretaxIncome < 0`) carries zero tax expense and the full loss flows to NET_INCOME — no NOL deferred-tax asset is booked (P0 taxonomy has no such BS line yet, documented scope boundary, module header). Never a fabricated negative tax (a "tax benefit" credit) and never a silent zero on a genuine profit. */
export function computeTaxNol(inputs: TaxNolInputs): TaxNolResult {
  const taxExpense = Math.max(0, inputs.pretaxIncome) * inputs.statutoryTaxRate;
  const netIncome = inputs.pretaxIncome - taxExpense;
  return { taxExpense, netIncome };
}

// ---------------------------------------------------------------------------
// equity_re
// ---------------------------------------------------------------------------

export interface EquityReInputs {
  priorRetainedEarnings: number;
  netIncome: number;
  /** Every real Baseline caller passes 0 (DEC-FIN-002 / ADR layer 3 — see module header). Exposed as a parameter, not hardcoded, so this function's own correctness does not silently depend on that external guarantee. */
  dividendsDeclared: number;
}

export function computeEquityRe(inputs: EquityReInputs): { closingRetainedEarnings: number } {
  return { closingRetainedEarnings: inputs.priorRetainedEarnings + inputs.netIncome - inputs.dividendsDeclared };
}

// ---------------------------------------------------------------------------
// headcount — implemented, independently testable, NOT currently wired to a P0 canonical
// output line (module header "SCOPE"). Kept here so the Kreator/driver-catalog surface (ADR
// Zalacznik B: HIRES_PER_PERIOD/ATTRITION_RATE_PCT/AVG_SALARY_GROWTH_PCT) has a real function
// behind it, ready for the day a PAYROLL canonical line exists.
// ---------------------------------------------------------------------------

export interface HeadcountInputs {
  priorHeadcount: number;
  hiresPerPeriod: number;
  /** e.g. 0.02 for 2%/month attrition. */
  attritionRatePct: number;
  priorAvgMonthlySalary: number;
  /** e.g. 0.003 for +0.3%/month salary growth. */
  avgSalaryGrowthRatePct: number;
}

export interface HeadcountResult {
  closingHeadcount: number;
  avgMonthlySalary: number;
  payrollCost: number;
}

export function computeHeadcount(inputs: HeadcountInputs): HeadcountResult {
  const attrition = inputs.priorHeadcount * inputs.attritionRatePct;
  const closingHeadcount = Math.max(0, inputs.priorHeadcount + inputs.hiresPerPeriod - attrition);
  const avgMonthlySalary = inputs.priorAvgMonthlySalary * (1 + inputs.avgSalaryGrowthRatePct);
  const payrollCost = closingHeadcount * avgMonthlySalary;
  return { closingHeadcount, avgMonthlySalary, payrollCost };
}

// ---------------------------------------------------------------------------
// leases — implemented, independently testable, NOT currently wired to a P0 canonical output
// line (same documented boundary as headcount above).
// ---------------------------------------------------------------------------

export interface LeasesInputs {
  priorLeaseLiability: number;
  monthlyLeasePayment: number;
  /** e.g. 0.02 for +2%/year escalation, applied once per fiscal-year boundary (monthIndexInYear === 0). */
  escalationRateAnnual: number;
  /** 0-based month-of-fiscal-year (0 = first month) — escalation applies once per year, not compounded every month. */
  monthIndexInYear: number;
}

export interface LeasesResult {
  leaseExpense: number;
  closingLeaseLiability: number;
  effectiveMonthlyPayment: number;
}

export function computeLeases(inputs: LeasesInputs): LeasesResult {
  const escalationFactor = inputs.monthIndexInYear === 0 ? 1 + inputs.escalationRateAnnual : 1;
  const effectiveMonthlyPayment = inputs.monthlyLeasePayment * escalationFactor;
  const closingLeaseLiability = Math.max(0, inputs.priorLeaseLiability - effectiveMonthlyPayment);
  return { leaseExpense: effectiveMonthlyPayment, closingLeaseLiability, effectiveMonthlyPayment };
}
