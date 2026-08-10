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
import {
  OKR_SET_ACTIVATE_SPEC,
  OKR_SET_CANCEL_SPEC,
  approveOkrSet,
  createOkrSet,
  narrowOkrSetVisibility,
  requestChangesOnOkrSet,
  runOkrSetLifecycleTransition,
  submitOkrSetForApproval,
  updateOkrSetDraft,
  OkrSetNoActiveVisibilityPolicyError,
  OkrSetNotReadyForSubmissionError,
  OkrSetSelfApprovalDeniedError,
  OkrSetValidationError,
  OkrSetVisibilityWideningDeniedError,
  type OkrSetLifecycleTransitionSpec,
} from '../../services/resultsVnext/okr/okrSetCommands.js';
import {
  cancelObjective,
  createObjective,
  updateObjective,
  OkrObjectiveNotFoundError,
  OkrObjectiveSetNotEditableError,
  OkrObjectiveValidationError,
} from '../../services/resultsVnext/okr/okrObjectiveCommands.js';
import {
  getKeyResult,
  getObjective,
  listObjectivesForSet,
} from '../../services/resultsVnext/okr/okrObjectiveRepository.js';
import {
  cancelKeyResult,
  createKeyResult,
  updateKeyResult,
  OkrKeyResultNotFoundError,
  OkrKeyResultValidationError,
} from '../../services/resultsVnext/okr/okrKeyResultCommands.js';
import {
  correctCheckIn,
  recordCheckIn,
  OkrCheckInAlreadyExistsForOccurrenceError,
  OkrCheckInNotFoundError,
  OkrCheckInValidationError,
} from '../../services/resultsVnext/okr/okrCheckInCommands.js';
import { getCheckIn, listCheckIns } from '../../services/resultsVnext/okr/okrCheckInRepository.js';
import { suggestNextCheckInValue } from '../../services/resultsVnext/okr/okrCheckInSuggestionService.js';
import {
  acceptAlignment,
  proposeAlignment,
  rejectAlignment,
  removeAlignment,
  OkrAlignmentCycleDetectedError,
  OkrAlignmentCycleMismatchError,
  OkrAlignmentNotOwnerError,
  OkrAlignmentValidationError,
  OkrAlignmentVisibilityDeniedError,
} from '../../services/resultsVnext/okr/okrAlignmentCommands.js';
import {
  getAlignmentTreeUnderObjective,
  listAlignmentsForObjective,
} from '../../services/resultsVnext/okr/okrAlignmentRepository.js';
import { recordOkrSetMaterialChange } from '../../services/resultsVnext/okr/okrSetMaterialChangeCommands.js';
import {
  getOkrSet,
  getOkrSetApprovedSnapshot,
  listOkrSetApprovedSnapshots,
  listOkrSets,
} from '../../services/resultsVnext/okr/okrSetRepository.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  CorrectOkrCheckInSchema,
  CreateOkrCycleSchema,
  CreateOkrKeyResultSchema,
  CreateOkrObjectiveSchema,
  CreateOkrProgramSchema,
  CreateOkrSetSchema,
  EditOkrProgramDraftSchema,
  ListOkrCheckInsQuerySchema,
  ListOkrCompanySetsQuerySchema,
  ListOkrCyclesQuerySchema,
  ListOkrProgramsQuerySchema,
  ListOkrSetsQuerySchema,
  NarrowOkrSetVisibilitySchema,
  OkrCheckInIdParamsSchema,
  OkrCheckInIdWithCheckInParamsSchema,
  OkrCycleIdParamsSchema,
  OkrCycleTransitionSchema,
  OkrKeyResultIdParamsSchema,
  OkrKeyResultTransitionSchema,
  OkrObjectiveIdParamsSchema,
  OkrObjectiveTransitionSchema,
  OkrProgramIdParamsSchema,
  OkrSetApprovalSnapshotIdParamsSchema,
  OkrSetIdParamsSchema,
  OkrSetTransitionSchema,
  PublishOkrProgramSchema,
  RecordOkrCheckInSchema,
  RecordOkrSetMaterialChangeSchema,
  RequestChangesOnOkrSetSchema,
  UpdateOkrKeyResultSchema,
  UpdateOkrObjectiveSchema,
  UpdateOkrSetDraftSchema,
  AcceptOkrAlignmentSchema,
  GetOkrAlignmentTreeQuerySchema,
  ListOkrAlignmentsForObjectiveQuerySchema,
  OkrAlignmentIdParamsSchema,
  ProposeOkrAlignmentSchema,
  RejectOkrAlignmentSchema,
  RemoveOkrAlignmentSchema,
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
  if (err instanceof OkrSetSelfApprovalDeniedError) {
    res.status(403).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrSetVisibilityWideningDeniedError) {
    res.status(409).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrSetNoActiveVisibilityPolicyError) {
    res.status(409).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrSetNotReadyForSubmissionError) {
    res.status(409).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrSetValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // OKR-E003 (design §14's error-mapping table).
  if (err instanceof OkrObjectiveNotFoundError || err instanceof OkrKeyResultNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrObjectiveSetNotEditableError) {
    res.status(409).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrObjectiveValidationError || err instanceof OkrKeyResultValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // OKR-E004 (design §11's error-mapping table).
  if (err instanceof OkrCheckInAlreadyExistsForOccurrenceError) {
    res.status(409).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrCheckInNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (err instanceof OkrCheckInValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // OKR-E005 (design §H's error-mapping table).
  if (err instanceof OkrAlignmentVisibilityDeniedError || err instanceof OkrAlignmentNotOwnerError) {
    res.status(403).json({ error: err.message, code: err.code, ...err.details });
    return;
  }
  if (
    err instanceof OkrAlignmentCycleMismatchError ||
    err instanceof OkrAlignmentCycleDetectedError ||
    err instanceof OkrAlignmentValidationError
  ) {
    res.status(409).json({ error: err.message, code: err.code, ...err.details });
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

// ==========================================
// OKR-E002 (Materialized Set) — HTTP layer (design §6).
//
// Sets are ABAC resources (design §6, Decision D1) — unlike Program/Cycle
// above, write routes here do NOT layer `requireAdminWrite` on top of the
// router-wide `requireOrgAccess()`. Verified precedent: neither
// `roi.routes.ts` nor `kpi.routes.ts` calls `requireOrgRole`/
// `resolveVisibility()` at the route layer for their own ABAC-resource
// write routes either (grep-confirmed) — authorization for those domains
// comes entirely from `requireOrgAccess()` (org membership) plus the
// command layer's own domain guards (e.g. self-approval denial -> 403).
// This file matches that exact precedent for Sets. The design doc's error-
// mapping table lists "ACL failure->403" as a possible outcome; no route in
// this codebase currently implements a live per-route ACL gate check (a
// real, stated gap — same class as D13's platform limitation), so that
// branch is not reachable via any code path here, consistent with ROI/KPI.
//
// Every mutating route below that targets an EXISTING setId pre-fetches it
// via `getOkrSet` (the same ABAC-scoped repository function the GET routes
// use) before invoking the write command — matching the verified precedent
// in both `roi.routes.ts` (every mutating route pre-fetches `getRoiCase`)
// and this file's own Program/Cycle routes above. For an ABAC resource this
// is more than a cosmetic 404: a caller who lacks visibility gets the same
// "not found" response as a caller whose id is simply wrong, never a
// different error that would leak the resource's existence.
// ==========================================

// ==========================================
// POST /api/vnext/results/okr/sets — createOkrSet
// ==========================================

router.post(
  '/sets',
  validateBody(CreateOkrSetSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof CreateOkrSetSchema>;
      const outcome = await createOkrSet({
        organizationId: auth.organizationId,
        programId: body.programId,
        cycleId: body.cycleId,
        scopeType: body.scopeType,
        scopeId: body.scopeId,
        ownerUserId: body.ownerUserId,
        reviewerUserId: body.reviewerUserId ?? null,
        title: body.title,
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
        set: outcome.result.set,
        created: outcome.result.created,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'createOkrSet');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/sets — listOkrSets
// ==========================================

router.get(
  '/sets',
  validateQuery(ListOkrSetsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrSetsQuerySchema>;
      const sets = await listOkrSets({
        userId: auth.userId,
        organizationId: auth.organizationId,
        cycleId: query.cycleId,
        scopeType: query.scopeType,
        status: query.status,
        attentionState: query.attentionState,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ sets });
    } catch (err) {
      handleOkrRouteError(res, err, 'listOkrSets');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/company — listOkrSets filtered scope_type='company'
//
// F-004-AC-02: "the company view is a projection, not a separate model" —
// structurally guaranteed by calling the exact same `listOkrSets` repository
// function every other list route uses, with `scopeType` pinned to
// 'company' rather than reading the query, never a bespoke duplicate query.
//
// MOUNTED BEFORE `/sets/:setId` on purpose even though the two paths do not
// literally collide (different top-level segments, `/company` vs `/sets`)
// — kept adjacent to the Set routes it shares a repository function with,
// per this file's own mount-order note above about literal-path routers
// needing to precede a same-segment dynamic one.
// ==========================================

router.get(
  '/company',
  validateQuery(ListOkrCompanySetsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrCompanySetsQuerySchema>;
      const sets = await listOkrSets({
        userId: auth.userId,
        organizationId: auth.organizationId,
        cycleId: query.cycleId,
        scopeType: 'company',
        status: query.status,
        attentionState: query.attentionState,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ sets });
    } catch (err) {
      handleOkrRouteError(res, err, 'listOkrCompanySets');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/sets/:setId — getOkrSet
// ==========================================

router.get(
  '/sets/:setId',
  validateParams(OkrSetIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const set = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!set) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ set });
    } catch (err) {
      handleOkrRouteError(res, err, 'getOkrSet');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/okr/sets/:setId/draft — updateOkrSetDraft
// ==========================================

router.patch(
  '/sets/:setId/draft',
  validateParams(OkrSetIdParamsSchema),
  validateBody(UpdateOkrSetDraftSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof UpdateOkrSetDraftSchema>;
      const outcome = await updateOkrSetDraft({
        setId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        title: body.title,
        ownerUserId: body.ownerUserId,
        reviewerUserId: body.reviewerUserId,
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
        set: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'updateOkrSetDraft');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/okr/sets/:setId/visibility — narrowOkrSetVisibility (D19)
// ==========================================

router.patch(
  '/sets/:setId/visibility',
  validateParams(OkrSetIdParamsSchema),
  validateBody(NarrowOkrSetVisibilitySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof NarrowOkrSetVisibilitySchema>;
      const outcome = await narrowOkrSetVisibility({
        setId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        visibilityMode: body.visibilityMode,
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
        set: outcome.result.set,
        visibilityMode: outcome.result.visibilityMode,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'narrowOkrSetVisibility');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/submit — submitOkrSetForApproval
// ==========================================

router.post(
  '/sets/:setId/submit',
  validateParams(OkrSetIdParamsSchema),
  validateBody(OkrSetTransitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof OkrSetTransitionSchema>;
      const outcome = await submitOkrSetForApproval({
        setId,
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
        set: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'submitOkrSetForApproval');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/approve — approveOkrSet
// ==========================================

router.post(
  '/sets/:setId/approve',
  validateParams(OkrSetIdParamsSchema),
  validateBody(OkrSetTransitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof OkrSetTransitionSchema>;
      const outcome = await approveOkrSet({
        setId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        approverId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        set: outcome.result.set,
        snapshot: outcome.result.snapshot,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'approveOkrSet');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/request-changes — requestChangesOnOkrSet
// ==========================================

router.post(
  '/sets/:setId/request-changes',
  validateParams(OkrSetIdParamsSchema),
  validateBody(RequestChangesOnOkrSetSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof RequestChangesOnOkrSetSchema>;
      const outcome = await requestChangesOnOkrSet({
        setId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        changeRequestNotes: body.changeRequestNotes,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        set: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'requestChangesOnOkrSet');
    }
  }
);

// ==========================================
// Set lifecycle transitions — activate / cancel (design §4.7/§6)
// ==========================================

function mountSetTransitionRoute(path: string, op: string, spec: OkrSetLifecycleTransitionSpec): void {
  router.post(
    path,
    validateParams(OkrSetIdParamsSchema),
    validateBody(OkrSetTransitionSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      const auth = requireAuth(req, res);
      if (!auth) return;
      try {
        const { setId } = req.params as { setId: string };
        const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
        if (!existing) {
          res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
          return;
        }
        const body = req.body as import('zod').infer<typeof OkrSetTransitionSchema>;
        const outcome = await runOkrSetLifecycleTransition(spec, {
          setId,
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
          set: outcome.result,
        });
      } catch (err) {
        handleOkrRouteError(res, err, op);
      }
    }
  );
}

mountSetTransitionRoute('/sets/:setId/activate', 'activateOkrSet', OKR_SET_ACTIVATE_SPEC);
mountSetTransitionRoute('/sets/:setId/cancel', 'cancelOkrSet', OKR_SET_CANCEL_SPEC);

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/request-revision — recordOkrSetMaterialChange
// ==========================================

router.post(
  '/sets/:setId/request-revision',
  validateParams(OkrSetIdParamsSchema),
  validateBody(RecordOkrSetMaterialChangeSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existing = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof RecordOkrSetMaterialChangeSchema>;
      const outcome = await recordOkrSetMaterialChange({
        setId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        fieldName: body.fieldName,
        afterValue: body.afterValue,
        reason: body.reason,
        requestedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        set: outcome.result.set,
        version: outcome.result.version,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'recordOkrSetMaterialChange');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/sets/:setId/approval-snapshots — listOkrSetApprovedSnapshots
// ==========================================

router.get(
  '/sets/:setId/approval-snapshots',
  validateParams(OkrSetIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const snapshots = await listOkrSetApprovedSnapshots({
        userId: auth.userId,
        organizationId: auth.organizationId,
        setId,
      });
      res.status(200).json({ snapshots });
    } catch (err) {
      handleOkrRouteError(res, err, 'listOkrSetApprovedSnapshots');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/sets/:setId/approval-snapshots/:snapshotId — getOkrSetApprovedSnapshot
// ==========================================

router.get(
  '/sets/:setId/approval-snapshots/:snapshotId',
  validateParams(OkrSetApprovalSnapshotIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId, snapshotId } = req.params as { setId: string; snapshotId: string };
      const snapshot = await getOkrSetApprovedSnapshot({
        userId: auth.userId,
        organizationId: auth.organizationId,
        setId,
        snapshotId,
      });
      if (!snapshot) {
        res.status(404).json({ error: 'OKR Set approval snapshot not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ snapshot });
    } catch (err) {
      handleOkrRouteError(res, err, 'getOkrSetApprovedSnapshot');
    }
  }
);

// ==========================================
// OKR-E003 (Objective & KeyResult) — HTTP layer (design §14).
//
// Same posture as the Set routes above: Objectives/KRs are ABAC resources
// inherited via the parent Set (design §13, no independent visibility
// row) — no requireAdminWrite gate here either, matching the Set block's
// own documented precedent. Every mutating route pre-fetches the target
// resource via the ABAC-scoped repository read before invoking the write
// command, same "404 for both wrong-id and no-visibility" posture used
// throughout this file.
// ==========================================

// ==========================================
// POST /api/vnext/results/okr/sets/:setId/objectives — createObjective
// ==========================================

router.post(
  '/sets/:setId/objectives',
  validateParams(OkrSetIdParamsSchema),
  validateBody(CreateOkrObjectiveSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const existingSet = await getOkrSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      if (!existingSet) {
        res.status(404).json({ error: 'OKR Set not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof CreateOkrObjectiveSchema>;
      const outcome = await createObjective({
        setId,
        organizationId: auth.organizationId,
        ownerUserId: body.ownerUserId,
        title: body.title,
        description: body.description ?? null,
        rationale: body.rationale ?? null,
        ambitionType: body.ambitionType,
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
        objective: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'createObjective');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/sets/:setId/objectives — listObjectivesForSet
// (design §-IO item 10: getOkrSet returns a FLAT OkrSet with no nested
// Objectives/KRs — re-verified against E002's actual landed
// okrSetRepository.ts — this route is ADDITIVE, not duplicative.)
// ==========================================

router.get(
  '/sets/:setId/objectives',
  validateParams(OkrSetIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { setId } = req.params as { setId: string };
      const objectives = await listObjectivesForSet({ userId: auth.userId, organizationId: auth.organizationId, setId });
      res.status(200).json({ objectives });
    } catch (err) {
      handleOkrRouteError(res, err, 'listObjectivesForSet');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/objectives/:objectiveId — getObjective
// ==========================================

router.get(
  '/objectives/:objectiveId',
  validateParams(OkrObjectiveIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const objective = await getObjective({ userId: auth.userId, organizationId: auth.organizationId, objectiveId });
      if (!objective) {
        res.status(404).json({ error: 'OKR Objective not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ objective });
    } catch (err) {
      handleOkrRouteError(res, err, 'getObjective');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/okr/objectives/:objectiveId — updateObjective
// ==========================================

router.patch(
  '/objectives/:objectiveId',
  validateParams(OkrObjectiveIdParamsSchema),
  validateBody(UpdateOkrObjectiveSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const existing = await getObjective({ userId: auth.userId, organizationId: auth.organizationId, objectiveId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Objective not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof UpdateOkrObjectiveSchema>;
      const outcome = await updateObjective({
        objectiveId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        title: body.title,
        description: body.description,
        rationale: body.rationale,
        ambitionType: body.ambitionType,
        ownerUserId: body.ownerUserId,
        confidence: body.confidence,
        confidenceNumericValue: body.confidenceNumericValue,
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
        objective: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'updateObjective');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/cancel — cancelObjective
// (maps the plan's DELETE /objectives/:objectiveId to a guarded status
// transition, design §6/§10.4's soft-delete precedent — no cascade to KRs,
// §-IO item 8.)
// ==========================================

router.post(
  '/objectives/:objectiveId/cancel',
  validateParams(OkrObjectiveIdParamsSchema),
  validateBody(OkrObjectiveTransitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const existing = await getObjective({ userId: auth.userId, organizationId: auth.organizationId, objectiveId });
      if (!existing) {
        res.status(404).json({ error: 'OKR Objective not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof OkrObjectiveTransitionSchema>;
      const outcome = await cancelObjective({
        objectiveId,
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
        objective: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'cancelObjective');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/key-results — createKeyResult
// ==========================================

router.post(
  '/objectives/:objectiveId/key-results',
  validateParams(OkrObjectiveIdParamsSchema),
  validateBody(CreateOkrKeyResultSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const existingObjective = await getObjective({ userId: auth.userId, organizationId: auth.organizationId, objectiveId });
      if (!existingObjective) {
        res.status(404).json({ error: 'OKR Objective not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof CreateOkrKeyResultSchema>;
      const outcome = await createKeyResult({
        objectiveId,
        organizationId: auth.organizationId,
        ownerUserId: body.ownerUserId,
        title: body.title,
        description: body.description ?? null,
        measurementType: body.measurementType,
        unit: body.unit ?? null,
        currency: body.currency ?? null,
        baselineValue: body.baselineValue ?? null,
        targetValue: body.targetValue ?? null,
        startValue: body.startValue ?? null,
        currentValue: body.currentValue ?? null,
        direction: body.direction,
        rangeMin: body.rangeMin ?? null,
        rangeMax: body.rangeMax ?? null,
        confidence: body.confidence ?? null,
        confidenceNumericValue: body.confidenceNumericValue ?? null,
        sourceType: body.sourceType,
        sourceReference: body.sourceReference ?? null,
        weight: body.weight ?? null,
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
        keyResult: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'createKeyResult');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/key-results/:keyResultId — getKeyResult
// ==========================================

router.get(
  '/key-results/:keyResultId',
  validateParams(OkrKeyResultIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId } = req.params as { keyResultId: string };
      const keyResult = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!keyResult) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ keyResult });
    } catch (err) {
      handleOkrRouteError(res, err, 'getKeyResult');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/okr/key-results/:keyResultId — updateKeyResult
// ==========================================

router.patch(
  '/key-results/:keyResultId',
  validateParams(OkrKeyResultIdParamsSchema),
  validateBody(UpdateOkrKeyResultSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId } = req.params as { keyResultId: string };
      const existing = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!existing) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof UpdateOkrKeyResultSchema>;
      const outcome = await updateKeyResult({
        keyResultId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        title: body.title,
        description: body.description,
        ownerUserId: body.ownerUserId,
        measurementType: body.measurementType,
        unit: body.unit,
        currency: body.currency,
        baselineValue: body.baselineValue,
        targetValue: body.targetValue,
        startValue: body.startValue,
        currentValue: body.currentValue,
        direction: body.direction,
        rangeMin: body.rangeMin,
        rangeMax: body.rangeMax,
        confidence: body.confidence,
        confidenceNumericValue: body.confidenceNumericValue,
        status: body.status,
        sourceType: body.sourceType,
        sourceReference: body.sourceReference,
        weight: body.weight,
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
        keyResult: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'updateKeyResult');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/key-results/:keyResultId/cancel — cancelKeyResult
// (maps the plan's DELETE /key-results/:keyResultId)
// ==========================================

router.post(
  '/key-results/:keyResultId/cancel',
  validateParams(OkrKeyResultIdParamsSchema),
  validateBody(OkrKeyResultTransitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId } = req.params as { keyResultId: string };
      const existing = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!existing) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof OkrKeyResultTransitionSchema>;
      const outcome = await cancelKeyResult({
        keyResultId,
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
        keyResult: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'cancelKeyResult');
    }
  }
);

// ==========================================
// OKR-E004 — Check-ins (design §11)
// ==========================================

// ==========================================
// GET /api/vnext/results/okr/key-results/:keyResultId/check-ins — listCheckIns
// ==========================================

router.get(
  '/key-results/:keyResultId/check-ins',
  validateParams(OkrCheckInIdParamsSchema),
  validateQuery(ListOkrCheckInsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId } = req.params as { keyResultId: string };
      const existing = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!existing) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      const query = req.query as import('zod').infer<typeof ListOkrCheckInsQuerySchema>;
      const checkIns = await listCheckIns({
        userId: auth.userId,
        organizationId: auth.organizationId,
        keyResultId,
        currentOnly: query.currentOnly,
      });
      res.status(200).json({ checkIns });
    } catch (err) {
      handleOkrRouteError(res, err, 'listCheckIns');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/key-results/:keyResultId/check-ins — recordCheckIn
// ==========================================

router.post(
  '/key-results/:keyResultId/check-ins',
  validateParams(OkrCheckInIdParamsSchema),
  validateBody(RecordOkrCheckInSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId } = req.params as { keyResultId: string };
      const existing = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!existing) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof RecordOkrCheckInSchema>;
      const outcome = await recordCheckIn({
        keyResultId,
        organizationId: auth.organizationId,
        cadenceOccurrenceId: body.cadenceOccurrenceId,
        newValue: body.newValue,
        ownerDeclaredStatus: body.ownerDeclaredStatus ?? null,
        confidence: body.confidence ?? null,
        confidenceNumericValue: body.confidenceNumericValue ?? null,
        note: body.note,
        blocker: body.blocker ?? null,
        supportRequested: body.supportRequested ?? null,
        evidenceRefs: body.evidenceRefs ?? [],
        submittedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        checkIn: outcome.result.checkIn,
        keyResult: outcome.result.keyResult,
        set: outcome.result.set,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'recordCheckIn');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/key-results/:keyResultId/check-ins/:checkinId/correct — correctCheckIn
// ==========================================

router.post(
  '/key-results/:keyResultId/check-ins/:checkinId/correct',
  validateParams(OkrCheckInIdWithCheckInParamsSchema),
  validateBody(CorrectOkrCheckInSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId, checkinId } = req.params as { keyResultId: string; checkinId: string };
      const existing = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!existing) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      const existingCheckIn = await getCheckIn({ userId: auth.userId, organizationId: auth.organizationId, checkInId: checkinId });
      if (!existingCheckIn) {
        res.status(404).json({ error: 'OKR CheckIn not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof CorrectOkrCheckInSchema>;
      const outcome = await correctCheckIn({
        checkInId: checkinId,
        organizationId: auth.organizationId,
        newValue: body.newValue,
        ownerDeclaredStatus: body.ownerDeclaredStatus,
        confidence: body.confidence,
        confidenceNumericValue: body.confidenceNumericValue,
        correctionReason: body.correctionReason,
        submittedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        original: outcome.result.original,
        checkIn: outcome.result.superseding,
        keyResult: outcome.result.keyResult,
        set: outcome.result.set,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'correctCheckIn');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/key-results/:keyResultId/suggested-next-check-in-value
// — suggestNextCheckInValue. The frozen design's own §11 table nests this
// under a specific "/check-ins/:checkinId/suggested-next-value" path — a
// suggestion for the KR's NEXT (not-yet-submitted) check-in has no real
// dependency on any EXISTING checkin_id, so that nesting looks like a
// drafting slip rather than an intentional per-checkin scope. Kept KR-scoped
// instead (no AC names either exact shape — design §11 itself flags this
// route as "not AC-mandated ... added for a plausible real UI need, flagged
// not silently assumed" — this is that same flag applied one level
// further).
// ==========================================

router.get(
  '/key-results/:keyResultId/suggested-next-check-in-value',
  validateParams(OkrCheckInIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { keyResultId } = req.params as { keyResultId: string };
      const keyResult = await getKeyResult({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      if (!keyResult) {
        res.status(404).json({ error: 'OKR KeyResult not found', code: 'NOT_FOUND' });
        return;
      }
      const priorCheckIns = await listCheckIns({ userId: auth.userId, organizationId: auth.organizationId, keyResultId });
      const suggestion = suggestNextCheckInValue(priorCheckIns, keyResult);
      res.status(200).json({ suggestion });
    } catch (err) {
      handleOkrRouteError(res, err, 'suggestNextCheckInValue');
    }
  }
);

// ==========================================
// OKR-E005 (Alignment) — HTTP layer (design §H).
//
// Same posture as the Set/Objective blocks above: no requireAdminWrite
// gate — the caller's specific authorization (source/target Objective
// Owner) is a per-record fact checked INSIDE the command
// (`OkrAlignmentNotOwnerError` -> 403), not a coarse RBAC role gate, same
// as `approveOkrSet`'s self-approval denial (OKR-E002 §4.5's precedent).
//
// MOUNT-ORDER NOTE: `/alignments/:alignmentId`, `/alignments/:alignmentId/accept`,
// `/alignments/:alignmentId/reject` and `/alignments/:alignmentId/remove` are
// all dynamic single-segment-then-literal paths — no collision risk within
// this epic's own routes, but any future literal-path sub-router under
// `/alignments` must mount before these `:alignmentId` handlers (same class
// of bug already fixed twice in the KPI domain).
// ==========================================

// ==========================================
// POST /api/vnext/results/okr/objectives/:objectiveId/alignments — proposeAlignment
// ==========================================

router.post(
  '/objectives/:objectiveId/alignments',
  validateParams(OkrObjectiveIdParamsSchema),
  validateBody(ProposeOkrAlignmentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const existingSource = await getObjective({ userId: auth.userId, organizationId: auth.organizationId, objectiveId });
      if (!existingSource) {
        res.status(404).json({ error: 'OKR Objective not found', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof ProposeOkrAlignmentSchema>;
      const outcome = await proposeAlignment({
        organizationId: auth.organizationId,
        sourceObjectiveId: objectiveId,
        targetObjectiveId: body.targetObjectiveId,
        rationale: body.rationale ?? null,
        proposedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' && outcome.result.created ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        alignment: outcome.result.alignment,
        created: outcome.result.created,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'proposeAlignment');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/objectives/:objectiveId/alignments — listAlignmentsForObjective
// ==========================================

router.get(
  '/objectives/:objectiveId/alignments',
  validateParams(OkrObjectiveIdParamsSchema),
  validateQuery(ListOkrAlignmentsForObjectiveQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListOkrAlignmentsForObjectiveQuerySchema>;
      const alignments = await listAlignmentsForObjective({
        userId: auth.userId,
        organizationId: auth.organizationId,
        objectiveId,
        direction: query.direction,
        status: query.status,
      });
      res.status(200).json({ alignments });
    } catch (err) {
      handleOkrRouteError(res, err, 'listAlignmentsForObjective');
    }
  }
);

// ==========================================
// GET /api/vnext/results/okr/objectives/:objectiveId/alignment-tree — getAlignmentTreeUnderObjective
// ==========================================

router.get(
  '/objectives/:objectiveId/alignment-tree',
  validateParams(OkrObjectiveIdParamsSchema),
  validateQuery(GetOkrAlignmentTreeQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { objectiveId } = req.params as { objectiveId: string };
      const query = req.query as unknown as import('zod').infer<typeof GetOkrAlignmentTreeQuerySchema>;
      const nodes = await getAlignmentTreeUnderObjective({
        userId: auth.userId,
        organizationId: auth.organizationId,
        rootObjectiveId: objectiveId,
        maxDepth: query.maxDepth,
      });
      res.status(200).json({ nodes });
    } catch (err) {
      handleOkrRouteError(res, err, 'getAlignmentTreeUnderObjective');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/alignments/:alignmentId/accept — acceptAlignment
// ==========================================

router.post(
  '/alignments/:alignmentId/accept',
  validateParams(OkrAlignmentIdParamsSchema),
  validateBody(AcceptOkrAlignmentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { alignmentId } = req.params as { alignmentId: string };
      const body = req.body as import('zod').infer<typeof AcceptOkrAlignmentSchema>;
      const outcome = await acceptAlignment({
        alignmentId,
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
        alignment: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'acceptAlignment');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/alignments/:alignmentId/reject — rejectAlignment
// ==========================================

router.post(
  '/alignments/:alignmentId/reject',
  validateParams(OkrAlignmentIdParamsSchema),
  validateBody(RejectOkrAlignmentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { alignmentId } = req.params as { alignmentId: string };
      const body = req.body as import('zod').infer<typeof RejectOkrAlignmentSchema>;
      const outcome = await rejectAlignment({
        alignmentId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        responseReason: body.responseReason ?? null,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        alignment: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'rejectAlignment');
    }
  }
);

// ==========================================
// POST /api/vnext/results/okr/alignments/:alignmentId/remove — removeAlignment
// (maps the plan's DELETE /alignments/:alignmentId to a guarded status
// transition, same soft-delete precedent as cancelObjective/cancelKeyResult)
// ==========================================

router.post(
  '/alignments/:alignmentId/remove',
  validateParams(OkrAlignmentIdParamsSchema),
  validateBody(RemoveOkrAlignmentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { alignmentId } = req.params as { alignmentId: string };
      const body = req.body as import('zod').infer<typeof RemoveOkrAlignmentSchema>;
      const outcome = await removeAlignment({
        alignmentId,
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
        alignment: outcome.result,
      });
    } catch (err) {
      handleOkrRouteError(res, err, 'removeAlignment');
    }
  }
);

export default router;
