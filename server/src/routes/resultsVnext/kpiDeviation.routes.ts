/**
 * KPI-E003 Deviation Closed Loop — HTTP layer.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §B (state-machine
 * table — this file implements every command that table lists as its own
 * route, per §D's "Not in this package" note that these routes are the next
 * package) / decision #2 (no separate `:planId` — "plan" is a phase of the
 * case, routes are `.../plan/submit` and `.../plan/approve` directly on
 * `:caseId`, ratified as part of that decision).
 *
 * Thin HTTP layer over `services/resultsVnext/kpi/kpiDeviationCommands.ts` /
 * `kpiCorrectiveActionCommands.ts` / `kpiDeviationRepository.ts` — same
 * division of responsibility as `kpi.routes.ts` (this file's own structural
 * precedent, copied 1:1: inline handlers + a shared `handle*Error` mapper +
 * a local `requireAuth` helper, no separate Controller class).
 *
 * Mounted at `/api/vnext/results/kpi/deviation-cases` (Gateway.ts).
 *
 * -- MOUNT-ORDER NOTE (not in the design doc — a routing conflict discovered
 * while wiring this file, not a design decision): `kpi.routes.ts` is mounted
 * at `/api/vnext/results/kpi` and owns `GET /:kpiId` (a single dynamic path
 * segment, `KpiIdParamsSchema` requires a UUID). If this router were mounted
 * at the same `/api/vnext/results/kpi` prefix (nesting `/deviation-cases/*`
 * as this router's OWN internal paths), Express would try `kpi.routes.ts`
 * FIRST for `GET /api/vnext/results/kpi/deviation-cases` (identical prefix,
 * registered first) — its `GET /:kpiId` route would match with
 * `kpiId = "deviation-cases"`, and `validateParams(KpiIdParamsSchema)` would
 * respond 400 directly (never calling `next()`) instead of falling through
 * to this router. Fix: this router is mounted at the MORE SPECIFIC prefix
 * `/api/vnext/results/kpi/deviation-cases` and registered in Gateway.ts
 * BEFORE the `/api/vnext/results/kpi` mount (Express matches app-level
 * middleware in registration order, not by prefix specificity) — see
 * Gateway.ts's own comment at that mount site. Every route below is declared
 * relative to that already-specific mount (e.g. `router.get('/')` for the
 * list endpoint, not `router.get('/deviation-cases')`).
 *
 * -- DEVIATION FROM TASK BRIEF: the task that requested this file named the
 * self-approval error `SelfApprovalDeniedError` (mirroring `kpi.routes.ts`'s
 * import of that exact class from `kpiDefinitionCommands.ts`). This domain's
 * OWN maker-checker guard (`approvePlan`) throws a different, sibling class —
 * `DeviationSelfApprovalDeniedError`, exported by `kpiDeviationCommands.ts`
 * itself (that file's own doc comment: "this module's own class since the
 * two domains have separate aggregates"). Mapped to 403 below exactly as the
 * brief specifies for "SelfApprovalDeniedError", just via the real class name.
 *
 * -- DESIGN NOTE (out of scope, confirmed against KPI_E003_DESIGN.md §D):
 * this file implements only the routes the task brief lists. It does NOT add
 * `GET .../corrective-actions` or `GET .../effectiveness-verifications`
 * list endpoints even though `kpiDeviationRepository.ts` already exports
 * `listCorrectiveActions`/`listEffectivenessVerifications` — neither route
 * appears in the task's endpoint list or in KPI_E003_DESIGN.md §D's file
 * table, so adding them here would be scope creep beyond what was asked;
 * left for a future package alongside the other explicitly-deferred §D items
 * (MyWork UI wiring, response-policy CRUD).
 */
import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';

import { acquirePgClient } from '../../database/PostgresDatabase.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validation.middleware.js';
import {
  addCorrectiveAction,
  updateCorrectiveAction,
} from '../../services/resultsVnext/kpi/kpiCorrectiveActionCommands.js';
import {
  acknowledgeDeviationCase,
  approvePlan,
  closeDeviationCase,
  deescalateDeviationCase,
  DeviationSelfApprovalDeniedError,
  escalateDeviationCase,
  KpiDeviationValidationError,
  recordRecoveryObservation,
  reopenDeviationCase,
  submitEffectivenessVerification,
  submitPlan,
  submitRootCause,
} from '../../services/resultsVnext/kpi/kpiDeviationCommands.js';
import {
  getDeviationCase,
  listDeviationCases,
} from '../../services/resultsVnext/kpi/kpiDeviationRepository.js';
import type { CorrectiveActionRow } from '../../services/resultsVnext/kpi/kpiDeviationTypes.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  AddCorrectiveActionSchema,
  CaseActionIdParamsSchema,
  CaseIdParamsSchema,
  DeviationCaseCaseActionSchema,
  EscalationOverlaySchema,
  ListDeviationCasesQuerySchema,
  RecordRecoveryObservationSchema,
  ReopenDeviationCaseSchema,
  SubmitEffectivenessVerificationSchema,
  SubmitRootCauseSchema,
  UpdateCorrectiveActionSchema,
} from '../../validators/resultsVnextKpiDeviation.validators.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// SHARED HELPERS (copied 1:1 from kpi.routes.ts — see that file's own doc
// comments for the rationale; not exported there, so re-declared here)
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
 * Shared error -> HTTP mapping for every write endpoint below. Same shape
 * (typed error classes checked first, generic 500 fallback last, never leak
 * a stack trace) as `kpi.routes.ts`'s `handleKpiRouteError`.
 */
function handleDeviationRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof DeviationSelfApprovalDeniedError) {
    res.status(403).json({ error: err.message, code: err.code, details: err.details });
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
  if (err instanceof KpiDeviationValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  logger.error(`[resultsVnext/kpiDeviation.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'KPI_DEVIATION_INTERNAL_ERROR' });
}

/** Same rationale as `kpi.routes.ts`'s `loadMeasurementRow`: a plain,
 * non-visibility-scoped read used ONLY to confirm a corrective action
 * (`:actionId` in the URL) actually belongs to the `:caseId` also in the
 * URL, before calling `updateCorrectiveAction` (whose own CAS is scoped by
 * `(actionId, organizationId)` alone — it does not itself re-check
 * `caseId`). Called AFTER the visibility of the parent case has already
 * been established by whatever route needs it. */
async function loadCorrectiveActionRow(
  organizationId: string,
  actionId: string
): Promise<CorrectiveActionRow | undefined> {
  const client = await acquirePgClient();
  try {
    const result = await client.query<CorrectiveActionRow>(
      `SELECT * FROM rvn_kpi_corrective_actions WHERE action_id = $1 AND organization_id = $2`,
      [actionId, organizationId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// ==========================================
// GET /api/vnext/results/kpi/deviation-cases — listDeviationCases
// ==========================================

router.get(
  '/',
  validateQuery(ListDeviationCasesQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListDeviationCasesQuerySchema>;
      const cases = await listDeviationCases({
        userId: auth.userId,
        organizationId: auth.organizationId,
        kpiId: query.kpiId,
        status: query.status,
        ownerUserId: query.ownerUserId,
        escalatedOnly: query.escalatedOnly,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ cases });
    } catch (err) {
      handleDeviationRouteError(res, err, 'listDeviationCases');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/deviation-cases/:caseId — getDeviationCase
// ==========================================

router.get(
  '/:caseId',
  validateParams(CaseIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const deviationCase = await getDeviationCase({
        userId: auth.userId,
        organizationId: auth.organizationId,
        caseId,
      });
      if (!deviationCase) {
        res.status(404).json({ error: 'Deviation case not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ case: deviationCase });
    } catch (err) {
      handleDeviationRouteError(res, err, 'getDeviationCase');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/deviation-cases/:caseId/acknowledge
// ==========================================

router.post(
  '/:caseId/acknowledge',
  validateParams(CaseIdParamsSchema),
  validateBody(DeviationCaseCaseActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof DeviationCaseCaseActionSchema>;
      const outcome = await acknowledgeDeviationCase({
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
      handleDeviationRouteError(res, err, 'acknowledgeDeviationCase');
    }
  }
);

// ==========================================
// PUT /api/vnext/results/kpi/deviation-cases/:caseId/root-cause — submitRootCause
// ==========================================

router.put(
  '/:caseId/root-cause',
  validateParams(CaseIdParamsSchema),
  validateBody(SubmitRootCauseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof SubmitRootCauseSchema>;
      const outcome = await submitRootCause({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        rootCauseSummary: body.rootCauseSummary ?? null,
        rootCauseCategory: body.rootCauseCategory ?? null,
        recurrenceFlag: body.recurrenceFlag ?? false,
        expectedRecoveryDate: body.expectedRecoveryDate ?? null,
        expectedRecoveryValue: body.expectedRecoveryValue ?? null,
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
      handleDeviationRouteError(res, err, 'submitRootCause');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions — addCorrectiveAction
// ==========================================

router.post(
  '/:caseId/corrective-actions',
  validateParams(CaseIdParamsSchema),
  validateBody(AddCorrectiveActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof AddCorrectiveActionSchema>;
      const outcome = await addCorrectiveAction({
        deviationCaseId: caseId,
        organizationId: auth.organizationId,
        title: body.title,
        description: body.description ?? null,
        ownerUserId: body.ownerUserId,
        dueDate: body.dueDate ?? null,
        expectedEffect: body.expectedEffect ?? null,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        action: outcome.result,
      });
    } catch (err) {
      handleDeviationRouteError(res, err, 'addCorrectiveAction');
    }
  }
);

// ==========================================
// PATCH .../:caseId/corrective-actions/:actionId — updateCorrectiveAction
// ==========================================

router.patch(
  '/:caseId/corrective-actions/:actionId',
  validateParams(CaseActionIdParamsSchema),
  validateBody(UpdateCorrectiveActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId, actionId } = req.params as { caseId: string; actionId: string };
      const actionRow = await loadCorrectiveActionRow(auth.organizationId, actionId);
      if (!actionRow || actionRow.deviation_case_id !== caseId) {
        res
          .status(404)
          .json({ error: 'Corrective action not found for this case', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof UpdateCorrectiveActionSchema>;
      const outcome = await updateCorrectiveAction({
        actionId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        status: body.status,
        title: body.title,
        description: body.description,
        ownerUserId: body.ownerUserId,
        dueDate: body.dueDate,
        expectedEffect: body.expectedEffect,
        actualEffect: body.actualEffect,
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
        action: outcome.result.action,
        caseAutoTransitionedToExecuting: outcome.result.caseAutoTransitionedToExecuting,
      });
    } catch (err) {
      handleDeviationRouteError(res, err, 'updateCorrectiveAction');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/deviation-cases/:caseId/plan/submit — submitPlan
// (decision #2: no separate :planId — plan is a phase of the case)
// ==========================================

router.post(
  '/:caseId/plan/submit',
  validateParams(CaseIdParamsSchema),
  validateBody(DeviationCaseCaseActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof DeviationCaseCaseActionSchema>;
      const outcome = await submitPlan({
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
      handleDeviationRouteError(res, err, 'submitPlan');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/deviation-cases/:caseId/plan/approve — approvePlan
// ==========================================

router.post(
  '/:caseId/plan/approve',
  validateParams(CaseIdParamsSchema),
  validateBody(DeviationCaseCaseActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof DeviationCaseCaseActionSchema>;
      const outcome = await approvePlan({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        // ApprovePlanInput extends BaseCaseCommandInput (requires
        // actorUserId) AND adds its own `approverId` — the command itself
        // only reads `approverId` (self-approval check + buildEvent's
        // actorUserId), `actorUserId` here is unused by approvePlan but
        // required by the type; both are the same caller.
        actorUserId: auth.userId,
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
        case: outcome.result,
      });
    } catch (err) {
      handleDeviationRouteError(res, err, 'approvePlan');
    }
  }
);

// ==========================================
// POST .../:caseId/recovery-observation — recordRecoveryObservation
// ==========================================

router.post(
  '/:caseId/recovery-observation',
  validateParams(CaseIdParamsSchema),
  validateBody(RecordRecoveryObservationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof RecordRecoveryObservationSchema>;
      const outcome = await recordRecoveryObservation({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        recoveryObservationMeasurementId: body.recoveryObservationMeasurementId,
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
      handleDeviationRouteError(res, err, 'recordRecoveryObservation');
    }
  }
);

// ==========================================
// POST .../:caseId/effectiveness-verifications — submitEffectivenessVerification
// ==========================================

router.post(
  '/:caseId/effectiveness-verifications',
  validateParams(CaseIdParamsSchema),
  validateBody(SubmitEffectivenessVerificationSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof SubmitEffectivenessVerificationSchema>;
      const outcome = await submitEffectivenessVerification({
        caseId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        verificationWindowStart: body.verificationWindowStart,
        verificationWindowEnd: body.verificationWindowEnd,
        outcome: body.outcome,
        rationale: body.rationale ?? null,
        measurementIds: body.measurementIds ?? [],
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result.case,
        verification: outcome.result.verification,
      });
    } catch (err) {
      handleDeviationRouteError(res, err, 'submitEffectivenessVerification');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/deviation-cases/:caseId/close — closeDeviationCase
// ==========================================

router.post(
  '/:caseId/close',
  validateParams(CaseIdParamsSchema),
  validateBody(DeviationCaseCaseActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof DeviationCaseCaseActionSchema>;
      const outcome = await closeDeviationCase({
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
      handleDeviationRouteError(res, err, 'closeDeviationCase');
    }
  }
);

// ==========================================
// POST .../:caseId/escalate | .../:caseId/deescalate — escalation overlay
// (non-exclusive boolean flag, case status untouched — see
// kpiDeviationCommands.ts's runEscalationOverlay doc comment)
// ==========================================

function mountEscalationRoute(
  path: string,
  op: string,
  runner: typeof escalateDeviationCase
): void {
  router.post(
    path,
    validateParams(CaseIdParamsSchema),
    validateBody(EscalationOverlaySchema),
    async (req: AuthenticatedRequest, res: Response) => {
      const auth = requireAuth(req, res);
      if (!auth) return;
      try {
        const { caseId } = req.params as { caseId: string };
        const body = req.body as import('zod').infer<typeof EscalationOverlaySchema>;
        const outcome = await runner({
          caseId,
          organizationId: auth.organizationId,
          expectedVersion: body.expectedVersion,
          escalatedReason: body.escalatedReason ?? null,
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
        handleDeviationRouteError(res, err, op);
      }
    }
  );
}

mountEscalationRoute('/:caseId/escalate', 'escalateDeviationCase', escalateDeviationCase);
mountEscalationRoute('/:caseId/deescalate', 'deescalateDeviationCase', deescalateDeviationCase);

// ==========================================
// POST /api/vnext/results/kpi/deviation-cases/:caseId/reopen — reopenDeviationCase
// (`:caseId` here is the PRIOR, closed case id — the command creates a NEW
// row rather than mutating this one, see kpiDeviationCommands.ts)
// ==========================================

router.post(
  '/:caseId/reopen',
  validateParams(CaseIdParamsSchema),
  validateBody(ReopenDeviationCaseSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const body = req.body as import('zod').infer<typeof ReopenDeviationCaseSchema>;
      const outcome = await reopenDeviationCase({
        priorCaseId: caseId,
        organizationId: auth.organizationId,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        triggerMeasurementId: body.triggerMeasurementId,
        ownerUserId: body.ownerUserId ?? undefined,
        managerUserId: body.managerUserId ?? undefined,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        case: outcome.result,
      });
    } catch (err) {
      handleDeviationRouteError(res, err, 'reopenDeviationCase');
    }
  }
);

export default router;
