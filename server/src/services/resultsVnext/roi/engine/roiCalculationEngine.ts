/**
 * ROI-E002 — pure calculation engine.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §4.3, Decisions
 * D1/D2/D12/D13 (§1).
 *
 * Decision D2: zero imports from `pg`/`express`/`services/resultsVnext/
 * platform/*` — this module is synchronous, total (never throws — every
 * failure mode is a typed `status: 'failed'` output or a validation
 * finding), and has no I/O of any kind. The command layer
 * (`roiCalculationRunCommands.ts`) does all DB reads, builds
 * `RoiCalculationEngineInput`, calls `runRoiCalculationEngine`, and persists
 * the output — this file does not know `rvn_roi_*` tables exist.
 *
 * Decision D12 (decimal.js scope): `Decimal` values are constructed and
 * consumed ENTIRELY inside this module. Every function this file exports
 * (`runRoiCalculationEngine`) takes plain `number`/`null` in and returns
 * plain `number`/`null` out — no `Decimal` instance ever crosses this
 * module's boundary. Internally, all period-series summation (`totalCosts`/
 * `totalFinancialBenefits`/per-period net) is done in `Decimal`; NPV/IRR/
 * payback/discountedPayback are computed by calling the IMPORTED
 * `investmentAppraisalService.ts` functions (Decision D1) with plain
 * `number` inputs built from the Decimal period series via `.toNumber()` —
 * per Decision D12's own text, those specific single-purpose calculations'
 * existing plain-number precision is accepted as sufficient; only the
 * engine-owned multi-period summation is required to be Decimal-safe.
 *
 * Decision D13 (discount-rate conversion): `discountRatePct` is always an
 * ANNUAL rate. Converted to the case's per-period rate via EFFECTIVE-RATE
 * compounding: `periodRate = (1 + annualRate/100)^(1/periodsPerYear) - 1`
 * (`periodsPerYear` = 12 for `monthly`, 1 for `annual`), computed in
 * `Decimal.pow` — NOT naive division by 12.
 *
 * -- IMPLEMENTATION NOTE on §4.3 step 4 (scenario overrides) — an explicit,
 * documented interpretation of the design's own admitted simplification,
 * not a silent guess. The DDL (§3) gives `rvn_roi_cost_lines`/
 * `rvn_roi_benefit_lines` NO column referencing `rvn_roi_assumptions` at
 * all — there is no `assumption_id`/formula-link field anywhere in the
 * schema. The design's own §9 simplification note names the one case that
 * IS supported: "the simple case where a line's own value directly mirrors
 * an assumption's value." This engine implements exactly that literal
 * reading for the two CANONICAL scenarios (`downside`/`upside`): for each
 * cost/benefit line, if the line's `amount` is EXACTLY equal (`===`) to
 * some assumption's `baseValue`, that line's amount is substituted with
 * that assumption's `downsideValue`/`upsideValue` for this calculation
 * only. A line whose `amount` does not numerically match any assumption's
 * `baseValue` is used unchanged, per the design's own explicit fallback
 * ("if the source data has no such linkage for a given line, the line's
 * own amount is used unchanged"). `custom` scenarios do not use this
 * mirror-matching at all — they apply `rvn_roi_scenario_overrides` rows by
 * `target_id`, an unambiguous explicit reference (Decision D10).
 */
// NAMED import (not default) is required here: `server/tsconfig.json` uses
// `module`/`moduleResolution: NodeNext` and `server/package.json` declares
// `"type": "module"`, so this file is ESM. `decimal.js` ships CJS-format types
// (`decimal.d.ts`, package has no `"type": "module"`), and under Node's
// ESM->CJS interop a default import binds to `module.exports` itself — i.e.
// the module namespace, not the class — which makes `Decimal` unusable as a
// type/constructor and hides the static `ROUND_*` constants. The class is also
// published as a named export at runtime in BOTH builds
// (`decimal.js`: `Decimal.Decimal = Decimal`; `decimal.mjs`: `export var
// Decimal`), so this is the same object with identical behaviour. The upstream
// `decimal.d.ts` header documents `import {Decimal} from "decimal.js"` as the
// primary supported form.
import { Decimal } from 'decimal.js';

import {
  discountedPayback,
  irr,
  npv,
  payback,
} from '../../../investmentAppraisalService.js';

import type {
  RoiCalculationEngineInput,
  RoiCalculationEngineOutput,
  RoiCalculationValidationFinding,
  RoiEngineBenefitLine,
  RoiEngineCashFlowPeriod,
  RoiEngineCostLine,
  RoiEngineGranularity,
  RoiEngineIrrStatus,
  RoiEngineRecurrenceCadence,
  RoiEngineRoundingPolicy,
  RoiEngineScenarioOverride,
} from './roiCalculationEngine.types.js';

export const ROI_CALCULATION_ENGINE_VERSION = '1.0.0';

// ==========================================
// DATE HELPERS (plain string arithmetic — DATE columns are YYYY-MM-DD,
// never parsed as JS `Date` to avoid timezone drift; determinism per §4.3's
// own "no Date.now() anywhere in this file" rule extends to never letting
// the HOST TIMEZONE influence date-to-period mapping either).
// ==========================================

function parseIsoDate(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) {
    throw new Error(`roiCalculationEngine: invalid DATE string "${dateStr}"`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** 0-based period offset of `dateStr` from `startStr`, at `granularity`. */
function periodIndexForDate(dateStr: string, startStr: string, granularity: RoiEngineGranularity): number {
  const d = parseIsoDate(dateStr);
  const s = parseIsoDate(startStr);
  if (granularity === 'monthly') {
    return d.year * 12 + d.month - (s.year * 12 + s.month);
  }
  return d.year - s.year;
}

function computePeriodCount(analysisStart: string, analysisEnd: string, granularity: RoiEngineGranularity): number {
  const lastIndex = periodIndexForDate(analysisEnd, analysisStart, granularity);
  return Math.max(1, lastIndex + 1);
}

function periodLabelForIndex(analysisStart: string, granularity: RoiEngineGranularity, index: number): string {
  const { year, month } = parseIsoDate(analysisStart);
  if (granularity === 'monthly') {
    const totalMonths = year * 12 + (month - 1) + index;
    const y = Math.floor(totalMonths / 12);
    const m = (totalMonths % 12) + 1;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  }
  return String(year + index);
}

/** Advances `dateStr` by `steps` occurrences of `cadence`. Day-of-month is
 * preserved verbatim (only year/month matter for period mapping — see
 * `periodIndexForDate`, which never reads the day component). */
function stepDate(dateStr: string, cadence: RoiEngineRecurrenceCadence, steps: number): string {
  const { year, month, day } = parseIsoDate(dateStr);
  const monthsToAdd = cadence === 'monthly' ? steps : cadence === 'quarterly' ? steps * 3 : steps * 12;
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Lexical ISO-date comparison — safe for `YYYY-MM-DD` strings, no `Date`
 * parsing involved. */
function isDateAfter(a: string, b: string): boolean {
  return a.slice(0, 10) > b.slice(0, 10);
}

// ==========================================
// SCENARIO APPLICATION (§4.3 step 4, Decision D10)
// ==========================================

interface EffectiveLines {
  costLines: RoiEngineCostLine[];
  benefitLines: RoiEngineBenefitLine[];
}

function findMirroredAssumptionValue(
  lineAmount: number,
  assumptions: RoiCalculationEngineInput['assumptions'],
  scenarioType: 'downside' | 'upside'
): number | null {
  const match = assumptions.find((a) => a.baseValue !== null && a.baseValue === lineAmount);
  if (!match) return null;
  const substitute = scenarioType === 'downside' ? match.downsideValue : match.upsideValue;
  return substitute;
}

function applyCanonicalScenario(
  input: RoiCalculationEngineInput,
  scenarioType: 'downside' | 'upside'
): EffectiveLines {
  const costLines = input.costLines.map((line) => {
    const substitute = findMirroredAssumptionValue(line.amount, input.assumptions, scenarioType);
    return substitute === null ? line : { ...line, amount: substitute };
  });
  const benefitLines = input.benefitLines.map((line) => {
    if (line.amount === null) return line;
    const substitute = findMirroredAssumptionValue(line.amount, input.assumptions, scenarioType);
    return substitute === null ? line : { ...line, amount: substitute };
  });
  return { costLines, benefitLines };
}

function findOverride(
  overrides: RoiEngineScenarioOverride[],
  targetType: RoiEngineScenarioOverride['targetType'],
  targetId: string
): RoiEngineScenarioOverride | undefined {
  return overrides.find((o) => o.targetType === targetType && o.targetId === targetId);
}

function applyCustomScenario(input: RoiCalculationEngineInput): EffectiveLines {
  const costLines = input.costLines.map((line) => {
    const override = findOverride(input.scenarioOverrides, 'cost_line', line.id);
    if (override && override.overrideAmount !== null) {
      return { ...line, amount: override.overrideAmount };
    }
    return line;
  });
  const benefitLines = input.benefitLines.map((line) => {
    // A non-financial line has no `amount` by DB constraint
    // (chk_rvn_roi_benefit_lines_financial_amount) — an override must never
    // fabricate a dollar value for it.
    if (!line.isFinancial) return line;
    const override = findOverride(input.scenarioOverrides, 'benefit_line', line.id);
    if (override && override.overrideAmount !== null) {
      return { ...line, amount: override.overrideAmount };
    }
    return line;
  });
  return { costLines, benefitLines };
}

function applyScenario(input: RoiCalculationEngineInput): EffectiveLines {
  if (input.scenarioType === 'downside' || input.scenarioType === 'upside') {
    return applyCanonicalScenario(input, input.scenarioType);
  }
  if (input.scenarioType === 'custom') {
    return applyCustomScenario(input);
  }
  // null (base) — every line's own value as stored.
  return { costLines: input.costLines, benefitLines: input.benefitLines };
}

// ==========================================
// DOUBLE-COUNTING SCAN (AC-03, Decision D8) — runs regardless of currency
// status, per §4.3 step 1.
// ==========================================

function scanDoubleCounting(benefitLines: RoiEngineBenefitLine[]): {
  hasUnresolved: boolean;
  findings: RoiCalculationValidationFinding[];
} {
  const groups = new Map<string, RoiEngineBenefitLine[]>();
  for (const line of benefitLines) {
    if (!line.doubleCountingGroup) continue;
    const existing = groups.get(line.doubleCountingGroup);
    if (existing) {
      existing.push(line);
    } else {
      groups.set(line.doubleCountingGroup, [line]);
    }
  }

  const findings: RoiCalculationValidationFinding[] = [];
  let hasUnresolved = false;
  for (const [group, lines] of groups) {
    if (lines.length < 2) continue;
    const resolved = lines.some(
      (l) => typeof l.doubleCountingResolutionNote === 'string' && l.doubleCountingResolutionNote.trim().length > 0
    );
    if (!resolved) {
      hasUnresolved = true;
      findings.push({
        code: 'unresolved_double_counting_group',
        severity: 'blocking',
        message: `Double-counting group "${group}" has ${lines.length} active member(s) and no double_counting_resolution_note`,
        refs: { group, benefitLineIds: lines.map((l) => l.id) },
      });
    }
  }
  return { hasUnresolved, findings };
}

// ==========================================
// PERIOD EXPANSION (§4.3 step 3) — Decimal-safe summation
// ==========================================

interface LineContributionParams {
  periodCount: number;
  analysisStart: string;
  granularity: RoiEngineGranularity;
  timingType: 'one_time' | 'recurring';
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiEngineRecurrenceCadence | null;
  amount: number;
  /** Benefit lines only — null/0 means no ramp (full amount every
   * occurrence). Ramp NEVER applies to `one_time` lines (a single
   * occurrence has no "over N periods" to ramp across). */
  rampPeriods: number | null;
  target: Decimal[];
}

/** Safety cap on recurring-occurrence iteration so a malformed row (e.g. no
 * `recurrenceEndDate` and a `recurrenceCadence` that never reaches
 * `periodCount`) cannot loop forever — this pure function must stay total. */
const MAX_OCCURRENCE_ITERATIONS = 2000;

function addLineContributions(params: LineContributionParams): void {
  const {
    periodCount,
    analysisStart,
    granularity,
    timingType,
    oneTimePeriodDate,
    recurrenceStartDate,
    recurrenceEndDate,
    recurrenceCadence,
    amount,
    rampPeriods,
    target,
  } = params;

  if (timingType === 'one_time') {
    if (!oneTimePeriodDate) return;
    const idx = periodIndexForDate(oneTimePeriodDate, analysisStart, granularity);
    if (idx >= 0 && idx < periodCount) {
      target[idx] = target[idx].plus(new Decimal(amount));
    }
    return;
  }

  // recurring
  if (!recurrenceStartDate || !recurrenceCadence) return;

  let cursor = recurrenceStartDate;
  let occurrenceIndex = 0; // 1-based once incremented, used for the ramp factor
  let iterations = 0;
  while (iterations < MAX_OCCURRENCE_ITERATIONS) {
    iterations += 1;
    const idx = periodIndexForDate(cursor, analysisStart, granularity);
    if (idx >= periodCount) break; // past the analysis window
    if (recurrenceEndDate && isDateAfter(cursor, recurrenceEndDate)) break;

    occurrenceIndex += 1;
    if (idx >= 0) {
      // Ramp formula (this engine's own concrete choice for "linearly ramp
      // from 0 to full amount over rampPeriods periods", §4.3 step 3):
      //   factor(occurrenceIndex) = min(occurrenceIndex, rampPeriods) / rampPeriods
      // i.e. the FIRST occurrence already contributes 1/rampPeriods of the
      // full amount (not literally $0), reaching exactly 1x at the
      // rampPeriods-th occurrence and staying at 1x thereafter.
      const factor = rampPeriods && rampPeriods > 0 ? Math.min(occurrenceIndex, rampPeriods) / rampPeriods : 1;
      target[idx] = target[idx].plus(new Decimal(amount).mul(factor));
    }
    cursor = stepDate(cursor, recurrenceCadence, 1);
  }
}

function expandPeriods(
  periodCount: number,
  analysisStart: string,
  granularity: RoiEngineGranularity,
  costLines: RoiEngineCostLine[],
  benefitLines: RoiEngineBenefitLine[],
  findings: RoiCalculationValidationFinding[]
): { periodSeries: RoiEngineCashFlowPeriod[]; totalCosts: Decimal; totalFinancialBenefits: Decimal } {
  const costs: Decimal[] = Array.from({ length: periodCount }, () => new Decimal(0));
  const benefits: Decimal[] = Array.from({ length: periodCount }, () => new Decimal(0));

  for (const line of costLines) {
    addLineContributions({
      periodCount,
      analysisStart,
      granularity,
      timingType: line.timingType,
      oneTimePeriodDate: line.oneTimePeriodDate,
      recurrenceStartDate: line.recurrenceStartDate,
      recurrenceEndDate: line.recurrenceEndDate,
      recurrenceCadence: line.recurrenceCadence,
      amount: line.amount,
      rampPeriods: null,
      target: costs,
    });
  }

  for (const line of benefitLines) {
    // Non-financial benefits never contribute a dollar figure — excluded
    // entirely from the financial sums (AC-01/honest-N/A: never a
    // fabricated $0 for a line that isn't measured in money).
    if (!line.isFinancial) continue;
    if (line.amount === null) {
      // "Missing" vs "true zero" (§9 KA-7): a financial benefit line with no
      // amount is EXCLUDED, never silently coerced to 0 — recorded as a
      // finding instead of corrupting the sum.
      findings.push({
        code: 'benefit_line_amount_missing',
        severity: 'warning',
        message: `Benefit line ${line.id} is financial but has no amount — excluded from totals, not treated as $0`,
        refs: { benefitLineId: line.id },
      });
      continue;
    }
    addLineContributions({
      periodCount,
      analysisStart,
      granularity,
      timingType: line.timingType,
      oneTimePeriodDate: line.oneTimePeriodDate,
      recurrenceStartDate: line.recurrenceStartDate,
      recurrenceEndDate: line.recurrenceEndDate,
      recurrenceCadence: line.recurrenceCadence,
      amount: line.amount,
      rampPeriods: line.rampPeriods,
      target: benefits,
    });
  }

  const periodSeries: RoiEngineCashFlowPeriod[] = [];
  let totalCosts = new Decimal(0);
  let totalFinancialBenefits = new Decimal(0);
  for (let i = 0; i < periodCount; i++) {
    totalCosts = totalCosts.plus(costs[i]);
    totalFinancialBenefits = totalFinancialBenefits.plus(benefits[i]);
    periodSeries.push({
      periodIndex: i,
      periodLabel: periodLabelForIndex(analysisStart, granularity, i),
      // Decision D12's output boundary: Decimal -> number ONLY here, when
      // building the object this module returns.
      costsTotal: costs[i].toNumber(),
      financialBenefitsTotal: benefits[i].toNumber(),
      netCashFlow: benefits[i].minus(costs[i]).toNumber(),
    });
  }
  return { periodSeries, totalCosts, totalFinancialBenefits };
}

// ==========================================
// ROUNDING (Decision D11 default lives in the DB; the policy STRING is
// always supplied by the caller here)
// ==========================================

function roundMoney(value: Decimal, policy: RoiEngineRoundingPolicy): number {
  if (policy === 'none') return value.toNumber();
  const mode = policy === 'half_even_2dp' ? Decimal.ROUND_HALF_EVEN : Decimal.ROUND_HALF_UP;
  return value.toDecimalPlaces(2, mode).toNumber();
}

// ==========================================
// MAIN ENTRY POINT
// ==========================================

export function runRoiCalculationEngine(input: RoiCalculationEngineInput): RoiCalculationEngineOutput {
  const warnings: string[] = [];
  const validationFindings: RoiCalculationValidationFinding[] = [];

  // Step 1 (§4.3): mixed-currency hard-fail, evaluated BEFORE anything else.
  const currencyMismatchLines = [
    ...input.costLines.filter((l) => l.currency !== input.currency).map((l) => l.id),
    ...input.benefitLines
      .filter((l) => l.isFinancial && l.currency !== null && l.currency !== input.currency)
      .map((l) => l.id),
  ];
  const hasMixedCurrencyFailure = currencyMismatchLines.length > 0;
  if (hasMixedCurrencyFailure) {
    validationFindings.push({
      code: 'mixed_currency_hard_fail',
      severity: 'blocking',
      message: `Case currency is "${input.currency}" but ${currencyMismatchLines.length} line(s) use a different currency`,
      refs: { lineIds: currencyMismatchLines },
    });
  }

  // Double-counting scan runs regardless of currency status (§4.3 step 1).
  const dcScan = scanDoubleCounting(input.benefitLines);
  validationFindings.push(...dcScan.findings);

  if (hasMixedCurrencyFailure) {
    return {
      status: 'failed',
      periodSeries: [],
      totalCosts: null,
      totalFinancialBenefits: null,
      simpleRoi: null,
      npv: null,
      irrPct: null,
      irrStatus: 'not_applicable',
      paybackPeriods: null,
      discountedPaybackPeriods: null,
      benefitCostRatio: null,
      hasUnresolvedDoubleCounting: dcScan.hasUnresolved,
      hasMixedCurrencyFailure: true,
      validationFindings,
      warnings,
    };
  }

  // Step 4: scenario overrides applied BEFORE period expansion — everything
  // downstream only ever sees "effective" lines.
  const scenario = applyScenario(input);

  // Step 2 (Decision D13): rate conversion, done in Decimal.
  const periodsPerYear = input.granularity === 'monthly' ? 12 : 1;
  let periodRatePct: number;
  if (input.discountRatePct === null) {
    periodRatePct = 0;
    warnings.push('discount_rate_missing_using_zero');
  } else {
    const annualMultiplier = new Decimal(1).plus(new Decimal(input.discountRatePct).div(100));
    const periodMultiplier = annualMultiplier.pow(new Decimal(1).div(periodsPerYear));
    periodRatePct = periodMultiplier.minus(1).mul(100).toNumber();
  }

  // Step 3: period expansion, Decimal-safe summation.
  const periodCount = computePeriodCount(input.analysisStart, input.analysisEnd, input.granularity);
  const { periodSeries, totalCosts, totalFinancialBenefits } = expandPeriods(
    periodCount,
    input.analysisStart,
    input.granularity,
    scenario.costLines,
    scenario.benefitLines,
    validationFindings
  );

  const initialInvestment = periodSeries[0]?.costsTotal ?? 0;
  const cashflows = periodSeries.slice(1).map((p) => p.netCashFlow);

  // Step 5: metrics via the IMPORTED investmentAppraisalService functions
  // (Decision D1) — plain numbers from this point on (Decision D12).
  const npvValue = npv(cashflows, periodRatePct, initialInvestment);
  const paybackRaw = payback(cashflows, initialInvestment);
  const paybackPeriods = Number.isFinite(paybackRaw) ? paybackRaw : null;
  const discountedPaybackRaw = discountedPayback(cashflows, periodRatePct, initialInvestment);
  const discountedPaybackPeriods = Number.isFinite(discountedPaybackRaw) ? discountedPaybackRaw : null;

  const irrRequired =
    !input.requiredMetrics || input.requiredMetrics.length === 0 || input.requiredMetrics.includes('irr');
  let irrPct: number | null = null;
  let irrStatus: RoiEngineIrrStatus;
  if (!irrRequired) {
    irrStatus = 'not_required_by_policy';
  } else {
    const irrRaw = irr(cashflows, initialInvestment);
    if (irrRaw === null) {
      irrStatus = 'not_applicable';
    } else {
      irrPct = irrRaw;
      irrStatus = 'computed';
    }
  }

  const simpleRoiDecimal = totalCosts.gt(0) ? totalFinancialBenefits.minus(totalCosts).div(totalCosts) : null;
  const bcrDecimal = totalCosts.gt(0) ? totalFinancialBenefits.div(totalCosts) : null;

  return {
    status: 'completed',
    periodSeries,
    totalCosts: roundMoney(totalCosts, input.roundingPolicy),
    totalFinancialBenefits: roundMoney(totalFinancialBenefits, input.roundingPolicy),
    simpleRoi: simpleRoiDecimal === null ? null : simpleRoiDecimal.toNumber(),
    npv: roundMoney(new Decimal(npvValue), input.roundingPolicy),
    irrPct,
    irrStatus,
    paybackPeriods,
    discountedPaybackPeriods,
    benefitCostRatio: bcrDecimal === null ? null : bcrDecimal.toNumber(),
    hasUnresolvedDoubleCounting: dcScan.hasUnresolved,
    hasMixedCurrencyFailure: false,
    validationFindings,
    warnings,
  };
}

export type {
  RoiCalculationEngineInput,
  RoiCalculationEngineOutput,
  RoiCalculationValidationFinding,
} from './roiCalculationEngine.types.js';
