/**
 * engineAdapter — the E09 seam: wires `src/services/ideaFinance` (the pure
 * calculation engine, built by a sibling agent) to `FinancialCaseView`'s
 * `computeFn` prop (the UI, built by another sibling agent). Neither side
 * previously imported the other — this file is the connection, per
 * `financialTypes.ts`'s own reconciliation note ("if the sibling engine's
 * real function name/shape differs from `FinancialComputeFn`, the fix is a
 * one-line adapter at the call site").
 *
 * ── WHY THE ADAPTER LIVES HERE, NOT IN THE ENGINE ───────────────────────────
 * `src/services/ideaFinance/engine.ts` documents itself as UI-agnostic pure
 * calculation core ("No UI, no I/O"). Importing UI-owned types
 * (`FinancialCaseInput`/`FinancialCaseResult`) into that package would
 * invert the intended dependency direction. This file lives on the UI side
 * and depends on the engine, never the reverse.
 *
 * ── THE REPRESENTATION GAP (read before changing driver mapping) ──────────
 * The UI's `FinancialDriver` stores an explicit `monthlyValues` map — the
 * user types the ACTUAL amount for every period directly, with no
 * escalation/ramp parameters. The engine's `InvestmentCostInput` /
 * `RecurringCostInput` / `BenefitInput` are PARAMETRIZED schedules (a flat
 * `amountPerPeriod` plus escalation-%/ramp-periods that the engine expands
 * into a period series). These are not the same model, and forcing the UI's
 * arbitrary month-by-month series into the engine's flat+escalation model
 * would either lose data or fabricate a rate. Instead, EVERY driver
 * (`investment` and `recurring` cost types alike, and every benefit) is
 * exploded into one engine entry PER POPULATED PERIOD, each pinned to that
 * exact `periodIndex` with that exact amount. This exactly reproduces any
 * month-to-month series (flat, escalating, or irregular) with no
 * approximation, at the cost of not using the engine's `RecurringCostInput`
 * escalation feature at all (dead for this caller, not for the engine
 * itself — the engine still exports and unit-tests it).
 *
 * Consequence: everything lands in `investments[]` (which supports an
 * arbitrary `periodIndex` per entry); `recurringCosts[]` is always empty
 * from this adapter. `computeImplementationCost`'s own `byDriver` breakdown
 * is what re-derives "investment total" vs "recurring total" for
 * `FinancialScenarioResult.implementationCost`/`recurringCostAnnual` — see
 * `splitCostTotals` below — the engine still does the currency/contingency/
 * scenario-multiplier math; this file only re-aggregates by the UI's own
 * cost-type tag.
 *
 * ── BENEFIT TYPE MAPPING (3-way UI taxonomy → 6-way engine taxonomy) ───────
 *  - UI 'cash'          → engine 'cash_saving' (one of the four types the
 *    engine pools identically into cashBenefit: revenue/margin/cash_saving/
 *    avoided_cost — which exact one is chosen doesn't change any total this
 *    adapter surfaces, since `FinancialCaseResult` has no byType breakdown).
 *  - UI 'risk_avoidance' → engine 'risk_avoidance' — exact 1:1 match, the
 *    engine already tracks this separately and excludes it from cash-basis
 *    totals, which is exactly doc 09 §7.4's requirement.
 *  - UI 'non_cash'      → engine 'capacity_release' with
 *    `capacityRealization.realizedFraction = 0`. The engine's 'qualitative'
 *    type is the closer-sounding name but REJECTS any numeric value
 *    (`amountPerPeriod` must be absent) — the UI's non_cash drivers DO carry
 *    a number (§7.4 requires one numeric non_cash driver). Fixing the
 *    realized fraction at 0 is the only engine type that (a) accepts a
 *    number and (b) is structurally guaranteed to never enter cashBenefit —
 *    exactly "tracked, never pooled" per §7.4. The UI does not yet expose a
 *    way to edit this fraction; if that becomes a real product requirement,
 *    thread it through `FinancialDriver` instead of hardcoding 0 here.
 *
 * ── UNIT SAFETY ─────────────────────────────────────────────────────────
 * `FinancialDriver.unit` may be a non-money unit ('hrs', 'FTE', ...) per its
 * own doc comment. The engine has no unit-to-cash conversion — only
 * currency-to-currency FX. A cost driver or a 'cash' benefit driver whose
 * `unit` does not match the case currency is EXCLUDED from the cash-basis
 * math with an explicit warning, never silently treated as if its raw
 * number were a currency amount (that would corrupt NPV/ROI/payback/BCR).
 * 'risk_avoidance'/'non_cash' drivers are exempt from this check — they
 * never enter cash-basis totals, so a non-money unit there is legitimate
 * and expected (e.g. "hours saved" as a non_cash driver).
 *
 * ── SENSITIVITY ─────────────────────────────────────────────────────────
 * The engine's own `computeSensitivity` bumps ONE driver id via a single
 * scenario override; a UI driver here maps to MULTIPLE exploded engine
 * entries (one per period), so this adapter instead builds the ±20% bumped
 * `IdeaFinancialCaseInput` directly (scaling every exploded entry that
 * shares a UI driver's id prefix) and calls the engine's own `computeNPV` on
 * each variant — the engine still owns the discounting math, this file only
 * decides which entries move together. Run against the 'base' scenario only
 * (the UI's `FinancialCaseResult.sensitivity` is a single flat list, not
 * per-scenario) and only for drivers that actually enter the cash-basis
 * total (a risk_avoidance/non_cash driver's NPV swing is always exactly 0
 * by construction — showing it would be noise, not insight).
 */
import type {
  BenefitInput,
  CurrencyInfo,
  IdeaFinancialCaseInput,
  InvestmentCostInput,
  ScenarioInput,
  ScenarioName,
} from '@/services/ideaFinance';
import {
  computeAnnualBenefit,
  computeBenefitCostRatio,
  computeCumulativeCashFlowAndPayback,
  computeImplementationCost,
  computeNPV,
  computeNetCashFlowPerPeriod,
  computeSimpleROI,
  FORMULA_VERSION,
} from '@/services/ideaFinance';

import { periodKeysForCase } from './financialDefaults';
import type {
  FinancialCaseInput,
  FinancialCaseResult,
  FinancialCaseWarning,
  FinancialDriver,
  FinancialPeriodResult,
  FinancialScenarioId,
  FinancialScenarioResult,
  FinancialSensitivityRow,
} from './financialTypes';

const SENSITIVITY_DELTA_PCT = 20;

interface ExplodedEntry {
  /** `${driver.id}::${periodKey}` — unique per (driver, period). */
  id: string;
  sourceDriverId: string;
  periodIndex: number;
  amount: number;
}

function explodeDriverPeriods(
  driver: FinancialDriver,
  periodIndexOf: Map<string, number>,
  warnings: FinancialCaseWarning[]
): ExplodedEntry[] {
  const out: ExplodedEntry[] = [];
  for (const [periodKey, rawAmount] of Object.entries(driver.monthlyValues)) {
    if (!Number.isFinite(rawAmount) || rawAmount === 0) continue;
    const periodIndex = periodIndexOf.get(periodKey);
    if (periodIndex === undefined) {
      warnings.push({
        code: 'period_out_of_horizon',
        message: `Driver "${driver.label || driver.id}" has a value for ${periodKey}, outside the case horizon — excluded from the calculation.`,
        driverId: driver.id,
      });
      continue;
    }
    out.push({
      id: `${driver.id}::${periodKey}`,
      sourceDriverId: driver.id,
      periodIndex,
      amount: rawAmount,
    });
  }
  return out;
}

function confidenceOf(driver: FinancialDriver, warnings: FinancialCaseWarning[]) {
  if (driver.evidence.length > 1) {
    warnings.push({
      code: 'evidence_truncated',
      message: `Driver "${driver.label || driver.id}" has ${driver.evidence.length} evidence refs; the calculation model carries one per driver — using the first.`,
      driverId: driver.id,
    });
  }
  const first = driver.evidence[0];
  return {
    level: driver.confidence,
    evidence: first ? { source: first.label, date: first.sourceDate, note: first.url } : undefined,
  };
}

/** Builds the engine input for ONE scenario's driver-override list (own
 * exploded-entry ids, not the UI driver ids) — reused for the real scenarios
 * and for the ±20% sensitivity bump variants. */
function overridesFor(
  scenario: Exclude<FinancialScenarioId, 'base'>,
  drivers: FinancialDriver[],
  entriesByDriver: Map<string, ExplodedEntry[]>
): ScenarioInput['driverOverrides'] {
  const out: ScenarioInput['driverOverrides'] = [];
  for (const d of drivers) {
    const mult = d.scenarioMultipliers[scenario];
    if (mult === undefined) continue;
    for (const e of entriesByDriver.get(d.id) ?? []) {
      out.push({ driverId: e.id, multiplier: mult });
    }
  }
  return out;
}

/**
 * Builds the full engine input plus bookkeeping needed to re-aggregate its
 * outputs (which exploded entries belong to which UI driver / cost type /
 * benefit type, for cash-affecting-ness and cost-total splitting).
 */
function buildEngineInput(uiInput: FinancialCaseInput, warnings: FinancialCaseWarning[]) {
  if (uiInput.horizonMonths < 1) {
    throw new Error(
      `Financial case horizon must be at least 1 month (got ${uiInput.horizonMonths}) — cannot build a calculation schedule.`
    );
  }
  const periodKeys = periodKeysForCase(uiInput.startPeriod, uiInput.horizonMonths);
  const periodIndexOf = new Map(periodKeys.map((k, i) => [k, i]));
  const caseCurrency: CurrencyInfo = { code: uiInput.currency, scale: 'unit' };

  const investments: InvestmentCostInput[] = [];
  const benefits: BenefitInput[] = [];
  const entriesByDriver = new Map<string, ExplodedEntry[]>();
  /** UI driver ids whose amounts genuinely entered the cash-basis total —
   * used to scope both sensitivity and the implementation/recurring split. */
  const cashAffectingDriverIds = new Set<string>();
  const investmentTypeDriverIds = new Set<string>();
  const recurringTypeDriverIds = new Set<string>();

  for (const d of uiInput.drivers) {
    const entries = explodeDriverPeriods(d, periodIndexOf, warnings);
    entriesByDriver.set(d.id, entries);
    if (entries.length === 0) continue;

    const confidence = confidenceOf(d, warnings);

    if (d.kind === 'cost') {
      if (d.unit !== uiInput.currency) {
        warnings.push({
          code: 'unit_mismatch',
          message: `Cost driver "${d.label || d.id}" is denominated in "${d.unit}", not the case currency "${uiInput.currency}" — no unit conversion is available, excluded from the calculation.`,
          driverId: d.id,
        });
        continue;
      }
      if (d.costType === 'recurring') recurringTypeDriverIds.add(d.id);
      else investmentTypeDriverIds.add(d.id);
      cashAffectingDriverIds.add(d.id);
      for (const e of entries) {
        investments.push({
          id: e.id,
          label: d.label || d.id,
          amount: e.amount,
          currency: caseCurrency,
          classification: 'unclassified',
          internalOrExternal: 'internal',
          periodIndex: e.periodIndex,
          confidence,
        });
      }
      continue;
    }

    // kind === 'benefit'
    if (d.benefitType === 'risk_avoidance') {
      for (const e of entries) {
        benefits.push({
          id: e.id,
          label: d.label || d.id,
          type: 'risk_avoidance',
          amountPerPeriod: e.amount,
          currency: caseCurrency,
          startPeriodIndex: e.periodIndex,
          endPeriodIndex: e.periodIndex,
          confidence,
        });
      }
    } else if (d.benefitType === 'non_cash') {
      for (const e of entries) {
        benefits.push({
          id: e.id,
          label: d.label || d.id,
          type: 'capacity_release',
          amountPerPeriod: e.amount,
          currency: caseCurrency,
          startPeriodIndex: e.periodIndex,
          endPeriodIndex: e.periodIndex,
          capacityRealization: {
            realizedFraction: 0,
            rationale:
              'Idea Table non-cash driver — realized fraction fixed at 0 by the engine adapter (not yet editable in the UI); tracked but never enters cash-basis totals.',
          },
          confidence,
        });
      }
    } else {
      // 'cash' (default)
      if (d.unit !== uiInput.currency) {
        warnings.push({
          code: 'unit_mismatch',
          message: `Benefit driver "${d.label || d.id}" is denominated in "${d.unit}", not the case currency "${uiInput.currency}" — no unit conversion is available, excluded from the calculation.`,
          driverId: d.id,
        });
        continue;
      }
      cashAffectingDriverIds.add(d.id);
      for (const e of entries) {
        benefits.push({
          id: e.id,
          label: d.label || d.id,
          type: 'cash_saving',
          amountPerPeriod: e.amount,
          currency: caseCurrency,
          startPeriodIndex: e.periodIndex,
          endPeriodIndex: e.periodIndex,
          confidence,
        });
      }
    }
  }

  const scenarios: ScenarioInput[] = [{ name: 'base', driverOverrides: [] }];
  for (const s of uiInput.scenarios) {
    if (s === 'base') continue;
    scenarios.push({ name: s, driverOverrides: overridesFor(s, uiInput.drivers, entriesByDriver) });
  }

  const engineInput: IdeaFinancialCaseInput = {
    formulaVersion: FORMULA_VERSION,
    currency: caseCurrency,
    periodConvention: { unit: 'month', periodsPerYear: 12, anchorDate: `${uiInput.startPeriod}-01` },
    discountRatePct: uiInput.discountRatePct,
    baseline: [],
    investments,
    recurringCosts: [],
    benefits,
    timing: {
      startDate: `${uiInput.startPeriod}-01`,
      implementationRampPeriods: 0,
      benefitRampPeriods: 0,
      usefulHorizonPeriods: uiInput.horizonMonths - 1,
    },
    scenarios,
  };

  return {
    engineInput,
    periodKeys,
    entriesByDriver,
    cashAffectingDriverIds,
    investmentTypeDriverIds,
    recurringTypeDriverIds,
  };
}

/** Re-derives implementation-cost / recurring-cost totals from the engine's
 * own per-entry `byDriver` breakdown, split by the UI's cost-type tag (see
 * file header — everything lives in `investments[]` for period fidelity, so
 * the engine's own investment/recurring split doesn't apply here). */
function splitCostTotals(
  byDriver: Array<{ id: string; amount: number }>,
  investmentTypeDriverIds: Set<string>,
  recurringTypeDriverIds: Set<string>
): { implementationCost: number; recurringCostAnnual: number } {
  let implementationCost = 0;
  let recurringCostAnnual = 0;
  for (const row of byDriver) {
    const sourceDriverId = row.id.split('::')[0];
    if (recurringTypeDriverIds.has(sourceDriverId)) recurringCostAnnual += row.amount;
    else if (investmentTypeDriverIds.has(sourceDriverId)) implementationCost += row.amount;
  }
  return { implementationCost, recurringCostAnnual };
}

function computeScenarioResult(
  engineInput: IdeaFinancialCaseInput,
  scenarioName: ScenarioName,
  periodKeys: string[],
  investmentTypeDriverIds: Set<string>,
  recurringTypeDriverIds: Set<string>,
  warnings: FinancialCaseWarning[]
): FinancialScenarioResult | null {
  const flow = computeNetCashFlowPerPeriod(engineInput, scenarioName);
  if (flow.status !== 'ok') {
    warnings.push({
      code: 'scenario_not_computable',
      message: `Scenario "${scenarioName}": ${flow.reason}`,
    });
    return null;
  }
  const payback = computeCumulativeCashFlowAndPayback(engineInput, scenarioName);
  const npvResult = computeNPV(engineInput, scenarioName);
  const roiResult = computeSimpleROI(engineInput, scenarioName);
  const bcrResult = computeBenefitCostRatio(engineInput, scenarioName);
  const annualResult = computeAnnualBenefit(engineInput, scenarioName);
  const implResult = computeImplementationCost(engineInput, scenarioName);

  for (const [label, r] of [
    ['NPV', npvResult] as const,
    ['ROI', roiResult] as const,
    ['benefit-cost ratio', bcrResult] as const,
    ['annual benefit', annualResult] as const,
  ]) {
    if (r.status !== 'ok') {
      warnings.push({ code: 'metric_not_computable', message: `Scenario "${scenarioName}" ${label}: ${r.reason}` });
    }
  }

  const cumulative = payback.status === 'ok' ? payback.value.cumulativeCashFlow : [];
  const periods: FinancialPeriodResult[] = flow.value.periods.map((p, idx) => ({
    period: periodKeys[p] ?? periodKeys[idx] ?? String(p),
    cost: flow.value.costTotal[idx] ?? 0,
    benefit: flow.value.cashBenefit[idx] ?? 0,
    netCashFlow: flow.value.netCashFlow[idx] ?? 0,
    cumulativeCashFlow: cumulative[idx] ?? 0,
  }));

  const { implementationCost, recurringCostAnnual } =
    implResult.status === 'ok'
      ? splitCostTotals(implResult.value.byDriver, investmentTypeDriverIds, recurringTypeDriverIds)
      : { implementationCost: null, recurringCostAnnual: null };

  return {
    scenario: scenarioName as FinancialScenarioId,
    periods,
    grossAnnualBenefit: annualResult.status === 'ok' ? annualResult.value.grossCashBenefit : null,
    netAnnualBenefit: annualResult.status === 'ok' ? annualResult.value.netCashBenefit : null,
    implementationCost,
    recurringCostAnnual,
    roiPct: roiResult.status === 'ok' ? roiResult.value.roi * 100 : null,
    npv: npvResult.status === 'ok' ? npvResult.value.npv : null,
    paybackMonths: payback.status === 'ok' ? payback.value.paybackPeriodIndex : null,
    benefitCostRatio: bcrResult.status === 'ok' ? bcrResult.value.bcr : null,
  };
}

function computeSensitivity(
  uiInput: FinancialCaseInput,
  engineInput: IdeaFinancialCaseInput,
  entriesByDriver: Map<string, ExplodedEntry[]>,
  cashAffectingDriverIds: Set<string>,
  warnings: FinancialCaseWarning[]
): FinancialSensitivityRow[] {
  const baseNpvResult = computeNPV(engineInput, 'base');
  if (baseNpvResult.status !== 'ok') return [];
  const baseNpv = baseNpvResult.value.npv;

  const bump = (driverId: string, factor: number): IdeaFinancialCaseInput => {
    const ids = new Set((entriesByDriver.get(driverId) ?? []).map((e) => e.id));
    return {
      ...engineInput,
      investments: engineInput.investments.map((inv) =>
        ids.has(inv.id) ? { ...inv, amount: inv.amount * factor } : inv
      ),
      benefits: engineInput.benefits.map((b) =>
        ids.has(b.id) && b.amountPerPeriod !== undefined
          ? { ...b, amountPerPeriod: b.amountPerPeriod * factor }
          : b
      ),
    };
  };

  const rows: FinancialSensitivityRow[] = [];
  for (const d of uiInput.drivers) {
    if (!cashAffectingDriverIds.has(d.id)) continue;
    const low = computeNPV(bump(d.id, 1 - SENSITIVITY_DELTA_PCT / 100), 'base');
    const high = computeNPV(bump(d.id, 1 + SENSITIVITY_DELTA_PCT / 100), 'base');
    if (low.status !== 'ok' || high.status !== 'ok') {
      warnings.push({
        code: 'sensitivity_not_computable',
        message: `Sensitivity for driver "${d.label || d.id}": ${low.status !== 'ok' ? low.reason : high.status === 'ok' ? '' : high.reason}`,
        driverId: d.id,
      });
      continue;
    }
    rows.push({
      driverId: d.id,
      driverLabel: d.label || d.id,
      baseNpv,
      lowNpv: low.value.npv,
      highNpv: high.value.npv,
    });
  }
  return rows;
}

/**
 * `FinancialComputeFn` implementation — the adapter itself. Pure: same
 * input, same output, no I/O (matches the engine's own contract).
 */
export function computeIdeaFinancialCase(uiInput: FinancialCaseInput): FinancialCaseResult {
  const warnings: FinancialCaseWarning[] = [];
  const {
    engineInput,
    periodKeys,
    entriesByDriver,
    cashAffectingDriverIds,
    investmentTypeDriverIds,
    recurringTypeDriverIds,
  } = buildEngineInput(uiInput, warnings);

  const scenarios: FinancialCaseResult['scenarios'] = {};
  for (const s of uiInput.scenarios) {
    const result = computeScenarioResult(
      engineInput,
      s,
      periodKeys,
      investmentTypeDriverIds,
      recurringTypeDriverIds,
      warnings
    );
    if (result) scenarios[s] = result;
  }

  const sensitivity = computeSensitivity(
    uiInput,
    engineInput,
    entriesByDriver,
    cashAffectingDriverIds,
    warnings
  );

  return {
    formulaVersion: FORMULA_VERSION,
    computedAt: new Date().toISOString(),
    currency: uiInput.currency,
    scenarios,
    sensitivity,
    warnings,
  };
}
