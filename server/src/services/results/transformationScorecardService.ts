/**
 * Transformation Scorecard (M15/W4 — 4.1 + 4.2)
 *
 * Pure aggregation layer behind the FINAL M15 product: a one-screen board-level
 * narrative — "transformation delivered X PLN (Y% of target), Z in flight, W at risk".
 *
 * Zero DB, zero IO — deterministic functions over portfolio benefit items so they
 * can be unit-tested and reused by any caller (route, snapshot, deck generator).
 */

export interface ScorecardItem {
  id: string;
  name?: string;
  /** Planned/committed value for this benefit. */
  targetValue?: number | null;
  /** Value already banked (delivered & verified). */
  realizedValue?: number | null;
  /** Forecast value not yet banked. */
  forecastValue?: number | null;
  /** 0..1 confidence in the forecast. */
  confidence?: number;
  /** Item is flagged as at-risk. */
  atRisk?: boolean;
}

export interface ScorecardInput {
  items: ScorecardItem[];
}

export interface Scorecard {
  /** Sum of realized value across all items. */
  banked: number;
  /** Sum of forecast for non-at-risk, not-yet-realized items. */
  inFlight: number;
  /** Sum of forecast for at-risk items. */
  atRisk: number;
  /** Sum of target value across all items. */
  totalTarget: number;
  /** (banked + inFlight) / totalTarget. */
  pctOfTarget: number;
  /** banked / totalTarget. */
  bankedPct: number;
  itemCount: number;
}

export interface TopBenefit {
  id: string;
  name?: string;
  realizedValue: number;
}

export interface TopRisk {
  id: string;
  name?: string;
  atRiskValue: number;
}

export interface WaterfallInput {
  baseline: number;
  increments: Array<{ label: string; delta: number }>;
}

export type WaterfallStepType = 'base' | 'increase' | 'decrease' | 'total';

export interface WaterfallStep {
  label: string;
  from: number;
  to: number;
  delta: number;
  type: WaterfallStepType;
}

/** Coerce any value to a finite number, defaulting to 0. */
function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Aggregate a portfolio of benefit items into the board scorecard.
 *
 * - banked    = Σ realizedValue
 * - inFlight  = Σ forecastValue for items NOT at-risk and NOT yet realized
 * - atRisk    = Σ forecastValue for at-risk items
 * - totalTarget = Σ targetValue
 * - pctOfTarget = (banked + inFlight) / totalTarget
 * - bankedPct   = banked / totalTarget
 */
export function buildScorecard(input: ScorecardInput): Scorecard {
  const items = Array.isArray(input?.items) ? input.items : [];

  let banked = 0;
  let inFlight = 0;
  let atRisk = 0;
  let totalTarget = 0;

  for (const item of items) {
    const realized = num(item?.realizedValue);
    const forecast = num(item?.forecastValue);

    banked += realized;
    totalTarget += num(item?.targetValue);

    if (item?.atRisk) {
      atRisk += forecast;
    } else if (realized <= 0) {
      // not yet realized → still in flight
      inFlight += forecast;
    }
  }

  const pctOfTarget = totalTarget > 0 ? (banked + inFlight) / totalTarget : 0;
  const bankedPct = totalTarget > 0 ? banked / totalTarget : 0;

  return {
    banked,
    inFlight,
    atRisk,
    totalTarget,
    pctOfTarget,
    bankedPct,
    itemCount: items.length,
  };
}

/**
 * Top N benefits by realized (banked) value, descending.
 * Items with no realized value still count but rank lowest.
 */
export function topBenefits(items: ScorecardItem[], n = 5): TopBenefit[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item) => ({
      id: item.id,
      name: item.name,
      realizedValue: num(item?.realizedValue),
    }))
    .sort((a, b) => b.realizedValue - a.realizedValue)
    .slice(0, Math.max(0, n));
}

/**
 * Top N at-risk items by forecast value, descending.
 * Only items flagged atRisk are considered.
 */
export function topRisks(items: ScorecardItem[], n = 5): TopRisk[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .filter((item) => Boolean(item?.atRisk))
    .map((item) => ({
      id: item.id,
      name: item.name,
      atRiskValue: num(item?.forecastValue),
    }))
    .sort((a, b) => b.atRiskValue - a.atRiskValue)
    .slice(0, Math.max(0, n));
}

/**
 * Build a value waterfall: baseline → running increments → final total.
 *
 * Emits a leading 'base' step, one step per increment ('increase' for delta >= 0,
 * 'decrease' for delta < 0), and a trailing 'total' step that subtotals everything.
 */
export function valueWaterfall(input: WaterfallInput): WaterfallStep[] {
  const baseline = num(input?.baseline);
  const increments = Array.isArray(input?.increments) ? input.increments : [];

  const steps: WaterfallStep[] = [];

  // Base step: from 0 to baseline.
  steps.push({
    label: 'Baseline',
    from: 0,
    to: baseline,
    delta: baseline,
    type: 'base',
  });

  let running = baseline;
  for (const inc of increments) {
    const delta = num(inc?.delta);
    const from = running;
    const to = running + delta;
    steps.push({
      label: inc?.label ?? '',
      from,
      to,
      delta,
      type: delta < 0 ? 'decrease' : 'increase',
    });
    running = to;
  }

  // Total step: full bar from 0 to the running subtotal.
  steps.push({
    label: 'Total',
    from: 0,
    to: running,
    delta: running,
    type: 'total',
  });

  return steps;
}
