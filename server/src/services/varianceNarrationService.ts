/**
 * Variance Narration Service (M16/8.2)
 *
 * Pure, RULE-BASED (no LLM) generation of CFO-grade variance narration from a
 * plan-vs-actual variance bridge. Deterministic and fully unit-testable.
 *
 * LLM-enhancement (richer prose, tone, recommendations) is a planned follow-up
 * layered ON TOP of these primitives — these functions are the deterministic
 * spine that grounds any future LLM narration.
 *
 * Sign convention
 * ───────────────
 * A "variance" on a single line is the signed gap between actual and plan,
 * normalised so that a POSITIVE variance always means "favourable":
 *
 *   - Revenue / income line  (isCost = false):  variance = actual - plan
 *       (beating revenue plan → positive → favourable)
 *   - Cost / expense line     (isCost = true):  variance = plan - actual
 *       (spending less than planned → positive → favourable)
 *
 * The bridge total variance is the sum of these favourable-signed line variances,
 * i.e. the net bottom-line effect of all deviations.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VarianceBridgeLine {
  /** Human label of the line item, e.g. "Revenue", "COGS", "Marketing". */
  label: string;
  /** Planned / budgeted amount. */
  plan: number;
  /** Actual realised amount. */
  actual: number;
  /** True for cost/expense lines (lower actual is favourable). */
  isCost?: boolean;
}

export type VarianceBridge = VarianceBridgeLine[];

export type VarianceDirection = 'favorable' | 'unfavorable' | 'neutral';

export interface VarianceDriver {
  /** The line label. */
  line: string;
  /** Favourable-signed variance contribution of this line (currency units). */
  contribution: number;
  /** Share of total absolute variance this line accounts for, 0–100. */
  pct: number;
  /** Whether this line helped (favorable) or hurt (unfavorable) the bottom line. */
  direction: VarianceDirection;
}

export interface VarianceNarration {
  /** One-line CFO headline with amount + dominant driver share. */
  headline: string;
  /** Top drivers sorted by absolute contribution (descending). */
  drivers: VarianceDriver[];
  /** Descriptive multi-sentence commentary. */
  commentary: string;
}

export interface TopVarianceDriver {
  /** The line label. */
  line: string;
  /** Favourable-signed variance of this line (currency units). */
  variance: number;
  /** Share of total absolute variance, 0–100. */
  sharePct: number;
}

export type VarianceSeverity = 'on-track' | 'watch' | 'off-track';

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Favourable-signed variance of a single bridge line. */
function lineVariance(line: VarianceBridgeLine): number {
  const plan = Number.isFinite(line.plan) ? line.plan : 0;
  const actual = Number.isFinite(line.actual) ? line.actual : 0;
  return line.isCost ? plan - actual : actual - plan;
}

/** Sum of |plan| across the bridge — the denominator for severity & shares. */
function totalAbsPlan(bridge: VarianceBridge): number {
  return bridge.reduce((sum, l) => sum + Math.abs(Number.isFinite(l.plan) ? l.plan : 0), 0);
}

function directionOf(variance: number): VarianceDirection {
  if (variance > 0) return 'favorable';
  if (variance < 0) return 'unfavorable';
  return 'neutral';
}

function roundTo(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Format a currency-ish amount compactly and deterministically (no locale). */
function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `${roundTo(abs / 1_000_000, 1)}M`;
  else if (abs >= 1_000) body = `${roundTo(abs / 1_000, 1)}k`;
  else body = `${roundTo(abs, 0)}`;
  return `${value < 0 ? '-' : ''}${body}`;
}

function fmtPct(value: number): string {
  return `${roundTo(value, 1)}%`;
}

// ─── 1. narrateVariance ──────────────────────────────────────────────────────

/**
 * Generate a full CFO narration from a variance bridge.
 *
 * @param bridge plan/actual lines
 * @returns headline, sorted drivers, and descriptive commentary
 */
export function narrateVariance(bridge: VarianceBridge): VarianceNarration {
  const lines = Array.isArray(bridge) ? bridge : [];

  if (lines.length === 0) {
    return {
      headline: 'No variance data available.',
      drivers: [],
      commentary: 'The variance bridge is empty — nothing to narrate.',
    };
  }

  // Net bottom-line variance (favourable-signed sum).
  const netVariance = lines.reduce((sum, l) => sum + lineVariance(l), 0);
  const totalAbs = lines.reduce((sum, l) => sum + Math.abs(lineVariance(l)), 0);
  const planBase = totalAbsPlan(lines);
  const netPctOfPlan = planBase > 0 ? (netVariance / planBase) * 100 : 0;

  // All drivers, sorted by absolute contribution descending (stable by label).
  const drivers: VarianceDriver[] = lines
    .map((l) => {
      const contribution = lineVariance(l);
      return {
        line: l.label,
        contribution: roundTo(contribution),
        pct: totalAbs > 0 ? roundTo((Math.abs(contribution) / totalAbs) * 100, 1) : 0,
        direction: directionOf(contribution),
      };
    })
    .sort((a, b) => {
      const d = Math.abs(b.contribution) - Math.abs(a.contribution);
      if (d !== 0) return d;
      return a.line.localeCompare(b.line);
    });

  const top = drivers[0];
  const netDir = netVariance > 0 ? 'favorably' : netVariance < 0 ? 'unfavorably' : 'neutrally';

  // Headline: "Budget swung -120k (-8.0%), 62% driven by COGS."
  let headline: string;
  if (netVariance === 0 && totalAbs === 0) {
    headline = 'Budget on plan — no material variance.';
  } else if (top && top.pct > 0) {
    headline = `Budget swung ${fmtAmount(roundTo(netVariance))} (${fmtPct(
      netPctOfPlan
    )}), ${fmtPct(top.pct)} driven by ${top.line}.`;
  } else {
    headline = `Budget swung ${fmtAmount(roundTo(netVariance))} (${fmtPct(netPctOfPlan)}).`;
  }

  // Commentary: net effect + name the top favourable & unfavourable drivers.
  const worst = [...drivers]
    .filter((d) => d.direction === 'unfavorable')
    .sort((a, b) => a.contribution - b.contribution)[0];
  const best = [...drivers]
    .filter((d) => d.direction === 'favorable')
    .sort((a, b) => b.contribution - a.contribution)[0];

  const parts: string[] = [];
  parts.push(
    `Actuals deviated ${netDir} from plan by ${fmtAmount(
      roundTo(netVariance)
    )} (${fmtPct(netPctOfPlan)} of planned base).`
  );
  if (worst) {
    parts.push(
      `The largest drag was ${worst.line} at ${fmtAmount(
        worst.contribution
      )} (${fmtPct(worst.pct)} of total variance).`
    );
  }
  if (best) {
    parts.push(
      `Offsetting it, ${best.line} contributed ${fmtAmount(
        best.contribution
      )} favorably (${fmtPct(best.pct)} of total variance).`
    );
  }
  const severity = varianceSeverity(lines);
  parts.push(
    severity === 'on-track'
      ? 'Overall the budget is on track.'
      : severity === 'watch'
        ? 'This warrants monitoring.'
        : 'This is materially off-track and needs action.'
  );

  return {
    headline,
    drivers,
    commentary: parts.join(' '),
  };
}

// ─── 2. topVarianceDrivers ───────────────────────────────────────────────────

/**
 * Return the n bridge lines with the largest absolute variance contribution,
 * together with each line's share (%) of the total absolute variance.
 *
 * @param bridge plan/actual lines
 * @param n max number of drivers (default 3)
 */
export function topVarianceDrivers(bridge: VarianceBridge, n = 3): TopVarianceDriver[] {
  const lines = Array.isArray(bridge) ? bridge : [];
  if (lines.length === 0 || n <= 0) return [];

  const totalAbs = lines.reduce((sum, l) => sum + Math.abs(lineVariance(l)), 0);

  return lines
    .map((l) => {
      const variance = lineVariance(l);
      return {
        line: l.label,
        variance: roundTo(variance),
        sharePct: totalAbs > 0 ? roundTo((Math.abs(variance) / totalAbs) * 100, 1) : 0,
      };
    })
    .sort((a, b) => {
      const d = Math.abs(b.variance) - Math.abs(a.variance);
      if (d !== 0) return d;
      return a.line.localeCompare(b.line);
    })
    .slice(0, n);
}

// ─── 3. varianceSeverity ─────────────────────────────────────────────────────

/**
 * Classify overall budget health by net |variance| as a fraction of the
 * planned base (sum of |plan|):
 *
 *   - on-track:  < 5%
 *   - watch:     5% – 15%
 *   - off-track: ≥ 15%
 *
 * @param bridge plan/actual lines
 */
export function varianceSeverity(bridge: VarianceBridge): VarianceSeverity {
  const lines = Array.isArray(bridge) ? bridge : [];
  const planBase = totalAbsPlan(lines);
  if (planBase <= 0) return 'on-track';

  const netVariance = lines.reduce((sum, l) => sum + lineVariance(l), 0);
  const ratio = Math.abs(netVariance) / planBase;

  if (ratio < 0.05) return 'on-track';
  if (ratio < 0.15) return 'watch';
  return 'off-track';
}
