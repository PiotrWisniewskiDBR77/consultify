/**
 * ideaFinance/types — input and output shapes for the Idea financial competence
 * layer (Program E / epic E09).
 *
 * Source of truth:
 *   docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md
 *     §7.1 Financial inputs, §7.2 Calculations
 *   docs/qa/ideas-manual-audit-2026-08-09/11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md
 *     §3.5 Business and financial DoD, epic E09
 *
 * This is the Idea-level *pre-decision candidate case* — distinct from
 * Consultify Finance's governed valuation artifacts (see
 * server/src/services/investmentAppraisalService.ts, which backs the M16
 * Investment Appraisal domain). §7 of the master program is explicit that
 * "Finance remains the authority for governed valuation/approved financial
 * artifacts; Ideas stores the assumptions and candidate case with lineage" —
 * these are deliberately two different authorities, so this module does not
 * import or extend the server-side engine (see engine.ts header for the full
 * reuse note).
 */

/** ISO 4217 currency code, e.g. 'PLN', 'EUR', 'USD'. */
export type CurrencyCode = string;

/** Presentation/storage scale. Amounts in this module are always stored in
 * the unit implied by `scale`, never inferred from formatting. */
export type CurrencyScale = 'unit' | 'thousand' | 'million';

export interface CurrencyInfo {
  code: CurrencyCode;
  scale: CurrencyScale;
  /** Required when a driver's currency differs from the case currency.
   * Conversion is only ever applied from this EXPLICIT, sourced rate —
   * never inferred or silently rescaled. */
  fx?: {
    toCaseCurrency: number;
    source: string;
    date: string;
  };
}

export interface EvidenceRef {
  source: string;
  date?: string;
  note?: string;
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface DriverConfidence {
  level: ConfidenceLevel;
  evidence?: EvidenceRef;
}

export type PeriodUnit = 'month' | 'quarter' | 'year';

export interface PeriodConvention {
  unit: PeriodUnit;
  /** Must match `unit`: month=12, quarter=4, year=1. Validated, never assumed. */
  periodsPerYear: number;
  /** ISO date for period index 0. */
  anchorDate: string;
}

export interface BaselineInput {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  currentValue: number;
  currency: CurrencyInfo;
  period: PeriodUnit;
  sourceDate: string;
  evidence: EvidenceRef;
}

export type CostClassification = 'capex' | 'opex' | 'unclassified';

export interface InvestmentCostInput {
  id: string;
  label: string;
  /** Positive one-time amount, before contingency. */
  amount: number;
  currency: CurrencyInfo;
  classification: CostClassification;
  internalOrExternal: 'internal' | 'external';
  /** Percent added on top of `amount`, e.g. 15 = +15%. */
  contingencyPct?: number;
  /** Period index (0-based) this outlay lands in. */
  periodIndex: number;
  confidence: DriverConfidence;
}

export type RecurringCostCategory =
  | 'license'
  | 'operations'
  | 'maintenance'
  | 'headcount'
  | 'vendor'
  | 'other';

export interface RecurringCostInput {
  id: string;
  label: string;
  category: RecurringCostCategory;
  /** Positive amount per period, before escalation. */
  amountPerPeriod: number;
  currency: CurrencyInfo;
  startPeriodIndex: number;
  /** Inclusive. Undefined = runs to the horizon. */
  endPeriodIndex?: number;
  /** Percent per year, compounded annually from `startPeriodIndex`. */
  escalationPctPerYear?: number;
  confidence: DriverConfidence;
}

/**
 * Benefit type — deliberately never conflated (DoD §3.5): cash, capacity,
 * avoided risk and qualitative value are tracked and reported separately.
 */
export type BenefitType =
  | 'revenue'
  | 'margin'
  | 'cash_saving'
  | 'avoided_cost'
  | 'capacity_release'
  | 'risk_avoidance'
  | 'qualitative';

/** Required whenever `BenefitInput.type === 'capacity_release'`. Capacity
 * release must never be counted as cash saving without this explicit,
 * caller-supplied realization assumption — never a hidden constant. */
export interface CapacityReleaseRealization {
  /** Fraction (0..1) of the released capacity's theoretical value assumed to
   * convert into realized cash value. */
  realizedFraction: number;
  rationale: string;
}

export interface BenefitInput {
  id: string;
  label: string;
  type: BenefitType;
  /**
   * Cash-equivalent value per period.
   * - revenue / margin / cash_saving / avoided_cost: required, enters the
   *   cash-basis math directly.
   * - capacity_release: required; this is the RAW theoretical value before
   *   realization — see `capacityRealization.realizedFraction` for how much
   *   of it is treated as cash.
   * - risk_avoidance: required, but kept OUT of the cash-basis headline
   *   (NPV/ROI/payback/BCR) and reported as a separate value.
   * - qualitative: must be omitted. Qualitative benefits carry no
   *   synthesized currency figure and never enter any numeric total.
   */
  amountPerPeriod?: number;
  currency?: CurrencyInfo;
  startPeriodIndex: number;
  endPeriodIndex?: number;
  /** Periods to ramp linearly from 0 to full `amountPerPeriod`. */
  rampPeriods?: number;
  /** Required when type === 'capacity_release'; must be absent otherwise. */
  capacityRealization?: CapacityReleaseRealization;
  /** Required when type === 'qualitative'; narrative only, no currency. */
  qualitativeDescription?: string;
  confidence: DriverConfidence;
}

export interface TimingInput {
  startDate: string;
  implementationRampPeriods: number;
  benefitRampPeriods: number;
  /** Number of periods in the model horizon (periods 0..usefulHorizonPeriods). */
  usefulHorizonPeriods: number;
  /** Signed one-off effect applied at the final period (e.g. decommissioning
   * cost as a negative number). */
  terminalValue?: number;
}

export type ScenarioName = 'base' | 'upside' | 'downside' | string;

export interface ScenarioDriverOverride {
  /** Matches an InvestmentCostInput/RecurringCostInput/BenefitInput id. */
  driverId: string;
  /** Multiplier applied to that single driver's amount, e.g. 1.15 = +15%.
   * Scenarios vary named drivers individually — never the finished total. */
  multiplier: number;
  note?: string;
}

export interface ScenarioInput {
  name: ScenarioName;
  driverOverrides: ScenarioDriverOverride[];
}

/** Confidence level → weight applied only inside computeConfidenceAdjustedValue. */
export type ConfidenceWeights = Record<ConfidenceLevel, number>;

export interface IdeaFinancialCaseInput {
  formulaVersion: string;
  currency: CurrencyInfo;
  periodConvention: PeriodConvention;
  /** Annual discount rate in percent, e.g. 10 = 10%. Always a parameter. */
  discountRatePct: number;
  baseline: BaselineInput[];
  investments: InvestmentCostInput[];
  recurringCosts: RecurringCostInput[];
  benefits: BenefitInput[];
  timing: TimingInput;
  /** Must include a scenario named 'base'. */
  scenarios: ScenarioInput[];
}

export interface CalculationMeta {
  formulaVersion: string;
  currency: CurrencyCode;
  scale: CurrencyScale;
  periodUnit: PeriodUnit;
  periodsPerYear: number;
  scenario: ScenarioName;
  /** Driver ids that fed this calculation, for provenance. */
  inputs: string[];
}

export type CalcResult<T> =
  | { status: 'ok'; value: T; meta: CalculationMeta }
  | { status: 'invalid'; reason: string; meta: CalculationMeta }
  | { status: 'missing'; reason: string; meta: CalculationMeta };

export function isOk<T>(r: CalcResult<T>): r is { status: 'ok'; value: T; meta: CalculationMeta } {
  return r.status === 'ok';
}
