/**
 * Balanced Scorecard (Kaplan–Norton) — pure functions.
 *
 * Groups KPIs into the 4 canonical perspectives and computes per-perspective
 * health plus an overall "balanced" view. No I/O, no DB — pure & deterministic.
 */

export type Perspective = 'financial' | 'customer' | 'process' | 'learning';

export const PERSPECTIVES: readonly Perspective[] = [
  'financial',
  'customer',
  'process',
  'learning',
] as const;

export type BscKpiStatus = 'on-target' | 'below' | 'no-data';

export interface BscKpi {
  id: string;
  name: string;
  perspective: Perspective;
  status?: BscKpiStatus;
  value?: number;
  target?: number;
}

export interface PerspectiveHealth {
  count: number;
  onTarget: number;
  below: number;
  noData: number;
  healthPct: number;
}

export interface BscOverview {
  perspectives: Record<Perspective, PerspectiveHealth>;
  overallHealthPct: number;
  balanced: boolean;
}

/** Treat a KPI's status as one of the three buckets, deriving from value/target when absent. */
function effectiveStatus(kpi: BscKpi): BscKpiStatus {
  if (kpi.status) return kpi.status;
  if (
    kpi.value == null ||
    kpi.target == null ||
    !Number.isFinite(kpi.value) ||
    !Number.isFinite(kpi.target)
  ) {
    return 'no-data';
  }
  return (kpi.value as number) >= (kpi.target as number) ? 'on-target' : 'below';
}

/**
 * Group KPIs by perspective. All 4 perspectives are always present in the
 * result (empty arrays when no KPIs match).
 */
export function groupByPerspective(kpis: BscKpi[]): Record<Perspective, BscKpi[]> {
  const grouped: Record<Perspective, BscKpi[]> = {
    financial: [],
    customer: [],
    process: [],
    learning: [],
  };
  for (const kpi of kpis) {
    (grouped[kpi.perspective] ?? grouped.process).push(kpi);
  }
  return grouped;
}

/**
 * Per-perspective health. healthPct = onTarget / measured, where measured =
 * count of KPIs that are NOT no-data. Perspectives with no measured KPIs get 0.
 */
export function perspectiveHealth(kpis: BscKpi[]): Record<Perspective, PerspectiveHealth> {
  const grouped = groupByPerspective(kpis);
  const result = {} as Record<Perspective, PerspectiveHealth>;

  for (const perspective of PERSPECTIVES) {
    const list = grouped[perspective];
    let onTarget = 0;
    let below = 0;
    let noData = 0;
    for (const kpi of list) {
      const status = effectiveStatus(kpi);
      if (status === 'on-target') onTarget += 1;
      else if (status === 'below') below += 1;
      else noData += 1;
    }
    const measured = onTarget + below;
    result[perspective] = {
      count: list.length,
      onTarget,
      below,
      noData,
      healthPct: measured > 0 ? onTarget / measured : 0,
    };
  }

  return result;
}

/**
 * Whole-scorecard overview. overallHealthPct = onTarget / measured across all
 * perspectives. balanced = every perspective has at least 1 KPI.
 */
export function bscOverview(kpis: BscKpi[]): BscOverview {
  const perspectives = perspectiveHealth(kpis);

  let totalOnTarget = 0;
  let totalMeasured = 0;
  let balanced = true;

  for (const perspective of PERSPECTIVES) {
    const h = perspectives[perspective];
    totalOnTarget += h.onTarget;
    totalMeasured += h.onTarget + h.below;
    if (h.count < 1) balanced = false;
  }

  return {
    perspectives,
    overallHealthPct: totalMeasured > 0 ? totalOnTarget / totalMeasured : 0,
    balanced,
  };
}

const PERSPECTIVE_KEYWORDS: Array<{ perspective: Perspective; keywords: string[] }> = [
  {
    perspective: 'financial',
    keywords: ['koszt', 'przychód', 'przychod', 'marża', 'marza', 'cost', 'revenue', 'margin', 'profit', 'roi'],
  },
  {
    perspective: 'customer',
    keywords: ['klient', 'nps', 'satysfakcja', 'customer', 'client', 'satisfaction', 'retention'],
  },
  {
    perspective: 'process',
    keywords: ['czas', 'cykl', 'jakość', 'jakosc', 'proces', 'time', 'cycle', 'quality', 'process', 'throughput'],
  },
  {
    perspective: 'learning',
    keywords: ['szkolenie', 'kompetencja', 'kompetencje', 'rozwój', 'rozwoj', 'training', 'competence', 'skill', 'growth', 'learning'],
  },
];

/**
 * Heuristic mapping of a KPI name to a perspective by keyword match.
 * Defaults to 'process' when nothing matches.
 */
export function inferPerspective(kpiName: string): Perspective {
  const name = (kpiName || '').toLowerCase();
  for (const { perspective, keywords } of PERSPECTIVE_KEYWORDS) {
    if (keywords.some((kw) => name.includes(kw))) return perspective;
  }
  return 'process';
}
