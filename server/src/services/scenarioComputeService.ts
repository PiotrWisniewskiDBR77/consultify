/**
 * scenarioComputeService — Multi-Scenario Compute (M16/5.2)
 *
 * Pure, side-effect-free assumption-modifier layer that brings the dead
 * base / optimistic / conservative scenario tabs to life. The financial
 * engine (`financialModelingService`) computes a single run; this layer
 * wraps it by mutating a COPY of the assumptions per scenario, then runs
 * an injected compute function over each variant so the FE can show three
 * real, distinct projections instead of one duplicated everywhere.
 *
 * Intentionally decoupled from `financialModelingService.ts` to avoid
 * merge collisions — it never imports or mutates that module.
 */

export type ScenarioName = 'base' | 'optimistic' | 'conservative';

export interface ScenarioModifier {
  /** Multiplier applied to growth / revenue style assumption fields. */
  growthMult: number;
  /** Multiplier applied to cost / opex / cogs style assumption fields. */
  costMult: number;
}

/**
 * Per-scenario multipliers.
 * - optimistic: revenue grows faster (1.15), costs shrink (0.95)
 * - conservative: revenue grows slower (0.85), costs swell (1.05)
 */
export const SCENARIO_MODIFIERS: Record<ScenarioName, ScenarioModifier> = {
  base: { growthMult: 1, costMult: 1 },
  optimistic: { growthMult: 1.15, costMult: 0.95 },
  conservative: { growthMult: 0.85, costMult: 1.05 },
};

export const SCENARIO_NAMES: ScenarioName[] = ['base', 'optimistic', 'conservative'];

type Assumptions = Record<string, any>;

const GROWTH_PATTERNS = ['growth', 'revenue'];
const COST_PATTERNS = ['cost', 'opex', 'cogs'];

function matchesAny(key: string, patterns: string[]): boolean {
  const lower = key.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

/**
 * Deeply clone + scale an assumptions object for a given scenario.
 *
 * Generic field matching (case-insensitive substring):
 *   *growth* / *revenue* → multiplied by growthMult
 *   *cost*   / *opex* / *cogs* → multiplied by costMult
 *
 * Matching is applied recursively so nested structures (e.g. `baseline`)
 * are scaled too. Non-numeric values and unmatched fields are copied as-is.
 * The original object is never mutated.
 */
export function applyScenario(assumptions: Assumptions, scenario: ScenarioName): Assumptions {
  const modifier = SCENARIO_MODIFIERS[scenario] ?? SCENARIO_MODIFIERS.base;
  return scaleValue(assumptions, modifier, '') as Assumptions;
}

function scaleValue(value: any, modifier: ScenarioModifier, key: string): any {
  if (Array.isArray(value)) {
    return value.map((item) => scaleValue(item, modifier, key));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [childKey, childVal] of Object.entries(value)) {
      out[childKey] = scaleValue(childVal, modifier, childKey);
    }
    return out;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (matchesAny(key, GROWTH_PATTERNS)) {
      return value * modifier.growthMult;
    }
    if (matchesAny(key, COST_PATTERNS)) {
      return value * modifier.costMult;
    }
  }
  return value;
}

export interface ScenarioMetrics {
  [metric: string]: number;
}

export interface ScenarioComparison<M extends ScenarioMetrics = ScenarioMetrics> {
  base: M;
  optimistic: M;
  conservative: M;
  /** Per-scenario, per-metric absolute delta vs the base scenario. */
  deltas: {
    optimistic: ScenarioMetrics;
    conservative: ScenarioMetrics;
  };
}

/**
 * Run the injected compute function across all three scenarios and report
 * each scenario's metrics plus optimistic/conservative deltas vs base.
 *
 * `computeFn` receives the scenario-modified assumptions and must return a
 * flat map of numeric metrics (e.g. `{ revenue, ebitda, netIncome }`).
 */
export function compareScenarios<M extends ScenarioMetrics>(
  baseAssumptions: Assumptions,
  computeFn: (modified: Assumptions) => M
): ScenarioComparison<M> {
  const base = computeFn(applyScenario(baseAssumptions, 'base'));
  const optimistic = computeFn(applyScenario(baseAssumptions, 'optimistic'));
  const conservative = computeFn(applyScenario(baseAssumptions, 'conservative'));

  return {
    base,
    optimistic,
    conservative,
    deltas: {
      optimistic: diffMetrics(optimistic, base),
      conservative: diffMetrics(conservative, base),
    },
  };
}

function diffMetrics(variant: ScenarioMetrics, base: ScenarioMetrics): ScenarioMetrics {
  const out: ScenarioMetrics = {};
  const keys = new Set([...Object.keys(variant), ...Object.keys(base)]);
  for (const key of keys) {
    out[key] = (variant[key] ?? 0) - (base[key] ?? 0);
  }
  return out;
}

export interface ScenarioFanData {
  /** The base scenario's series for the requested metric. */
  base: number[];
  /** Upper/lower (and any extra) bands for the fan chart. */
  bands: Array<{ label: string; values: number[] }>;
}

/**
 * Shape per-scenario time-series into the structure expected by the
 * <ScenarioFan> component: a base line plus optimistic/conservative bands.
 *
 * `scenarios` maps each scenario name to a metric→series lookup, e.g.
 *   { base: { revenue: [..] }, optimistic: { revenue: [..] }, ... }
 */
export function scenarioFanData(
  scenarios: Partial<Record<ScenarioName, Record<string, number[]>>>,
  metric: string
): ScenarioFanData {
  const seriesFor = (name: ScenarioName): number[] => scenarios[name]?.[metric] ?? [];

  const bands: Array<{ label: string; values: number[] }> = [];
  if (scenarios.optimistic) {
    bands.push({ label: 'optimistic', values: seriesFor('optimistic') });
  }
  if (scenarios.conservative) {
    bands.push({ label: 'conservative', values: seriesFor('conservative') });
  }

  return {
    base: seriesFor('base'),
    bands,
  };
}
