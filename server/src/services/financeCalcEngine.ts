/**
 * financeCalcEngine — CANONICAL FINANCE PRIMITIVES (SSOT)
 *
 * M16/1.4 — Server-side Finance Engine, Single Source of Truth.
 *
 * This module is the *one* audited home for low-level financial math primitives
 * (NPV, IRR, payback, present/future value, annuities, CAGR, margins, growth).
 *
 * CANONICAL — DO NOT DUPLICATE.
 * If you need NPV, IRR, a discount factor, a margin, a CAGR, etc., import it from
 * here. Do NOT re-implement these formulas in route handlers, other services, or
 * (especially) the browser. Historically some of this math lived client-side,
 * which let server and client drift apart; this file collapses that drift into a
 * single auditable implementation.
 *
 * Design contract:
 *   - Pure: no I/O, no DB, no clock, no randomness, no global mutation.
 *   - Deterministic: same inputs → identical outputs, every time.
 *   - Side-effect free and dependency free (plain TypeScript only).
 *
 * Conventions:
 *   - Rates are expressed as PERCENT (e.g. 10 means 10% per period), unless the
 *     parameter name explicitly says otherwise. Internally we convert to a
 *     decimal fraction (r = ratePct / 100).
 *   - `cashflows` is an ordered array of net flows for periods 1..N (period 0 is
 *     supplied separately as `initial`, sign-negative for an outlay).
 *   - Money is returned at full precision; callers decide rounding for display.
 *     `round2` is provided for the common 2-dp money case.
 */

// ---------------------------------------------------------------------------
// Helpers (canonical — do not duplicate)
// ---------------------------------------------------------------------------

/**
 * Clamp `value` into the inclusive range [min, max].
 * If min > max the bounds are treated as swapped (defensive, deterministic).
 */
export function clamp(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * Round to 2 decimal places (half-up on the conventional binary float),
 * the canonical money-display rounding. Returns 0 for non-finite input.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Internal: convert a percent rate to a decimal fraction. */
function toFraction(ratePct: number): number {
  return ratePct / 100;
}

// ---------------------------------------------------------------------------
// Time value of money — single cash amount (canonical — do not duplicate)
// ---------------------------------------------------------------------------

/**
 * Present value of a single future `value`, discounted at `ratePct` per period
 * over `periods` periods.
 *   PV = value / (1 + r)^periods
 */
export function pv(value: number, ratePct: number, periods: number): number {
  const r = toFraction(ratePct);
  return value / Math.pow(1 + r, periods);
}

/**
 * Future value of a single present `value`, compounded at `ratePct` per period
 * over `periods` periods.
 *   FV = value * (1 + r)^periods
 *
 * Invariant (and a test anchor): pv(fv(x, r, n), r, n) === x  and
 *   fv(pv(x, r, n), r, n) === x  (up to float epsilon).
 */
export function fv(value: number, ratePct: number, periods: number): number {
  const r = toFraction(ratePct);
  return value * Math.pow(1 + r, periods);
}

/**
 * Present value of an ordinary annuity: `periods` equal `payment`s, the first
 * occurring one period from now, discounted at `ratePct` per period.
 *   r === 0  → payment * periods
 *   r !== 0  → payment * (1 - (1 + r)^-periods) / r
 */
export function annuityPv(payment: number, ratePct: number, periods: number): number {
  const r = toFraction(ratePct);
  if (r === 0) return payment * periods;
  return (payment * (1 - Math.pow(1 + r, -periods))) / r;
}

// ---------------------------------------------------------------------------
// Project / investment appraisal (canonical — do not duplicate)
// ---------------------------------------------------------------------------

/**
 * Net Present Value.
 *
 * `initial` is the period-0 flow. Pass a *negative* number for an up-front
 * outlay (e.g. initial = -1000 for a $1000 investment). `cashflows[i]` is the
 * net flow for period i+1 (i.e. cashflows[0] is period 1).
 *
 *   NPV = initial + Σ_{t=1..N}  CF_t / (1 + r)^t
 */
export function npv(cashflows: number[], ratePct: number, initial = 0): number {
  const r = toFraction(ratePct);
  let acc = initial;
  for (let t = 0; t < cashflows.length; t++) {
    acc += cashflows[t] / Math.pow(1 + r, t + 1);
  }
  return acc;
}

/**
 * Internal Rate of Return — the periodic rate r* for which NPV = 0, returned as
 * a PERCENT. Convention matches {@link npv}: `initial` is the period-0 flow
 * (negative for an outlay), `cashflows` are periods 1..N.
 *
 * Solved with a robust bisection on the discount rate over a wide bracket
 * (-99.9% .. 100000%). Returns `NaN` when the cash-flow stream has no sign
 * change (no real IRR) or no root is bracketed — callers must handle NaN.
 *
 * Deterministic: fixed bracket, fixed iteration count, fixed tolerance.
 */
export function irr(cashflows: number[], initial = 0): number {
  const flows = [initial, ...cashflows];

  // An IRR exists only if there is at least one sign change in the stream.
  let hasPos = false;
  let hasNeg = false;
  for (const f of flows) {
    if (f > 0) hasPos = true;
    if (f < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return NaN;

  const npvAtFraction = (rate: number): number => {
    let acc = 0;
    for (let t = 0; t < flows.length; t++) {
      acc += flows[t] / Math.pow(1 + rate, t);
    }
    return acc;
  };

  // Bracket the root. Lower bound just above -100% (avoids div-by-zero/negative
  // base in the (1+rate) powers); upper bound very large to catch high IRRs.
  let lo = -0.999;
  let hi = 1000; // 100000%
  let fLo = npvAtFraction(lo);
  let fHi = npvAtFraction(hi);

  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return NaN;
  if (fLo === 0) return lo * 100;
  if (fHi === 0) return hi * 100;
  // Standard cash-flow shape (outflow then inflows) brackets a root here.
  if (fLo * fHi > 0) return NaN;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAtFraction(mid);
    if (Math.abs(fMid) < 1e-9 || (hi - lo) / 2 < 1e-9) {
      return mid * 100;
    }
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return ((lo + hi) / 2) * 100;
}

/**
 * Simple (undiscounted) payback period, in periods.
 *
 * `initial` is the magnitude of the up-front investment as a POSITIVE number
 * (e.g. payback([...], 1000) for a $1000 outlay). Returns the period at which
 * cumulative cash flow first covers the investment, with a fractional part for
 * partial recovery within the final period. Returns `NaN` if never recovered.
 */
export function payback(cashflows: number[], initial: number): number {
  let remaining = Math.abs(initial);
  for (let t = 0; t < cashflows.length; t++) {
    const cf = cashflows[t];
    if (cf >= remaining) {
      // Fractional recovery inside period (t+1). Guard cf === 0 (cf >= remaining
      // with remaining 0 already returned below).
      const fraction = cf === 0 ? 0 : remaining / cf;
      return t + fraction;
    }
    remaining -= cf;
  }
  if (remaining <= 0) return 0;
  return NaN;
}

/**
 * Discounted payback period, in periods. Same convention as {@link payback}, but
 * each period's flow is discounted at `ratePct` before being applied against the
 * (positive) `initial` investment. Returns `NaN` if never recovered.
 */
export function discountedPayback(cashflows: number[], ratePct: number, initial: number): number {
  const r = toFraction(ratePct);
  let remaining = Math.abs(initial);
  for (let t = 0; t < cashflows.length; t++) {
    const discounted = cashflows[t] / Math.pow(1 + r, t + 1);
    if (discounted >= remaining) {
      const fraction = discounted === 0 ? 0 : remaining / discounted;
      return t + fraction;
    }
    remaining -= discounted;
  }
  if (remaining <= 0) return 0;
  return NaN;
}

/**
 * Profitability Index (PI), aka benefit-cost ratio.
 *
 *   PI = PV(future inflows) / |initial outlay|
 *
 * `initial` is the period-0 outlay; its magnitude is the denominator. Returns
 * `NaN` when the outlay is zero (PI undefined). PI > 1 ⇔ positive NPV.
 */
export function profitabilityIndex(cashflows: number[], ratePct: number, initial: number): number {
  const outlay = Math.abs(initial);
  if (outlay === 0) return NaN;
  const pvInflows = npv(cashflows, ratePct, 0); // initial excluded → pure inflow PV
  return pvInflows / outlay;
}

// ---------------------------------------------------------------------------
// Growth & ratio primitives (canonical — do not duplicate)
// ---------------------------------------------------------------------------

/**
 * Compound Annual Growth Rate, returned as a PERCENT.
 *   CAGR = ((end / begin)^(1/years) - 1) * 100
 *
 * Returns `NaN` when `begin <= 0` or `years <= 0` (CAGR undefined for a
 * non-positive base or non-positive horizon).
 */
export function cagr(begin: number, end: number, years: number): number {
  if (begin <= 0 || years <= 0) return NaN;
  return (Math.pow(end / begin, 1 / years) - 1) * 100;
}

/**
 * Margin (ratio) as a PERCENT: numerator / denominator * 100.
 * Returns `NaN` when `denominator === 0` (margin undefined).
 * e.g. margin(grossProfit, revenue) → gross margin %.
 */
export function margin(numerator: number, denominator: number): number {
  if (denominator === 0) return NaN;
  return (numerator / denominator) * 100;
}

/**
 * Period-over-period growth rate as a PERCENT: (curr - prev) / |prev| * 100.
 * Uses |prev| in the denominator so the sign of the growth reflects the
 * direction of change even when `prev` is negative.
 * Returns `NaN` when `prev === 0` (growth rate undefined from a zero base).
 */
export function growthRate(prev: number, curr: number): number {
  if (prev === 0) return NaN;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ---------------------------------------------------------------------------
// Canonical namespace export (ergonomic single-import surface)
// ---------------------------------------------------------------------------

/**
 * Grouped export for callers that prefer a single namespaced import:
 *   import { financeCalcEngine } from '.../financeCalcEngine.js';
 *   financeCalcEngine.npv(...)
 */
export const financeCalcEngine = {
  npv,
  irr,
  payback,
  discountedPayback,
  profitabilityIndex,
  pv,
  fv,
  annuityPv,
  cagr,
  margin,
  growthRate,
  clamp,
  round2,
} as const;

export default financeCalcEngine;
