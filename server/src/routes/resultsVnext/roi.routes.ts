/**
 * ROI-E001 (Case & Baseline) — HTTP layer.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §7. Structural
 * template: `kpi.routes.ts` — thin HTTP layer over
 * `services/resultsVnext/roi/*` (owns all business logic — CAS, duplicate
 * prevention, visibility scoping, the freeze guard). This router does
 * auth/param plumbing, request-shape validation, and error->HTTP mapping
 * only.
 *
 * Mounted at `/api/vnext/results/roi` (Gateway.ts).
 *
 * MOUNT-ORDER NOTE (design §7): `GET /cases/:caseId` is a single dynamic
 * segment. Any future sub-router mounted under
 * `/api/vnext/results/roi/cases` with a literal path segment (e.g. a future
 * `/cases/legacy`) must be registered in `Gateway.ts` BEFORE this router —
 * same class of bug fixed twice already in the KPI domain
 * (`kpiDeviation.routes.ts`, `kpiScorecard.routes.ts`). Not an active
 * collision within this epic's own endpoint set (this router owns every
 * literal segment under `/cases` itself), but flagged here for whoever adds
 * the next ROI router.
 */
import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import {
  captureOrUpdateBaseline,
  RoiBaselineFrozenError,
} from '../../services/resultsVnext/roi/roiBaselineCommands.js';
import {
  archiveRoiCase,
  createRoiCase,
  markReadyForReview,
  RoiCaseNoActiveVisibilityPolicyError,
  RoiCaseNotReadyForReviewError,
  RoiCaseValidationError,
  startModeling,
  updateRoiCaseDetails,
} from '../../services/resultsVnext/roi/roiCaseCommands.js';
import { getRoiBaseline, getRoiCase, listRoiCases } from '../../services/resultsVnext/roi/roiRepository.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  ArchiveRoiCaseSchema,
  CaptureOrUpdateBaselineSchema,
  CreateRoiCaseSchema,
  ListRoiCasesQuerySchema,
  RoiCaseIdParamsSchema,
  RoiCaseTransitionSchema,
  UpdateRoiCaseDetailsSchema,
} from '../../validators/resultsVnextRoi.validators.js';

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
 * same pattern as `kpi.routes.ts`'s `requireAuth`. */
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

/** Same repo convention `kpi.routes.ts` documents (documents.routes.ts,
 * conversations.routes.ts, report-builder.routes.ts, ...). */
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
 * `kpi.routes.ts`'s `handleKpiRouteError` in shape and in the rule "never
 * leak a stack trace". E001 has no self-approval maker-checker action of
 * its own (design §6) — that mapping arrives with ROI-E003's
 * `approveRoiCase`, not here.
 */
function handleRoiRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof AtomicWriteConflictError) {
    res.status(409).json({ error: err.message, code: err.code, ...(err.details || {}) });
    return;
  }
  if (err instanceof AtomicWriteAggregateNotFoundError) {
    res.status(404).json({ error: err.message || 'Not found', code: 'NOT_FOUND' });
    return;
  }
  if (err instanceof RoiCaseNoActiveVisibilityPolicyError) {
    // Org/domain has no active visibility policy provisioned yet — a
    // precondition failure, not a malformed request (400) nor a missing
    // resource (404). Same 409 rationale as KpiNoActiveVisibilityPolicyError.
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiCaseNotReadyForReviewError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiBaselineFrozenError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiCaseValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  logger.error(`[resultsVnext/roi.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'ROI_INTERNAL_ERROR' });
}

// ==========================================
// POST /api/vnext/results/roi/cases — createRoiCase
// ==========================================

router.post(
  '/cases',
  validateBody(CreateRoiCaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof CreateRoiCaseSchema>;
      const outcome = await createRoiCase({
        organizationId: auth.organizationId,
        initiativeId: body.initiativeId,
        title: body.title,
        ownerUserId: body.ownerUserId,
        currency: body.currency,
        granularity: body.granularity,
        analysisStart: body.analysisStart ?? null,
        analysisEnd: body.analysisEnd ?? null,
        createdBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' && outcome.result.created ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result.case,
        baseline: outcome.result.baseline,
        created: outcome.result.created,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'createRoiCase');
    }
  }
);

// ==========================================
// GET /api/vnext/results/roi/cases — listRoiCases
// ==========================================

router.get(
  '/cases',
  validateQuery(ListRoiCasesQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiCasesQuerySchema>;
      const cases = await listRoiCases({
        userId: auth.userId,
        organizationId: auth.organizationId,
        status: query.status,
        includeArchived: query.includeArchived,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ cases });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiCases');
    }
  }
);

// ==========================================
// GET /api/vnext/results/roi/cases/:caseId — getRoiCase
// ==========================================

router.get(
  '/cases/:caseId',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      // includeArchived: true — fetching a specific known id must not 404
      // merely because the case was archived (Decision D4: archiving is
      // registry housekeeping, orthogonal to whether the resource still
      // exists/is visible). Only the LIST endpoint's default excludes
      // archived rows.
      const roiCase = await getRoiCase({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeArchived: true,
      });
      if (!roiCase) {
        res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ case: roiCase });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiCase');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/roi/cases/:caseId — updateRoiCaseDetails
// ==========================================

router.patch(
  '/cases/:caseId',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(UpdateRoiCaseDetailsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const existing = await getRoiCase({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeArchived: true,
      });
      if (!existing) {
        res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof UpdateRoiCaseDetailsSchema>;
      const outcome = await updateRoiCaseDetails({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        title: body.title,
        ownerUserId: body.ownerUserId,
        currency: body.currency,
        granularity: body.granularity,
        analysisStart: body.analysisStart,
        analysisEnd: body.analysisEnd,
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
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateRoiCaseDetails');
    }
  }
);

// ==========================================
// POST /api/vnext/results/roi/cases/:caseId/archive — archiveRoiCase
// ==========================================

router.post(
  '/cases/:caseId/archive',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(ArchiveRoiCaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const existing = await getRoiCase({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeArchived: true,
      });
      if (!existing) {
        res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof ArchiveRoiCaseSchema>;
      const outcome = await archiveRoiCase({
        caseId,
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
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'archiveRoiCase');
    }
  }
);

// ==========================================
// ROI case lifecycle: start-modeling / ready-for-review
// ==========================================

function mountTransitionRoute(path: string, op: string, runner: typeof startModeling): void {
  router.post(
    path,
    validateParams(RoiCaseIdParamsSchema),
    validateBody(RoiCaseTransitionSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      const auth = requireAuth(req, res);
      if (!auth) return;
      try {
        const { caseId } = req.params as { caseId: string };
        const existing = await getRoiCase({
          userId: auth.userId,
          organizationId: auth.organizationId,
          caseId,
          includeArchived: true,
        });
        if (!existing) {
          res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
          return;
        }
        const body = req.body as import('zod').infer<typeof RoiCaseTransitionSchema>;
        const outcome = await runner({
          caseId,
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
          case: outcome.result,
        });
      } catch (err) {
        handleRoiRouteError(res, err, op);
      }
    }
  );
}

mountTransitionRoute('/cases/:caseId/transitions/start-modeling', 'startModeling', startModeling);
mountTransitionRoute('/cases/:caseId/transitions/ready-for-review', 'markReadyForReview', markReadyForReview);

// ==========================================
// GET /api/vnext/results/roi/cases/:caseId/baseline — getRoiBaseline
// ==========================================

router.get(
  '/cases/:caseId/baseline',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const baseline = await getRoiBaseline({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
      });
      if (!baseline) {
        res.status(404).json({ error: 'ROI baseline not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ baseline });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiBaseline');
    }
  }
);

// ==========================================
// PUT /api/vnext/results/roi/cases/:caseId/baseline — captureOrUpdateBaseline
// ==========================================

router.put(
  '/cases/:caseId/baseline',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(CaptureOrUpdateBaselineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const existing = await getRoiCase({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeArchived: true,
      });
      if (!existing) {
        res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof CaptureOrUpdateBaselineSchema>;
      const outcome = await captureOrUpdateBaseline({
        organizationId: auth.organizationId,
        caseId,
        expectedVersion: body.expectedVersion,
        baselinePeriodStart: body.baselinePeriodStart,
        baselinePeriodEnd: body.baselinePeriodEnd,
        currentMeasuredValue: body.currentMeasuredValue,
        currentMeasuredUnit: body.currentMeasuredUnit,
        currentMeasuredAsOf: body.currentMeasuredAsOf,
        bauProjectionMethod: body.bauProjectionMethod,
        bauGrowthRatePct: body.bauGrowthRatePct,
        bauReferenceValue: body.bauReferenceValue,
        interventionComparisonNotes: body.interventionComparisonNotes,
        source: body.source,
        confidence: body.confidence,
        ownerUserId: body.ownerUserId,
        actorId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        baseline: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'captureOrUpdateBaseline');
    }
  }
);

export default router;
