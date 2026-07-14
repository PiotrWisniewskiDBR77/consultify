/**
 * Portfolio Prioritization Service (M16/4.2)
 *
 * Pure functions that turn a set of initiatives into an NPV × risk
 * "bubble board". The board plots each initiative on a bubble chart:
 *   - x axis = risk (0..1)
 *   - y axis = NPV
 *   - bubble size = effort / nakład
 *
 * Quadrants are derived from the MEDIAN of NPV and the MEDIAN of risk
 * across the supplied set:
 *   - high NPV + low  risk -> 'fund'      (zielony / inwestuj)
 *   - high NPV + high risk -> 'evaluate'  (oceń / due diligence)
 *   - low  NPV + low  risk -> 'quick_win' (szybka wygrana)
 *   - low  NPV + high risk -> 'defer'     (odłóż)
 *
 * Ranking sorts by value-over-risk: npv / (1 + risk), descending.
 *
 * No I/O, no DB, no side effects — easy to unit test and reuse on FE.
 */

export type Quadrant = 'fund' | 'evaluate' | 'quick_win' | 'defer';

export interface PortfolioInitiativeInput {
  id: string;
  name?: string;
  /** Net Present Value (any currency unit). Higher = better. */
  npv: number;
  /** Risk score in the range 0..1 (clamped). */
  risk: number;
  /** Effort / nakład (relative units). Drives bubble size. */
  effort: number;
  /** Optional strategic fit in the range 0..1. */
  strategicFit?: number;
}

export interface PrioritizedInitiative {
  id: string;
  name?: string;
  npv: number;
  risk: number;
  effort: number;
  strategicFit?: number;
  quadrant: Quadrant;
  /** 1-based rank, sorted by npv / (1 + risk) descending. */
  rank: number;
}

export interface BubblePoint {
  id: string;
  /** risk (0..1) */
  x: number;
  /** npv */
  y: number;
  /** effort / nakład */
  size: number;
  /** quadrant color token */
  color: string;
  label: string;
}

/** Quadrant -> color token used by the PortfolioBubble component. */
export const QUADRANT_COLORS: Record<Quadrant, string> = {
  fund: '#16a34a', // green — invest
  evaluate: '#f59e0b', // amber — assess
  quick_win: '#2563eb', // blue — quick win
  defer: '#6b7280', // gray — defer
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Median of a numeric array. Returns 0 for an empty array. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** value-over-risk score used for ranking. */
function valueOverRisk(npv: number, risk: number): number {
  return npv / (1 + risk);
}

function quadrantFor(npv: number, risk: number, npvMedian: number, riskMedian: number): Quadrant {
  const highNpv = npv >= npvMedian;
  const highRisk = risk > riskMedian;
  if (highNpv && !highRisk) return 'fund';
  if (highNpv && highRisk) return 'evaluate';
  if (!highNpv && !highRisk) return 'quick_win';
  return 'defer';
}

/**
 * Prioritize a portfolio of initiatives into an NPV × risk board.
 *
 * Quadrants are computed against the median NPV and median risk of the
 * supplied set. Rank is assigned by npv / (1 + risk), descending.
 */
export function prioritize(initiatives: PortfolioInitiativeInput[]): PrioritizedInitiative[] {
  if (!Array.isArray(initiatives) || initiatives.length === 0) return [];

  const normalized = initiatives.map((it) => ({
    id: it.id,
    name: it.name,
    npv: toFiniteNumber(it.npv),
    risk: clamp01(it.risk),
    effort: toFiniteNumber(it.effort),
    strategicFit: it.strategicFit === undefined ? undefined : clamp01(it.strategicFit),
  }));

  const npvMedian = median(normalized.map((it) => it.npv));
  const riskMedian = median(normalized.map((it) => it.risk));

  // Stable ranking: sort by value/risk desc, tie-break by npv desc then id.
  const ranked = [...normalized].sort((a, b) => {
    const vorA = valueOverRisk(a.npv, a.risk);
    const vorB = valueOverRisk(b.npv, b.risk);
    if (vorB !== vorA) return vorB - vorA;
    if (b.npv !== a.npv) return b.npv - a.npv;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const rankById = new Map<string, number>();
  ranked.forEach((it, index) => rankById.set(it.id, index + 1));

  return normalized.map((it) => ({
    id: it.id,
    name: it.name,
    npv: it.npv,
    risk: it.risk,
    effort: it.effort,
    strategicFit: it.strategicFit,
    quadrant: quadrantFor(it.npv, it.risk, npvMedian, riskMedian),
    rank: rankById.get(it.id) ?? 0,
  }));
}

/**
 * Shape the prioritized portfolio for the PortfolioBubble component.
 *   x = risk, y = npv, size = effort, color = quadrant color.
 */
export function bubbleData(initiatives: PortfolioInitiativeInput[]): BubblePoint[] {
  return prioritize(initiatives).map((it) => ({
    id: it.id,
    x: it.risk,
    y: it.npv,
    size: it.effort,
    color: QUADRANT_COLORS[it.quadrant],
    label: it.name ?? it.id,
  }));
}
