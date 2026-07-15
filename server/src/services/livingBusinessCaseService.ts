/**
 * M16/2.1 — Living Business Case
 * ------------------------------------------------------------------
 * Pure (DB-free) economics layer that WOULD let a financial-analysis-born
 * initiative carry its NUMBERS — not just a name + summary.
 *
 * Seam A (the bug this is meant to fix): today an initiative spawned from a
 * financial analysis (`server/src/routes/v8/finance.routes.ts`, see
 * `POST /analyses/:analysisId/initiatives`) is born "empty" — only `name` +
 * `summary`, with no NPV / IRR / payback. This service extracts the
 * economics out of the already computed investment ratios
 * (financialAnalysisService.computeInvestmentRatios: NPV / IRR / payback /
 * ROI) into a transportable shape, and lets the read path RE-COMPUTE
 * NPV/IRR/payback/PI from the stored assumptions against a REAL WACC (the
 * "living" part — change WACC → numbers move), never a hardcoded 10%.
 *
 * ★ NOT WIRED (verified 2026-07-15, Oxford O4 audit): grep of server/src
 * finds zero callers of buildBusinessCaseFromAnalysis / computeNpvOnRead /
 * toRoiAssumptions outside this file's own tests. `finance.routes.ts`'s
 * `/analyses/:analysisId/initiatives` does NOT call this service — it still
 * inserts initiatives with only name/summary, exactly the "empty" state
 * this module was written to fix. A previous version of this docblock
 * claimed "the DB/route wiring lives in the caller" — that was aspirational,
 * not actual; corrected here so this file stops misrepresenting its own
 * integration status. Everything below is still a pure function (no
 * DbPromise import, no I/O) and is safe to wire in; the remaining work is
 * a route-level call in finance.routes.ts that (a) fetches the analysis'
 * ratios via financialAnalysisService, (b) resolves capex/opex/benefit
 * drivers (not currently read by that route — only insight title/description
 * are), and (c) persists the result via the roi_assumptions writers already
 * used by benefits.routes.ts / results.routes.ts.
 */

import type { RatioResult } from './financialAnalysisService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The economics of a business case, in the SAME shape we want to carry
 * onto an initiative (roi_assumptions-shaped inputs) + the cashflow
 * series that drives the on-read recompute.
 *
 * `cashflows` is the NET BENEFIT stream by year, t=1..horizonYears
 * (year 0 = the capex outlay, kept separate so the recompute can apply
 * the discount factor at t correctly). All amounts in the analysis
 * currency, undiscounted.
 */
export interface BusinessCaseEconomics {
  /** Upfront capital outlay (year 0), positive number. */
  capex: number;
  /** Recurring annual operating cost of the initiative, positive number. */
  opex: number;
  /** Annual incremental revenue the initiative is expected to create. */
  revenueDelta: number;
  /** Annual cost savings the initiative is expected to create. */
  costSavings: number;
  /** Horizon of the case, in years. */
  horizonYears: number;
  /** Discount rate / WACC baked in at build time (percent, e.g. 11.5). */
  discountRatePct: number;
  /**
   * Net benefit cashflow series for t=1..horizonYears (undiscounted).
   * Each entry = revenueDelta + costSavings − opex for that year.
   * Year-0 capex is NOT in this array (held in `capex`).
   */
  cashflows: number[];
}

/** Result of the living on-read recompute. */
export interface ComputedBusinessCase {
  /** Net Present Value: Σ cf_t/(1+r)^t − capex. */
  npv: number;
  /** Internal Rate of Return (fraction, e.g. 0.18 = 18%), or null if no sign change. */
  irr: number | null;
  /** Discounted payback in years (fractional), or null if never recovered. */
  paybackYears: number | null;
  /** Profitability Index: PV(benefits) / capex. */
  pi: number | null;
}

/** Options for extracting economics out of an analysis. */
export interface BuildBusinessCaseOptions {
  /** Upfront capital outlay. If omitted, derived from the analysis NPV/ROI is not possible — defaults to 0. */
  capex?: number;
  /** Recurring annual opex of the initiative. */
  opex?: number;
  /** Annual incremental revenue. */
  revenueDelta?: number;
  /** Annual cost savings. */
  costSavings?: number;
  /** Horizon in years (default 5). */
  horizonYears?: number;
  /** Discount rate / WACC to bake in (percent). Default 10 ONLY as a last resort. */
  discountRatePct?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNonNeg(value: number): number {
  return value > 0 ? value : 0;
}

function ratioValue(ratios: RatioResult[], code: string): number | null {
  const hit = (ratios || []).find((r) => r.code === code);
  if (!hit || hit.value == null || !Number.isFinite(hit.value)) return null;
  return hit.value;
}

// ---------------------------------------------------------------------------
// 2. buildBusinessCaseFromAnalysis
// ---------------------------------------------------------------------------

/**
 * Pull the economics out of an analysis' computed investment ratios
 * (npv / irr_pct / payback_periods / roi_pct) plus the caller-supplied
 * outlay/horizon, producing a roi_assumptions-shaped economics object
 * that can be carried onto a freshly born initiative.
 *
 * The analysis gives us the *signal* (does this clear the bar, how fast
 * does it pay back); the opts give us the *inputs* (capex, opex, the
 * benefit drivers). When explicit benefit drivers are missing, we fall
 * back to reconstructing a flat net-benefit stream from ROI:
 *   total net benefit ≈ roi_pct/100 * capex  (over the horizon)
 * so the case is never born with all-zero numbers when an ROI exists.
 */
export function buildBusinessCaseFromAnalysis(
  ratios: RatioResult[],
  opts: BuildBusinessCaseOptions = {}
): BusinessCaseEconomics {
  const capex = clampNonNeg(num(opts.capex, 0));
  const opex = clampNonNeg(num(opts.opex, 0));
  const horizonYears = Math.max(1, Math.round(num(opts.horizonYears, 5)));
  const discountRatePct = num(opts.discountRatePct, 10);

  const revenueDelta = clampNonNeg(num(opts.revenueDelta, 0));
  let costSavings = clampNonNeg(num(opts.costSavings, 0));

  // If the caller gave no explicit benefit drivers, reconstruct a flat
  // benefit stream from the analysis ROI so the case carries real numbers
  // instead of being born empty.
  if (revenueDelta === 0 && costSavings === 0) {
    const roiPct = ratioValue(ratios, 'roi_pct');
    if (roiPct != null && capex > 0) {
      // ROI% (cumulative over the analysed cashflows) → total net benefit,
      // spread flat across the horizon, then add back opex so the gross
      // annual benefit is consistent with the net-benefit cashflow below.
      const totalNetBenefit = (roiPct / 100) * capex;
      const annualNetBenefit = totalNetBenefit / horizonYears;
      // Surface the reconstructed benefit as "cost savings" (the neutral
      // bucket) and gross it up by opex so cashflow = benefit − opex matches.
      costSavings = clampNonNeg(annualNetBenefit + opex);
    }
  }

  const annualNetBenefit = revenueDelta + costSavings - opex;
  const cashflows = Array.from({ length: horizonYears }, () => annualNetBenefit);

  return {
    capex,
    opex,
    revenueDelta,
    costSavings,
    horizonYears,
    discountRatePct,
    cashflows,
  };
}

// ---------------------------------------------------------------------------
// 3. computeNpvOnRead — the "living" recompute
// ---------------------------------------------------------------------------

/**
 * Re-compute NPV / IRR / discounted-payback / PI from stored economics
 * against a REAL WACC (param), never a hardcoded 10%.
 *
 *   NPV = Σ_{t=1..N} cf_t / (1+r)^t  −  capex
 *   IRR = rate where NPV(rate) = 0   (bisection over [-0.99, 10])
 *   payback = first year where cumulative DISCOUNTED cashflow ≥ capex
 *   PI  = PV(benefits) / capex
 *
 * `waccPct` is a percentage (e.g. 11.5 → r = 0.115). If a non-finite or
 * non-positive WACC is passed, falls back to the discountRatePct baked
 * into the economics (still never a blind 10%).
 */
export function computeNpvOnRead(
  econ: BusinessCaseEconomics,
  waccPct: number
): ComputedBusinessCase {
  const capex = clampNonNeg(num(econ?.capex, 0));
  const cashflows = Array.isArray(econ?.cashflows) ? econ.cashflows.map((c) => num(c, 0)) : [];

  // Real WACC param wins; fall back to the case's baked-in rate, then 0.
  const rawWacc = num(waccPct, NaN);
  const effectiveRatePct =
    Number.isFinite(rawWacc) && rawWacc > -100 ? rawWacc : num(econ?.discountRatePct, 0);
  const r = effectiveRatePct / 100;

  // PV of the benefit stream (t = 1..N).
  const pvBenefits = cashflows.reduce((acc, cf, idx) => acc + cf / Math.pow(1 + r, idx + 1), 0);

  const npv = pvBenefits - capex;

  // ---- IRR via bisection on NPV(rate) = 0 ----
  const npvAt = (rate: number): number =>
    cashflows.reduce((acc, cf, idx) => acc + cf / Math.pow(1 + rate, idx + 1), 0) - capex;

  let irr: number | null = null;
  let low = -0.99;
  let high = 10;
  let lowNpv = npvAt(low);
  const highNpv = npvAt(high);
  if (Number.isFinite(lowNpv) && Number.isFinite(highNpv) && lowNpv * highNpv < 0) {
    for (let i = 0; i < 100; i += 1) {
      const mid = (low + high) / 2;
      const midNpv = npvAt(mid);
      if (Math.abs(midNpv) < 1e-6) {
        irr = mid;
        break;
      }
      if (lowNpv * midNpv < 0) {
        high = mid;
      } else {
        low = mid;
        lowNpv = midNpv;
      }
    }
    irr = irr ?? (low + high) / 2;
  }

  // ---- Discounted payback ----
  let paybackYears: number | null = null;
  let cumulativeDiscounted = 0;
  for (let idx = 0; idx < cashflows.length; idx += 1) {
    const discounted = cashflows[idx] / Math.pow(1 + r, idx + 1);
    const prev = cumulativeDiscounted;
    cumulativeDiscounted += discounted;
    if (cumulativeDiscounted >= capex) {
      const need = capex - prev;
      const fraction = discounted !== 0 ? need / discounted : 0;
      paybackYears = idx + Math.min(1, Math.max(0, fraction));
      break;
    }
  }

  // ---- Profitability Index ----
  const pi = capex > 0 ? pvBenefits / capex : null;

  return { npv, irr, paybackYears, pi };
}

// ---------------------------------------------------------------------------
// 4. toRoiAssumptions — shape for the roi_assumptions table (M15)
// ---------------------------------------------------------------------------

/**
 * Project the economics onto the `roi_assumptions` column shape used by
 * M15 (benefits.routes.ts / results.routes.ts INSERT). The recompute is
 * done against the case's own baked-in discount rate so the persisted
 * expected_* values are internally consistent at write time; the read
 * path can later re-run computeNpvOnRead with a live WACC.
 *
 * Returned keys mirror the INSERT columns (camelCase request-body names
 * the routes already accept): capex, opexAnnual, expectedRoiPercent,
 * expectedNpv, expectedPaybackMonths, horizonMonths, expectedRevenueDelta,
 * expectedCostDelta.
 */
export function toRoiAssumptions(econ: BusinessCaseEconomics): Record<string, unknown> {
  const computed = computeNpvOnRead(econ, econ.discountRatePct);

  const totalNetBenefit = (econ.cashflows || []).reduce((acc, cf) => acc + num(cf, 0), 0);
  const expectedRoiPercent = econ.capex > 0 ? (totalNetBenefit / econ.capex) * 100 : null;

  const expectedPaybackMonths =
    computed.paybackYears == null ? null : Math.round(computed.paybackYears * 12);

  return {
    capex: econ.capex,
    opexAnnual: econ.opex,
    expectedRoiPercent,
    expectedNpv: computed.npv,
    expectedPaybackMonths,
    horizonMonths: Math.round(econ.horizonYears * 12),
    expectedRevenueDelta: econ.revenueDelta,
    expectedCostDelta: econ.costSavings,
    // Discount rate the figures above were computed at (percent).
    discountRatePct: econ.discountRatePct,
    // Convenience: the profitability index / IRR for downstream display.
    expectedProfitabilityIndex: computed.pi,
    expectedIrrPercent: computed.irr == null ? null : computed.irr * 100,
  };
}
