/**
 * investmentAppraisalService — M16/7.1 Investment Appraisal computational core.
 *
 * Pure, dependency-free functions for capital-budgeting appraisal. The discount
 * rate / WACC / hurdle rate is ALWAYS a PARAMETER — never hardcoded (the audit
 * P0 was a shell that assumed NPV @ 10%). All rates are passed as percentages
 * (e.g. 10 means 10%), converted internally to decimals.
 *
 * Conventions:
 *  - `cashflows` are the per-period NET cash flows for periods t = 1..N
 *    (the initial outlay is NOT included in this array).
 *  - `initialInvestment` is the period-0 outlay as a POSITIVE number.
 *  - Time periods are integers starting at 1 for the first element of
 *    `cashflows`.
 */

const PERCENT = 100;

/** Convert a percentage (10 → 0.10) to a decimal rate. */
function toRate(ratePct: number): number {
  return ratePct / PERCENT;
}

/**
 * Present value of a stream of cash flows (periods 1..N) at a given rate.
 * Does NOT subtract the initial investment.
 */
function presentValueOfFlows(cashflows: number[], ratePct: number): number {
  const r = toRate(ratePct);
  let pv = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const t = i + 1;
    pv += cashflows[i] / Math.pow(1 + r, t);
  }
  return pv;
}

/**
 * Net Present Value.
 *   NPV = Σ_{t=1..N} cf_t / (1 + r)^t − initialInvestment
 *
 * @param cashflows        net cash flows for periods 1..N
 * @param ratePct          discount rate in percent (PARAMETER, never hardcoded)
 * @param initialInvestment period-0 outlay (positive)
 */
export function npv(cashflows: number[], ratePct: number, initialInvestment: number): number {
  return presentValueOfFlows(cashflows, ratePct) - initialInvestment;
}

/**
 * Internal Rate of Return via bisection.
 * Returns the rate (in PERCENT) at which NPV == 0, or `null` when no sign
 * change exists in the bracket (e.g. all-positive or all-negative flows).
 *
 * @param cashflows        net cash flows for periods 1..N
 * @param initialInvestment period-0 outlay (positive)
 */
export function irr(cashflows: number[], initialInvestment: number): number | null {
  if (cashflows.length === 0) return null;

  // NPV as a function of decimal rate r.
  const npvAt = (r: number): number => {
    let v = -initialInvestment;
    for (let i = 0; i < cashflows.length; i++) {
      v += cashflows[i] / Math.pow(1 + r, i + 1);
    }
    return v;
  };

  // Bracket: search for a sign change between lo and hi.
  let lo = -0.9999; // rate cannot be <= -100%
  let hi = 10; // 1000%
  let fLo = npvAt(lo);
  let fHi = npvAt(hi);

  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (fLo === 0) return lo * PERCENT;
  if (fHi === 0) return hi * PERCENT;

  // No sign change in the default bracket → no real IRR we can bisect.
  if (fLo * fHi > 0) return null;

  // Bisection.
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-9 || (hi - lo) / 2 < 1e-9) {
      return mid * PERCENT;
    }
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return ((lo + hi) / 2) * PERCENT;
}

/**
 * Modified Internal Rate of Return.
 * Positive flows are reinvested forward at `reinvestRatePct`; negative flows
 * (incl. the initial investment) are discounted back at `financeRatePct`.
 *   MIRR = (FV_positive / -PV_negative)^(1/n) − 1
 *
 * @param cashflows         net cash flows for periods 1..N
 * @param financeRatePct    finance rate in percent (for negative flows)
 * @param reinvestRatePct   reinvestment rate in percent (for positive flows)
 * @param initialInvestment period-0 outlay (positive)
 * @returns MIRR in PERCENT
 */
export function mirr(
  cashflows: number[],
  financeRatePct: number,
  reinvestRatePct: number,
  initialInvestment: number
): number {
  const n = cashflows.length;
  if (n === 0) return NaN;

  const rFinance = toRate(financeRatePct);
  const rReinvest = toRate(reinvestRatePct);

  // Full flow series including period 0 (the outlay is negative).
  const flows = [-initialInvestment, ...cashflows];

  // Future value of positive flows, compounded to period n at reinvest rate.
  let fvPositive = 0;
  // Present value of negative flows, discounted to period 0 at finance rate.
  let pvNegative = 0;

  for (let t = 0; t < flows.length; t++) {
    const cf = flows[t];
    if (cf > 0) {
      fvPositive += cf * Math.pow(1 + rReinvest, n - t);
    } else if (cf < 0) {
      pvNegative += cf / Math.pow(1 + rFinance, t);
    }
  }

  if (pvNegative === 0) return NaN; // no outflow → undefined
  // pvNegative is negative; ratio uses its magnitude.
  const ratio = fvPositive / -pvNegative;
  if (ratio <= 0) return NaN;

  const mirrDecimal = Math.pow(ratio, 1 / n) - 1;
  return mirrDecimal * PERCENT;
}

/**
 * Simple (undiscounted) cumulative payback period, with linear interpolation
 * within the recovery period.
 * Returns the number of periods to recover `initialInvestment`, or
 * `Infinity` when the investment is never recovered.
 *
 * @param cashflows        net cash flows for periods 1..N
 * @param initialInvestment period-0 outlay (positive)
 */
export function payback(cashflows: number[], initialInvestment: number): number {
  if (initialInvestment <= 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const cf = cashflows[i];
    const prevCumulative = cumulative;
    cumulative += cf;
    if (cumulative >= initialInvestment) {
      const shortfall = initialInvestment - prevCumulative;
      // Fractional part of this period needed to close the shortfall.
      const fraction = cf !== 0 ? shortfall / cf : 0;
      return i + fraction; // i is 0-based; first period contributes 1.0
    }
  }
  return Infinity;
}

/**
 * Discounted payback: same as `payback`, but on present-value cash flows.
 * Always >= simple payback (discounting slows recovery). Returns `Infinity`
 * when discounted flows never recover the outlay.
 *
 * @param cashflows        net cash flows for periods 1..N
 * @param ratePct          discount rate in percent (PARAMETER)
 * @param initialInvestment period-0 outlay (positive)
 */
export function discountedPayback(
  cashflows: number[],
  ratePct: number,
  initialInvestment: number
): number {
  if (initialInvestment <= 0) return 0;
  const r = toRate(ratePct);
  let cumulative = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const t = i + 1;
    const discounted = cashflows[i] / Math.pow(1 + r, t);
    const prevCumulative = cumulative;
    cumulative += discounted;
    if (cumulative >= initialInvestment) {
      const shortfall = initialInvestment - prevCumulative;
      const fraction = discounted !== 0 ? shortfall / discounted : 0;
      return i + fraction;
    }
  }
  return Infinity;
}

/**
 * Profitability Index = PV(future benefits) / initialInvestment.
 * PI > 1 ⇒ value-creating. Returns `Infinity` when there is no outlay.
 *
 * @param cashflows        net cash flows for periods 1..N
 * @param ratePct          discount rate in percent (PARAMETER)
 * @param initialInvestment period-0 outlay (positive)
 */
export function profitabilityIndex(
  cashflows: number[],
  ratePct: number,
  initialInvestment: number
): number {
  if (initialInvestment <= 0) return Infinity;
  return presentValueOfFlows(cashflows, ratePct) / initialInvestment;
}

export interface AppraisalInput {
  cashflows: number[];
  initialInvestment: number;
  /** Discount rate / WACC in percent (PARAMETER). */
  discountRatePct: number;
  /** Hurdle rate in percent the IRR must clear. */
  hurdleRatePct: number;
}

export type AppraisalVerdict = 'go' | 'conditional' | 'no-go';

export interface AppraisalResult {
  npv: number;
  irr: number | null;
  mirr: number;
  payback: number;
  discountedPayback: number;
  pi: number;
  verdict: AppraisalVerdict;
}

/**
 * Full investment appraisal with a go / conditional / no-go verdict.
 *
 * Verdict logic:
 *  - go:          NPV > 0 AND IRR > hurdle AND PI > 1 (all strongly positive)
 *  - no-go:       NPV < 0 OR PI < 1 (clearly value-destroying)
 *  - conditional: everything else (borderline — e.g. NPV >= 0 but IRR <= hurdle,
 *                 or IRR undefined, or metrics on the boundary)
 *
 * The discount rate is taken from `discountRatePct` — NOT hardcoded. MIRR uses
 * the same rate for both finance and reinvestment unless callers want to split
 * (here we use discountRatePct for both, a standard default).
 */
export function appraise(input: AppraisalInput): AppraisalResult {
  const { cashflows, initialInvestment, discountRatePct, hurdleRatePct } = input;

  const npvValue = npv(cashflows, discountRatePct, initialInvestment);
  const irrValue = irr(cashflows, initialInvestment);
  const mirrValue = mirr(cashflows, discountRatePct, discountRatePct, initialInvestment);
  const paybackValue = payback(cashflows, initialInvestment);
  const discountedPaybackValue = discountedPayback(cashflows, discountRatePct, initialInvestment);
  const piValue = profitabilityIndex(cashflows, discountRatePct, initialInvestment);

  let verdict: AppraisalVerdict;

  // Clearly value-destroying → no-go.
  if (npvValue < 0 || piValue < 1) {
    verdict = 'no-go';
  } else if (
    // Strongly positive on every criterion → go.
    npvValue > 0 &&
    piValue > 1 &&
    irrValue !== null &&
    irrValue > hurdleRatePct
  ) {
    verdict = 'go';
  } else {
    // Borderline: NPV >= 0 & PI >= 1 but IRR doesn't clear the hurdle,
    // or IRR is undefined, or a metric sits exactly on the boundary.
    verdict = 'conditional';
  }

  return {
    npv: npvValue,
    irr: irrValue,
    mirr: mirrValue,
    payback: paybackValue,
    discountedPayback: discountedPaybackValue,
    pi: piValue,
    verdict,
  };
}
