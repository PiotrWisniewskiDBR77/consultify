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
  cascadeRollup,
  okrSummary,
  type Objective,
  type KeyResult,
} from '../services/results/okrService.js';
import {
  buildStrategicView,
  type StrategicInitiative,
  type StrategicInitiativeToKpi,
  type StrategicKpi,
} from '../services/results/resultsStrategicViewService.js';
import { all as dbAll, exec as dbExec } from '../utils/DbPromise.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * D10: OKR cascade tables (lazy-DDL so staging+demo provision on first hit —
 * no separate migration deploy needed). objectives → key_results, org-scoped.
 */
let okrTablesReady = false;
async function ensureOkrTables(): Promise<void> {
  if (okrTablesReady) return;
  await dbExec(`
    CREATE TABLE IF NOT EXISTS okr_objectives (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      label TEXT NOT NULL,
      parent_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS okr_key_results (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      label TEXT NOT NULL,
      baseline DOUBLE PRECISION,
      target DOUBLE PRECISION,
      current DOUBLE PRECISION,
      weight DOUBLE PRECISION,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  okrTablesReady = true;
}

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

// ─── GET /okr ─────────────────────────────────────────────────────────────
// D10: OKR cascade — Objectives → Key Results, cascade roll-up + summary.
// Reads okr_objectives + okr_key_results (lazy-provisioned). Empty → graceful.
router.get(
  '/:projectId/okr',
  verifyToken,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, error: 'organization context required' });
      return;
    }
    await ensureOkrTables();

    const objRows = ((await dbAll(
      `SELECT id, label, parent_id FROM okr_objectives WHERE organization_id = ?`,
      [orgId],
    )) as Array<{ id: string; label: string; parent_id: string | null }>) || [];
    const krRows = ((await dbAll(
      `SELECT id, objective_id, label, baseline, target, current, weight
       FROM okr_key_results WHERE organization_id = ?`,
      [orgId],
    )) as Array<{
      id: string; objective_id: string; label: string;
      baseline: number | null; target: number | null; current: number | null; weight: number | null;
    }>) || [];

    const krByObjective = new Map<string, KeyResult[]>();
    for (const k of krRows) {
      const list = krByObjective.get(String(k.objective_id)) ?? [];
      list.push({
        id: String(k.id),
        label: k.label,
        baseline: k.baseline ?? undefined,
        target: k.target ?? undefined,
        current: k.current ?? undefined,
        weight: k.weight ?? undefined,
      });
      krByObjective.set(String(k.objective_id), list);
    }

    const objectives: Objective[] = objRows.map((o) => ({
      id: String(o.id),
      label: o.label,
      parentId: o.parent_id ?? undefined,
      keyResults: krByObjective.get(String(o.id)) ?? [],
    }));

    const cascaded = cascadeRollup(objectives);
    const summary = okrSummary(objectives);
    res.json({ objectives: cascaded, summary });
  }),
);

export default router;
