/**
 * KPI-E001/E002 — HTTP layer.
 *
 * Design: docs/product/results-vnext/02_KPI_IMPLEMENTATION_PLAN.md §7.1/§7.2
 * (route list — this file implements the subset that has a real command/
 * repository implementation today: definition lifecycle + measurements.
 * Deviation cases §7.3 and Scorecards §7.4 have no domain code yet — not
 * wired here, tracked as future packages).
 *
 * Thin HTTP layer over `services/resultsVnext/kpi/*` (own all business
 * logic — CAS, self-approval denial, append-only measurement history,
 * visibility scoping). This router does auth/param plumbing, request-shape
 * validation, and error->HTTP mapping only — same division of responsibility
 * as `server/src/routes/pmo/initiativeClosure.routes.ts` (that file's own
 * header comment states the same rule for its service), which this file
 * follows as its structural precedent (inline handlers + a shared
 * `handle*Error` mapper + a local `requireAuth` helper, rather than a
 * separate Controller class — this domain has no existing controller to
 * extend, and the closure-gate file shows that pattern scales fine to a
 * medium-sized route set without one).
 *
 * Mounted at `/api/vnext/results/kpi` (Gateway.ts) — the vNext namespace is
 * deliberately separate from the many legacy `/api/v8/results*` KPI surfaces
 * (see EXECUTION_LEDGER.md §3.8: "4+ tabele definicji, 3 modele Scorecard")
 * per plan §7's own instruction: "Legacy V8 routes remain compatibility/
 * read-only surfaces and are not aliases for new commands."
 *
 * -- DEVIATION FROM TASK BRIEF: the task that requested this file named an
 * error class `DefinitionVersionNotSubmittedError` for the "version wasn't
 * submitted" case. That class does not exist anywhere in this repo (grepped
 * before writing this file) — the actual, already-implemented error for
 * every invalid state transition on a KPI/definition-version (submitting a
 * non-draft, approving/rejecting a non-submitted version, activating a KPI
 * with no approved version, etc.) is the single `KpiDefinitionValidationError`
 * class in `kpiDefinitionCommands.ts`, discriminated by its `.code` string
 * (`NOT_A_DRAFT` / `NOT_SUBMITTED` / `INVALID_KPI_STATUS_TRANSITION` /
 * `NO_APPROVED_VERSION`). Mapped to 409 below (a domain-state conflict, the
 * same character as `DecisionConflictError`'s non-`FORBIDDEN` codes in
 * `DecisionController.ts`'s `respondToCollaborationError` — see that
 * function's own doc comment) rather than 400 (reserved here for
 * request-shape validation failures, which Zod already owns via
 * `validateBody`/`validateParams`/`validateQuery`).
 *
 * -- DESIGN NOTE (performance_status): `recordMeasurement`'s own doc comment
 * says its `performanceStatus` input is not evaluated internally — "the
 * caller already has the definition version loaded ... and can evaluate
 * before calling" (`targetGeometryEvaluator.ts`'s `evaluatePerformanceStatus`,
 * otherwise unused by any caller in this repo today). This HTTP layer is
 * that caller: `POST .../measurements` and `POST .../measurements/:id/corrections`
 * both load the relevant `rvn_kpi_definition_versions` row and compute
 * `performanceStatus` server-side rather than trusting a client-supplied
 * value — a measurement's performance status is exactly the field a
 * self-reporting client would be most tempted to fudge, and nothing in the
 * command layer re-validates it against the geometry.
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
  activateKpi,
  approveDefinitionVersion,
  archiveKpi,
  createKpiDraft,
  editDraft,
  KpiDefinitionValidationError,
  KpiNoActiveVisibilityPolicyError,
  rejectDefinitionVersion,
  SelfApprovalDeniedError,
  submitDefinition,
  suspendKpi,
} from '../../services/resultsVnext/kpi/kpiDefinitionCommands.js';
import {
  correctMeasurement,
  disputeMeasurement,
  KpiMeasurementNotFoundError,
  recordMeasurement,
  verifyMeasurement,
} from '../../services/resultsVnext/kpi/kpiMeasurementCommands.js';
import {
  getKpi,
  listKpis,
  listMeasurements,
} from '../../services/resultsVnext/kpi/kpiRepository.js';
import {
  type KpiDefinitionVersionRow,
  type KpiMeasurementRow,
  toKpiDefinitionVersion,
} from '../../services/resultsVnext/kpi/kpiTypes.js';
import { evaluatePerformanceStatus } from '../../services/resultsVnext/kpi/targetGeometryEvaluator.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  ApproveDefinitionVersionSchema,
  CorrectMeasurementSchema,
  CreateKpiDraftSchema,
  DisputeMeasurementSchema,
  EditKpiDraftSchema,
  KpiDefinitionVersionParamsSchema,
  KpiIdParamsSchema,
  KpiLifecycleActionSchema,
  KpiMeasurementParamsSchema,
  ListKpisQuerySchema,
  ListMeasurementsQuerySchema,
  RecordMeasurementSchema,
  RejectDefinitionVersionSchema,
  SubmitDefinitionSchema,
  VerifyMeasurementSchema,
} from '../../validators/resultsVnextKpi.validators.js';

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
 * same pattern as `initiativeClosure.routes.ts`'s `requireAuth`. */
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

/** Established repo convention (documents.routes.ts, conversations.routes.ts,
 * report-builder.routes.ts, ...): prefer a correlation id a prior middleware
 * already attached to the request, fall back to the client-supplied header. */
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
 * `DecisionController.ts`'s `respondToCollaborationError` and
 * `initiativeClosure.routes.ts`'s `handleClosureError` in shape (typed
 * error classes checked first, generic 500 fallback last) and in the rule
 * "never leak a stack trace" — the fallback branch logs the real error
 * server-side and returns only a generic message + code to the client.
 */
function handleKpiRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof SelfApprovalDeniedError) {
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
  if (err instanceof KpiNoActiveVisibilityPolicyError) {
    // Org/domain has no active visibility policy provisioned yet — a
    // precondition failure, not a malformed request (400) nor a missing
    // resource (404). 409 for the same reason `AtomicWriteConflictError`
    // gets 409: the request is well-formed but the aggregate/org state
    // cannot satisfy it right now.
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof KpiDefinitionValidationError) {
    // See file header DEVIATION note — this is the real "invalid state
    // transition" error (covers the task brief's imagined
    // DefinitionVersionNotSubmittedError case among others).
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof KpiMeasurementNotFoundError) {
    res.status(404).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  logger.error(`[resultsVnext/kpi.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'KPI_INTERNAL_ERROR' });
}

/** Plain read of a `rvn_kpi_definition_versions` row, scoped by
 * (organizationId, definitionVersionId) — NOT visibility-scoped, unlike
 * `kpiRepository.ts`'s reads. This is deliberate and narrow: it is only ever
 * called AFTER the caller has already established the actor can see the
 * parent KPI (via `getKpi`, which IS visibility-scoped) — its sole purpose
 * is fetching target-geometry bounds for `evaluatePerformanceStatus`, not
 * exposing a second, easier-to-forget read path for the version resource
 * itself (no route below returns this row directly without that prior
 * `getKpi` check). Same SQL shape as `kpiDefinitionCommands.ts`'s
 * `loadDefinitionVersionForUpdate`, minus `FOR UPDATE` (this is a read, not
 * a pre-mutation lock). */
async function loadDefinitionVersionRow(
  organizationId: string,
  definitionVersionId: string
): Promise<KpiDefinitionVersionRow | undefined> {
  const client = await acquirePgClient();
  try {
    const result = await client.query<KpiDefinitionVersionRow>(
      `SELECT * FROM rvn_kpi_definition_versions WHERE definition_version_id = $1 AND organization_id = $2`,
      [definitionVersionId, organizationId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

/** Same rationale as `loadDefinitionVersionRow` above, for
 * `rvn_kpi_measurements` — used by the correct/verify/dispute endpoints to
 * (a) confirm the measurement belongs to the `:kpiId` in the URL before
 * calling the command (the command itself only scopes by
 * `(measurementId, organizationId)`, not `kpiId` — see its own doc comment)
 * and (b) for `correctMeasurement`, to find which definition version's
 * bounds to re-evaluate the corrected value against. */
async function loadMeasurementRow(
  organizationId: string,
  measurementId: string
): Promise<KpiMeasurementRow | undefined> {
  const client = await acquirePgClient();
  try {
    const result = await client.query<KpiMeasurementRow>(
      `SELECT * FROM rvn_kpi_measurements WHERE measurement_id = $1 AND organization_id = $2`,
      [measurementId, organizationId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// ==========================================
// POST /api/vnext/results/kpi — createKpiDraft
// ==========================================

router.post(
  '/',
  validateBody(CreateKpiDraftSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof CreateKpiDraftSchema>;
      const outcome = await createKpiDraft({
        organizationId: auth.organizationId,
        kpiCode: body.kpiCode,
        name: body.name,
        description: body.description ?? null,
        unit: body.unit ?? null,
        targetGeometry: body.targetGeometry,
        targetValue: body.targetValue ?? null,
        targetMin: body.targetMin ?? null,
        targetMax: body.targetMax ?? null,
        warningLow: body.warningLow ?? null,
        warningHigh: body.warningHigh ?? null,
        criticalLow: body.criticalLow ?? null,
        criticalHigh: body.criticalHigh ?? null,
        binarySuccessValue: body.binarySuccessValue ?? null,
        formulaText: body.formulaText ?? null,
        primaryProcessId: body.primaryProcessId ?? null,
        responsePolicyId: body.responsePolicyId ?? null,
        ownerUserId: body.ownerUserId ?? null,
        scopeId: body.scopeId ?? null,
        sensitivity: body.sensitivity ?? null,
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
        kpi: outcome.result.kpi,
        definitionVersion: outcome.result.definitionVersion,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'createKpiDraft');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi — listKpis
// ==========================================

router.get(
  '/',
  validateQuery(ListKpisQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListKpisQuerySchema>;
      const kpis = await listKpis({
        userId: auth.userId,
        organizationId: auth.organizationId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ kpis });
    } catch (err) {
      handleKpiRouteError(res, err, 'listKpis');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/:kpiId — getKpi
// ==========================================

router.get(
  '/:kpiId',
  validateParams(KpiIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId } = req.params as { kpiId: string };
      const kpi = await getKpi({ userId: auth.userId, organizationId: auth.organizationId, kpiId });
      if (!kpi) {
        res.status(404).json({ error: 'KPI not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ kpi });
    } catch (err) {
      handleKpiRouteError(res, err, 'getKpi');
    }
  }
);

// ==========================================
// PUT /api/vnext/results/kpi/:kpiId/draft — editDraft
// ==========================================

router.put(
  '/:kpiId/draft',
  validateParams(KpiIdParamsSchema),
  validateBody(EditKpiDraftSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId } = req.params as { kpiId: string };
      const kpi = await getKpi({ userId: auth.userId, organizationId: auth.organizationId, kpiId });
      if (!kpi) {
        res.status(404).json({ error: 'KPI not found', code: 'NOT_FOUND' });
        return;
      }
      if (!kpi.currentDefinitionVersionId) {
        res.status(409).json({
          error: `KPI ${kpiId} has no current definition version to edit`,
          code: 'NO_CURRENT_VERSION',
        });
        return;
      }
      const body = req.body as import('zod').infer<typeof EditKpiDraftSchema>;
      const outcome = await editDraft({
        definitionVersionId: kpi.currentDefinitionVersionId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        name: body.name,
        description: body.description,
        unit: body.unit,
        targetGeometry: body.targetGeometry,
        targetValue: body.targetValue,
        targetMin: body.targetMin,
        targetMax: body.targetMax,
        warningLow: body.warningLow,
        warningHigh: body.warningHigh,
        criticalLow: body.criticalLow,
        criticalHigh: body.criticalHigh,
        binarySuccessValue: body.binarySuccessValue,
        formulaText: body.formulaText,
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
        definitionVersion: outcome.result,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'editDraft');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/:kpiId/submit — submitDefinition
// ==========================================

router.post(
  '/:kpiId/submit',
  validateParams(KpiIdParamsSchema),
  validateBody(SubmitDefinitionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId } = req.params as { kpiId: string };
      const kpi = await getKpi({ userId: auth.userId, organizationId: auth.organizationId, kpiId });
      if (!kpi) {
        res.status(404).json({ error: 'KPI not found', code: 'NOT_FOUND' });
        return;
      }
      if (!kpi.currentDefinitionVersionId) {
        res.status(409).json({
          error: `KPI ${kpiId} has no current definition version to submit`,
          code: 'NO_CURRENT_VERSION',
        });
        return;
      }
      const body = req.body as import('zod').infer<typeof SubmitDefinitionSchema>;
      const outcome = await submitDefinition({
        definitionVersionId: kpi.currentDefinitionVersionId,
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
        definitionVersion: outcome.result,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'submitDefinition');
    }
  }
);

// ==========================================
// POST .../definition-versions/:versionId/approve — approveDefinitionVersion
// ==========================================

router.post(
  '/:kpiId/definition-versions/:versionId/approve',
  validateParams(KpiDefinitionVersionParamsSchema),
  validateBody(ApproveDefinitionVersionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId, versionId } = req.params as { kpiId: string; versionId: string };
      const versionRow = await loadDefinitionVersionRow(auth.organizationId, versionId);
      if (!versionRow || versionRow.kpi_id !== kpiId) {
        res
          .status(404)
          .json({ error: 'Definition version not found for this KPI', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof ApproveDefinitionVersionSchema>;
      const outcome = await approveDefinitionVersion({
        definitionVersionId: versionId,
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
        definitionVersion: outcome.result,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'approveDefinitionVersion');
    }
  }
);

// ==========================================
// POST .../definition-versions/:versionId/reject — rejectDefinitionVersion
// ==========================================

router.post(
  '/:kpiId/definition-versions/:versionId/reject',
  validateParams(KpiDefinitionVersionParamsSchema),
  validateBody(RejectDefinitionVersionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId, versionId } = req.params as { kpiId: string; versionId: string };
      const versionRow = await loadDefinitionVersionRow(auth.organizationId, versionId);
      if (!versionRow || versionRow.kpi_id !== kpiId) {
        res
          .status(404)
          .json({ error: 'Definition version not found for this KPI', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof RejectDefinitionVersionSchema>;
      const outcome = await rejectDefinitionVersion({
        definitionVersionId: versionId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        rejectedBy: auth.userId,
        rejectionReason: body.rejectionReason,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        definitionVersion: outcome.result,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'rejectDefinitionVersion');
    }
  }
);

// ==========================================
// KPI lifecycle: activate / suspend / archive
// ==========================================

function mountLifecycleRoute(path: string, op: string, runner: typeof activateKpi): void {
  router.post(
    path,
    validateParams(KpiIdParamsSchema),
    validateBody(KpiLifecycleActionSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      const auth = requireAuth(req, res);
      if (!auth) return;
      try {
        const { kpiId } = req.params as { kpiId: string };
        const body = req.body as import('zod').infer<typeof KpiLifecycleActionSchema>;
        const outcome = await runner({
          kpiId,
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
          kpi: outcome.result,
        });
      } catch (err) {
        handleKpiRouteError(res, err, op);
      }
    }
  );
}

mountLifecycleRoute('/:kpiId/activate', 'activateKpi', activateKpi);
mountLifecycleRoute('/:kpiId/suspend', 'suspendKpi', suspendKpi);
mountLifecycleRoute('/:kpiId/archive', 'archiveKpi', archiveKpi);

// ==========================================
// POST /api/vnext/results/kpi/:kpiId/measurements — recordMeasurement
// ==========================================

router.post(
  '/:kpiId/measurements',
  validateParams(KpiIdParamsSchema),
  validateBody(RecordMeasurementSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId } = req.params as { kpiId: string };
      const kpi = await getKpi({ userId: auth.userId, organizationId: auth.organizationId, kpiId });
      if (!kpi) {
        res.status(404).json({ error: 'KPI not found', code: 'NOT_FOUND' });
        return;
      }

      const body = req.body as import('zod').infer<typeof RecordMeasurementSchema>;
      const definitionVersionId = body.definitionVersionId ?? kpi.currentDefinitionVersionId;
      if (!definitionVersionId) {
        res.status(409).json({
          error: `KPI ${kpiId} has no current definition version to measure against`,
          code: 'NO_CURRENT_VERSION',
        });
        return;
      }

      const versionRow = await loadDefinitionVersionRow(auth.organizationId, definitionVersionId);
      if (!versionRow || versionRow.kpi_id !== kpiId) {
        res.status(404).json({
          error: 'Definition version not found for this KPI',
          code: 'NOT_FOUND',
        });
        return;
      }
      const version = toKpiDefinitionVersion(versionRow);

      // Design note (file header): performanceStatus is computed here, from
      // the definition version's own bounds — never trusted from the client.
      const performanceStatus = evaluatePerformanceStatus({
        geometry: version.targetGeometry,
        actualValue: body.actualValue,
        targetValue: version.targetValue,
        targetMin: version.targetMin,
        targetMax: version.targetMax,
        warningLow: version.warningLow,
        warningHigh: version.warningHigh,
        criticalLow: version.criticalLow,
        criticalHigh: version.criticalHigh,
        binarySuccessValue: version.binarySuccessValue,
      });

      const outcome = await recordMeasurement({
        kpiId,
        definitionVersionId,
        organizationId: auth.organizationId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        actualValue: body.actualValue,
        performanceStatus,
        source: body.source,
        evidenceRefs: body.evidenceRefs ?? [],
        notes: body.notes ?? null,
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
        measurement: outcome.result,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'recordMeasurement');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/:kpiId/measurements — listMeasurements
// ==========================================

router.get(
  '/:kpiId/measurements',
  validateParams(KpiIdParamsSchema),
  validateQuery(ListMeasurementsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId } = req.params as { kpiId: string };
      const kpi = await getKpi({ userId: auth.userId, organizationId: auth.organizationId, kpiId });
      if (!kpi) {
        res.status(404).json({ error: 'KPI not found', code: 'NOT_FOUND' });
        return;
      }
      const query = req.query as unknown as import('zod').infer<typeof ListMeasurementsQuerySchema>;
      const measurements = await listMeasurements({
        userId: auth.userId,
        organizationId: auth.organizationId,
        kpiId,
        includeSuperseded: query.includeSuperseded,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ measurements });
    } catch (err) {
      handleKpiRouteError(res, err, 'listMeasurements');
    }
  }
);

// ==========================================
// POST .../measurements/:measurementId/corrections — correctMeasurement
// ==========================================

router.post(
  '/:kpiId/measurements/:measurementId/corrections',
  validateParams(KpiMeasurementParamsSchema),
  validateBody(CorrectMeasurementSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId, measurementId } = req.params as { kpiId: string; measurementId: string };
      const measurementRow = await loadMeasurementRow(auth.organizationId, measurementId);
      if (!measurementRow || measurementRow.kpi_id !== kpiId) {
        res.status(404).json({ error: 'Measurement not found for this KPI', code: 'NOT_FOUND' });
        return;
      }
      const versionRow = await loadDefinitionVersionRow(
        auth.organizationId,
        measurementRow.definition_version_id
      );
      if (!versionRow) {
        res
          .status(404)
          .json({ error: 'Definition version not found for this measurement', code: 'NOT_FOUND' });
        return;
      }
      const version = toKpiDefinitionVersion(versionRow);

      const body = req.body as import('zod').infer<typeof CorrectMeasurementSchema>;
      const performanceStatus = evaluatePerformanceStatus({
        geometry: version.targetGeometry,
        actualValue: body.actualValue,
        targetValue: version.targetValue,
        targetMin: version.targetMin,
        targetMax: version.targetMax,
        warningLow: version.warningLow,
        warningHigh: version.warningHigh,
        criticalLow: version.criticalLow,
        criticalHigh: version.criticalHigh,
        binarySuccessValue: version.binarySuccessValue,
      });

      const outcome = await correctMeasurement({
        measurementId,
        organizationId: auth.organizationId,
        actualValue: body.actualValue,
        performanceStatus,
        correctionReason: body.correctionReason,
        recordedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        original: outcome.result.original,
        measurement: outcome.result.superseding,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'correctMeasurement');
    }
  }
);

// ==========================================
// POST .../measurements/:measurementId/verify — verifyMeasurement
// ==========================================

router.post(
  '/:kpiId/measurements/:measurementId/verify',
  validateParams(KpiMeasurementParamsSchema),
  validateBody(VerifyMeasurementSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId, measurementId } = req.params as { kpiId: string; measurementId: string };
      const measurementRow = await loadMeasurementRow(auth.organizationId, measurementId);
      if (!measurementRow || measurementRow.kpi_id !== kpiId) {
        res.status(404).json({ error: 'Measurement not found for this KPI', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof VerifyMeasurementSchema>;
      const outcome = await verifyMeasurement({
        measurementId,
        organizationId: auth.organizationId,
        verifiedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        notes: body.notes ?? null,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        original: outcome.result.original,
        measurement: outcome.result.superseding,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'verifyMeasurement');
    }
  }
);

// ==========================================
// POST .../measurements/:measurementId/dispute — disputeMeasurement
// ==========================================

router.post(
  '/:kpiId/measurements/:measurementId/dispute',
  validateParams(KpiMeasurementParamsSchema),
  validateBody(DisputeMeasurementSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId, measurementId } = req.params as { kpiId: string; measurementId: string };
      const measurementRow = await loadMeasurementRow(auth.organizationId, measurementId);
      if (!measurementRow || measurementRow.kpi_id !== kpiId) {
        res.status(404).json({ error: 'Measurement not found for this KPI', code: 'NOT_FOUND' });
        return;
      }
      const body = req.body as import('zod').infer<typeof DisputeMeasurementSchema>;
      const outcome = await disputeMeasurement({
        measurementId,
        organizationId: auth.organizationId,
        disputedBy: auth.userId,
        disputeReason: body.disputeReason,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        original: outcome.result.original,
        measurement: outcome.result.superseding,
      });
    } catch (err) {
      handleKpiRouteError(res, err, 'disputeMeasurement');
    }
  }
);

export default router;
