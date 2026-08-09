/**
 * ROI-E002 — pure calculation engine types.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4.3.
 *
 * These are the engine's OWN input/output shapes — camelCase, plain
 * `number`/`null` at both boundaries (Decision D12: `Decimal` never leaves
 * `roiCalculationEngine.ts`, these types never import `decimal.js`). The
 * command layer (`roiCalculationRunCommands.ts`) is responsible for mapping
 * DB rows into `RoiCalculationEngineInput` and the engine's
 * `RoiCalculationEngineOutput` back into `rvn_roi_calculation_runs` columns —
 * this file has zero knowledge of Postgres, `pg`, or any `rvn_roi_*` table.
 */

export type RoiEngineGranularity = 'monthly' | 'annual';
export type RoiEngineRoundingPolicy = 'half_up_2dp' | 'half_even_2dp' | 'none';
export type RoiEngineTimingType = 'one_time' | 'recurring';
export type RoiEngineRecurrenceCadence = 'monthly' | 'quarterly' | 'annual';
export type RoiEngineScenarioType = 'downside' | 'upside' | 'custom';
export type RoiEngineIrrStatus = 'computed' | 'not_applicable' | 'no_sign_change' | 'not_required_by_policy';
export type RoiEngineScenarioOverrideTargetType = 'assumption' | 'cost_line' | 'benefit_line';

export interface RoiEngineAssumption {
  /** `rvn_roi_assumptions.assumption_id` — used as the `target_id` a
   * `custom` scenario override may reference, and (Decision D10 / §9's
   * documented "mirrors" simplification, see roiCalculationEngine.ts's own
   * header comment) to numerically match a cost/benefit line's `amount` for
   * the canonical downside/upside substitution. */
  id: string;
  category: string;
  label: string;
  baseValue: number | null;
  downsideValue: number | null;
  upsideValue: number | null;
}

export interface RoiEngineCostLine {
  id: string;
  amount: number;
  currency: string;
  timingType: RoiEngineTimingType;
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiEngineRecurrenceCadence | null;
}

export interface RoiEngineBenefitLine {
  id: string;
  isFinancial: boolean;
  amount: number | null;
  currency: string | null;
  timingType: RoiEngineTimingType;
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiEngineRecurrenceCadence | null;
  rampPeriods: number | null;
  doubleCountingGroup: string | null;
  doubleCountingResolutionNote: string | null;
}

export interface RoiEngineScenarioOverride {
  targetType: RoiEngineScenarioOverrideTargetType;
  targetId: string;
  /** Replaces an assumption's `baseValue` for this calculation only. */
  overrideValue: number | null;
  /** Replaces a cost/benefit line's `amount` for this calculation only. */
  overrideAmount: number | null;
}

export interface RoiCalculationEngineInput {
  currency: string;
  granularity: RoiEngineGranularity;
  analysisStart: string; // DATE
  analysisEnd: string; // DATE
  discountRatePct: number | null; // ANNUAL rate, see Decision D13
  roundingPolicy: RoiEngineRoundingPolicy;
  requiredMetrics: string[] | null;
  assumptions: RoiEngineAssumption[];
  costLines: RoiEngineCostLine[];
  benefitLines: RoiEngineBenefitLine[];
  scenarioType: RoiEngineScenarioType | null; // null = base
  scenarioOverrides: RoiEngineScenarioOverride[]; // 'custom' only
}

export interface RoiEngineCashFlowPeriod {
  periodIndex: number;
  /** ISO year-month (monthly granularity) or ISO year (annual granularity)
   * label for this period, derived from `analysisStart` — purely
   * informational, never parsed back by any consumer. */
  periodLabel: string;
  costsTotal: number;
  financialBenefitsTotal: number;
  netCashFlow: number;
}

export interface RoiCalculationValidationFinding {
  code: string;
  severity: 'info' | 'warning' | 'blocking';
  message: string;
  /** Optional reference to the row(s) this finding is about — a benefit
   * line id, a double_counting_group label, etc. Never a DB foreign key,
   * purely descriptive for the caller. */
  refs?: Record<string, unknown>;
}

export interface RoiCalculationEngineOutput {
  status: 'completed' | 'failed';
  periodSeries: RoiEngineCashFlowPeriod[];
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: RoiEngineIrrStatus;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  hasUnresolvedDoubleCounting: boolean;
  hasMixedCurrencyFailure: boolean;
  validationFindings: RoiCalculationValidationFinding[];
  warnings: string[];
}
