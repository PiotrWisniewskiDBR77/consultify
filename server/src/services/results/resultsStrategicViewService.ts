/**
 * resultsStrategicViewService — M15/W5 strategic-view composition (pure).
 *
 * Composes three strategic results services into a single payload for the
 * board-level strategic view:
 *  - bsc       : Balanced Scorecard overview (Kaplan–Norton, 4 perspectives),
 *  - bdn       : Benefits Dependency Network graph (Cranfield) + stats,
 *  - narrative : deterministic value narrative for leadership.
 *
 * Pure & deterministic: no DB, no I/O — same input yields the same output.
 * KPIs lacking an explicit perspective are mapped via inferPerspective(name).
 */
import {
  type BscKpi,
  type BscKpiStatus,
  type BscOverview,
  bscOverview,
  inferPerspective,
  type Perspective,
} from './balancedScorecardService.js';
import {
  type BdnEdge,
  type BdnNode,
  type BdnStats,
  bdnStats,
  buildBdn,
} from './benefitsDependencyNetworkService.js';
import { buildNarrative, type ValueNarrative } from './valueNarrativeService.js';

export interface StrategicKpi {
  id: string;
  name: string;
  perspective?: Perspective;
  status?: BscKpiStatus;
  value?: number;
  target?: number;
}

export interface StrategicInitiative {
  id: string;
  name: string;
}

export interface StrategicInitiativeToKpi {
  initiativeId: string;
  kpiId: string;
}

export interface StrategicScorecard {
  banked: number;
  inFlight: number;
  atRisk: number;
  totalTarget: number;
  pctOfTarget: number;
}

export interface BuildStrategicViewInput {
  kpis: StrategicKpi[];
  initiatives: StrategicInitiative[];
  initiativeToKpi: StrategicInitiativeToKpi[];
  scorecard?: StrategicScorecard;
}

export interface StrategicView {
  bsc: BscOverview;
  bdn: {
    nodes: BdnNode[];
    edges: BdnEdge[];
    stats: BdnStats;
  };
  narrative: ValueNarrative;
}

const ZERO_SCORECARD: StrategicScorecard = {
  banked: 0,
  inFlight: 0,
  atRisk: 0,
  totalTarget: 0,
  pctOfTarget: 0,
};

/**
 * Composes the strategic view from M15 entities. Each KPI without an explicit
 * perspective is assigned one heuristically from its name (inferPerspective),
 * so the Balanced Scorecard always groups across all 4 perspectives.
 */
export function buildStrategicView(input: BuildStrategicViewInput): StrategicView {
  const kpis = input.kpis ?? [];
  const initiatives = input.initiatives ?? [];
  const initiativeToKpi = input.initiativeToKpi ?? [];

  // BSC: ensure every KPI has a perspective (infer from name when absent).
  const bscKpis: BscKpi[] = kpis.map((kpi) => ({
    id: kpi.id,
    name: kpi.name,
    perspective: kpi.perspective ?? inferPerspective(kpi.name),
    status: kpi.status,
    value: kpi.value,
    target: kpi.target,
  }));
  const bsc = bscOverview(bscKpis);

  // BDN: initiatives = enablers, KPIs = benefits, links = enabler→benefit edges.
  const graph = buildBdn({
    initiatives: initiatives.map((i) => ({ id: i.id, name: i.name })),
    kpis: kpis.map((k) => ({ id: k.id, name: k.name })),
    initiativeToKpi: initiativeToKpi.map((link) => ({
      initiativeId: link.initiativeId,
      kpiId: link.kpiId,
    })),
  });
  const stats = bdnStats(graph.nodes, graph.edges);

  // Narrative: from the supplied scorecard aggregates, or zeros when absent.
  const narrative = buildNarrative(input.scorecard ?? ZERO_SCORECARD);

  return {
    bsc,
    bdn: { nodes: graph.nodes, edges: graph.edges, stats },
    narrative,
  };
}

export default { buildStrategicView };
