/**
 * Capital Decision Service (M16/4.1 + 4.3)
 *
 * Pure-function capital-allocation primitives — zero DB, zero IO.
 *
 *   4.1 Hurdle-Rate         — WACC + risk-class premium → minimum acceptable return
 *   4.3 Risk-adjusted NPV   — rNPV = NPV × P(success) × (1 − leakage), with haircut
 *       evaluateAgainstHurdle — IRR vs hurdle → go / borderline / kill verdict
 *       rankByRiskAdjusted    — portfolio ranking by rNPV (descending)
 *
 * Conventions:
 *   - Rates (wacc, hurdle, irr) and premiums are expressed in percentage POINTS (pp),
 *     e.g. a 12% WACC is `12`, a +4pp premium adds `4`.
 *   - Probabilities and leakage are fractions in [0, 1] (e.g. 0.7 = 70%).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type RiskClass = 'core' | 'transformation' | 'rd';

export interface RiskAdjustedNpvResult {
  /** Risk-adjusted NPV = npv × P × (1 − leakage). */
  rnpv: number;
  /** Value discarded by risk/leakage adjustment = npv − rnpv. */
  haircut: number;
}

export type HurdleVerdict = 'go' | 'borderline' | 'kill';

export interface HurdleEvaluation {
  verdict: HurdleVerdict;
  /** IRR minus hurdle, in percentage points. */
  marginPp: number;
}

export interface RankableItem {
  id: string;
  npv: number;
  /** Probability of success, fraction in [0, 1]. */
  probabilityOfSuccess: number;
  /** Optional value leakage, fraction in [0, 1]. Defaults to 0. */
  leakagePct?: number;
}

export interface RankedItem extends RankableItem {
  rnpv: number;
  haircut: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Clamp a fraction into the [0, 1] range. */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Normalize a risk-class label to the canonical {@link RiskClass}.
 * Accepts EN/PL aliases: 'rdzeń'→core, 'new_market'→rd.
 */
function normalizeRiskClass(riskClass: string): RiskClass {
  const key = String(riskClass).trim().toLowerCase();
  switch (key) {
    case 'core':
    case 'rdzeń':
    case 'rdzen':
      return 'core';
    case 'transformation':
    case 'transformacja':
      return 'transformation';
    case 'rd':
    case 'r&d':
    case 'r_d':
    case 'new_market':
    case 'newmarket':
      return 'rd';
    default:
      // Unknown class is treated as the most conservative (highest premium).
      return 'rd';
  }
}

// ─── 4.1 Hurdle-Rate ──────────────────────────────────────────────────────────

/** Risk premium added to WACC per risk class, in percentage points. */
export const RISK_PREMIUM_PP: Record<RiskClass, number> = {
  core: 0,
  transformation: 4,
  rd: 10,
};

/**
 * Hurdle rate = WACC + risk-class premium (both in percentage points).
 *
 *   core / rdzeń       → +0 pp
 *   transformation     → +4 pp
 *   rd / new_market    → +10 pp
 */
export function hurdleRate(wacc: number, riskClass: RiskClass | string): number {
  const base = Number.isFinite(wacc) ? wacc : 0;
  const cls = normalizeRiskClass(riskClass);
  return base + RISK_PREMIUM_PP[cls];
}

// ─── 4.3 Risk-adjusted NPV (rNPV) ─────────────────────────────────────────────

/**
 * Risk-adjusted NPV.
 *
 *   rnpv    = npv × P(success) × (1 − leakage)
 *   haircut = npv − rnpv
 *
 * @param npv                 Base (deterministic) NPV.
 * @param probabilityOfSuccess Fraction in [0, 1].
 * @param leakagePct          Fraction in [0, 1]; defaults to 0.
 */
export function riskAdjustedNpv(
  npv: number,
  probabilityOfSuccess: number,
  leakagePct: number = 0
): RiskAdjustedNpvResult {
  const base = Number.isFinite(npv) ? npv : 0;
  const p = clamp01(probabilityOfSuccess);
  const leakage = clamp01(leakagePct);

  const rnpv = base * p * (1 - leakage);
  const haircut = base - rnpv;

  return { rnpv, haircut };
}

// ─── Hurdle evaluation ────────────────────────────────────────────────────────

/**
 * Evaluate an IRR against a hurdle rate (both in percentage points).
 *
 *   margin > 2pp  → 'go'
 *   margin >= 0   → 'borderline'
 *   margin < 0    → 'kill'
 */
export function evaluateAgainstHurdle(irr: number, hurdle: number): HurdleEvaluation {
  const safeIrr = Number.isFinite(irr) ? irr : 0;
  const safeHurdle = Number.isFinite(hurdle) ? hurdle : 0;
  const marginPp = safeIrr - safeHurdle;

  let verdict: HurdleVerdict;
  if (marginPp > 2) {
    verdict = 'go';
  } else if (marginPp >= 0) {
    verdict = 'borderline';
  } else {
    verdict = 'kill';
  }

  return { verdict, marginPp };
}

// ─── Portfolio ranking ────────────────────────────────────────────────────────

/**
 * Rank items by risk-adjusted NPV (descending).
 * Returns a new array with `rnpv` and `haircut` attached to each item;
 * the input is not mutated.
 */
export function rankByRiskAdjusted<T extends RankableItem>(items: T[]): (T & RankedItem)[] {
  const enriched = (items ?? []).map((item) => {
    const { rnpv, haircut } = riskAdjustedNpv(
      item.npv,
      item.probabilityOfSuccess,
      item.leakagePct ?? 0
    );
    return { ...item, rnpv, haircut };
  });

  enriched.sort((a, b) => b.rnpv - a.rnpv);
  return enriched;
}
