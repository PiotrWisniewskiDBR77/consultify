/**
 * M15/W2 task 2.3 — driver-tree route.
 *
 * GET /api/results-driver-tree/:projectId/driver-tree
 * Builds the Value Driver Tree from initiative_kpis + initiative_kpi_mappings.
 * Returns nodes (objective/driver/kpi/initiative) with rolled-up values and edges.
 *
 * BUG-17: synthetic objective + driver (BSC category) nodes when none in DB.
 * BUG-18: rollUpTree() to populate rolledUpValue + confidence + stats.coveredValue.
 * BUG-12: edges aliased with `from`/`to` for frontend compatibility.
 */
import { Router, type Response } from 'express';

import verifyToken from '../middleware/auth.middleware.js';
import {
  buildTreeFromMappings,
  rollUpTree,
  type BuildTreeInput,
} from '../services/results/valueDriverTreeService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import { asyncHandler } from '../utils/asyncHandler.js';

interface AuthedRequest {
  user?: { organizationId?: string };
  params: Record<string, string>;
}

const CATEGORY_LABELS: Record<string, string> = {
  financial: 'Finansowe',
  customer: 'Klienci',
  internal: 'Procesy wewnętrzne',
  learning: 'Rozwój i uczenie się',
  process: 'Procesy wewnętrzne',
  growth: 'Wzrost',
};

function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return 'Pozostałe';
  const key = cat.toLowerCase().trim();
  return CATEGORY_LABELS[key] ?? cat;
}

const router = Router();

router.get(
  '/:projectId/driver-tree',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, error: 'organization context required' });
      return;
    }
    const projectId = req.params.projectId;
    const orgWide =
      !projectId || projectId === 'all' || projectId === 'null' || projectId === 'undefined';

    const initiatives = ((await dbAll(
      orgWide
        ? `SELECT id, name FROM initiatives WHERE organization_id = ?`
        : `SELECT id, name FROM initiatives WHERE project_id = ? AND organization_id = ?`,
      orgWide ? [orgId] : [projectId, orgId]
    )) as Array<{ id: string; name: string }>) || [];

    const kpis = ((await dbAll(
      `SELECT id, name, category, current_value, target_value, baseline_value
       FROM initiative_kpis WHERE organization_id = ?`,
      [orgId]
    )) as Array<{
      id: string;
      name: string;
      category: string | null;
      current_value: number | null;
      target_value: number | null;
      baseline_value: number | null;
    }>) || [];

    const mappings = ((await dbAll(
      `SELECT initiative_id, kpi_id FROM initiative_kpi_mappings WHERE organization_id = ?`,
      [orgId]
    )) as Array<{ initiative_id: string; kpi_id: string }>) || [];

    // BUG-17: build synthetic driver nodes from KPI categories
    // Group KPIs by category → one driver node per unique category
    const categorySet = new Set<string>();
    for (const k of kpis) {
      categorySet.add(k.category?.toLowerCase().trim() || '__other__');
    }
    const categoryToDriverId = new Map<string, string>();
    for (const cat of categorySet) {
      categoryToDriverId.set(cat, `driver_cat_${cat}`);
    }

    // One synthetic objective at the top
    const syntheticObjectiveId = 'objective_root';
    const syntheticObjectives = [{ id: syntheticObjectiveId, label: 'Wyniki biznesowe', value: null }];

    const syntheticDrivers = Array.from(categoryToDriverId.entries()).map(([cat, driverId]) => ({
      id: driverId,
      label: cat === '__other__' ? 'Pozostałe' : categoryLabel(cat),
      value: null,
    }));

    // ALL KPIs connect to their category's driver node.
    // Initiative→KPI edges are for display only; value rollup uses KPI's own current_value.
    const kpiToDriverEdges = kpis.map((k) => {
      const cat = k.category?.toLowerCase().trim() || '__other__';
      const driverId = categoryToDriverId.get(cat)!;
      return { kpiId: String(k.id), driverId };
    });

    const input: BuildTreeInput = {
      objectives: syntheticObjectives,
      financialLines: syntheticDrivers,
      initiatives: initiatives.map((i) => ({ id: String(i.id), name: i.name })),
      kpis: kpis.map((k) => ({
        id: String(k.id),
        name: k.name,
        baseline: k.baseline_value != null ? Number(k.baseline_value) : undefined,
        target: k.target_value != null ? Number(k.target_value) : undefined,
        current: k.current_value != null ? Number(k.current_value) : undefined,
      })),
      // kpiToFinancial drives KPI→driver edges (reuse the driver id as statementLineId)
      kpiToFinancial: kpiToDriverEdges.map((e) => ({
        kpiId: e.kpiId,
        statementLineId: e.driverId,
        multiplier: 1,
      })),
      initiativeToKpi: mappings.map((m) => ({
        initiativeId: String(m.initiative_id),
        kpiId: String(m.kpi_id),
      })),
    };

    // Override objective/financial nodes to use our synthetic objective at top
    // buildTreeFromMappings maps financialLines→driver type, objectives→objective type
    // driver→objective edges are added automatically when objectives.length > 0
    const { nodes: rawNodes, edges: rawEdges } = buildTreeFromMappings(input);

    // BUG-18: KPI current_value is the meaningful metric; initiatives have no monetary value.
    // Roll up only through objective→driver→KPI edges so KPI current_value propagates upward.
    // Initiative→KPI edges are kept in rawEdges for visualization but excluded from rollup.
    const rollupEdges = rawEdges.filter((e) => {
      const fromNode = rawNodes.find((n) => n.id === e.fromId);
      return fromNode?.type !== 'initiative';
    });

    const rolledNodes = rollUpTree(rawNodes, rollupEdges);

    // BUG-18: confidence per KPI = current/target ratio (capped at 1)
    const progressByKpiId = new Map<string, number>();
    for (const k of kpis) {
      if (k.current_value != null && k.target_value != null && k.target_value !== 0) {
        progressByKpiId.set(String(k.id), Math.min(Number(k.current_value) / Number(k.target_value), 1));
      }
    }

    const enrichedNodes = rolledNodes.map((n) => {
      const base: Record<string, unknown> = {
        id: n.id,
        type: n.type,
        label: n.label,
        value: n.value ?? undefined,
        rolledUpValue: n.rolledUpValue,
      };
      if (n.type === 'kpi') {
        const conf = progressByKpiId.get(n.id);
        if (conf != null) base['confidence'] = conf;
        if (n.baseline != null) base['baseline'] = n.baseline;
        if (n.target != null) base['target'] = n.target;
        if (n.current != null) base['current'] = n.current;
      }
      return base;
    });

    // BUG-12: alias edges from/to for frontend
    const enrichedEdges = rawEdges.map((e) => ({
      from: e.fromId,
      to: e.toId,
      fromId: e.fromId,
      toId: e.toId,
      weight: e.weight,
    }));

    // BUG-18: coveredValue = sum of rolledUpValue of all kpi nodes
    const kpiNodes = rolledNodes.filter((n) => n.type === 'kpi');
    const coveredValue = kpiNodes.reduce((s, n) => s + (n.rolledUpValue ?? 0), 0);

    const stats = {
      totalNodes: enrichedNodes.length,
      objectiveCount: enrichedNodes.filter((n) => n['type'] === 'objective').length,
      driverCount: enrichedNodes.filter((n) => n['type'] === 'driver').length,
      kpiCount: enrichedNodes.filter((n) => n['type'] === 'kpi').length,
      initiativeCount: enrichedNodes.filter((n) => n['type'] === 'initiative').length,
      coveredValue,
    };

    res.json({ nodes: enrichedNodes, edges: enrichedEdges, stats });
  })
);

export default router;
