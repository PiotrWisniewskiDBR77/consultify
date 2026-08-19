export const EXECUTION_HEALTH_FORMULA_VERSION = 'execution-health-v1' as const;

export type CanonicalExecutionRag = 'GREEN' | 'AMBER' | 'RED' | 'NA';

export type CanonicalExecutionHealthInput = {
  progressPct?: number | null;
  taskCompletionPct?: number | null;
  decisionHealthPct?: number | null;
  riskHealthPct?: number | null;
  spi?: number | null;
  cpi?: number | null;
  criticalPathPercent?: number | null;
  overdueCriticalCount?: number | null;
};

export type CanonicalExecutionHealth = {
  formulaVersion: typeof EXECUTION_HEALTH_FORMULA_VERSION;
  score: number | null;
  rag: CanonicalExecutionRag;
  components: {
    progress?: number;
    tasks?: number;
    decisions?: number;
    risks?: number;
    schedule?: number;
    cost?: number;
  };
};

const finite = (value: number | null | undefined): value is number => Number.isFinite(value);
const clampPct = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Normalize an EVM performance index without changing the already-shipped
 * traffic-light doctrine: >=0.95 GREEN, >=0.85 AMBER, otherwise RED. The
 * normalized scores (100/70/40) then flow through the same common aggregate
 * thresholds as every non-EVM component.
 */
export function normalizePerformanceIndex(value: number | null | undefined): number | undefined {
  if (!finite(value) || value < 0) return undefined;
  if (value >= 0.95) return 100;
  if (value >= 0.85) return 70;
  return 40;
}

export function executionHealthRag(score: number | null): CanonicalExecutionRag {
  if (!finite(score)) return 'NA';
  if (score >= 80) return 'GREEN';
  if (score >= 60) return 'AMBER';
  return 'RED';
}

export function computeCanonicalExecutionHealth(
  input: CanonicalExecutionHealthInput,
): CanonicalExecutionHealth {
  const components: CanonicalExecutionHealth['components'] = {};
  if (finite(input.progressPct)) components.progress = clampPct(input.progressPct);
  if (finite(input.taskCompletionPct)) components.tasks = clampPct(input.taskCompletionPct);
  if (finite(input.decisionHealthPct)) components.decisions = clampPct(input.decisionHealthPct);
  if (finite(input.riskHealthPct)) components.risks = clampPct(input.riskHealthPct);

  const scheduleFromEvm = normalizePerformanceIndex(input.spi);
  if (scheduleFromEvm != null) {
    components.schedule = scheduleFromEvm;
  } else if (finite(input.criticalPathPercent) || finite(input.overdueCriticalCount)) {
    const critical = finite(input.criticalPathPercent) ? input.criticalPathPercent : 0;
    const overdue = finite(input.overdueCriticalCount) ? input.overdueCriticalCount : 0;
    components.schedule = critical > 50 || overdue > 1 ? 40 : critical >= 30 || overdue > 0 ? 70 : 100;
  }

  const costFromEvm = normalizePerformanceIndex(input.cpi);
  if (costFromEvm != null) components.cost = costFromEvm;

  const values = Object.values(components);
  const score = values.length > 0
    ? clampPct(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
  return {
    formulaVersion: EXECUTION_HEALTH_FORMULA_VERSION,
    score,
    rag: executionHealthRag(score),
    components,
  };
}
