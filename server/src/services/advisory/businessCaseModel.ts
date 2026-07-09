/**
 * businessCaseModel — DETERMINISTIC business-case engine (Oxford O4 foundation).
 * ============================================================================
 * "Finanse jako doradztwo": a business case is not a filled-in table, it's a
 * chain assumptions → cashflows → scenarios named by LEVER (not ±X% blindly)
 * → recommendation. This module owns the middle: assumptions in, numbers out.
 *
 * Hard rule (project doctrine, CONCLUSION_LAYER_STANDARD W3): every number the
 * narrative layer quotes must trace back to THIS engine. No LLM math here —
 * pure, synchronous, testable TypeScript. The LLM (BusinessCaseService) only
 * proposes the STRUCTURE (which drivers, which scenarios) and writes prose
 * AROUND numbers this module computed.
 *
 * Cashflow convention: year 0 = upfront investment (capex, undiscounted
 * outflow), years 1..N = recurring net cashflow (benefits − costs), each
 * ramped by an adoption/realization curve. NPV discounts every year at the
 * plan's WACC. Payback is computed on the UNDISCOUNTED cumulative cashflow
 * (standard "simple payback"), reported in fractional years.
 */

// ---------------------------------------------------------------------------
// Types — the vocabulary of a business case
// ---------------------------------------------------------------------------

/** A named, unit-bearing assumption that drives the model. Never a bare "±15%". */
export interface ValueDriver {
  /** Stable key used by scenarios to target this driver (e.g. "adoption_rate"). */
  key: string;
  /** Human label (PL), e.g. "Tempo adopcji przez zespoły". */
  label: string;
  /** Role in the cashflow: recurring benefit, recurring cost, or one-time capex. */
  role: 'benefit' | 'cost' | 'capex';
  /** Annual amount in plan currency (role=benefit|cost) or one-time amount (role=capex). */
  annualAmount: number;
  /**
   * Realization ramp per year, e.g. [0.5, 0.85, 1, 1, 1] = 50% of annualAmount
   * realized in year 1, 85% in year 2, 100% from year 3 on. Missing years
   * repeat the last value. Ignored for role=capex (capex always lands year 0).
   */
  rampPct?: number[];
  /** Why this number — grounding for the narrative layer (R2, no orphan numbers). */
  rationale?: string;
}

export interface BusinessCasePlan {
  /** One-sentence problem statement the case answers. */
  problem: string;
  /** Named options considered; the plan picks one as `recommendedOptionId` post-model. */
  options: Array<{ id: string; name: string; description: string }>;
  drivers: ValueDriver[];
  /** Named scenarios — each moves ONE driver by an explicit, labelled delta. */
  scenarios: BusinessCaseScenarioDef[];
  /** Analysis horizon in years (>=1). */
  horizonYears: number;
  /** Discount rate (WACC), as a percentage, e.g. 12 = 12%. */
  waccPct: number;
  currency: string;
}

/** A scenario is a DRIVER + a labelled multiplier — never an unnamed "what-if". */
export interface BusinessCaseScenarioDef {
  key: string;
  /** Named after the lever it pulls, e.g. "Wolniejsza adopcja". */
  name: string;
  /** Driver key this scenario perturbs. */
  driverKey: string;
  /** Multiplier applied to the driver's annualAmount (0.7 = "-30%"). */
  multiplier: number;
  /** Why this scenario matters — the business reason the lever might move. */
  rationale?: string;
}

export interface ScenarioResult {
  key: string;
  name: string;
  driverKey: string | null;
  multiplier: number;
  cashflows: number[]; // index 0 = year 0 (capex, negative), index i = year i
  npv: number;
  irrPct: number | null;
  paybackYears: number | null;
  roiPct: number;
  totalInvestment: number;
  totalNominalBenefit: number;
}

export interface BusinessCaseModelResult {
  waccPct: number;
  horizonYears: number;
  currency: string;
  base: ScenarioResult;
  scenarios: ScenarioResult[];
  /** Scenario with the lowest NPV (excluding base) — the downside case the recommendation must address. */
  worstCase: ScenarioResult | null;
  /** Scenario with the highest NPV (excluding base) — the upside case. */
  bestCase: ScenarioResult | null;
}

// ---------------------------------------------------------------------------
// Core math — pure functions, independently testable
// ---------------------------------------------------------------------------

/** Net present value of a cashflow series; index 0 is treated as year 0 (undiscounted). */
export function computeNPV(cashflows: number[], ratePct: number): number {
  const r = ratePct / 100;
  return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + r, t), 0);
}

/**
 * Internal rate of return via bisection on NPV(rate) = 0. Returns null when no
 * sign change exists in the search range (e.g. cashflows never recover the
 * investment — a real, reportable outcome, not an error).
 */
export function computeIRR(cashflows: number[]): number | null {
  const npvAt = (ratePct: number) => computeNPV(cashflows, ratePct);

  // Search space is deliberately 0%..1000% — negative discount rates are not
  // economically meaningful for a business case (WACC is never negative),
  // and near -100% the NPV formula blows up, producing mathematically real
  // but business-nonsensical roots. A project that doesn't clear NPV=0 for
  // any non-negative rate correctly has "no meaningful IRR" (returns null).
  let lo = 0;
  let hi = 1000;
  const npvLo = npvAt(lo);
  const npvHi = npvAt(hi);
  if (Number.isNaN(npvLo) || Number.isNaN(npvHi)) return null;
  if (npvLo * npvHi > 0) return null; // no sign change → no IRR in range

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npvAt(mid);
    if (Math.abs(npvMid) < 1e-6) return round2(mid);
    if (npvLo * npvMid < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return round2((lo + hi) / 2);
}

/**
 * Simple (undiscounted) payback in fractional years. Null when the cashflow
 * never turns cumulatively positive within the horizon.
 */
export function computePayback(cashflows: number[]): number | null {
  let cumulative = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prevCumulative = cumulative;
    cumulative += cashflows[t];
    if (cumulative >= 0 && t > 0) {
      const cf = cashflows[t];
      if (cf === 0) return round2(t);
      const fraction = -prevCumulative / cf;
      return round2(t - 1 + fraction);
    }
    if (cumulative >= 0 && t === 0) return 0;
  }
  return null;
}

/** ROI% = (total nominal net benefit over the horizon − investment) / investment × 100. */
export function computeROI(cashflows: number[]): { roiPct: number; totalInvestment: number; totalNominalBenefit: number } {
  const totalInvestment = Math.abs(Math.min(0, cashflows[0] ?? 0));
  const totalNominalBenefit = cashflows.slice(1).reduce((s, cf) => s + cf, 0);
  const roiPct = totalInvestment > 0 ? round2(((totalNominalBenefit - totalInvestment) / totalInvestment) * 100) : 0;
  return { roiPct, totalInvestment, totalNominalBenefit };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rampFor(driver: ValueDriver, year: number): number {
  // year is 1-indexed (year 1..horizon)
  const ramp = driver.rampPct;
  if (!ramp || ramp.length === 0) return 1;
  const idx = Math.min(year - 1, ramp.length - 1);
  return ramp[idx] ?? ramp[ramp.length - 1] ?? 1;
}

/**
 * Builds the year-by-year cashflow series for a set of drivers, with an
 * optional (driverKey → multiplier) override map to express a scenario.
 */
export function buildCashflows(
  drivers: ValueDriver[],
  horizonYears: number,
  overrides: Record<string, number> = {}
): number[] {
  const capex = drivers
    .filter((d) => d.role === 'capex')
    .reduce((sum, d) => sum + d.annualAmount * (overrides[d.key] ?? 1), 0);

  const cashflows: number[] = [-capex];

  for (let year = 1; year <= horizonYears; year++) {
    let net = 0;
    for (const d of drivers) {
      if (d.role === 'capex') continue;
      const mult = overrides[d.key] ?? 1;
      const realized = d.annualAmount * mult * rampFor(d, year);
      net += d.role === 'benefit' ? realized : -realized;
    }
    cashflows.push(net);
  }
  return cashflows;
}

function runScenario(
  key: string,
  name: string,
  driverKey: string | null,
  multiplier: number,
  drivers: ValueDriver[],
  horizonYears: number,
  waccPct: number
): ScenarioResult {
  const overrides = driverKey ? { [driverKey]: multiplier } : {};
  const cashflows = buildCashflows(drivers, horizonYears, overrides);
  const npv = round2(computeNPV(cashflows, waccPct));
  const irrPct = computeIRR(cashflows);
  const paybackYears = computePayback(cashflows);
  const { roiPct, totalInvestment, totalNominalBenefit } = computeROI(cashflows);

  return {
    key,
    name,
    driverKey,
    multiplier,
    cashflows: cashflows.map(round2),
    npv,
    irrPct,
    paybackYears,
    roiPct,
    totalInvestment: round2(totalInvestment),
    totalNominalBenefit: round2(totalNominalBenefit),
  };
}

/**
 * Runs the full model: base case + every named scenario in the plan.
 * This is the ONLY function BusinessCaseService should call for numbers.
 */
export function runBusinessCaseModel(plan: BusinessCasePlan): BusinessCaseModelResult {
  if (!plan.drivers || plan.drivers.length === 0) {
    throw new Error('businessCaseModel: plan has no drivers — cannot compute cashflows');
  }
  if (!plan.horizonYears || plan.horizonYears < 1) {
    throw new Error('businessCaseModel: horizonYears must be >= 1');
  }

  const base = runScenario('base', 'Bazowy', null, 1, plan.drivers, plan.horizonYears, plan.waccPct);

  const knownDriverKeys = new Set(plan.drivers.map((d) => d.key));
  const scenarios = (plan.scenarios || [])
    .filter((s) => {
      if (!knownDriverKeys.has(s.driverKey)) {
        throw new Error(
          `businessCaseModel: scenario "${s.key}" targets unknown driver "${s.driverKey}"`
        );
      }
      return true;
    })
    .map((s) => runScenario(s.key, s.name, s.driverKey, s.multiplier, plan.drivers, plan.horizonYears, plan.waccPct));

  let worstCase: ScenarioResult | null = null;
  let bestCase: ScenarioResult | null = null;
  for (const s of scenarios) {
    if (!worstCase || s.npv < worstCase.npv) worstCase = s;
    if (!bestCase || s.npv > bestCase.npv) bestCase = s;
  }

  return {
    waccPct: plan.waccPct,
    horizonYears: plan.horizonYears,
    currency: plan.currency,
    base,
    scenarios,
    worstCase,
    bestCase,
  };
}
