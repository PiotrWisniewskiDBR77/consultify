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
 * -- RN-G6-SRV / B3 (closed the gap the note below used to document): this
 * file now DOES add `GET .../corrective-actions` and
 * `GET .../effectiveness-verifications` list endpoints —
 * `kpiDeviationRepository.ts` already exported `listCorrectiveActions`/
 * `listEffectivenessVerifications`, fully visibility-scoped
 * (`buildVisibilityScopedCte`, resourceType `'kpi'`, inherited via the
 * case's own `kpi_id` — same posture that file's own header documents for
 * every read in it), so both routes below are a thin HTTP wrapper only,
 * zero new query logic. Query-param schemas are declared LOCALLY in this
 * file (`ListCorrectiveActionsQuerySchema`/
 * `ListEffectivenessVerificationsQuerySchema` below) rather than added to
 * `resultsVnextKpiDeviation.validators.ts` — that file is outside this
 * package's own file allowlist for this pass, and a route-local Zod schema
 * is a strictly additive, self-contained way to keep the validation this
 * file's every other endpoint already has without touching a file shared
 * with a concurrently-running sibling package.
 */
import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { acquirePgClient } from '../../database/PostgresDatabase.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { requireResultsInternalBetaVisibility } from '../../middleware/resultsInternalBetaVisibility.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middleware/validation.middleware.js';
import { resolveEffectiveAccess } from '../../services/effectiveAccessService.js';
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
  listCorrectiveActions,
  listDeviationCases,
  listEffectivenessVerifications,
} from '../../services/resultsVnext/kpi/kpiDeviationRepository.js';
import { CORRECTIVE_ACTION_STATUSES, type CorrectiveActionRow } from '../../services/resultsVnext/kpi/kpiDeviationTypes.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import {
  CommandCapabilityDeniedError,
  type CommandAccessContext,
} from '../../services/resultsVnext/platform/commandCapabilityGuard.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { getCorrelationId } from './correlationId.js';
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

// ==========================================
// RN-G6-SRV / B3 — route-local query schemas for the two new read
// endpoints below. Same field shapes (`limit`/`offset` coercion, enum
// re-use of the domain's own CHECK-constraint array) as
// `ListDeviationCasesQuerySchema` above; declared here rather than in
// `resultsVnextKpiDeviation.validators.ts` — see file header note.
// ==========================================

const ListCorrectiveActionsQuerySchema = z.object({
  status: z.enum(CORRECTIVE_ACTION_STATUSES).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const ListEffectivenessVerificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(requireResultsInternalBetaVisibility);
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

/**
 * RN-G5: resolves the REAL effective access context (capabilities +
 * platformRole) for the authenticated actor — this is what
 * `commandCapabilityGuard.ts`'s `assertCommandCapability` checks inside each
 * command's `applyMutation`, replacing the previous behavior where
 * `auth.role` (a raw, sometimes-defaulted-to-'member' string) was threaded
 * through only for audit logging and never actually checked. No `projectId`
 * is passed — the KPI deviation domain has no project association (its
 * aggregates are organization-scoped), so only the org-level baseline
 * (`APPLICATION_ROLE_BASELINE_CAPABILITIES`) plus OWNER/ADMIN/SUPERADMIN's
 * `'*'` apply; see RN_G5_AUTHZ_DESIGN.md for the known limitation this
 * implies for explicit per-member capability grants in this domain.
 */
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
 * Shared error -> HTTP mapping for every write endpoint below. Same shape
 * (typed error classes checked first, generic 500 fallback last, never leak
 * a stack trace) as `kpi.routes.ts`'s `handleKpiRouteError`.
 */
function handleDeviationRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof CommandCapabilityDeniedError) {
    // RN-G5 fix: same rationale as kpi.routes.ts's identical branch —
    // `details.capability` is server-side-log-only, never wire.
    logger.warn(`[resultsVnext/kpiDeviation.routes] ${op} denied`, { capability: err.details.capability });
    res.status(403).json({ error: err.message, code: err.code });
    return;
  }
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
      const access = await resolveAccess(req, auth);
      const outcome = await acknowledgeDeviationCase({
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
      const access = await resolveAccess(req, auth);
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
        access,
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
      const access = await resolveAccess(req, auth);
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
        access,
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
// GET .../:caseId/corrective-actions — listCorrectiveActions (RN-G6-SRV / B3)
// ==========================================

router.get(
  '/:caseId/corrective-actions',
  validateParams(CaseIdParamsSchema),
  validateQuery(ListCorrectiveActionsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListCorrectiveActionsQuerySchema>;
      // No separate "case not found" 404 here, matching this file's own
      // `listDeviationCases`/`listScorecardItems`-style precedent: the
      // repository call is visibility-scoped by the same `resourceType:
      // 'kpi'` join the case read uses, so an invisible or nonexistent
      // caseId returns an empty list rather than leaking existence via a
      // 404-vs-empty-200 distinction (D06).
      const actions = await listCorrectiveActions({
        userId: auth.userId,
        organizationId: auth.organizationId,
        deviationCaseId: caseId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ actions });
    } catch (err) {
      handleDeviationRouteError(res, err, 'listCorrectiveActions');
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
      const access = await resolveAccess(req, auth);
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
        access,
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
      const access = await resolveAccess(req, auth);
      const outcome = await submitPlan({
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
      const access = await resolveAccess(req, auth);
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
        access,
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
      const access = await resolveAccess(req, auth);
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
        access,
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
      const access = await resolveAccess(req, auth);
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
        access,
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
// GET .../:caseId/effectiveness-verifications — listEffectivenessVerifications
// (RN-G6-SRV / B3)
// ==========================================

router.get(
  '/:caseId/effectiveness-verifications',
  validateParams(CaseIdParamsSchema),
  validateQuery(ListEffectivenessVerificationsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { caseId } = req.params as { caseId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListEffectivenessVerificationsQuerySchema>;
      // Same D06 posture as listCorrectiveActions above — visibility-scoped
      // by the repository, no separate case-existence check here.
      const verifications = await listEffectivenessVerifications({
        userId: auth.userId,
        organizationId: auth.organizationId,
        deviationCaseId: caseId,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ verifications });
    } catch (err) {
      handleDeviationRouteError(res, err, 'listEffectivenessVerifications');
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
      const access = await resolveAccess(req, auth);
      const outcome = await closeDeviationCase({
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
        const access = await resolveAccess(req, auth);
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
          access,
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
      const access = await resolveAccess(req, auth);
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
        access,
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
