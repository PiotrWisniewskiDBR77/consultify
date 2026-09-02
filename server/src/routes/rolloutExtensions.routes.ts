/**
 * Rollout Extensions Routes — Module M14 Wdrożenie (Execution) — F5 services.
 *
 * Thin HTTP layer over the four F5 rollout services, mirroring the auth /
 * org-scope / write-gate conventions of server/src/routes/rollout.routes.ts:
 *
 *   - router-level read gate:  verifyToken + isAuthenticated +
 *     requireOrgRole('user', 'project_manager')
 *   - per-route write gate:    requirePermission('MANAGE_ROLLOUT')
 *   - org always resolved from req.user.organizationId (never the payload);
 *     401 when no org is present.
 *
 * Resources (all org-scoped):
 *   - /stages           wave-based rollout planning   (rolloutStagesService)
 *   - /baselines        plan baseline / rebaseline    (rolloutBaselineService)
 *   - /cutover          cutover runbooks + steps      (cutoverRunbookService)
 *   - /gate/evaluate    stage-boundary go/no-go gate  (rolloutGateService, pure)
 *
 * Mounted in `Gateway.ts` at `/api/rollout-ext`.
 * Corrected on 2026-09-01 by duty 254 after the earlier pre-wiring comment
 * was checked against the current import and `app.use` registration.
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { requireOrgRole } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { addStep, createRunbook, getRunbook } from '../services/cutoverRunbookService.js';
import {
  captureBaseline,
  getLatestBaseline,
  listBaselines,
} from '../services/rolloutBaselineService.js';
import { evaluateStageGate, type GateInputs } from '../services/rolloutGateService.js';
import {
  advanceStage,
  createStage,
  type CreateStageInput,
  listStages,
  updateStage,
  type UpdateStagePatch,
} from '../services/rolloutStagesService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Reads require an authenticated org member; project_manager is listed
// explicitly (see rollout.routes.ts) so the PMO tier is not 403'd out of reads.
router.use(verifyToken, isAuthenticated, requireOrgRole('user', 'project_manager'));

// Writes require the MANAGE_ROLLOUT permission (PMO / admin tier).
const requireRolloutWrite = requirePermission('MANAGE_ROLLOUT');

const requireOrg = (req: AuthRequest, res: Response): string | null => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
};

const optionalProjectId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
};

// ================================================================
// Stages (5.1) — wave-based rollout planning
// ================================================================

const WAVE_TYPES = ['pilot', 'limited', 'full', 'hypercare', 'closure'] as const;
const STAGE_STATUSES = ['not_started', 'active', 'gated', 'done'] as const;

const StageCreateSchema = z.object({
  projectId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  waveType: z.enum(WAVE_TYPES),
  sequence: z.number().int().optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  baselineStart: z.string().nullable().optional(),
  baselineEnd: z.string().nullable().optional(),
  status: z.enum(STAGE_STATUSES).optional(),
  entryCriteria: z.string().nullable().optional(),
  exitCriteria: z.string().nullable().optional(),
});

const StageUpdateSchema = z.object({
  projectId: z.string().nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  waveType: z.enum(WAVE_TYPES).optional(),
  sequence: z.number().int().optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  baselineStart: z.string().nullable().optional(),
  baselineEnd: z.string().nullable().optional(),
  status: z.enum(STAGE_STATUSES).optional(),
  entryCriteria: z.string().nullable().optional(),
  exitCriteria: z.string().nullable().optional(),
});

router.get(
  '/stages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const stages = await listStages(orgId, optionalProjectId(req.query.projectId));
    return res.json({ stages, count: stages.length });
  })
);

router.post(
  '/stages',
  requireRolloutWrite,
  validateBody(StageCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof StageCreateSchema>;
    const stage = await createStage(orgId, b as CreateStageInput);
    return res.status(201).json({ stage });
  })
);

router.patch(
  '/stages/:id',
  requireRolloutWrite,
  validateBody(StageUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof StageUpdateSchema>;
    const stage = await updateStage(orgId, req.params.id, b as UpdateStagePatch);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    return res.json({ stage });
  })
);

router.post(
  '/stages/:id/advance',
  requireRolloutWrite,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const stage = await advanceStage(orgId, req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    return res.json({ stage });
  })
);

// ================================================================
// Baselines (5.3) — plan baseline / rebaseline
// ================================================================

const BaselineCreateSchema = z.object({
  projectId: z.string().min(1),
  snapshot: z.unknown(),
  label: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

router.get(
  '/baselines',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const projectId = optionalProjectId(req.query.projectId);
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const baselines = await listBaselines(orgId, projectId);
    return res.json({ baselines, count: baselines.length });
  })
);

router.get(
  '/baselines/latest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const projectId = optionalProjectId(req.query.projectId);
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const baseline = await getLatestBaseline(orgId, projectId);
    return res.json({ baseline });
  })
);

router.post(
  '/baselines',
  requireRolloutWrite,
  validateBody(BaselineCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof BaselineCreateSchema>;
    const baseline = await captureBaseline(orgId, b.projectId, b.snapshot, {
      label: b.label ?? null,
      reason: b.reason ?? null,
      createdBy: req.user?.id ?? null,
    });
    return res.status(201).json({ baseline });
  })
);

// ================================================================
// Cutover (5.4) — runbooks + steps
// ================================================================

const CUTOVER_RUNBOOK_STATUSES = ['planned', 'in_progress', 'completed', 'aborted'] as const;
const CUTOVER_GO_NO_GO = ['go', 'no_go', 'pending'] as const;
const CUTOVER_STEP_STATUSES = ['pending', 'in_progress', 'done', 'skipped', 'failed'] as const;

const RunbookCreateSchema = z.object({
  initiativeId: z.string().nullable().optional(),
  stageId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  status: z.enum(CUTOVER_RUNBOOK_STATUSES).optional(),
  goNoGo: z.enum(CUTOVER_GO_NO_GO).nullable().optional(),
});

const StepCreateSchema = z.object({
  sequence: z.number().int().optional(),
  title: z.string().min(1).max(255),
  ownerId: z.string().nullable().optional(),
  timeWindow: z.string().nullable().optional(),
  status: z.enum(CUTOVER_STEP_STATUSES).optional(),
  isRollback: z.boolean().optional(),
});

router.get(
  '/cutover/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const runbook = await getRunbook(orgId, req.params.initiativeId);
    if (!runbook) return res.status(404).json({ error: 'Runbook not found' });
    return res.json({ runbook });
  })
);

router.post(
  '/cutover',
  requireRolloutWrite,
  validateBody(RunbookCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof RunbookCreateSchema>;
    const runbook = await createRunbook(orgId, b);
    return res.status(201).json({ runbook });
  })
);

router.post(
  '/cutover/:runbookId/steps',
  requireRolloutWrite,
  validateBody(StepCreateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const b = req.body as z.infer<typeof StepCreateSchema>;
    const step = await addStep(orgId, req.params.runbookId, b);
    return res.status(201).json({ step });
  })
);

// ================================================================
// Gate (5.x) — stage-boundary cross-register go/no-go (pure)
// ================================================================

const GateEvaluateSchema = z.object({
  gateMetrics: z.array(z.object({ name: z.string(), met: z.boolean() })).optional(),
  gateBlockers: z.array(z.object({ name: z.string(), open: z.boolean() })).optional(),
  signOffs: z.array(z.object({ name: z.string(), done: z.boolean() })).optional(),
});

router.post(
  '/gate/evaluate',
  validateBody(GateEvaluateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const result = evaluateStageGate(req.body as GateInputs);
    return res.json({ result });
  })
);

export default router;
