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
import { resolveEffectiveAccess } from '../../services/effectiveAccessService.js';
import { acquirePgClient } from '../../database/PostgresDatabase.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import {
  CommandCapabilityDeniedError,
  type CommandAccessContext,
} from '../../services/resultsVnext/platform/commandCapabilityGuard.js';
import {
  captureOrUpdateBaseline,
  RoiBaselineFrozenError,
} from '../../services/resultsVnext/roi/roiBaselineCommands.js';
import {
  addAssumption,
  removeAssumption,
  updateAssumption,
  RoiAssumptionFrozenError,
} from '../../services/resultsVnext/roi/roiAssumptionCommands.js';
import {
  addBenefitEvidenceLink,
  flagEvidenceLinkFreshnessCheck,
  removeBenefitEvidenceLink,
  RoiBenefitEvidenceLinkValidationError,
} from '../../services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.js';
import {
  addBenefitLine,
  removeBenefitLine,
  updateBenefitLine,
  RoiBenefitLineFrozenError,
  RoiBenefitLineValidationError,
} from '../../services/resultsVnext/roi/roiBenefitLineCommands.js';
import {
  captureOrUpdateCalculationPolicy,
  RoiCalculationPolicyFrozenError,
  RoiEconomicModelNotEditableError,
} from '../../services/resultsVnext/roi/roiCalculationPolicyCommands.js';
import {
  createRoiCalculationRun,
  RoiCalculationRunValidationError,
} from '../../services/resultsVnext/roi/roiCalculationRunCommands.js';
import {
  archiveRoiCase,
  createRoiCase,
  markReadyForReview,
  reopenRejectedRoiCase,
  RoiCaseNoActiveVisibilityPolicyError,
  RoiCaseNotReadyForReviewError,
  RoiCaseValidationError,
  startModeling,
  updateRoiCaseDetails,
} from '../../services/resultsVnext/roi/roiCaseCommands.js';
import {
  approveRoiCase,
  rejectRoiCase,
  reopenApprovedRoiCaseForRevision,
  requestChangesOnRoiCase,
  RoiSelfApprovalDeniedError,
  submitRoiCaseForApproval,
} from '../../services/resultsVnext/roi/roiCaseApprovalCommands.js';
import {
  getRoiApprovalSnapshot,
  listRoiApprovalSnapshots,
} from '../../services/resultsVnext/roi/roiApprovalSnapshotRepository.js';
import {
  addCostLine,
  removeCostLine,
  updateCostLine,
  RoiCostLineFrozenError,
} from '../../services/resultsVnext/roi/roiCostLineCommands.js';
import {
  getAssumption,
  getBenefitLine,
  getCalculationPolicy,
  getCalculationRun,
  getCostLine,
  getScenario,
  listAssumptions,
  listBenefitEvidenceLinks,
  listBenefitLines,
  listCalculationRuns,
  listCostLines,
  listScenarioOverrides,
  listScenarios,
} from '../../services/resultsVnext/roi/roiEconomicModelRepository.js';
import { getRoiBaseline, getRoiCase, listRoiCases } from '../../services/resultsVnext/roi/roiRepository.js';
import {
  addScenario,
  removeScenario,
  removeScenarioOverride,
  setScenarioOverride,
  updateScenario,
  RoiScenarioFrozenError,
  RoiScenarioValidationError,
} from '../../services/resultsVnext/roi/roiScenarioCommands.js';
import { startRoiCaseTracking } from '../../services/resultsVnext/roi/roiTrackingCommands.js';
import {
  cancelRoiCase,
  startRoiCaseBenefitsRealization,
} from '../../services/resultsVnext/roi/roiBenefitsRealizationCommands.js';
import { getRoiCaseBenefitsRealizationView } from '../../services/resultsVnext/roi/roiBenefitsRealizationRepository.js';
import {
  createRoiForecastVersion,
  RoiForecastVersionValidationError,
} from '../../services/resultsVnext/roi/roiForecastVersionCommands.js';
import {
  getRoiForecastVersion,
  listRoiForecastVersions,
} from '../../services/resultsVnext/roi/roiForecastVersionRepository.js';
import { getRoiCaseCompareView } from '../../services/resultsVnext/roi/roiCompareRepository.js';
import {
  correctActualEntry,
  disputeActualEntry,
  recordActualEntry,
  verifyActualEntry,
  RoiActualEntryNotFoundError,
  RoiActualEntryValidationError,
  RoiActualSelfVerificationDeniedError,
} from '../../services/resultsVnext/roi/roiActualEntryCommands.js';
import { getActualEntry, listActualEntries } from '../../services/resultsVnext/roi/roiActualEntryRepository.js';
import { publishRoiActualSnapshot } from '../../services/resultsVnext/roi/roiActualSnapshotCommands.js';
import {
  getRoiActualSnapshot,
  listRoiActualSnapshots,
} from '../../services/resultsVnext/roi/roiActualSnapshotRepository.js';
import {
  addVarianceCause,
  recordVariance,
  removeVarianceCause,
  updateVarianceStatus,
  RoiVarianceNotFoundError,
  RoiVarianceValidationError,
} from '../../services/resultsVnext/roi/roiVarianceCommands.js';
import { getVariance, listVariances } from '../../services/resultsVnext/roi/roiVarianceRepository.js';
import {
  closeRoiCase,
  markRoiCasePostInvestmentReviewDue,
  recordRoiPirTeresaDraftDisposition,
  scheduleRoiCasePostInvestmentReview,
  startRoiCasePostInvestmentReview,
  updateRoiPostInvestmentReviewDraft,
  RoiPirNotFoundError,
  RoiPirSelfCloseDeniedError,
  RoiPirValidationError,
} from '../../services/resultsVnext/roi/roiPirCommands.js';
import { getRoiPostInvestmentReview, listRoiPostInvestmentReviews } from '../../services/resultsVnext/roi/roiPirRepository.js';
import {
  createRoiFinanceLink,
  removeRoiFinanceLink,
} from '../../services/resultsVnext/roi/roiFinanceLinkCommands.js';
import {
  listRoiFinanceLinks,
  listRoiFinanceReconciliations,
} from '../../services/resultsVnext/roi/roiFinanceLinkRepository.js';
import {
  openRoiFinanceReconciliation,
  updateRoiFinanceReconciliationStatus,
  RoiFinanceLinkNotFoundError,
  RoiFinanceReconciliationNotFoundError,
  RoiFinanceReconciliationValidationError,
} from '../../services/resultsVnext/roi/roiFinanceReconciliationCommands.js';
import { listRoiFinanceProjections } from '../../services/resultsVnext/roi/roiFinanceProjectionRepository.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { getCorrelationId } from './correlationId.js';
import logger from '../../utils/Logger.js';
import {
  ArchiveRoiCaseSchema,
  CaptureOrUpdateBaselineSchema,
  CreateRoiCaseSchema,
  CreateRoiFinanceLinkSchema,
  FreshnessCheckSchema,
  ListRoiCasesQuerySchema,
  OpenRoiFinanceReconciliationSchema,
  RejectRoiCaseSchema,
  RemoveRoiFinanceLinkSchema,
  ReopenApprovedRoiCaseForRevisionSchema,
  RequestChangesOnRoiCaseSchema,
  RoiApprovalSnapshotParamsSchema,
  RoiCaseIdParamsSchema,
  RoiCaseTransitionSchema,
  RoiFinanceLinkParamsSchema,
  RoiFinanceReconciliationParamsSchema,
  UpdateRoiCaseDetailsSchema,
  UpdateRoiFinanceReconciliationStatusSchema,
} from '../../validators/resultsVnextRoi.validators.js';
import {
  AddAssumptionSchema,
  AddBenefitEvidenceLinkSchema,
  AddBenefitLineSchema,
  AddCostLineSchema,
  AddScenarioSchema,
  CaptureOrUpdateCalculationPolicySchema,
  CreateRoiCalculationRunSchema,
  IncludeDeletedQuerySchema,
  ListBenefitEvidenceLinksQuerySchema,
  ListCalculationRunsQuerySchema,
  RemoveAssumptionSchema,
  RemoveBenefitEvidenceLinkSchema,
  RemoveBenefitLineSchema,
  RemoveCostLineSchema,
  RemoveScenarioOverrideSchema,
  RemoveScenarioSchema,
  RoiAssumptionParamsSchema,
  RoiBenefitEvidenceLinkListParamsSchema,
  RoiBenefitEvidenceLinkParamsSchema,
  RoiBenefitLineParamsSchema,
  RoiCalculationRunParamsSchema,
  RoiCostLineParamsSchema,
  RoiScenarioOverrideParamsSchema,
  RoiScenarioParamsSchema,
  SetScenarioOverrideSchema,
  UpdateAssumptionSchema,
  UpdateBenefitLineSchema,
  UpdateCostLineSchema,
  UpdateScenarioSchema,
} from '../../validators/resultsVnextRoiEconomicModel.validators.js';
import {
  AddVarianceCauseSchema,
  CorrectActualEntrySchema,
  CreateRoiForecastVersionSchema,
  DisputeActualEntrySchema,
  ListActualEntriesQuerySchema,
  PublishRoiActualSnapshotSchema,
  RecordActualEntrySchema,
  RecordVarianceSchema,
  RemoveVarianceCauseSchema,
  RoiCaseCancellationSchema,
  RoiActualEntryParamsSchema,
  RoiActualSnapshotParamsSchema,
  RoiForecastVersionParamsSchema,
  RoiVarianceCauseParamsSchema,
  RoiVarianceParamsSchema,
  UpdateVarianceStatusSchema,
  VerifyActualEntrySchema,
} from '../../validators/resultsVnextRoiForecastActual.validators.js';
import {
  CloseRoiCaseSchema,
  RecordRoiPirTeresaDraftDispositionSchema,
  RoiPirParamsSchema,
  ScheduleRoiCasePostInvestmentReviewSchema,
  UpdateRoiPostInvestmentReviewDraftSchema,
} from '../../validators/resultsVnextRoiPir.validators.js';

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

/** RN-G5 — see kpiDeviation.routes.ts's identical helper for the full
 * rationale (no projectId: ROI cases are organization-scoped, not project-
 * scoped, same as the KPI domain). Only the 5 case-decision commands in
 * `roiCaseApprovalCommands.ts` are gated by this pakiet — see that file's
 * own RN-G5 comment for the exact scope. */
async function resolveAccess(req: AuthenticatedRequest, auth: RouteAuth): Promise<CommandAccessContext> {
  return resolveEffectiveAccess({
    userId: auth.userId,
    organizationId: auth.organizationId,
    applicationRole: req.user?.role,
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

// getCorrelationId moved to ./correlationId.js (RN-G6 P0 fix — F1): shared,
// UUID-shape-validated implementation for all resultsVnext routes instead of
// six copies each trusting the header/attached value as-is once non-empty.
// See that file's doc comment for the full root-cause writeup.

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
  // RN-G5: checked FIRST — coarse authorization denial, ahead of every
  // other error branch (including the self-approval one right below, which
  // is a finer-grained business rule that only fires for actors who already
  // passed this gate).
  if (err instanceof CommandCapabilityDeniedError) {
    // RN-G5 fix: same rationale as kpi.routes.ts's identical branch —
    // `details.capability` is server-side-log-only, never wire.
    logger.warn(`[resultsVnext/roi.routes] ${op} denied`, { capability: err.details.capability });
    res.status(403).json({ error: err.message, code: err.code });
    return;
  }
  // ROI-E003 §7: checked FIRST, ahead of the generic conflict/validation 409
  // branches — self-approval denial is a 403 (authorization), not a 409
  // (state-conflict).
  if (err instanceof RoiSelfApprovalDeniedError) {
    res.status(403).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // ROI-E006 §9: RoiPirSelfCloseDeniedError checked ahead of the generic
  // 409 branches, same "authorization, not state-conflict" reasoning as
  // RoiSelfApprovalDeniedError/RoiActualSelfVerificationDeniedError above.
  // RoiPirNotFoundError is a 404 (internal-invariant "no active draft PIR"),
  // also checked ahead of the generic 409 branch.
  if (err instanceof RoiPirSelfCloseDeniedError) {
    res.status(403).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiPirNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiPirValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
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
  // ROI-E002 typed errors — same 409 "typed precondition failure" mapping
  // every other guard error in this router already uses.
  if (
    err instanceof RoiEconomicModelNotEditableError ||
    err instanceof RoiCalculationPolicyFrozenError ||
    err instanceof RoiAssumptionFrozenError ||
    err instanceof RoiCostLineFrozenError ||
    err instanceof RoiBenefitLineFrozenError ||
    err instanceof RoiBenefitLineValidationError ||
    err instanceof RoiBenefitEvidenceLinkValidationError ||
    err instanceof RoiScenarioFrozenError ||
    err instanceof RoiScenarioValidationError ||
    err instanceof RoiCalculationRunValidationError
  ) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // ROI-E004 §6: RoiActualSelfVerificationDeniedError checked ahead of the
  // generic 409 validation branch — Decision D10's self-verification denial
  // is a 403 (authorization), same character as RoiSelfApprovalDeniedError
  // above, not a 409 (state-conflict). RoiActualEntryNotFoundError is a 404
  // (referenced actual_entry_id does not exist), also checked ahead of the
  // generic 409 branch for the same "more specific status code first" reason.
  if (err instanceof RoiActualSelfVerificationDeniedError) {
    res.status(403).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiActualEntryNotFoundError || err instanceof RoiVarianceNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (
    err instanceof RoiForecastVersionValidationError ||
    err instanceof RoiActualEntryValidationError ||
    err instanceof RoiVarianceValidationError
  ) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // ROI-E007 §6: RoiFinanceLinkNotFoundError/RoiFinanceReconciliationNotFoundError
  // are 404s (a referenced financeLinkId/reconciliationId does not exist on
  // this case), same "more specific status code first" placement every other
  // *NotFoundError above uses. RoiFinanceReconciliationValidationError is a
  // 409, matching every other typed precondition-failure error in this
  // router.
  if (err instanceof RoiFinanceLinkNotFoundError || err instanceof RoiFinanceReconciliationNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof RoiFinanceReconciliationValidationError) {
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
      const access = await resolveAccess(req, auth);
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
        access,
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
      const access = await resolveAccess(req, auth);
      const outcome = await archiveRoiCase({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
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
        const access = await resolveAccess(req, auth);
        const outcome = await runner({
          caseId,
          organizationId: auth.organizationId,
          expectedVersion: body.expectedVersion,
          actorUserId: auth.userId,
          actorEffectiveRole: auth.role,
          idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
          correlationId: getCorrelationId(req),
          reason: body.reason ?? null,
          access,
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
      const access = await resolveAccess(req, auth);
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
        access,
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

// ==========================================================================
// ROI-E002 — Economic Model routes (design §7)
// ==========================================================================

/** Shared existing-case 404 guard, identical shape to every write route
 * above (`includeArchived: true` — a specific known id must not 404 merely
 * because the case was archived, Decision D4). */
async function requireExistingRoiCase(
  auth: RouteAuth,
  caseId: string,
  res: Response
): Promise<boolean> {
  const existing = await getRoiCase({ userId: auth.userId, organizationId: auth.organizationId, caseId, includeArchived: true });
  if (!existing) {
    res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
    return false;
  }
  return true;
}

// ---------- GET/PUT .../calculation-policy ----------

router.get(
  '/cases/:caseId/calculation-policy',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const policy = await getCalculationPolicy({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      if (!policy) {
        res.status(404).json({ error: 'ROI calculation policy not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ calculationPolicy: policy });
    } catch (err) {
      handleRoiRouteError(res, err, 'getCalculationPolicy');
    }
  }
);

router.put(
  '/cases/:caseId/calculation-policy',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(CaptureOrUpdateCalculationPolicySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof CaptureOrUpdateCalculationPolicySchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await captureOrUpdateCalculationPolicy({
        organizationId: auth.organizationId,
        caseId,
        expectedVersion: body.expectedVersion,
        discountRatePct: body.discountRatePct,
        taxTreatment: body.taxTreatment,
        inflationRatePct: body.inflationRatePct,
        roundingPolicy: body.roundingPolicy,
        requiredMetrics: body.requiredMetrics,
        notes: body.notes,
        confidence: body.confidence,
        ownerUserId: body.ownerUserId,
        actorId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        calculationPolicy: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'captureOrUpdateCalculationPolicy');
    }
  }
);

// ---------- GET/POST/PATCH/DELETE .../assumptions[/:assumptionId] ----------

router.get(
  '/cases/:caseId/assumptions',
  validateParams(RoiCaseIdParamsSchema),
  validateQuery(IncludeDeletedQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof IncludeDeletedQuerySchema>;
      const assumptions = await listAssumptions({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeDeleted: query.includeDeleted,
      });
      res.status(200).json({ assumptions });
    } catch (err) {
      handleRoiRouteError(res, err, 'listAssumptions');
    }
  }
);

router.get(
  '/cases/:caseId/assumptions/:assumptionId',
  validateParams(RoiAssumptionParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, assumptionId } = req.params as { caseId: string; assumptionId: string };
      const assumption = await getAssumption({ userId: auth.userId, organizationId: auth.organizationId, caseId, assumptionId });
      if (!assumption) {
        res.status(404).json({ error: 'ROI assumption not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ assumption });
    } catch (err) {
      handleRoiRouteError(res, err, 'getAssumption');
    }
  }
);

router.post(
  '/cases/:caseId/assumptions',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(AddAssumptionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof AddAssumptionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addAssumption({
        caseId,
        organizationId: auth.organizationId,
        category: body.category,
        label: body.label,
        unit: body.unit,
        baseValue: body.baseValue,
        downsideValue: body.downsideValue,
        upsideValue: body.upsideValue,
        confidence: body.confidence,
        evidenceRef: body.evidenceRef,
        source: body.source,
        ownerUserId: body.ownerUserId,
        sensitivityRank: body.sensitivityRank,
        notes: body.notes,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        assumption: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'addAssumption');
    }
  }
);

router.patch(
  '/cases/:caseId/assumptions/:assumptionId',
  validateParams(RoiAssumptionParamsSchema),
  validateBody(UpdateAssumptionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, assumptionId } = req.params as { caseId: string; assumptionId: string };
      const body = req.body as import('zod').infer<typeof UpdateAssumptionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateAssumption({
        assumptionId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        category: body.category,
        label: body.label,
        unit: body.unit,
        baseValue: body.baseValue,
        downsideValue: body.downsideValue,
        upsideValue: body.upsideValue,
        confidence: body.confidence,
        evidenceRef: body.evidenceRef,
        source: body.source,
        ownerUserId: body.ownerUserId,
        sensitivityRank: body.sensitivityRank,
        notes: body.notes,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        assumption: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateAssumption');
    }
  }
);

router.delete(
  '/cases/:caseId/assumptions/:assumptionId',
  validateParams(RoiAssumptionParamsSchema),
  validateBody(RemoveAssumptionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, assumptionId } = req.params as { caseId: string; assumptionId: string };
      const body = req.body as import('zod').infer<typeof RemoveAssumptionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeAssumption({
        assumptionId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        assumption: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeAssumption');
    }
  }
);

// ---------- GET/POST/PATCH/DELETE .../cost-lines[/:costLineId] ----------

router.get(
  '/cases/:caseId/cost-lines',
  validateParams(RoiCaseIdParamsSchema),
  validateQuery(IncludeDeletedQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof IncludeDeletedQuerySchema>;
      const costLines = await listCostLines({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeDeleted: query.includeDeleted,
      });
      res.status(200).json({ costLines });
    } catch (err) {
      handleRoiRouteError(res, err, 'listCostLines');
    }
  }
);

router.get(
  '/cases/:caseId/cost-lines/:costLineId',
  validateParams(RoiCostLineParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, costLineId } = req.params as { caseId: string; costLineId: string };
      const costLine = await getCostLine({ userId: auth.userId, organizationId: auth.organizationId, caseId, costLineId });
      if (!costLine) {
        res.status(404).json({ error: 'ROI cost line not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ costLine });
    } catch (err) {
      handleRoiRouteError(res, err, 'getCostLine');
    }
  }
);

router.post(
  '/cases/:caseId/cost-lines',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(AddCostLineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof AddCostLineSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addCostLine({
        caseId,
        organizationId: auth.organizationId,
        category: body.category,
        label: body.label,
        description: body.description,
        amount: body.amount,
        currency: body.currency,
        timingType: body.timingType,
        oneTimePeriodDate: body.oneTimePeriodDate,
        recurrenceStartDate: body.recurrenceStartDate,
        recurrenceEndDate: body.recurrenceEndDate,
        recurrenceCadence: body.recurrenceCadence,
        confidence: body.confidence,
        source: body.source,
        ownerUserId: body.ownerUserId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        costLine: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'addCostLine');
    }
  }
);

router.patch(
  '/cases/:caseId/cost-lines/:costLineId',
  validateParams(RoiCostLineParamsSchema),
  validateBody(UpdateCostLineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, costLineId } = req.params as { caseId: string; costLineId: string };
      const body = req.body as import('zod').infer<typeof UpdateCostLineSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateCostLine({
        costLineId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        category: body.category,
        label: body.label,
        description: body.description,
        amount: body.amount,
        currency: body.currency,
        timingType: body.timingType,
        oneTimePeriodDate: body.oneTimePeriodDate,
        recurrenceStartDate: body.recurrenceStartDate,
        recurrenceEndDate: body.recurrenceEndDate,
        recurrenceCadence: body.recurrenceCadence,
        confidence: body.confidence,
        source: body.source,
        ownerUserId: body.ownerUserId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        costLine: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateCostLine');
    }
  }
);

router.delete(
  '/cases/:caseId/cost-lines/:costLineId',
  validateParams(RoiCostLineParamsSchema),
  validateBody(RemoveCostLineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, costLineId } = req.params as { caseId: string; costLineId: string };
      const body = req.body as import('zod').infer<typeof RemoveCostLineSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeCostLine({
        costLineId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        costLine: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeCostLine');
    }
  }
);

// ---------- GET/POST/PATCH/DELETE .../benefit-lines[/:benefitLineId] ----------

router.get(
  '/cases/:caseId/benefit-lines',
  validateParams(RoiCaseIdParamsSchema),
  validateQuery(IncludeDeletedQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof IncludeDeletedQuerySchema>;
      const benefitLines = await listBenefitLines({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeDeleted: query.includeDeleted,
      });
      res.status(200).json({ benefitLines });
    } catch (err) {
      handleRoiRouteError(res, err, 'listBenefitLines');
    }
  }
);

router.get(
  '/cases/:caseId/benefit-lines/:benefitLineId',
  validateParams(RoiBenefitLineParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, benefitLineId } = req.params as { caseId: string; benefitLineId: string };
      const benefitLine = await getBenefitLine({ userId: auth.userId, organizationId: auth.organizationId, caseId, benefitLineId });
      if (!benefitLine) {
        res.status(404).json({ error: 'ROI benefit line not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ benefitLine });
    } catch (err) {
      handleRoiRouteError(res, err, 'getBenefitLine');
    }
  }
);

router.post(
  '/cases/:caseId/benefit-lines',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(AddBenefitLineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof AddBenefitLineSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addBenefitLine({
        caseId,
        organizationId: auth.organizationId,
        category: body.category,
        label: body.label,
        description: body.description,
        isFinancial: body.isFinancial,
        amount: body.amount,
        currency: body.currency,
        timingType: body.timingType,
        oneTimePeriodDate: body.oneTimePeriodDate,
        recurrenceStartDate: body.recurrenceStartDate,
        recurrenceEndDate: body.recurrenceEndDate,
        recurrenceCadence: body.recurrenceCadence,
        rampPeriods: body.rampPeriods,
        doubleCountingGroup: body.doubleCountingGroup,
        doubleCountingResolutionNote: body.doubleCountingResolutionNote,
        confidence: body.confidence,
        source: body.source,
        ownerUserId: body.ownerUserId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        benefitLine: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'addBenefitLine');
    }
  }
);

router.patch(
  '/cases/:caseId/benefit-lines/:benefitLineId',
  validateParams(RoiBenefitLineParamsSchema),
  validateBody(UpdateBenefitLineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, benefitLineId } = req.params as { caseId: string; benefitLineId: string };
      const body = req.body as import('zod').infer<typeof UpdateBenefitLineSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateBenefitLine({
        benefitLineId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        category: body.category,
        label: body.label,
        description: body.description,
        isFinancial: body.isFinancial,
        amount: body.amount,
        currency: body.currency,
        timingType: body.timingType,
        oneTimePeriodDate: body.oneTimePeriodDate,
        recurrenceStartDate: body.recurrenceStartDate,
        recurrenceEndDate: body.recurrenceEndDate,
        recurrenceCadence: body.recurrenceCadence,
        rampPeriods: body.rampPeriods,
        doubleCountingGroup: body.doubleCountingGroup,
        doubleCountingResolutionNote: body.doubleCountingResolutionNote,
        confidence: body.confidence,
        source: body.source,
        ownerUserId: body.ownerUserId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        benefitLine: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateBenefitLine');
    }
  }
);

router.delete(
  '/cases/:caseId/benefit-lines/:benefitLineId',
  validateParams(RoiBenefitLineParamsSchema),
  validateBody(RemoveBenefitLineSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, benefitLineId } = req.params as { caseId: string; benefitLineId: string };
      const body = req.body as import('zod').infer<typeof RemoveBenefitLineSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeBenefitLine({
        benefitLineId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        benefitLine: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeBenefitLine');
    }
  }
);

// ---------- GET/POST/DELETE .../benefit-lines/:benefitLineId/kpi-evidence-links[/:linkId] ----------
// NOTE: `flagBenefitEvidenceLinkDisputed` (roiBenefitEvidenceLinkCommands.ts)
// has no route here — design §7's table lists only GET/POST/DELETE for this
// path. The command exists (design §4) for a future epic/UI surface to call;
// intentionally not wired to HTTP in E002, not a silent omission.

router.get(
  '/cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links',
  validateParams(RoiBenefitEvidenceLinkListParamsSchema),
  validateQuery(ListBenefitEvidenceLinksQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, benefitLineId } = req.params as { caseId: string; benefitLineId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListBenefitEvidenceLinksQuerySchema>;
      const links = await listBenefitEvidenceLinks({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        benefitLineId,
        hydrateKpiDetails: query.hydrateKpiDetails,
      });
      res.status(200).json({ links });
    } catch (err) {
      handleRoiRouteError(res, err, 'listBenefitEvidenceLinks');
    }
  }
);

router.post(
  '/cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links',
  validateParams(RoiBenefitEvidenceLinkListParamsSchema),
  validateBody(AddBenefitEvidenceLinkSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, benefitLineId } = req.params as { caseId: string; benefitLineId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof AddBenefitEvidenceLinkSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addBenefitEvidenceLink({
        benefitLineId,
        caseId,
        organizationId: auth.organizationId,
        kpiId: body.kpiId,
        pinnedKpiDefinitionVersionId: body.pinnedKpiDefinitionVersionId,
        expectedUnit: body.expectedUnit,
        purpose: body.purpose,
        notes: body.notes,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        link: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'addBenefitEvidenceLink');
    }
  }
);

router.delete(
  '/cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links/:linkId',
  validateParams(RoiBenefitEvidenceLinkParamsSchema),
  validateBody(RemoveBenefitEvidenceLinkSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, linkId } = req.params as { caseId: string; benefitLineId: string; linkId: string };
      const body = req.body as import('zod').infer<typeof RemoveBenefitEvidenceLinkSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeBenefitEvidenceLink({
        linkId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        linkId: outcome.result.linkId,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeBenefitEvidenceLink');
    }
  }
);

// ---------- GET/POST/PATCH/DELETE .../scenarios[/:scenarioId] ----------

router.get(
  '/cases/:caseId/scenarios',
  validateParams(RoiCaseIdParamsSchema),
  validateQuery(IncludeDeletedQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof IncludeDeletedQuerySchema>;
      const scenarios = await listScenarios({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeDeleted: query.includeDeleted,
      });
      res.status(200).json({ scenarios });
    } catch (err) {
      handleRoiRouteError(res, err, 'listScenarios');
    }
  }
);

router.get(
  '/cases/:caseId/scenarios/:scenarioId',
  validateParams(RoiScenarioParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, scenarioId } = req.params as { caseId: string; scenarioId: string };
      const scenario = await getScenario({ userId: auth.userId, organizationId: auth.organizationId, caseId, scenarioId });
      if (!scenario) {
        res.status(404).json({ error: 'ROI scenario not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ scenario });
    } catch (err) {
      handleRoiRouteError(res, err, 'getScenario');
    }
  }
);

router.post(
  '/cases/:caseId/scenarios',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(AddScenarioSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof AddScenarioSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addScenario({
        caseId,
        organizationId: auth.organizationId,
        scenarioType: body.scenarioType,
        label: body.label,
        description: body.description,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        scenario: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'addScenario');
    }
  }
);

router.patch(
  '/cases/:caseId/scenarios/:scenarioId',
  validateParams(RoiScenarioParamsSchema),
  validateBody(UpdateScenarioSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, scenarioId } = req.params as { caseId: string; scenarioId: string };
      const body = req.body as import('zod').infer<typeof UpdateScenarioSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateScenario({
        scenarioId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        label: body.label,
        description: body.description,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        scenario: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateScenario');
    }
  }
);

router.delete(
  '/cases/:caseId/scenarios/:scenarioId',
  validateParams(RoiScenarioParamsSchema),
  validateBody(RemoveScenarioSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, scenarioId } = req.params as { caseId: string; scenarioId: string };
      const body = req.body as import('zod').infer<typeof RemoveScenarioSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeScenario({
        scenarioId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        scenario: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeScenario');
    }
  }
);

// ---------- POST .../scenarios/:scenarioId/overrides ; DELETE .../overrides/:overrideId ----------

router.post(
  '/cases/:caseId/scenarios/:scenarioId/overrides',
  validateParams(RoiScenarioParamsSchema),
  validateBody(SetScenarioOverrideSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, scenarioId } = req.params as { caseId: string; scenarioId: string };
      const body = req.body as import('zod').infer<typeof SetScenarioOverrideSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await setScenarioOverride({
        scenarioId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        targetType: body.targetType,
        targetId: body.targetId,
        overrideValue: body.overrideValue,
        overrideAmount: body.overrideAmount,
        note: body.note,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        override: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'setScenarioOverride');
    }
  }
);

// ---------- GET .../scenarios/:scenarioId/overrides — listScenarioOverrides ----------
//
// RN-G6-SRV / B3: the read side of `setScenarioOverride`/`removeScenarioOverride`
// above was missing entirely — an override could be SET and REMOVED but never
// READ back through any API (`roiEconomicModelRepository.ts`'s own
// `listScenarioOverrides`, fully visibility-scoped via `wrapWithVisibilityScope`
// / resourceType `ROI_RESOURCE_TYPE`, inherited through the parent scenario's
// own `case_id` — see that function's header comment — already existed and was
// simply never wired to a route). Thin wrapper only, no new query logic.

router.get(
  '/cases/:caseId/scenarios/:scenarioId/overrides',
  validateParams(RoiScenarioParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, scenarioId } = req.params as { caseId: string; scenarioId: string };
      const overrides = await listScenarioOverrides({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        scenarioId,
      });
      res.status(200).json({ overrides });
    } catch (err) {
      handleRoiRouteError(res, err, 'listScenarioOverrides');
    }
  }
);

router.delete(
  '/cases/:caseId/scenarios/:scenarioId/overrides/:overrideId',
  validateParams(RoiScenarioOverrideParamsSchema),
  validateBody(RemoveScenarioOverrideSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, scenarioId, overrideId } = req.params as {
        caseId: string;
        scenarioId: string;
        overrideId: string;
      };
      const body = req.body as import('zod').infer<typeof RemoveScenarioOverrideSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeScenarioOverride({
        overrideId,
        scenarioId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        overrideId: outcome.result.overrideId,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeScenarioOverride');
    }
  }
);

// ---------- POST/GET .../calculation-runs[/:runId] ----------

router.post(
  '/cases/:caseId/calculation-runs',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(CreateRoiCalculationRunSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof CreateRoiCalculationRunSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await createRoiCalculationRun({
        organizationId: auth.organizationId,
        caseId,
        scenarioId: body.scenarioId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        run: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'createRoiCalculationRun');
    }
  }
);

router.get(
  '/cases/:caseId/calculation-runs',
  validateParams(RoiCaseIdParamsSchema),
  validateQuery(ListCalculationRunsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListCalculationRunsQuerySchema>;
      const runs = await listCalculationRuns({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ runs });
    } catch (err) {
      handleRoiRouteError(res, err, 'listCalculationRuns');
    }
  }
);

router.get(
  '/cases/:caseId/calculation-runs/:runId',
  validateParams(RoiCalculationRunParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, runId } = req.params as { caseId: string; runId: string };
      const run = await getCalculationRun({ userId: auth.userId, organizationId: auth.organizationId, caseId, runId });
      if (!run) {
        res.status(404).json({ error: 'ROI calculation run not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ run });
    } catch (err) {
      handleRoiRouteError(res, err, 'getCalculationRun');
    }
  }
);

// ==========================================================================
// ROI-E003 — Decision & Approved routes (design §7)
// ==========================================================================

// ---------- POST .../transitions/submit-for-approval ----------
// RN-G5: no longer routed through mountTransitionRoute — submitRoiCaseForApproval
// now requires an `access` context (commandCapabilityGuard.ts) that
// mountTransitionRoute's shared `runner` signature (still shaped after
// startModeling/reopenRejectedRoiCase, neither of which is gated by this
// pakiet) does not provide. Hand-rolled instead, same shape mountTransitionRoute
// produces (bare RoiCase result), same pattern approveRoiCase/rejectRoiCase/
// requestChangesOnRoiCase below already use for the same reason.

router.post(
  '/cases/:caseId/transitions/submit-for-approval',
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
      const access = await resolveAccess(req, auth);
      const outcome = await submitRoiCaseForApproval({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'submitRoiCaseForApproval');
    }
  }
);

// ---------- POST .../transitions/reopen-after-rejection ----------
// reopenRejectedRoiCase (roiCaseCommands.ts) is NOT gated by this pakiet —
// still routed through the generic mountTransitionRoute.

mountTransitionRoute(
  '/cases/:caseId/transitions/reopen-after-rejection',
  'reopenRejectedRoiCase',
  reopenRejectedRoiCase
);

// ---------- POST .../transitions/approve ----------
// Not routed through mountTransitionRoute — approveRoiCase's input uses
// `approverId` (not `actorUserId`) and returns { case, snapshot }, not a
// bare RoiCase.

router.post(
  '/cases/:caseId/transitions/approve',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RoiCaseTransitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RoiCaseTransitionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await approveRoiCase({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        approverId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result.case,
        snapshot: outcome.result.snapshot,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'approveRoiCase');
    }
  }
);

// ---------- POST .../transitions/reject ----------

router.post(
  '/cases/:caseId/transitions/reject',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RejectRoiCaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RejectRoiCaseSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await rejectRoiCase({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        rejectedBy: auth.userId,
        rejectionReason: body.rejectionReason,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'rejectRoiCase');
    }
  }
);

// ---------- POST .../transitions/request-changes ----------

router.post(
  '/cases/:caseId/transitions/request-changes',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RequestChangesOnRoiCaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RequestChangesOnRoiCaseSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await requestChangesOnRoiCase({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        changeRequestNotes: body.changeRequestNotes,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'requestChangesOnRoiCase');
    }
  }
);

// ---------- POST .../transitions/reopen-for-revision ----------

router.post(
  '/cases/:caseId/transitions/reopen-for-revision',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(ReopenApprovedRoiCaseForRevisionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof ReopenApprovedRoiCaseForRevisionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await reopenApprovedRoiCaseForRevision({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        reason: body.reason,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'reopenApprovedRoiCaseForRevision');
    }
  }
);

// ---------- GET .../approval-snapshots ; GET .../approval-snapshots/:snapshotId ----------

router.get(
  '/cases/:caseId/approval-snapshots',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const snapshots = await listRoiApprovalSnapshots({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
      });
      res.status(200).json({ snapshots });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiApprovalSnapshots');
    }
  }
);

router.get(
  '/cases/:caseId/approval-snapshots/:snapshotId',
  validateParams(RoiApprovalSnapshotParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, snapshotId } = req.params as { caseId: string; snapshotId: string };
      const snapshot = await getRoiApprovalSnapshot({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        snapshotId,
      });
      if (!snapshot) {
        res.status(404).json({ error: 'ROI approval snapshot not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ snapshot });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiApprovalSnapshot');
    }
  }
);

// ==========================================================================
// ROI-E004 — Forecast & Actual routes (design §6)
// ==========================================================================

// ---------- POST .../transitions/start-tracking — startRoiCaseTracking ----------
// Reuses mountTransitionRoute — startRoiCaseTracking's input shape is
// RunRoiCaseLifecycleTransitionInput-compatible (caseId/organizationId/
// expectedVersion/actorUserId/actorEffectiveRole/idempotencyKey/
// correlationId/causationId/reason), same as submitRoiCaseForApproval/
// reopenRejectedRoiCase above.

mountTransitionRoute('/cases/:caseId/transitions/start-tracking', 'startRoiCaseTracking', startRoiCaseTracking);

// ---------- POST/GET .../forecast-versions[/:forecastVersionId] ----------

router.post(
  '/cases/:caseId/forecast-versions',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(CreateRoiForecastVersionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof CreateRoiForecastVersionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await createRoiForecastVersion({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        reason: body.reason,
        overrides: body.overrides,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        forecastVersion: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'createRoiForecastVersion');
    }
  }
);

router.get(
  '/cases/:caseId/forecast-versions',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const forecastVersions = await listRoiForecastVersions({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      res.status(200).json({ forecastVersions });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiForecastVersions');
    }
  }
);

router.get(
  '/cases/:caseId/forecast-versions/:forecastVersionId',
  validateParams(RoiForecastVersionParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, forecastVersionId } = req.params as { caseId: string; forecastVersionId: string };
      const forecastVersion = await getRoiForecastVersion({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        forecastVersionId,
      });
      if (!forecastVersion) {
        res.status(404).json({ error: 'ROI forecast version not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ forecastVersion });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiForecastVersion');
    }
  }
);

// ---------- GET .../compare — getRoiCaseCompareView (AC-04) ----------

router.get(
  '/cases/:caseId/compare',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const compareView = await getRoiCaseCompareView({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      if (!compareView) {
        res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ compare: compareView });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiCaseCompareView');
    }
  }
);

// ---------- GET/POST .../actuals ; GET .../actuals/:entryId ----------

router.get(
  '/cases/:caseId/actuals',
  validateParams(RoiCaseIdParamsSchema),
  validateQuery(ListActualEntriesQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListActualEntriesQuerySchema>;
      const entries = await listActualEntries({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        includeSuperseded: query.includeSuperseded,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ entries });
    } catch (err) {
      handleRoiRouteError(res, err, 'listActualEntries');
    }
  }
);

router.post(
  '/cases/:caseId/actuals',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RecordActualEntrySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RecordActualEntrySchema>;
      const outcome = await recordActualEntry({
        caseId,
        organizationId: auth.organizationId,
        entryType: body.entryType,
        costLineId: body.costLineId,
        benefitLineId: body.benefitLineId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        amount: body.amount,
        currency: body.currency,
        source: body.source,
        evidenceRefs: body.evidenceRefs,
        notes: body.notes,
        recordedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        actualEntry: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'recordActualEntry');
    }
  }
);

router.get(
  '/cases/:caseId/actuals/:entryId',
  validateParams(RoiActualEntryParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, entryId } = req.params as { caseId: string; entryId: string };
      const entry = await getActualEntry({ userId: auth.userId, organizationId: auth.organizationId, caseId, actualEntryId: entryId });
      if (!entry) {
        res.status(404).json({ error: 'ROI actual entry not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ actualEntry: entry });
    } catch (err) {
      handleRoiRouteError(res, err, 'getActualEntry');
    }
  }
);

// ---------- POST .../actuals/:entryId/corrections | /verify | /dispute ----------

router.post(
  '/cases/:caseId/actuals/:entryId/corrections',
  validateParams(RoiActualEntryParamsSchema),
  validateBody(CorrectActualEntrySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { entryId } = req.params as { caseId: string; entryId: string };
      const body = req.body as import('zod').infer<typeof CorrectActualEntrySchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await correctActualEntry({
        actualEntryId: entryId,
        organizationId: auth.organizationId,
        amount: body.amount,
        currency: body.currency,
        correctionReason: body.correctionReason,
        recordedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        actualEntry: outcome.result.superseding,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'correctActualEntry');
    }
  }
);

router.post(
  '/cases/:caseId/actuals/:entryId/verify',
  validateParams(RoiActualEntryParamsSchema),
  validateBody(VerifyActualEntrySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { entryId } = req.params as { caseId: string; entryId: string };
      const body = req.body as import('zod').infer<typeof VerifyActualEntrySchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await verifyActualEntry({
        actualEntryId: entryId,
        organizationId: auth.organizationId,
        verifierId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        notes: body.notes,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        actualEntry: outcome.result.superseding,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'verifyActualEntry');
    }
  }
);

router.post(
  '/cases/:caseId/actuals/:entryId/dispute',
  validateParams(RoiActualEntryParamsSchema),
  validateBody(DisputeActualEntrySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { entryId } = req.params as { caseId: string; entryId: string };
      const body = req.body as import('zod').infer<typeof DisputeActualEntrySchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await disputeActualEntry({
        actualEntryId: entryId,
        organizationId: auth.organizationId,
        disputedBy: auth.userId,
        disputeReason: body.disputeReason,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        actualEntry: outcome.result.superseding,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'disputeActualEntry');
    }
  }
);

// ---------- POST/GET .../actual-snapshots[/:actualSnapshotId] ----------

router.post(
  '/cases/:caseId/actual-snapshots',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(PublishRoiActualSnapshotSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof PublishRoiActualSnapshotSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await publishRoiActualSnapshot({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        asOfPeriodEnd: body.asOfPeriodEnd,
        publishedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        actualSnapshot: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'publishRoiActualSnapshot');
    }
  }
);

router.get(
  '/cases/:caseId/actual-snapshots',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const actualSnapshots = await listRoiActualSnapshots({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      res.status(200).json({ actualSnapshots });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiActualSnapshots');
    }
  }
);

router.get(
  '/cases/:caseId/actual-snapshots/:actualSnapshotId',
  validateParams(RoiActualSnapshotParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, actualSnapshotId } = req.params as { caseId: string; actualSnapshotId: string };
      const actualSnapshot = await getRoiActualSnapshot({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        actualSnapshotId,
      });
      if (!actualSnapshot) {
        res.status(404).json({ error: 'ROI actual snapshot not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ actualSnapshot });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiActualSnapshot');
    }
  }
);

// ---------- GET/POST .../variances ; GET/PATCH .../variances/:varianceId ----------

router.get(
  '/cases/:caseId/variances',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const variances = await listVariances({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      res.status(200).json({ variances });
    } catch (err) {
      handleRoiRouteError(res, err, 'listVariances');
    }
  }
);

router.post(
  '/cases/:caseId/variances',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RecordVarianceSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RecordVarianceSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await recordVariance({
        caseId,
        organizationId: auth.organizationId,
        comparisonType: body.comparisonType,
        metric: body.metric,
        referenceApprovalSnapshotId: body.referenceApprovalSnapshotId,
        referenceForecastVersionId: body.referenceForecastVersionId,
        referenceActualSnapshotId: body.referenceActualSnapshotId,
        ownerUserId: body.ownerUserId,
        createdBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        variance: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'recordVariance');
    }
  }
);

router.get(
  '/cases/:caseId/variances/:varianceId',
  validateParams(RoiVarianceParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, varianceId } = req.params as { caseId: string; varianceId: string };
      const variance = await getVariance({ userId: auth.userId, organizationId: auth.organizationId, caseId, varianceId });
      if (!variance) {
        res.status(404).json({ error: 'ROI variance not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ variance });
    } catch (err) {
      handleRoiRouteError(res, err, 'getVariance');
    }
  }
);

router.patch(
  '/cases/:caseId/variances/:varianceId',
  validateParams(RoiVarianceParamsSchema),
  validateBody(UpdateVarianceStatusSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, varianceId } = req.params as { caseId: string; varianceId: string };
      const body = req.body as import('zod').infer<typeof UpdateVarianceStatusSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateVarianceStatus({
        varianceId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        status: body.status,
        ownerUserId: body.ownerUserId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        variance: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateVarianceStatus');
    }
  }
);

// ---------- POST .../variances/:varianceId/causes ; DELETE .../causes/:causeId ----------

router.post(
  '/cases/:caseId/variances/:varianceId/causes',
  validateParams(RoiVarianceParamsSchema),
  validateBody(AddVarianceCauseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { varianceId } = req.params as { caseId: string; varianceId: string };
      const body = req.body as import('zod').infer<typeof AddVarianceCauseSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addVarianceCause({
        varianceId,
        organizationId: auth.organizationId,
        causeCategory: body.causeCategory,
        contributionPct: body.contributionPct,
        narrative: body.narrative,
        createdBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        varianceCause: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'addVarianceCause');
    }
  }
);

router.delete(
  '/cases/:caseId/variances/:varianceId/causes/:causeId',
  validateParams(RoiVarianceCauseParamsSchema),
  validateBody(RemoveVarianceCauseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { varianceId, causeId } = req.params as { caseId: string; varianceId: string; causeId: string };
      const body = req.body as import('zod').infer<typeof RemoveVarianceCauseSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeVarianceCause({
        causeId,
        varianceId,
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        causeId: outcome.result.causeId,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeVarianceCause');
    }
  }
);

// ==========================================================================
// ROI-E005 — Benefits Realization routes (design §4)
// ==========================================================================

// ---------- POST .../transitions/start-benefits-realization ----------
// Reuses mountTransitionRoute — startRoiCaseBenefitsRealization's input shape
// is RunRoiCaseLifecycleTransitionInput-compatible (caseId/organizationId/
// expectedVersion/actorUserId/actorEffectiveRole/idempotencyKey/
// correlationId/causationId/reason), same as startRoiCaseTracking above.

mountTransitionRoute(
  '/cases/:caseId/transitions/start-benefits-realization',
  'startRoiCaseBenefitsRealization',
  startRoiCaseBenefitsRealization
);

// ---------- POST .../transitions/cancel — cancelRoiCase ----------
// NOT routed through mountTransitionRoute — cancelRoiCase's `reason` is
// mandatory (Decision D8), unlike RoiCaseTransitionSchema's optional/
// nullable one mountTransitionRoute hardcodes, so this needs its own schema
// (RoiCaseCancellationSchema) and its own handler — same shape as the
// `/transitions/reject` route above (RejectRoiCaseSchema's mandatory
// rejectionReason).

router.post(
  '/cases/:caseId/transitions/cancel',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RoiCaseCancellationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RoiCaseCancellationSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await cancelRoiCase({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        reason: body.reason,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'cancelRoiCase');
    }
  }
);

// ---------- GET .../benefits-realization — getRoiCaseBenefitsRealizationView ----------
// Decision D14: no status restriction — readable in any status, same "no
// status restriction on GET routes" convention `getRoiCaseCompareView`'s own
// route above uses.

router.get(
  '/cases/:caseId/benefits-realization',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const view = await getRoiCaseBenefitsRealizationView({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      if (!view) {
        res.status(404).json({ error: 'ROI case not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ benefitsRealization: view });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiCaseBenefitsRealizationView');
    }
  }
);

// ==========================================================================
// ROI-E006 — PIR & Learning routes (design §9)
// ==========================================================================

// ---------- PUT .../post-investment-review-schedule — scheduleRoiCasePostInvestmentReview ----------

router.put(
  '/cases/:caseId/post-investment-review-schedule',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(ScheduleRoiCasePostInvestmentReviewSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof ScheduleRoiCasePostInvestmentReviewSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await scheduleRoiCasePostInvestmentReview({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        nextReviewAt: body.nextReviewAt,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'scheduleRoiCasePostInvestmentReview');
    }
  }
);

// ---------- POST .../transitions/mark-pir-due — markRoiCasePostInvestmentReviewDue ----------
// Reuses mountTransitionRoute — MarkRoiCasePostInvestmentReviewDueInput is
// structurally RunRoiCaseLifecycleTransitionInput-compatible.

mountTransitionRoute(
  '/cases/:caseId/transitions/mark-pir-due',
  'markRoiCasePostInvestmentReviewDue',
  markRoiCasePostInvestmentReviewDue
);

// ---------- POST .../transitions/start-pir — startRoiCasePostInvestmentReview ----------
// NOT routed through mountTransitionRoute — the result shape is
// { case, pir }, not a bare RoiCase.

router.post(
  '/cases/:caseId/transitions/start-pir',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(RoiCaseTransitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof RoiCaseTransitionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await startRoiCasePostInvestmentReview({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result.case,
        pir: outcome.result.pir,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'startRoiCasePostInvestmentReview');
    }
  }
);

// ---------- GET .../post-investment-reviews[/:pirId] ----------

router.get(
  '/cases/:caseId/post-investment-reviews',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const postInvestmentReviews = await listRoiPostInvestmentReviews({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
      });
      res.status(200).json({ postInvestmentReviews });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiPostInvestmentReviews');
    }
  }
);

router.get(
  '/cases/:caseId/post-investment-reviews/:pirId',
  validateParams(RoiPirParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, pirId } = req.params as { caseId: string; pirId: string };
      const postInvestmentReview = await getRoiPostInvestmentReview({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
        pirId,
      });
      if (!postInvestmentReview) {
        res.status(404).json({ error: 'ROI post-investment review not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ postInvestmentReview });
    } catch (err) {
      handleRoiRouteError(res, err, 'getRoiPostInvestmentReview');
    }
  }
);

// ---------- PATCH .../post-investment-reviews/:pirId — updateRoiPostInvestmentReviewDraft ----------

router.patch(
  '/cases/:caseId/post-investment-reviews/:pirId',
  validateParams(RoiPirParamsSchema),
  validateBody(UpdateRoiPostInvestmentReviewDraftSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, pirId } = req.params as { caseId: string; pirId: string };
      const body = req.body as import('zod').infer<typeof UpdateRoiPostInvestmentReviewDraftSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateRoiPostInvestmentReviewDraft({
        pirId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        outcome: body.outcome,
        lessonsLearned: body.lessonsLearned,
        recommendation: body.recommendation,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        postInvestmentReview: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateRoiPostInvestmentReviewDraft');
    }
  }
);

// ---------- POST .../post-investment-reviews/:pirId/teresa-draft-disposition — recordRoiPirTeresaDraftDisposition (AC-06) ----------

router.post(
  '/cases/:caseId/post-investment-reviews/:pirId/teresa-draft-disposition',
  validateParams(RoiPirParamsSchema),
  validateBody(RecordRoiPirTeresaDraftDispositionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, pirId } = req.params as { caseId: string; pirId: string };
      const body = req.body as import('zod').infer<typeof RecordRoiPirTeresaDraftDispositionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await recordRoiPirTeresaDraftDisposition({
        pirId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        disposition: body.disposition,
        finalLessonsText: body.finalLessonsText,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        postInvestmentReview: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'recordRoiPirTeresaDraftDisposition');
    }
  }
);

// ---------- POST .../transitions/close — closeRoiCase (AC-03, D6) ----------
// NOT routed through mountTransitionRoute — openVarianceWaiverReason is an
// extra optional field CloseRoiCaseSchema carries, and the result shape is
// { case, pir }, not a bare RoiCase.

router.post(
  '/cases/:caseId/transitions/close',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(CloseRoiCaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof CloseRoiCaseSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await closeRoiCase({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        openVarianceWaiverReason: body.openVarianceWaiverReason,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result.case,
        pir: outcome.result.pir,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'closeRoiCase');
    }
  }
);

// ==========================================================================
// ROI-E007 — Finance/KPI Seams routes (design §6)
// ==========================================================================

// ---------- GET/POST .../finance-links ; DELETE .../finance-links/:linkId ----------

router.get(
  '/cases/:caseId/finance-links',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const financeLinks = await listRoiFinanceLinks({ userId: auth.userId, organizationId: auth.organizationId, caseId });
      res.status(200).json({ financeLinks });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiFinanceLinks');
    }
  }
);

router.post(
  '/cases/:caseId/finance-links',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(CreateRoiFinanceLinkSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof CreateRoiFinanceLinkSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await createRoiFinanceLink({
        caseId,
        organizationId: auth.organizationId,
        financeArtifactType: body.financeArtifactType,
        financeArtifactId: body.financeArtifactId,
        financeVersionId: body.financeVersionId,
        mappingVersion: body.mappingVersion,
        source: body.source,
        asOf: body.asOf,
        semanticUnit: body.semanticUnit,
        currency: body.currency,
        linkPurpose: body.linkPurpose,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        financeLink: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'createRoiFinanceLink');
    }
  }
);

router.delete(
  '/cases/:caseId/finance-links/:linkId',
  validateParams(RoiFinanceLinkParamsSchema),
  validateBody(RemoveRoiFinanceLinkSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, linkId } = req.params as { caseId: string; linkId: string };
      const body = req.body as import('zod').infer<typeof RemoveRoiFinanceLinkSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeRoiFinanceLink({
        linkId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        financeLink: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'removeRoiFinanceLink');
    }
  }
);

// ---------- GET/POST .../finance-reconciliations ; PATCH .../finance-reconciliations/:reconciliationId ----------

router.get(
  '/cases/:caseId/finance-reconciliations',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const financeReconciliations = await listRoiFinanceReconciliations({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
      });
      res.status(200).json({ financeReconciliations });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiFinanceReconciliations');
    }
  }
);

router.post(
  '/cases/:caseId/finance-reconciliations',
  validateParams(RoiCaseIdParamsSchema),
  validateBody(OpenRoiFinanceReconciliationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      if (!(await requireExistingRoiCase(auth, caseId, res))) return;
      const body = req.body as import('zod').infer<typeof OpenRoiFinanceReconciliationSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await openRoiFinanceReconciliation({
        caseId,
        organizationId: auth.organizationId,
        financeLinkId: body.financeLinkId,
        roiValue: body.roiValue,
        financeValue: body.financeValue,
        reconciliationKind: body.reconciliationKind,
        divergenceReason: body.divergenceReason,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        financeReconciliation: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'openRoiFinanceReconciliation');
    }
  }
);

router.patch(
  '/cases/:caseId/finance-reconciliations/:reconciliationId',
  validateParams(RoiFinanceReconciliationParamsSchema),
  validateBody(UpdateRoiFinanceReconciliationStatusSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, reconciliationId } = req.params as { caseId: string; reconciliationId: string };
      const body = req.body as import('zod').infer<typeof UpdateRoiFinanceReconciliationStatusSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await updateRoiFinanceReconciliationStatus({
        reconciliationId,
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        status: body.status,
        resolutionNotes: body.resolutionNotes,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        financeReconciliation: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'updateRoiFinanceReconciliationStatus');
    }
  }
);

// ---------- GET .../finance-projections (RN-G6 design §9) ----------

router.get(
  '/cases/:caseId/finance-projections',
  validateParams(RoiCaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const financeProjections = await listRoiFinanceProjections({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
      });
      res.status(200).json({ financeProjections });
    } catch (err) {
      handleRoiRouteError(res, err, 'listRoiFinanceProjections');
    }
  }
);

// ---------- POST .../kpi-evidence-links/:linkId/freshness-check ----------

router.post(
  '/cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links/:linkId/freshness-check',
  validateParams(RoiBenefitEvidenceLinkParamsSchema),
  validateBody(FreshnessCheckSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, linkId } = req.params as { caseId: string; benefitLineId: string; linkId: string };
      const body = req.body as import('zod').infer<typeof FreshnessCheckSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await flagEvidenceLinkFreshnessCheck({
        linkId,
        caseId,
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        link: outcome.result,
      });
    } catch (err) {
      handleRoiRouteError(res, err, 'flagEvidenceLinkFreshnessCheck');
    }
  }
);

export default router;
