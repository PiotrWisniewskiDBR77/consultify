/**
 * M15/W5 — strategic-view route.
 *
 * GET /api/results-strategic/:projectId/strategic — gathers the org's
 * initiatives + KPIs + initiative↔KPI mappings and composes the strategic
 * payload: Balanced Scorecard (BSC) + Benefits Dependency Network (BDN) +
 * value narrative. Org-wide when projectId is 'all'/'null'/absent. Read-only.
 */
import { Router, type Response } from 'express';

import verifyToken from '../middleware/auth.middleware.js';
import {
  buildStrategicView,
  type StrategicInitiative,
  type StrategicInitiativeToKpi,
  type StrategicKpi,
} from '../services/results/resultsStrategicViewService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import { asyncHandler } from '../utils/asyncHandler.js';

interface AuthedRequest {
  user?: { organizationId?: string };
  params: Record<string, string>;
}

interface InitiativeRow {
  id: string;
  name: string;
}

interface KpiRow {
  id: string;
  name: string;
  current_value: number | null;
  target_value: number | null;
  measurement_frequency: string | null;
}

interface MappingRow {
  initiative_id: string;
  kpi_id: string;
}

const router = Router();

router.get(
  '/:projectId/strategic',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, error: 'organization context required' });
      return;
    }
    const projectId = req.params.projectId;
    const orgWide =
      !projectId ||
      projectId === 'all' ||
      projectId === 'null' ||
      projectId === 'undefined';

    const initiativeRows = ((await dbAll(
      orgWide
        ? `SELECT id, name FROM initiatives WHERE organization_id = ?`
        : `SELECT id, name FROM initiatives WHERE project_id = ? AND organization_id = ?`,
      orgWide ? [orgId] : [projectId, orgId]
    )) as InitiativeRow[] | undefined) || [];

    const kpiRows = ((await dbAll(
      `SELECT id, name, current_value, target_value, measurement_frequency
       FROM initiative_kpis WHERE organization_id = ?`,
      [orgId]
    )) as KpiRow[] | undefined) || [];

    const mappingRows = ((await dbAll(
      `SELECT initiative_id, kpi_id
       FROM initiative_kpi_mappings WHERE organization_id = ?`,
      [orgId]
    )) as MappingRow[] | undefined) || [];

    const initiatives: StrategicInitiative[] = initiativeRows.map((r) => ({
      id: r.id,
      name: r.name,
    }));

    const kpis: StrategicKpi[] = kpiRows.map((r) => ({
      id: r.id,
      name: r.name,
      value: r.current_value ?? undefined,
      target: r.target_value ?? undefined,
    }));

    const initiativeToKpi: StrategicInitiativeToKpi[] = mappingRows.map((r) => ({
      initiativeId: r.initiative_id,
      kpiId: r.kpi_id,
    }));

    const data = buildStrategicView({ kpis, initiatives, initiativeToKpi });
    // Return the bare payload (not {success,data}): the FE Api proxy maps
    // `response.data` to the whole payload, so a wrapper would hide the fields.
    res.json(data);
  })
);

export default router;
