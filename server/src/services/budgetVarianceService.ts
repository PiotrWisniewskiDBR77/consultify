/**
 * Budget-vs-Actual Variance Bridge
 *
 * Pure, side-effect-free finance functions for budget variance analysis —
 * the planning-vs-realization gap that every FP&A review opens with.
 *
 *   1. lineVariance     — single line plan→actual delta + favorable/unfavorable
 *   2. varianceBridge   — plan→actual waterfall (steps for <FinanceWaterfall/>)
 *   3. ytdVariance      — cumulative year-to-date plan/actual roll-up
 *   4. varianceSummary  — portfolio-level counts, net variance, worst offenders
 *
 * Sign convention:
 *   Δ (variance) = actual − plan
 *   For a COST line: actual < plan is FAVORABLE (we underspent / saved money).
 *   For a REVENUE line: actual > plan is FAVORABLE (we over-earned).
 *   Δ === 0 → neutral.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type VarianceDirection = 'favorable' | 'unfavorable' | 'neutral';

export interface LineVariance {
  variance: number;
  variancePct: number;
  direction: VarianceDirection;
}

export type WaterfallStepKind = 'start' | 'increase' | 'decrease' | 'total';

export interface WaterfallStep {
  label: string;
  value: number;
  kind: WaterfallStepKind;
}

export interface VarianceLineInput {
  label: string;
  plan: number;
  actual: number;
  isCost: boolean;
}

export interface VarianceBridge {
  steps: WaterfallStep[];
  totalVariance: number;
}

export interface PeriodInput {
  plan: number;
  actual: number;
}

export interface YtdVariance {
  ytdPlan: number;
  ytdActual: number;
  ytdVariance: number;
  ytdVariancePct: number;
}

export interface WorstLine {
  label: string;
  variance: number;
  variancePct: number;
  direction: VarianceDirection;
}

export interface VarianceSummary {
  favorableCount: number;
  unfavorableCount: number;
  netVariance: number;
  worstLines: WorstLine[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const num = (n: number): number => (Number.isFinite(n) ? n : 0);

function round4(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Map a delta to a direction given whether the line is a cost.
 * Cost: spending less than plan (Δ<0) is favorable.
 * Revenue: earning more than plan (Δ>0) is favorable.
 */
function directionFor(delta: number, isCost: boolean): VarianceDirection {
  if (delta === 0) return 'neutral';
  const goodWhenNegative = isCost;
  if (goodWhenNegative) {
    return delta < 0 ? 'favorable' : 'unfavorable';
  }
  return delta > 0 ? 'favorable' : 'unfavorable';
}

// ─── 1. Line variance ─────────────────────────────────────────────────────────

export function lineVariance(plan: number, actual: number, isCost: boolean): LineVariance {
  const p = num(plan);
  const a = num(actual);
  const variance = round4(a - p);

  const variancePct = p === 0 ? 0 : round4((a - p) / Math.abs(p));

  return {
    variance,
    variancePct,
    direction: directionFor(variance, isCost),
  };
}

// ─── 2. Variance bridge (plan → actual waterfall) ─────────────────────────────

/**
 * Build a plan→actual waterfall.
 *   start: total plan
 *   per-line bar: signed by direction — favorable bars push toward a better
 *     outcome (increase, green), unfavorable bars push the wrong way (decrease).
 *     The step `value` is the favorability-signed magnitude:
 *       favorable → +|Δ|, unfavorable → −|Δ|, neutral → 0.
 *   total: actual total (closing bar).
 *
 * totalVariance is the plain sum of line deltas (actual − plan), summed across
 * lines (== actualTotal − planTotal).
 */
export function varianceBridge(lines: VarianceLineInput[]): VarianceBridge {
  const safe = Array.isArray(lines) ? lines : [];

  const planTotal = round4(safe.reduce((sum, l) => sum + num(l.plan), 0));
  const actualTotal = round4(safe.reduce((sum, l) => sum + num(l.actual), 0));

  const steps: WaterfallStep[] = [];
  steps.push({ label: 'Plan', value: planTotal, kind: 'start' });

  for (const l of safe) {
    const lv = lineVariance(l.plan, l.actual, l.isCost);
    const magnitude = Math.abs(lv.variance);

    let value: number;
    let kind: WaterfallStepKind;
    if (lv.direction === 'favorable') {
      value = round4(magnitude);
      kind = 'increase';
    } else if (lv.direction === 'unfavorable') {
      value = round4(-magnitude);
      kind = 'decrease';
    } else {
      value = 0;
      kind = 'increase';
    }

    steps.push({ label: l.label, value, kind });
  }

  steps.push({ label: 'Actual', value: actualTotal, kind: 'total' });

  return {
    steps,
    totalVariance: round4(actualTotal - planTotal),
  };
}

// ─── 3. Year-to-date variance ─────────────────────────────────────────────────

export function ytdVariance(periods: PeriodInput[]): YtdVariance {
  const safe = Array.isArray(periods) ? periods : [];

  const ytdPlan = round4(safe.reduce((sum, p) => sum + num(p.plan), 0));
  const ytdActual = round4(safe.reduce((sum, p) => sum + num(p.actual), 0));
  const ytdVar = round4(ytdActual - ytdPlan);
  const ytdVariancePct = ytdPlan === 0 ? 0 : round4((ytdActual - ytdPlan) / Math.abs(ytdPlan));

  return {
    ytdPlan,
    ytdActual,
    ytdVariance: ytdVar,
    ytdVariancePct,
  };
}

// ─── 4. Variance summary ───────────────────────────────────────────────────────

export function varianceSummary(lines: VarianceLineInput[]): VarianceSummary {
  const safe = Array.isArray(lines) ? lines : [];

  let favorableCount = 0;
  let unfavorableCount = 0;
  let netVariance = 0;

  const worst: WorstLine[] = [];

  for (const l of safe) {
    const lv = lineVariance(l.plan, l.actual, l.isCost);
    netVariance += lv.variance;

    if (lv.direction === 'favorable') favorableCount += 1;
    else if (lv.direction === 'unfavorable') unfavorableCount += 1;

    worst.push({
      label: l.label,
      variance: lv.variance,
      variancePct: lv.variancePct,
      direction: lv.direction,
    });
  }

  // Worst = largest unfavorable swings first; favorable/neutral sink to the bottom.
  const worstLines = worst
    .sort((a, b) => {
      const rank = (d: VarianceDirection) => (d === 'unfavorable' ? 0 : d === 'neutral' ? 1 : 2);
      const r = rank(a.direction) - rank(b.direction);
      if (r !== 0) return r;
      // Within the same bucket, larger absolute variance first.
      return Math.abs(b.variance) - Math.abs(a.variance);
    })
    .slice(0, 5);

  return {
    favorableCount,
    unfavorableCount,
    netVariance: round4(netVariance),
    worstLines,
  };
}
