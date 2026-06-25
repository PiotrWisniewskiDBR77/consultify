/**
 * M15/W2 task 2.3 — driver-tree route.
 *
 * GET /api/results-driver-tree/:projectId/driver-tree
 * Builds the Value Driver Tree from initiative_kpis + initiative_kpi_mappings.
 * Returns nodes (objective/driver/kpi/initiative) with rolled-up values and edges.
 */
import { Router, type Response } from 'express';

import verifyToken from '../middleware/auth.middleware.js';
import {
  buildTreeFromMappings,
  treeStats,
  type BuildTreeInput,
} from '../services/results/valueDriverTreeService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import { asyncHandler } from '../utils/asyncHandler.js';

interface AuthedRequest {
  user?: { organizationId?: string };
  params: Record<string, string>;
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
      `SELECT id, name, current_value, target_value FROM initiative_kpis WHERE organization_id = ?`,
      [orgId]
    )) as Array<{ id: string; name: string; current_value: number | null; target_value: number | null }>) || [];

    const mappings = ((await dbAll(
      `SELECT initiative_id, kpi_id FROM initiative_kpi_mappings WHERE organization_id = ?`,
      [orgId]
    )) as Array<{ initiative_id: string; kpi_id: string }>) || [];

    // Try to get financial mappings for financial weighting
    let financialMappings: Array<{ kpi_id: string; annual_impact: number | null }> = [];
    try {
      financialMappings = ((await dbAll(
        `SELECT kpi_id, annual_impact FROM kpi_financial_mappings WHERE organization_id = ?`,
        [orgId]
      )) as Array<{ kpi_id: string; annual_impact: number | null }>) || [];
    } catch {
      // table may not exist; proceed without
    }

    const impactByKpi = new Map<string, number>();
    for (const fm of financialMappings) {
      if (fm.kpi_id && fm.annual_impact != null) {
        impactByKpi.set(String(fm.kpi_id), (impactByKpi.get(String(fm.kpi_id)) || 0) + Number(fm.annual_impact));
      }
    }

    const input: BuildTreeInput = {
      objectives: [],
      initiatives: initiatives.map((i) => ({ id: String(i.id), name: i.name })),
      kpis: kpis.map((k) => ({
        id: String(k.id),
        name: k.name,
        value: k.current_value != null ? Number(k.current_value) : undefined,
        target: k.target_value != null ? Number(k.target_value) : undefined,
        financialImpact: impactByKpi.get(String(k.id)),
      })),
      initiativeToKpi: mappings.map((m) => ({
        initiativeId: String(m.initiative_id),
        kpiId: String(m.kpi_id),
      })),
    };

    const { nodes, edges } = buildTreeFromMappings(input);
    const stats = treeStats(nodes);
    res.json({ nodes, edges, stats });
  })
);

export default router;
