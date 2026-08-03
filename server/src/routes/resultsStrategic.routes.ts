/**
 * M15/W5 — strategic-view route.
 *
 * GET /api/results-strategic/:projectId/strategic — gathers the org's
 * initiatives + KPIs + initiative↔KPI mappings and composes the strategic
 * payload: Balanced Scorecard (BSC) + Benefits Dependency Network (BDN) +
 * value narrative. Org-wide when projectId is 'all'/'null'/absent. Read-only.
 */
import { type Response, Router } from 'express';

import verifyToken, { type AuthRequest } from '../middleware/auth.middleware.js';
import { requireProjectCapability } from '../middleware/effectiveCapability.middleware.js';
import { kpiVisibilitySql } from '../services/results/kpiVisibilityService.js';
import {
  cascadeRollup,
  closeCycle,
  createCheckIn,
  createCycle,
  createKeyResult,
  createObjective,
  deleteKeyResult,
  deleteObjective,
  getSuggestedValueForKeyResult,
  type KeyResult,
  listCheckIns,
  listCycles,
  type Objective,
  okrSummary,
  updateKeyResult,
  updateObjective,
} from '../services/results/okrService.js';
import {
  buildStrategicView,
  type StrategicInitiative,
  type StrategicInitiativeToKpi,
  type StrategicKpi,
} from '../services/results/resultsStrategicViewService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, exec as dbExec } from '../utils/DbPromise.js';

/**
 * D10: OKR cascade tables (lazy-DDL so staging+demo provision on first hit —
 * no separate migration deploy needed). objectives → key_results, org-scoped.
 *
 * D7 slice (migration 914) extends this with cycles/check-ins + extra columns
 * on the two base tables. Re-declared here (idempotent ADD COLUMN IF NOT
 * EXISTS / CREATE TABLE IF NOT EXISTS) so the CRUD routes below are
 * self-sufficient even on an environment where migration 914 hasn't deployed
 * yet — mirrors the migration file's own "self-sufficient on a fresh DB"
 * intent, just in the other direction (route provisions ahead of migration).
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
  await dbExec(`
    CREATE TABLE IF NOT EXISTS okr_cycles (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      period_quarter INTEGER,
      period_year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      dept_id TEXT,
      team_id TEXT,
      closed_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS okr_check_ins (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      key_result_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      confidence TEXT,
      value DOUBLE PRECISION,
      score DOUBLE PRECISION,
      note TEXT,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checked_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await dbExec(`ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS cycle_id TEXT;`);
  await dbExec(`ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS owner_user_id TEXT;`);
  await dbExec(`ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS description TEXT;`);
  await dbExec(
    `ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';`
  );
  await dbExec(
    `ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();`
  );
  await dbExec(`ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kpi_id TEXT;`);
  await dbExec(
    `ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kpi_definition_version_id TEXT;`
  );
  await dbExec(
    `ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kr_type TEXT NOT NULL DEFAULT 'metric';`
  );
  await dbExec(
    `ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION NOT NULL DEFAULT 0;`
  );
  await dbExec(
    `ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'aspirational';`
  );
  await dbExec(`ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS owner_user_id TEXT;`);
  await dbExec(
    `ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();`
  );
  okrTablesReady = true;
}

interface AuthedRequest {
  user?: { id?: string; organizationId?: string };
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
      !projectId || projectId === 'all' || projectId === 'null' || projectId === 'undefined';

    const initiativeRows =
      ((await dbAll(
        orgWide
          ? `SELECT id, name FROM initiatives WHERE organization_id = ?`
          : `SELECT id, name FROM initiatives WHERE project_id = ? AND organization_id = ?`,
        orgWide ? [orgId] : [projectId, orgId]
      )) as InitiativeRow[] | undefined) || [];

    // RES-11 (Phase 1): the BSC/BDN composer is one of the packet's named
    // aggregation points — a hidden KPI must never surface here, not even as
    // a zero/placeholder row. isAdmin false: packet §10 leaves "does admin
    // see private_to_owner" as an open policy decision, fail-closed for now.
    const kpiVisibility = kpiVisibilitySql('initiative_kpis', {
      userId: req.user?.id || null,
      isAdmin: false,
    });
    const kpiRows =
      ((await dbAll(
        `SELECT id, name, current_value, target_value, measurement_frequency
       FROM initiative_kpis WHERE organization_id = ? AND ${kpiVisibility.sql}`,
        [orgId, ...kpiVisibility.params]
      )) as KpiRow[] | undefined) || [];

    const mappingRows =
      ((await dbAll(
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

    // D7 slice: extra columns (cycle_id/owner/description/status,
    // kpi_id/kr_type/kind/owner/score) are additive passthrough — the pure
    // cascadeRollup()/okrSummary() functions above only read id/label/
    // parentId/keyResults, so spreading the extra fields onto the mapped
    // objects is safe (cascadeRollup spreads `...o` into its return value).
    // FE edit forms need these to prefill (see OkrObjectiveModal/
    // OkrKeyResultModal) — the CRUD write endpoints already accept/persist them.
    const objRows =
      ((await dbAll(
        `SELECT id, label, parent_id, cycle_id, owner_user_id, description, status
       FROM okr_objectives WHERE organization_id = ?`,
        [orgId]
      )) as Array<{
        id: string;
        label: string;
        parent_id: string | null;
        cycle_id: string | null;
        owner_user_id: string | null;
        description: string | null;
        status: string | null;
      }>) || [];
    const krRows =
      ((await dbAll(
        `SELECT id, objective_id, label, baseline, target, current, weight,
              kpi_id, kpi_definition_version_id, kr_type, kind, owner_user_id, score
       FROM okr_key_results WHERE organization_id = ?`,
        [orgId]
      )) as Array<{
        id: string;
        objective_id: string;
        label: string;
        baseline: number | null;
        target: number | null;
        current: number | null;
        weight: number | null;
        kpi_id: string | null;
        kpi_definition_version_id: string | null;
        kr_type: string | null;
        kind: string | null;
        owner_user_id: string | null;
        score: number | null;
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
        kpiId: k.kpi_id ?? undefined,
        kpiDefinitionVersionId: k.kpi_definition_version_id ?? undefined,
        krType: (k.kr_type as KeyResult['krType']) ?? undefined,
        kind: (k.kind as KeyResult['kind']) ?? undefined,
        // extra passthrough for FE edit forms (not part of the pure KeyResult
        // scoring shape, but plain objects carry them through untouched)
        ...(k.owner_user_id != null ? { ownerUserId: k.owner_user_id } : {}),
        ...(k.score != null ? { persistedScore: k.score } : {}),
      } as KeyResult);
      krByObjective.set(String(k.objective_id), list);
    }

    const objectives: Objective[] = objRows.map(
      (o) =>
        ({
          id: String(o.id),
          label: o.label,
          parentId: o.parent_id ?? undefined,
          keyResults: krByObjective.get(String(o.id)) ?? [],
          // extra passthrough for FE edit forms (see comment above)
          ...(o.cycle_id != null ? { cycleId: o.cycle_id } : {}),
          ...(o.owner_user_id != null ? { ownerUserId: o.owner_user_id } : {}),
          ...(o.description != null ? { description: o.description } : {}),
          ...(o.status != null ? { status: o.status } : {}),
        }) as Objective
    );

    const cascaded = cascadeRollup(objectives);
    const summary = okrSummary(objectives);
    res.json({ objectives: cascaded, summary });
  })
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

// All CRUD writes below share this path prefix — ensure the D7 columns/tables
// (migration 914) exist before any of them runs, so the route is self-
// sufficient even if the migration hasn't been deployed separately yet
// (mirrors the GET /:projectId/okr guard above; ensureOkrTables() is a cheap
// no-op after the first call in this process).
router.use(
  '/:projectId/okr',
  asyncHandler(async (_req: AuthRequest, _res: Response, next) => {
    await ensureOkrTables();
    next();
  })
);

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
  })
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
  })
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
  })
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
  })
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
  })
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
  })
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
  })
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
  })
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
  })
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
  })
);

/**
 * RES-009: read-only prefill lookup — "what did the linked KPI last measure"
 * — for the check-in form. Never writes anything; D7 (manual-only scoring)
 * stays intact regardless of what this returns. `{ suggestedValue: null }`
 * covers every "nothing to suggest" case (no link, no measurement, KPI in
 * another org) uniformly — the caller doesn't need to distinguish why.
 */
router.get(
  '/:projectId/okr/key-results/:id/suggested-value',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = getOkrOrgId(req, res);
    if (!orgId) return;
    const suggestedValue = await getSuggestedValueForKeyResult(req.params.id, orgId);
    res.json({ suggestedValue });
  })
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
  })
);

export default router;
