/**
 * M15/W5 — strategic-view route.
 *
 * GET /api/results-strategic/:projectId/strategic — gathers the org's
 * initiatives + KPIs + initiative↔KPI mappings and composes the strategic
 * payload: Balanced Scorecard (BSC) + Benefits Dependency Network (BDN) +
 * value narrative. Org-wide when projectId is 'all'/'null'/absent. Read-only.
 */
import { Router, type Response } from 'express';

import verifyToken, { type AuthRequest } from '../middleware/auth.middleware.js';
import { requireProjectCapability } from '../middleware/effectiveCapability.middleware.js';
import {
  cascadeRollup,
  okrSummary,
  createCycle,
  listCycles,
  closeCycle,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  createCheckIn,
  listCheckIns,
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

// ─── CRUD (D7 slice) ────────────────────────────────────────────────────────
// Objectives/Key Results/Cycles/Check-ins — role-gating is SHADOW (log-only)
// per the Faza 1 capability rollout (effectiveCapability.middleware.ts):
// zero blocking until CAPABILITY_ENFORCE=enforce is flipped from data.
// projectId in the URL is 'all'/'null'/absent for org-wide OKRs — mirrors the
// GET /:projectId/strategic convention above; resolved to null in that case
// so the capability check runs org-wide (allowWithoutProject).
function resolveOkrProjectId(req: AuthRequest): string | null {
  const projectId = req.params?.projectId;
  if (!projectId || projectId === 'all' || projectId === 'null' || projectId === 'undefined') {
    return null;
  }
  return projectId;
}

function getOkrOrgId(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ success: false, error: 'organization context required' });
    return null;
  }
  return orgId;
}

// ─── Cycles ─────────────────────────────────────────────────────────────

router.get(
  '/:projectId/okr/cycles',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const cycles = await listCycles(orgId);
    res.json({ cycles });
  }),
);

router.post(
  '/:projectId/okr/cycles',
  verifyToken,
  requireProjectCapability('okr.cycle.create', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const { name, periodYear, periodQuarter, deptId, teamId } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    const year = Number(periodYear);
    if (!Number.isFinite(year)) {
      res.status(400).json({ success: false, error: 'periodYear is required' });
      return;
    }
    const cycle = await createCycle({
      organizationId: orgId,
      name,
      periodYear: year,
      periodQuarter: periodQuarter != null ? Number(periodQuarter) : null,
      deptId: deptId ?? null,
      teamId: teamId ?? null,
      createdBy: req.user?.id ?? null,
    });
    res.status(201).json({ success: true, cycle });
  }),
);

router.post(
  '/:projectId/okr/cycles/:cycleId/close',
  verifyToken,
  requireProjectCapability('okr.cycle.close', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const result = await closeCycle(req.params.cycleId, orgId);
    if (!result) {
      res.status(404).json({ success: false, error: 'cycle not found' });
      return;
    }
    res.json({ success: true, ...result });
  }),
);

// ─── Objectives ─────────────────────────────────────────────────────────

router.post(
  '/:projectId/okr/objectives',
  verifyToken,
  requireProjectCapability('okr.objective.create', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const { label, parentId, cycleId, ownerUserId, description } = req.body ?? {};
    if (!label || typeof label !== 'string') {
      res.status(400).json({ success: false, error: 'label is required' });
      return;
    }
    const resolvedProjectId = resolveOkrProjectId(req);
    const { id } = await createObjective({
      organizationId: orgId,
      label,
      projectId: resolvedProjectId,
      parentId: parentId ?? null,
      cycleId: cycleId ?? null,
      ownerUserId: ownerUserId ?? null,
      description: description ?? null,
    });
    res.status(201).json({ success: true, id });
  }),
);

router.patch(
  '/:projectId/okr/objectives/:id',
  verifyToken,
  requireProjectCapability('okr.objective.update', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const { label, parentId, cycleId, ownerUserId, description, status } = req.body ?? {};
    const updated = await updateObjective(req.params.id, orgId, {
      label,
      parentId,
      cycleId,
      ownerUserId,
      description,
      status,
    });
    if (!updated) {
      res.status(404).json({ success: false, error: 'objective not found or no changes' });
      return;
    }
    res.json({ success: true });
  }),
);

router.delete(
  '/:projectId/okr/objectives/:id',
  verifyToken,
  requireProjectCapability('okr.objective.delete', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const deleted = await deleteObjective(req.params.id, orgId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'objective not found' });
      return;
    }
    res.json({ success: true });
  }),
);

// ─── Key Results ────────────────────────────────────────────────────────

router.post(
  '/:projectId/okr/objectives/:id/key-results',
  verifyToken,
  requireProjectCapability('okr.keyresult.create', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const { label, baseline, target, current, weight, kpiId, krType, kind, ownerUserId } =
      req.body ?? {};
    if (!label || typeof label !== 'string') {
      res.status(400).json({ success: false, error: 'label is required' });
      return;
    }
    if (krType && krType !== 'metric' && krType !== 'milestone') {
      res.status(400).json({ success: false, error: 'krType must be metric|milestone' });
      return;
    }
    if (kind && kind !== 'committed' && kind !== 'aspirational') {
      res.status(400).json({ success: false, error: 'kind must be committed|aspirational' });
      return;
    }
    const result = await createKeyResult({
      objectiveId: req.params.id,
      organizationId: orgId,
      label,
      baseline: baseline != null ? Number(baseline) : null,
      target: target != null ? Number(target) : null,
      current: current != null ? Number(current) : null,
      weight: weight != null ? Number(weight) : null,
      kpiId: kpiId ?? null,
      krType,
      kind,
      ownerUserId: ownerUserId ?? null,
    });
    res.status(201).json({ success: true, ...result });
  }),
);

router.patch(
  '/:projectId/okr/key-results/:id',
  verifyToken,
  requireProjectCapability('okr.keyresult.update', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const { label, baseline, target, current, weight, kpiId, krType, kind, ownerUserId } =
      req.body ?? {};
    if (krType && krType !== 'metric' && krType !== 'milestone') {
      res.status(400).json({ success: false, error: 'krType must be metric|milestone' });
      return;
    }
    if (kind && kind !== 'committed' && kind !== 'aspirational') {
      res.status(400).json({ success: false, error: 'kind must be committed|aspirational' });
      return;
    }
    const result = await updateKeyResult(req.params.id, orgId, {
      label,
      baseline: baseline != null ? Number(baseline) : baseline,
      target: target != null ? Number(target) : target,
      current: current != null ? Number(current) : current,
      weight: weight != null ? Number(weight) : weight,
      kpiId,
      krType,
      kind,
      ownerUserId,
    });
    if (!result.updated) {
      res.status(404).json({ success: false, error: 'key result not found' });
      return;
    }
    res.json({ success: true, score: result.score });
  }),
);

router.delete(
  '/:projectId/okr/key-results/:id',
  verifyToken,
  requireProjectCapability('okr.keyresult.delete', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const deleted = await deleteKeyResult(req.params.id, orgId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'key result not found' });
      return;
    }
    res.json({ success: true });
  }),
);

// ─── Check-ins ──────────────────────────────────────────────────────────

router.get(
  '/:projectId/okr/key-results/:id/check-ins',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const checkIns = await listCheckIns(req.params.id, orgId);
    res.json({ checkIns });
  }),
);

router.post(
  '/:projectId/okr/key-results/:id/check-in',
  verifyToken,
  requireProjectCapability('okr.checkin.create', resolveOkrProjectId, {
    shadow: true,
    allowWithoutProject: true,
  }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const { confidence, value, score, note } = req.body ?? {};
    if (confidence && !['green', 'amber', 'red'].includes(confidence)) {
      res.status(400).json({ success: false, error: 'confidence must be green|amber|red' });
      return;
    }
    const result = await createCheckIn({
      keyResultId: req.params.id,
      organizationId: orgId,
      confidence: confidence ?? null,
      value: value != null ? Number(value) : null,
      score: score != null ? Number(score) : null,
      note: note ?? null,
      checkedBy: req.user?.id ?? null,
    });
    if (!result) {
      res.status(404).json({ success: false, error: 'key result not found' });
      return;
    }
    res.status(201).json({ success: true, ...result });
  }),
);

export default router;
