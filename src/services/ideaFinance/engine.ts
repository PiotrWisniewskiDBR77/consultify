/**
 * ideaFinance/engine — pure calculation core for the Idea financial
 * competence layer (Program E / epic E09).
 *
 * No UI, no I/O, no wall-clock reads inside compute paths (deterministic and
 * testable). Every exported calculation returns a `CalcResult<T>` carrying
 * `meta.formulaVersion`, `meta.currency`/`meta.scale`, `meta.periodUnit`/
 * `meta.periodsPerYear`, `meta.scenario` and `meta.inputs` (driver ids used),
 * plus an explicit `reason` whenever it cannot compute (per master program
 * §7.2 and DoD §3.5/§3.8 — no formatted-text inference, no silent rescaling,
 * no unlike units, no misleading numbers).
 *
 * REUSE NOTE (read before extending): the only pre-existing NPV/IRR engine in
 * this repo is `server/src/services/investmentAppraisalService.ts`, a
 * Node-only, dependency-free module backing the M16 Investment Appraisal
 * domain (governed Finance valuation, invoked over HTTP by
 * `src/components/Economics/panels/InvestmentAppraisalPanel.tsx` — there is
 * no client-side calculation engine for it, only a fetch wrapper). Grepping
 * `src/` confirmed no client-side NPV/IRR implementation exists prior to this
 * file. This module intentionally does NOT import that server service:
 *   1. Architectural boundary — it lives under `server/src`, is bundled for
 *      Node, and is wired to the *governed* Finance/Investment-Appraisal
 *      domain. The master program (§7, opening paragraph) is explicit that
 *      Finance is a *different authority* from the Idea's pre-decision
 *      candidate case; collapsing the two would let an unapproved Idea draft
 *      masquerade as governed valuation.
 *   2. Idea calculations must run synchronously in the client so driver
 *      edits can mark results "stale" and recompute locally (§7.3) without a
 *      server round trip — a Node-only module can't do that from the
 *      Idea workspace bundle.
 * Where sensible this module mirrors that service's *safe conventions*
 * (discount rate always an explicit parameter, cash flows as plain period
 * arrays, IRR via bisection with an explicit non-applicable case) so the two
 * domains stay numerically consistent, without sharing a bundle boundary.
 */

import type {
  BenefitInput,
  BenefitType,
  CalcResult,
  CalculationMeta,
  ConfidenceLevel,
  ConfidenceWeights,
  CurrencyInfo,
  IdeaFinancialCaseInput,
  InvestmentCostInput,
  PeriodUnit,
  RecurringCostInput,
  ScenarioInput,
  ScenarioName,
} from './types';

export const FORMULA_VERSION = 'idea-finance-v1';

const CASH_BENEFIT_TYPES: BenefitType[] = ['revenue', 'margin', 'cash_saving', 'avoided_cost'];

const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = { low: 0.5, medium: 0.75, high: 1.0 };

// ---------------------------------------------------------------------------
// Shared internal schedule
// ---------------------------------------------------------------------------

export interface IdeaFinanceSchedule {
  periods: number[];
  investmentCost: number[];
  recurringCost: number[];
  costTotal: number[];
  benefitByType: Record<Exclude<BenefitType, 'qualitative'>, number[]>;
  /** revenue + margin + cash_saving + avoided_cost + realized capacity_release. */
  cashBenefit: number[];
  capacityRaw: number[];
  capacityRealized: number[];
  /** Tracked separately — never folded into cashBenefit/netCashFlow (DoD §3.5). */
  riskAvoidance: number[];
  qualitativeBenefits: Array<{ id: string; label: string; description?: string }>;
  netCashFlow: number[];
  driverIds: string[];
}

type ScheduleBuild = { ok: true; schedule: IdeaFinanceSchedule } | { ok: false; reason: string };

function scaleFactor(scale: CurrencyInfo['scale']): number {
  return scale === 'unit' ? 1 : scale === 'thousand' ? 1e3 : 1e6;
}

/** Converts a driver amount into case-currency, case-scale units. Never
 * infers a rate — requires an explicit, sourced `fx` when codes differ. */
function currencyFactor(
  driverCurrency: CurrencyInfo | undefined,
  caseCurrency: CurrencyInfo
): { ok: true; factor: number } | { ok: false; reason: string } {
  const dc = driverCurrency ?? caseCurrency;
  let factor = scaleFactor(dc.scale) / scaleFactor(caseCurrency.scale);
  if (dc.code !== caseCurrency.code) {
    if (!dc.fx || !(dc.fx.toCaseCurrency > 0) || !dc.fx.source || !dc.fx.date) {
      return {
        ok: false,
        reason: `currency mismatch: driver uses ${dc.code}, case currency is ${caseCurrency.code}, no valid fx conversion (rate/source/date) provided`,
      };
    }
    factor *= dc.fx.toCaseCurrency;
  }
  return { ok: true, factor };
}

function rampFraction(period: number, start: number, rampPeriods: number | undefined): number {
  if (period < start) return 0;
  if (!rampPeriods || rampPeriods <= 0) return 1;
  const sincStart = period - start + 1;
  return Math.min(1, sincStart / rampPeriods);
}

function expectedPeriodsPerYear(unit: PeriodUnit): number {
  return unit === 'month' ? 12 : unit === 'quarter' ? 4 : 1;
}

function scenarioMultiplierMap(scenario: ScenarioInput | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of scenario?.driverOverrides ?? []) m.set(o.driverId, o.multiplier);
  return m;
}

function findScenario(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): { ok: true; scenario: ScenarioInput } | { ok: false; reason: string } {
  const scenario = input.scenarios.find((s) => s.name === scenarioName);
  if (!scenario) {
    return { ok: false, reason: `unknown scenario "${scenarioName}" — not present in scenarios[]` };
  }
  return { ok: true, scenario };
}

function emptyByTypeMap(length: number): Record<Exclude<BenefitType, 'qualitative'>, number[]> {
  return {
    revenue: new Array(length).fill(0),
    margin: new Array(length).fill(0),
    cash_saving: new Array(length).fill(0),
    avoided_cost: new Array(length).fill(0),
    capacity_release: new Array(length).fill(0),
    risk_avoidance: new Array(length).fill(0),
  };
}

function buildSchedule(input: IdeaFinancialCaseInput, scenarioName: ScenarioName): ScheduleBuild {
  if (!input.scenarios.some((s) => s.name === 'base')) {
    return { ok: false, reason: 'scenarios[] must include a scenario named "base"' };
  }
  const scenarioLookup = findScenario(input, scenarioName);
  if (!scenarioLookup.ok) return scenarioLookup;
  const scenario = scenarioLookup.scenario;

  const knownDriverIds = new Set<string>([
    ...input.investments.map((d) => d.id),
    ...input.recurringCosts.map((d) => d.id),
    ...input.benefits.map((d) => d.id),
  ]);
  for (const o of scenario.driverOverrides) {
    if (!knownDriverIds.has(o.driverId)) {
      return {
        ok: false,
        reason: `scenario "${scenario.name}" overrides unknown driver id "${o.driverId}"`,
      };
    }
  }

  const { periodConvention, timing, currency: caseCurrency } = input;
  const expectedPpy = expectedPeriodsPerYear(periodConvention.unit);
  if (periodConvention.periodsPerYear !== expectedPpy) {
    return {
      ok: false,
      reason: `periodConvention.periodsPerYear (${periodConvention.periodsPerYear}) does not match unit "${periodConvention.unit}" (expected ${expectedPpy})`,
    };
  }
  if (!Number.isFinite(input.discountRatePct)) {
    return { ok: false, reason: 'discountRatePct is missing or not a finite number' };
  }
  if (!Number.isInteger(timing.usefulHorizonPeriods) || timing.usefulHorizonPeriods < 0) {
    return { ok: false, reason: 'timing.usefulHorizonPeriods must be a non-negative integer' };
  }

  const horizon = timing.usefulHorizonPeriods;
  const length = horizon + 1;
  const periods = Array.from({ length }, (_, i) => i);
  const mult = scenarioMultiplierMap(scenario);

  const investmentCost = new Array(length).fill(0);
  const driverIds: string[] = [];

  for (const inv of input.investments) {
    if (inv.periodIndex < 0 || inv.periodIndex > horizon) {
      return {
        ok: false,
        reason: `investment "${inv.id}" periodIndex (${inv.periodIndex}) is outside the horizon [0, ${horizon}]`,
      };
    }
    const factorResult = currencyFactor(inv.currency, caseCurrency);
    if (!factorResult.ok) return { ok: false, reason: `investment "${inv.id}": ${factorResult.reason}` };
    const withContingency = inv.amount * (1 + (inv.contingencyPct ?? 0) / 100);
    const scenarioMult = mult.get(inv.id) ?? 1;
    investmentCost[inv.periodIndex] += withContingency * scenarioMult * factorResult.factor;
    driverIds.push(inv.id);
  }

  const recurringCost = new Array(length).fill(0);
  for (const rc of input.recurringCosts) {
    const factorResult = currencyFactor(rc.currency, caseCurrency);
    if (!factorResult.ok) return { ok: false, reason: `recurring cost "${rc.id}": ${factorResult.reason}` };
    const scenarioMult = mult.get(rc.id) ?? 1;
    const end = rc.endPeriodIndex ?? horizon;
    for (let p = Math.max(0, rc.startPeriodIndex); p <= Math.min(horizon, end); p++) {
      const elapsedYears = Math.floor((p - rc.startPeriodIndex) / periodConvention.periodsPerYear);
      const escalationMult = Math.pow(1 + (rc.escalationPctPerYear ?? 0) / 100, elapsedYears);
      recurringCost[p] += rc.amountPerPeriod * escalationMult * scenarioMult * factorResult.factor;
    }
    driverIds.push(rc.id);
  }

  const costTotal = periods.map((p) => investmentCost[p] + recurringCost[p]);

  const benefitByType = emptyByTypeMap(length);
  const cashBenefit = new Array(length).fill(0);
  const capacityRaw = new Array(length).fill(0);
  const capacityRealized = new Array(length).fill(0);
  const riskAvoidance = new Array(length).fill(0);
  const qualitativeBenefits: Array<{ id: string; label: string; description?: string }> = [];

  for (const b of input.benefits) {
    driverIds.push(b.id);
    if (b.type === 'qualitative') {
      if (b.amountPerPeriod !== undefined) {
        return {
          ok: false,
          reason: `qualitative benefit "${b.id}" must not carry amountPerPeriod — qualitative value is never numeric`,
        };
      }
      qualitativeBenefits.push({ id: b.id, label: b.label, description: b.qualitativeDescription });
      continue;
    }
    if (b.type === 'capacity_release') {
      if (!b.capacityRealization) {
        return {
          ok: false,
          reason: `capacity_release benefit "${b.id}" is missing a realization assumption (capacityRealization) — capacity release cannot be counted as cash saving without one`,
        };
      }
      const rf = b.capacityRealization.realizedFraction;
      if (!(rf >= 0 && rf <= 1)) {
        return {
          ok: false,
          reason: `capacity_release benefit "${b.id}" has an invalid realizedFraction (${rf}) — must be within [0, 1]`,
        };
      }
    } else if (b.capacityRealization) {
      return {
        ok: false,
        reason: `benefit "${b.id}" (type "${b.type}") must not carry capacityRealization — only capacity_release benefits do`,
      };
    }
    if (b.amountPerPeriod === undefined) {
      return { ok: false, reason: `benefit "${b.id}" (type "${b.type}") is missing amountPerPeriod` };
    }
    const factorResult = currencyFactor(b.currency, caseCurrency);
    if (!factorResult.ok) return { ok: false, reason: `benefit "${b.id}": ${factorResult.reason}` };
    const scenarioMult = mult.get(b.id) ?? 1;
    const end = b.endPeriodIndex ?? horizon;
    for (let p = Math.max(0, b.startPeriodIndex); p <= Math.min(horizon, end); p++) {
      const raw =
        b.amountPerPeriod *
        rampFraction(p, b.startPeriodIndex, b.rampPeriods) *
        scenarioMult *
        factorResult.factor;
      benefitByType[b.type][p] += raw;
      if (CASH_BENEFIT_TYPES.includes(b.type)) {
        cashBenefit[p] += raw;
      } else if (b.type === 'capacity_release') {
        capacityRaw[p] += raw;
        const realized = raw * (b.capacityRealization?.realizedFraction ?? 0);
        capacityRealized[p] += realized;
        cashBenefit[p] += realized;
      } else if (b.type === 'risk_avoidance') {
        riskAvoidance[p] += raw;
      }
    }
  }

  const netCashFlow = periods.map((p) => cashBenefit[p] - costTotal[p]);
  if (timing.terminalValue) {
    netCashFlow[horizon] += timing.terminalValue;
  }

  return {
    ok: true,
    schedule: {
      periods,
      investmentCost,
      recurringCost,
      costTotal,
      benefitByType,
      cashBenefit,
      capacityRaw,
      capacityRealized,
      riskAvoidance,
      qualitativeBenefits,
      netCashFlow,
      driverIds: Array.from(new Set(driverIds)),
    },
  };
}

function buildMeta(input: IdeaFinancialCaseInput, scenarioName: ScenarioName, driverIds: string[]): CalculationMeta {
  return {
    formulaVersion: FORMULA_VERSION,
    currency: input.currency.code,
    scale: input.currency.scale,
    periodUnit: input.periodConvention.unit,
    periodsPerYear: input.periodConvention.periodsPerYear,
    scenario: scenarioName,
    inputs: driverIds,
  };
}

function emptyMeta(input: IdeaFinancialCaseInput, scenarioName: ScenarioName): CalculationMeta {
  return buildMeta(input, scenarioName, []);
}

function invalidResult<T>(input: IdeaFinancialCaseInput, scenarioName: ScenarioName, reason: string): CalcResult<T> {
  return { status: 'invalid', reason, meta: emptyMeta(input, scenarioName) };
}

/** Use for a required driver/field that is simply absent (vs. present-but-
 * violating-a-constraint, which is `invalidResult`). Both surface a `reason`
 * string; the status distinguishes "nothing to compute from" from "the
 * computation was rejected". */
function missingResult<T>(input: IdeaFinancialCaseInput, scenarioName: ScenarioName, reason: string): CalcResult<T> {
  return { status: 'missing', reason, meta: emptyMeta(input, scenarioName) };
}

/** buildSchedule reasons that mean "a required input is simply absent" and
 * should surface as CalcResult status `missing` rather than `invalid`. */
const MISSING_REASON_PREFIXES = [
  'discountRatePct is missing',
  'scenarios[] must include a scenario named "base"',
];

/** Re-wraps a failed inner CalcResult (e.g. from computeNPV) into a new
 * CalcResult of a different value type, preserving whether the inner failure
 * was `missing` or `invalid` rather than collapsing both to `invalid`. */
function propagateFailure<T>(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName,
  inner: { status: 'invalid' | 'missing'; reason: string },
  reasonPrefix?: string
): CalcResult<T> {
  const reason = reasonPrefix ? `${reasonPrefix}${inner.reason}` : inner.reason;
  return inner.status === 'missing'
    ? missingResult(input, scenarioName, reason)
    : invalidResult(input, scenarioName, reason);
}

function scheduleFailureResult<T>(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName,
  reason: string
): CalcResult<T> {
  if (
    MISSING_REASON_PREFIXES.some((p) => reason.startsWith(p)) ||
    /is missing amountPerPeriod$/.test(reason) ||
    /is missing a realization assumption/.test(reason)
  ) {
    return missingResult(input, scenarioName, reason);
  }
  return invalidResult(input, scenarioName, reason);
}

// ---------------------------------------------------------------------------
// 1/2. Gross and net annual benefit
// ---------------------------------------------------------------------------

export interface AnnualBenefitResult {
  /** Period index range of the representative (last full) year used. */
  yearPeriodRange: [number, number];
  byType: Record<Exclude<BenefitType, 'qualitative'>, number>;
  /** Cash-basis only: revenue + margin + cash_saving + avoided_cost + realized capacity. */
  grossCashBenefit: number;
  /** grossCashBenefit − recurring operating cost in the same year (one-time
   * investment is excluded — see computeImplementationCost for that). */
  netCashBenefit: number;
  riskAvoidanceValue: number;
  qualitativeCount: number;
}

function representativeYearRange(
  horizon: number,
  periodsPerYear: number
): { ok: true; range: [number, number] } | { ok: false; reason: string } {
  const fullYears = Math.floor((horizon + 1) / periodsPerYear);
  if (fullYears < 1) {
    return {
      ok: false,
      reason: `horizon (${horizon + 1} periods) is shorter than one full year (${periodsPerYear} periods) — annual benefit not computable without rescaling a partial period`,
    };
  }
  const start = (fullYears - 1) * periodsPerYear;
  const end = fullYears * periodsPerYear - 1;
  return { ok: true, range: [start, end] };
}

export function computeAnnualBenefit(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<AnnualBenefitResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const { schedule } = built;
  const yr = representativeYearRange(schedule.periods.length - 1, input.periodConvention.periodsPerYear);
  if (!yr.ok) return invalidResult(input, scenarioName, yr.reason);
  const [start, end] = yr.range;

  const sumRange = (arr: number[]) => arr.slice(start, end + 1).reduce((a, b) => a + b, 0);

  const byType = {
    revenue: sumRange(schedule.benefitByType.revenue),
    margin: sumRange(schedule.benefitByType.margin),
    cash_saving: sumRange(schedule.benefitByType.cash_saving),
    avoided_cost: sumRange(schedule.benefitByType.avoided_cost),
    capacity_release: sumRange(schedule.benefitByType.capacity_release),
    risk_avoidance: sumRange(schedule.benefitByType.risk_avoidance),
  };
  const grossCashBenefit = sumRange(schedule.cashBenefit);
  const recurringCostInYear = sumRange(schedule.recurringCost);

  return {
    status: 'ok',
    value: {
      yearPeriodRange: [start, end],
      byType,
      grossCashBenefit,
      netCashBenefit: grossCashBenefit - recurringCostInYear,
      riskAvoidanceValue: byType.risk_avoidance,
      qualitativeCount: schedule.qualitativeBenefits.length,
    },
    meta: buildMeta(input, scenarioName, schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 3. Implementation and recurring cost
// ---------------------------------------------------------------------------

export interface ImplementationCostResult {
  total: number;
  byDriver: Array<{ id: string; label: string; amount: number }>;
}

export function computeImplementationCost(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<ImplementationCostResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const total = built.schedule.investmentCost.reduce((a, b) => a + b, 0);
  const byDriver = input.investments.map((inv) => {
    const mult = scenarioMultiplierMap(input.scenarios.find((s) => s.name === scenarioName)).get(inv.id) ?? 1;
    const factor = currencyFactor(inv.currency, input.currency);
    const amount = factor.ok ? inv.amount * (1 + (inv.contingencyPct ?? 0) / 100) * mult * factor.factor : NaN;
    return { id: inv.id, label: inv.label, amount };
  });
  return {
    status: 'ok',
    value: { total, byDriver },
    meta: buildMeta(input, scenarioName, built.schedule.driverIds),
  };
}

export interface RecurringCostResult {
  perPeriod: number[];
  total: number;
}

export function computeRecurringCost(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<RecurringCostResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  return {
    status: 'ok',
    value: {
      perPeriod: built.schedule.recurringCost,
      total: built.schedule.recurringCost.reduce((a, b) => a + b, 0),
    },
    meta: buildMeta(input, scenarioName, built.schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 4. Net cash flow per period
// ---------------------------------------------------------------------------

export interface NetCashFlowResult {
  periods: number[];
  cashBenefit: number[];
  costTotal: number[];
  netCashFlow: number[];
}

export function computeNetCashFlowPerPeriod(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<NetCashFlowResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const { schedule } = built;
  return {
    status: 'ok',
    value: {
      periods: schedule.periods,
      cashBenefit: schedule.cashBenefit,
      costTotal: schedule.costTotal,
      netCashFlow: schedule.netCashFlow,
    },
    meta: buildMeta(input, scenarioName, schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 5. Cumulative cash flow and payback period
// ---------------------------------------------------------------------------

export interface PaybackResult {
  cumulativeCashFlow: number[];
  /** Fractional period index at which cumulative cash flow first reaches
   * zero, or `null` when it never does within the horizon. */
  paybackPeriodIndex: number | null;
  reason?: string;
}

export function computeCumulativeCashFlowAndPayback(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<PaybackResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const { netCashFlow } = built.schedule;

  const cumulative: number[] = [];
  let running = 0;
  for (const cf of netCashFlow) {
    running += cf;
    cumulative.push(running);
  }

  let paybackPeriodIndex: number | null = null;
  let reason: string | undefined;
  for (let p = 0; p < cumulative.length; p++) {
    if (cumulative[p] >= 0) {
      if (p === 0) {
        paybackPeriodIndex = 0;
      } else {
        const prev = cumulative[p - 1];
        const delta = cumulative[p] - prev;
        const fraction = delta !== 0 ? (0 - prev) / delta : 0;
        paybackPeriodIndex = p - 1 + fraction;
      }
      break;
    }
  }
  if (paybackPeriodIndex === null) {
    reason = 'cumulative cash flow never reaches zero within the modeled horizon — not recovered';
  }

  return {
    status: 'ok',
    value: { cumulativeCashFlow: cumulative, paybackPeriodIndex, reason },
    meta: buildMeta(input, scenarioName, built.schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 6. Simple ROI (explicitly named numerator/denominator)
// ---------------------------------------------------------------------------

export interface SimpleRoiResult {
  numeratorLabel: 'Net benefit (cash-basis benefit − total cost)';
  denominatorLabel: 'Total cost (implementation + recurring)';
  numerator: number;
  denominator: number;
  roi: number;
}

export function computeSimpleROI(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<SimpleRoiResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const { schedule } = built;
  const totalCashBenefit = schedule.cashBenefit.reduce((a, b) => a + b, 0);
  const totalCost = schedule.costTotal.reduce((a, b) => a + b, 0);
  if (totalCost === 0) {
    return invalidResult(input, scenarioName, 'ROI denominator (total cost) is zero — ROI is undefined');
  }
  const numerator = totalCashBenefit - totalCost;
  return {
    status: 'ok',
    value: {
      numeratorLabel: 'Net benefit (cash-basis benefit − total cost)',
      denominatorLabel: 'Total cost (implementation + recurring)',
      numerator,
      denominator: totalCost,
      roi: numerator / totalCost,
    },
    meta: buildMeta(input, scenarioName, schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 7. NPV
// ---------------------------------------------------------------------------

function periodRateFromAnnual(annualRatePct: number, periodsPerYear: number): number {
  const annual = annualRatePct / 100;
  if (periodsPerYear === 1) return annual;
  return Math.pow(1 + annual, 1 / periodsPerYear) - 1;
}

export interface NpvResult {
  npv: number;
  discountRatePct: number;
  /** Effective per-period rate derived from the annual rate via compounding
   * (periodConvention). periodsPerYear===1 ⇒ periodRatePct===discountRatePct. */
  periodRatePct: number;
  periodConvention: PeriodUnit;
}

function presentValue(cashflows: number[], periodRate: number): number {
  let pv = 0;
  for (let p = 0; p < cashflows.length; p++) {
    pv += cashflows[p] / Math.pow(1 + periodRate, p);
  }
  return pv;
}

export function computeNPV(input: IdeaFinancialCaseInput, scenarioName: ScenarioName): CalcResult<NpvResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const periodRate = periodRateFromAnnual(input.discountRatePct, input.periodConvention.periodsPerYear);
  const npv = presentValue(built.schedule.netCashFlow, periodRate);
  return {
    status: 'ok',
    value: {
      npv,
      discountRatePct: input.discountRatePct,
      periodRatePct: periodRate * 100,
      periodConvention: input.periodConvention.unit,
    },
    meta: buildMeta(input, scenarioName, built.schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 8. IRR — optional, explicit "not applicable" when the shape doesn't support it
// ---------------------------------------------------------------------------

export type IrrOutcome =
  | { applicable: true; irrPct: number; periodRatePct: number }
  | { applicable: false; reason: string };

function signChanges(values: number[]): number {
  const nonZero = values.filter((v) => v !== 0);
  let changes = 0;
  for (let i = 1; i < nonZero.length; i++) {
    if (Math.sign(nonZero[i]) !== Math.sign(nonZero[i - 1])) changes++;
  }
  return changes;
}

function bisectIrr(cashflows: number[]): number | null {
  const npvAt = (r: number) => presentValue(cashflows, r);
  let lo = -0.9999;
  let hi = 10;
  let fLo = npvAt(lo);
  let fHi = npvAt(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-9 || (hi - lo) / 2 < 1e-9) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function computeIRR(input: IdeaFinancialCaseInput, scenarioName: ScenarioName): CalcResult<IrrOutcome> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const { netCashFlow } = built.schedule;
  const changes = signChanges(netCashFlow);

  let outcome: IrrOutcome;
  if (changes === 0) {
    outcome = {
      applicable: false,
      reason: 'cash flow never changes sign (all outflow or all inflow) — IRR is not applicable',
    };
  } else if (changes > 1) {
    outcome = {
      applicable: false,
      reason: `cash flow changes sign ${changes} times — shape does not guarantee a unique IRR, returning "not applicable" instead of a misleading number`,
    };
  } else {
    const periodRate = bisectIrr(netCashFlow);
    if (periodRate === null) {
      outcome = { applicable: false, reason: 'no root found for IRR within the search bracket [-99.99%, 1000%]' };
    } else {
      const periodsPerYear = input.periodConvention.periodsPerYear;
      const annual = Math.pow(1 + periodRate, periodsPerYear) - 1;
      outcome = { applicable: true, irrPct: annual * 100, periodRatePct: periodRate * 100 };
    }
  }

  return {
    status: 'ok',
    value: outcome,
    meta: buildMeta(input, scenarioName, built.schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 9. Benefit-cost ratio
// ---------------------------------------------------------------------------

export interface BcrResult {
  presentValueBenefits: number;
  presentValueCosts: number;
  bcr: number;
}

export function computeBenefitCostRatio(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName
): CalcResult<BcrResult> {
  const built = buildSchedule(input, scenarioName);
  if (!built.ok) return scheduleFailureResult(input, scenarioName, built.reason);
  const periodRate = periodRateFromAnnual(input.discountRatePct, input.periodConvention.periodsPerYear);
  const pvBenefits = presentValue(built.schedule.cashBenefit, periodRate);
  const pvCosts = presentValue(built.schedule.costTotal, periodRate);
  if (pvCosts === 0) {
    return invalidResult(input, scenarioName, 'present value of costs is zero — benefit-cost ratio is undefined');
  }
  return {
    status: 'ok',
    value: { presentValueBenefits: pvBenefits, presentValueCosts: pvCosts, bcr: pvBenefits / pvCosts },
    meta: buildMeta(input, scenarioName, built.schedule.driverIds),
  };
}

// ---------------------------------------------------------------------------
// 10. Sensitivity of key drivers
// ---------------------------------------------------------------------------

export interface SensitivityRequest {
  driverId: string;
  label: string;
  kind: 'benefit' | 'investment' | 'recurring' | 'discountRate';
  /** Percent deltas to apply, e.g. [-20, -10, 10, 20]. */
  deltasPct: number[];
}

export interface SensitivityPoint {
  driverId: string;
  label: string;
  deltaPct: number;
  npv: number;
  deltaNpv: number;
}

export interface SensitivityResult {
  baseNpv: number;
  points: SensitivityPoint[];
}

function withDriverDelta(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName,
  req: SensitivityRequest,
  deltaPct: number
): IdeaFinancialCaseInput {
  if (req.kind === 'discountRate') {
    return { ...input, discountRatePct: input.discountRatePct * (1 + deltaPct / 100) };
  }
  const scenario = input.scenarios.find((s) => s.name === scenarioName);
  const baseMultiplier = scenario?.driverOverrides.find((o) => o.driverId === req.driverId)?.multiplier ?? 1;
  const newMultiplier = baseMultiplier * (1 + deltaPct / 100);
  const otherScenarios = input.scenarios.filter((s) => s.name !== scenarioName);
  const otherOverrides = (scenario?.driverOverrides ?? []).filter((o) => o.driverId !== req.driverId);
  const bumpedScenario: ScenarioInput = {
    name: scenarioName,
    driverOverrides: [...otherOverrides, { driverId: req.driverId, multiplier: newMultiplier }],
  };
  return { ...input, scenarios: [...otherScenarios, bumpedScenario] };
}

export function computeSensitivity(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName,
  drivers: SensitivityRequest[]
): CalcResult<SensitivityResult> {
  const baseNpvResult = computeNPV(input, scenarioName);
  if (baseNpvResult.status !== 'ok') {
    return propagateFailure(input, scenarioName, baseNpvResult);
  }
  const baseNpv = baseNpvResult.value.npv;
  const points: SensitivityPoint[] = [];
  for (const req of drivers) {
    for (const deltaPct of req.deltasPct) {
      const bumpedInput = withDriverDelta(input, scenarioName, req, deltaPct);
      const bumpedNpv = computeNPV(bumpedInput, scenarioName);
      if (bumpedNpv.status !== 'ok') {
        return propagateFailure(input, scenarioName, bumpedNpv, `sensitivity on "${req.driverId}": `);
      }
      points.push({
        driverId: req.driverId,
        label: req.label,
        deltaPct,
        npv: bumpedNpv.value.npv,
        deltaNpv: bumpedNpv.value.npv - baseNpv,
      });
    }
  }
  return {
    status: 'ok',
    value: { baseNpv, points },
    meta: buildMeta(input, scenarioName, []),
  };
}

// ---------------------------------------------------------------------------
// 11. Scenario comparison
// ---------------------------------------------------------------------------

export interface ScenarioComparisonRow {
  scenario: ScenarioName;
  npv: CalcResult<NpvResult>;
  roi: CalcResult<SimpleRoiResult>;
  payback: CalcResult<PaybackResult>;
  bcr: CalcResult<BcrResult>;
  driverOverrides: ScenarioInput['driverOverrides'];
}

export function computeScenarioComparison(input: IdeaFinancialCaseInput): ScenarioComparisonRow[] {
  return input.scenarios.map((s) => ({
    scenario: s.name,
    npv: computeNPV(input, s.name),
    roi: computeSimpleROI(input, s.name),
    payback: computeCumulativeCashFlowAndPayback(input, s.name),
    bcr: computeBenefitCostRatio(input, s.name),
    driverOverrides: s.driverOverrides,
  }));
}

// ---------------------------------------------------------------------------
// 12. Confidence-adjusted value — SEPARATE, clearly labelled, never blended
//     into computeNPV/computeSimpleROI above.
// ---------------------------------------------------------------------------

export interface ConfidenceAdjustedResult {
  label: 'Confidence-adjusted NPV (separate from headline NPV — not a substitute)';
  unadjustedNpv: number;
  confidenceAdjustedNpv: number;
  weightsUsed: ConfidenceWeights;
  perDriverWeight: Array<{ driverId: string; level: ConfidenceLevel; weight: number }>;
}

function benefitConfidenceList(
  input: IdeaFinancialCaseInput
): Array<{ id: string; level: ConfidenceLevel }> {
  // Only benefit drivers are confidence-weighted: costs are commitments
  // (already carry their own contingencyPct for cost-side uncertainty), so
  // weighting them down here would perversely shrink cost for a low-
  // confidence, high-risk driver. This mirrors standard risk-adjusted-
  // benefit business-case practice: benefit realization probability, not
  // cost.
  return input.benefits
    .filter((b) => b.type !== 'qualitative')
    .map((d) => ({ id: d.id, level: d.confidence.level }));
}

export function computeConfidenceAdjustedNPV(
  input: IdeaFinancialCaseInput,
  scenarioName: ScenarioName,
  weights: ConfidenceWeights = DEFAULT_CONFIDENCE_WEIGHTS
): CalcResult<ConfidenceAdjustedResult> {
  const unadjusted = computeNPV(input, scenarioName);
  if (unadjusted.status !== 'ok') return propagateFailure(input, scenarioName, unadjusted);

  const drivers = benefitConfidenceList(input);
  const perDriverWeight = drivers.map((d) => ({ driverId: d.id, level: d.level, weight: weights[d.level] }));

  // Confidence-weight each benefit driver's contribution by scaling its
  // scenario multiplier with its confidence weight, then re-run NPV on that
  // adjusted input. This keeps the adjustment fully transparent (visible
  // per-driver weight list) and structurally separate from computeNPV's own
  // result type. Cost drivers are left at full value (see benefitConfidenceList).
  const scenario = input.scenarios.find((s) => s.name === scenarioName);
  const existingOverrides = scenario?.driverOverrides ?? [];
  const overrideMap = new Map(existingOverrides.map((o) => [o.driverId, o.multiplier]));
  const weightedOverrides = drivers.map((d) => ({
    driverId: d.id,
    multiplier: (overrideMap.get(d.id) ?? 1) * weights[d.level],
  }));
  // Preserve any existing cost-driver overrides untouched.
  const weightedIds = new Set(weightedOverrides.map((o) => o.driverId));
  const preservedOverrides = existingOverrides.filter((o) => !weightedIds.has(o.driverId));
  const otherScenarios = input.scenarios.filter((s) => s.name !== scenarioName);
  const weightedInput: IdeaFinancialCaseInput = {
    ...input,
    scenarios: [
      ...otherScenarios,
      { name: scenarioName, driverOverrides: [...preservedOverrides, ...weightedOverrides] },
    ],
  };
  const adjusted = computeNPV(weightedInput, scenarioName);
  if (adjusted.status !== 'ok') return propagateFailure(input, scenarioName, adjusted);

  return {
    status: 'ok',
    value: {
      label: 'Confidence-adjusted NPV (separate from headline NPV — not a substitute)',
      unadjustedNpv: unadjusted.value.npv,
      confidenceAdjustedNpv: adjusted.value.npv,
      weightsUsed: weights,
      perDriverWeight,
    },
    meta: unadjusted.meta,
  };
}

export { buildSchedule as __buildScheduleForTests };
