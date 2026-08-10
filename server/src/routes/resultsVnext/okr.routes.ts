/**
 * OKR-E001 (Program & Cycle) — HTTP layer.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §8. Structural
 * precedent: `roi.routes.ts` (most recent sibling "first epic of a
 * domain") — thin HTTP layer over `services/resultsVnext/okr/*` (owns all
 * business logic — CAS, the program-not-active guard, the policy-version
 * snapshot). This router does auth/param plumbing, request-shape
 * validation, and error->HTTP mapping only.
 *
 * Mounted at `/api/vnext/results/okr` (Gateway.ts).
 *
 * RBAC, not ABAC (design §7/Decision P2/P4 — a genuine departure from
 * every prior resultsVnext epic): every mutating route requires
 * `requireOrgRole('admin','superadmin')` in addition to the router-wide
 * `requireOrgAccess()`; `GET` routes rely on `requireOrgAccess()` alone.
 * Program/Cycle are org-wide configuration, not a per-resource ABAC
 * surface — there is no `resolveVisibility()` call anywhere in this file.
 *
 * MOUNT-ORDER NOTE (design §8): no literal-path sub-router collision within
 * this epic's own route set (`GET /cycles/:cycleId` is this router's only
 * dynamic top-level segment under `/cycles`). Flagged here for whoever
 * mounts the next OKR router (OKR-E002's `/sets/*`) — same class of bug
 * fixed twice already in the KPI domain and flagged once already in ROI's
 * own `roi.routes.ts` header.
 */
import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess, requireOrgRole } from '../../middleware/rbac.middleware.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import {
  OKR_CYCLE_ACTIVATE_SPEC,
  OKR_CYCLE_CANCEL_SPEC,
  OKR_CYCLE_CLOSE_SPEC,
  OKR_CYCLE_OPEN_DRAFTING_SPEC,
  OKR_CYCLE_OPEN_REVIEW_SPEC,
  createCycle,
  runOkrCycleLifecycleTransition,
  OkrCycleProgramNotActiveError,
  OkrCycleValidationError,
  type OkrCycleLifecycleTransitionSpec,
} from '../../services/resultsVnext/okr/okrCycleCommands.js';
import {
  createProgram,
  editProgramDraft,
  publishProgram,
  OkrProgramValidationError,
} from '../../services/resultsVnext/okr/okrProgramCommands.js';
import { getCycle, getProgram, listCycles, listPrograms } from '../../services/resultsVnext/okr/okrRepository.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  CreateOkrCycleSchema,
  CreateOkrProgramSchema,
  EditOkrProgramDraftSchema,
  ListOkrCyclesQuerySchema,
  ListOkrProgramsQuerySchema,
  OkrCycleIdParamsSchema,
  OkrCycleTransitionSchema,
  OkrProgramIdParamsSchema,
  PublishOkrProgramSchema,
} from '../../validators/resultsVnextOkr.validators.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// SHARED HELPERS
// ==========================================

interface RouteAuth {
  organizationId: string;
  userId: string;
  role: string;
}

/** Defense-in-depth re-check on top of `verifyToken`/`requireOrgAccess()` —
 * same pattern as `roi.routes.ts`'s `requireAuth`. */
function requireAuth(req: AuthenticatedRequest, res: Response): RouteAuth | null {
  const organizationId = req.user?.organizationId || req.user?.organization_id;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }
  return { organizationId, userId, role: req.user?.role ? String(req.user.role) : 'member' };
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function getCorrelationId(req: AuthenticatedRequest): string | undefined {
  return (
    normalizeOptionalString(req.correlationId) ||
    normalizeOptionalString(req.get?.('X-Correlation-ID'))
  );
}

function resolveIdempotencyKey(bodyKey: string | undefined | null): string {
  return normalizeOptionalString(bodyKey ?? undefined) || randomUUID();
}

/**
 * Shared error -> HTTP mapping for every write endpoint below. Mirrors
 * `roi.routes.ts`'s `handleRoiRouteError` in shape and in the rule "never
 * leak a stack trace". `requireOrgRole` failures are mapped by that
 * middleware itself (403, before this handler ever runs) — not handled
 * here.
 */
function handleOkrRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof AtomicWriteConflictError) {
    res.status(409).json({ error: err.message, code: err.code, ...(err.details || {}) });
    return;
  }
  if (err instanceof AtomicWriteAggregateNotFoundError) {
    res.status(404).json({ error: err.message || 'Not found', code: 'NOT_FOUND' });
    return;
  }
  if (err instanceof OkrCycleProgramNotActiveError) {
    res.status(409).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof OkrCycleValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof OkrProgramValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  logger.error(`[resultsVnext/okr.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'OKR_INTERNAL_ERROR' });
}

const requireAdminWrite = requireOrgRole('admin', 'superadmin');

// ==========================================
// POST /api/vnext/results/okr/programs — createProgram
// ==========================================

router.post(
  '/programs',
  requireAdminWrite,
  validateBody(CreateOkrProgramSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof CreateOkrProgramSchema>;
      const outcome = await createProgram({
        organizationId: auth.organizationId,
        name: body.name,
        cycleModel: body.cycleModel,
        annualDirectionEnabled: body.annualDirectionEnabled,
        objectiveMinRecommended: body.objectiveMinRecommended,
        objectiveMaxRecommended: body.objectiveMaxRecommended,
        krMinRequired: body.krMinRequired,
        krMaxRecommended: body.krMaxRecommended,
        checkinFrequency: body.checkinFrequency,
        approvalRequired: body.approvalRequired,
        scoringModel: body.scoringModel,
        objectiveRollupModel: body.objectiveRollupModel,
        confidenceEnabled: body.confidenceEnabled,
        confidenceModel: body.confidenceModel,
        objectiveConfidenceModel: body.objectiveConfidenceModel,
        visibilityDefault: body.visibilityDefault,
        committedVsAspirationalEnabled: body.committedVsAspirationalEnabled,
        managerReviewRequired: body.managerReviewRequired,
        selfReviewRequired: body.selfReviewRequired,
        reflectionRequiredForClose: body.reflectionRequiredForClose,
        recognitionEnabled: body.recognitionEnabled,
        createdBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        program: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'createProgram');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/programs — listPrograms
// ==========================================

router.get(
  '/programs',
  validateQuery(ListOkrProgramsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrProgramsQuerySchema>;
      const programs = await listPrograms({
        organizationId: auth.organizationId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ programs });
    } catch (err) {
      handleOkrRouteError(res, err, 'listPrograms');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/programs/:programId — getProgram
// ==========================================

router.get(
  '/programs/:programId',
  validateParams(OkrProgramIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { programId } = req.params as { programId: string };
      const program = await getProgram({ organizationId: auth.organizationId, programId });
      if (!program) {
        res.status(404).json({ error: 'OKR Program not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ program });
    } catch (err) {
      handleOkrRouteError(res, err, 'getProgram');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/okr/programs/:programId/draft — editProgramDraft
// ==========================================

router.patch(
  '/programs/:programId/draft',
  requireAdminWrite,
  validateParams(OkrProgramIdParamsSchema),
  validateBody(EditOkrProgramDraftSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { programId } = req.params as { programId: string };
      const existing = await getProgram({ organizationId: auth.organizationId, programId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Program not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof EditOkrProgramDraftSchema>;
      const outcome = await editProgramDraft({
        programId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        name: body.name,
        cycleModel: body.cycleModel,
        annualDirectionEnabled: body.annualDirectionEnabled,
        objectiveMinRecommended: body.objectiveMinRecommended,
        objectiveMaxRecommended: body.objectiveMaxRecommended,
        krMinRequired: body.krMinRequired,
        krMaxRecommended: body.krMaxRecommended,
        checkinFrequency: body.checkinFrequency,
        approvalRequired: body.approvalRequired,
        scoringModel: body.scoringModel,
        objectiveRollupModel: body.objectiveRollupModel,
        confidenceEnabled: body.confidenceEnabled,
        confidenceModel: body.confidenceModel,
        objectiveConfidenceModel: body.objectiveConfidenceModel,
        visibilityDefault: body.visibilityDefault,
        committedVsAspirationalEnabled: body.committedVsAspirationalEnabled,
        managerReviewRequired: body.managerReviewRequired,
        selfReviewRequired: body.selfReviewRequired,
        reflectionRequiredForClose: body.reflectionRequiredForClose,
        recognitionEnabled: body.recognitionEnabled,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        program: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'editProgramDraft');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/programs/:programId/publish — publishProgram
// ==========================================

router.post(
  '/programs/:programId/publish',
  requireAdminWrite,
  validateParams(OkrProgramIdParamsSchema),
  validateBody(PublishOkrProgramSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { programId } = req.params as { programId: string };
      const existing = await getProgram({ organizationId: auth.organizationId, programId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Program not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof PublishOkrProgramSchema>;
      const outcome = await publishProgram({
        programId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        program: outcome.result.program,
        policyVersion: outcome.result.policyVersion,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'publishProgram');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/cycles — createCycle
// ==========================================

router.post(
  '/cycles',
  requireAdminWrite,
  validateBody(CreateOkrCycleSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof CreateOkrCycleSchema>;
      const outcome = await createCycle({
        organizationId: auth.organizationId,
        programId: body.programId,
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        draftOpenAt: body.draftOpenAt,
        submissionDueAt: body.submissionDueAt,
        approvalDueAt: body.approvalDueAt ?? null,
        activeStartAt: body.activeStartAt,
        midcycleReviewAt: body.midcycleReviewAt ?? null,
        finalUpdateDueAt: body.finalUpdateDueAt,
        reviewOpenAt: body.reviewOpenAt,
        reflectionDueAt: body.reflectionDueAt,
        managerReviewDueAt: body.managerReviewDueAt ?? null,
        closeAt: body.closeAt,
        createdBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        cycle: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'createCycle');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/cycles — listCycles
// ==========================================

router.get(
  '/cycles',
  validateQuery(ListOkrCyclesQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrCyclesQuerySchema>;
      const cycles = await listCycles({
        organizationId: auth.organizationId,
        programId: query.programId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ cycles });
    } catch (err) {
      handleOkrRouteError(res, err, 'listCycles');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/cycles/:cycleId — getCycle
// ==========================================

router.get(
  '/cycles/:cycleId',
  validateParams(OkrCycleIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { cycleId } = req.params as { cycleId: string };
      const cycle = await getCycle({ organizationId: auth.organizationId, cycleId });
      if (!cycle) {
        res.status(404).json({ error: 'OKR Cycle not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ cycle });
    } catch (err) {
      handleOkrRouteError(res, err, 'getCycle');
    }
  }
);

// ==========================================
// Cycle lifecycle transitions (design §6.5/§8)
// ==========================================

function mountTransitionRoute(path: string, op: string, spec: OkrCycleLifecycleTransitionSpec): void {
  router.post(
    path,
    requireAdminWrite,
    validateParams(OkrCycleIdParamsSchema),
    validateBody(OkrCycleTransitionSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      const auth = requireAuth(req, res);
      if (!auth) return;
      try {
        const { cycleId } = req.params as { cycleId: string };
        const existing = await getCycle({ organizationId: auth.organizationId, cycleId });
        if (!existing) {
          res.status(404).json({ error: 'OKR Cycle not found', code: 'NOT_FOUND' });
          return;
        }
        const body = req.body as import('zod').infer<typeof OkrCycleTransitionSchema>;
        const outcome = await runOkrCycleLifecycleTransition(spec, {
          cycleId,
          organizationId: auth.organizationId,
          expectedVersion: body.expectedVersion,
          actorUserId: auth.userId,
          actorEffectiveRole: auth.role,
          idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
          correlationId: getCorrelationId(req),
          reason: body.reason ?? null,
        });
        res.status(200).json({
          outcome: outcome.outcome,
          eventId: outcome.eventId,
          resultingVersion: outcome.resultingVersion,
          cycle: outcome.result,
        });
      } catch (err) {
        handleOkrRouteError(res, err, op);
      }
    }
  );
}

mountTransitionRoute('/cycles/:cycleId/open-drafting', 'openDrafting', OKR_CYCLE_OPEN_DRAFTING_SPEC);
mountTransitionRoute('/cycles/:cycleId/activate', 'activateCycle', OKR_CYCLE_ACTIVATE_SPEC);
mountTransitionRoute('/cycles/:cycleId/open-review', 'openReview', OKR_CYCLE_OPEN_REVIEW_SPEC);
mountTransitionRoute('/cycles/:cycleId/close', 'closeCycle', OKR_CYCLE_CLOSE_SPEC);
mountTransitionRoute('/cycles/:cycleId/cancel', 'cancelCycle', OKR_CYCLE_CANCEL_SPEC);

export default router;
