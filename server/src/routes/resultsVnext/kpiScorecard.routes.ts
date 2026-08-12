/**
 * KPI-E004 Scorecards — HTTP layer.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §D ("Not in this
 * package: server/src/routes/resultsVnext/kpiScorecard.routes.ts (HTTP
 * layer, next package)" — this file is that next package) / §C.3 (7-section
 * Scorecard Tool -> query/endpoint mapping).
 *
 * Thin HTTP layer over `services/resultsVnext/kpi/kpiScorecardCommands.ts` /
 * `kpiScorecardRepository.ts` — same division of responsibility as
 * `kpi.routes.ts`/`kpiDeviation.routes.ts` (this file's own structural
 * precedent, copied 1:1: inline handlers + a shared `handle*Error` mapper +
 * a local `requireAuth` helper, no separate Controller class).
 *
 * Mounted at `/api/vnext/results/kpi/scorecards` (Gateway.ts).
 *
 * -- MOUNT-ORDER NOTE (same risk `kpiDeviation.routes.ts` already documents
 * for its own `/deviation-cases` prefix, verified to apply here too):
 * `kpi.routes.ts` is mounted at `/api/vnext/results/kpi` and owns
 * `GET /:kpiId` (a single dynamic path segment, `KpiIdParamsSchema` requires
 * a UUID). If this router were mounted at that same `/api/vnext/results/kpi`
 * prefix (nesting `/scorecards/*` as this router's OWN internal paths),
 * Express would try `kpi.routes.ts` FIRST for
 * `GET /api/vnext/results/kpi/scorecards` (identical prefix, registered
 * first) — its `GET /:kpiId` route would match with `kpiId = "scorecards"`,
 * and `validateParams(KpiIdParamsSchema)` would respond 400 directly (never
 * calling `next()`) instead of falling through to this router. Fix: this
 * router is mounted at the MORE SPECIFIC prefix
 * `/api/vnext/results/kpi/scorecards` and registered in Gateway.ts BEFORE
 * the `/api/vnext/results/kpi` mount — see Gateway.ts's own comment at that
 * mount site. Every route below is declared relative to that already-
 * specific mount (e.g. `router.get('/')` for the list endpoint, not
 * `router.get('/scorecards')`). Registration order relative to
 * `kpiDeviation.routes.ts`'s own `/deviation-cases` router does not matter —
 * the two prefixes' literal segments ("scorecards" vs "deviation-cases")
 * never collide with each other, only with the shorter generic mount.
 *
 * -- getScorecard (single-row fetch): `kpiScorecardRepository.ts` does not
 * export a `getScorecard`/`getScorecardById` function (verified by reading
 * that file — it has `listScorecards`/`listScorecardItems`/
 * `getScorecardStatusDistribution`/`getPublishedSnapshot`/
 * `listReviewSnapshots` only, and `ListScorecardsParams` has no
 * `scorecardId` filter to piggy-back on). Rather than widen the repository's
 * own contract for a single route file's convenience, this file declares its
 * own minimal, self-contained `loadVisibleScorecard` — the same
 * visibility-scoped-read shape `listScorecards` itself uses
 * (`wrapWithVisibilityScope`, resourceType `'kpi_scorecard'`, the
 * `::text` cast the repository's own header comment documents as required
 * for the TEXT/UUID join), narrowed to one `scorecard_id`. This mirrors how
 * `kpi.routes.ts` keeps its own narrow `loadDefinitionVersionRow`/
 * `loadMeasurementRow` helpers locally rather than growing the repository.
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
import { resolveEffectiveAccess } from '../../services/effectiveAccessService.js';
import { KpiNoActiveVisibilityPolicyError } from '../../services/resultsVnext/kpi/kpiDefinitionCommands.js';
import {
  activateScorecard,
  addScorecardItem,
  archiveScorecard,
  createReviewSnapshot,
  createScorecard,
  KpiScorecardValidationError,
  publishReviewSnapshot,
  removeScorecardItem,
  reorderScorecardItems,
  suspendScorecard,
} from '../../services/resultsVnext/kpi/kpiScorecardCommands.js';
import {
  getPublishedSnapshot,
  getScorecardStatusDistribution,
  listReviewSnapshots,
  listScorecardItems,
  listScorecards,
} from '../../services/resultsVnext/kpi/kpiScorecardRepository.js';
import {
  type KpiScorecard,
  type KpiScorecardRow,
  toKpiScorecard,
} from '../../services/resultsVnext/kpi/kpiScorecardTypes.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import {
  CommandCapabilityDeniedError,
  type CommandAccessContext,
} from '../../services/resultsVnext/platform/commandCapabilityGuard.js';
import {
  VISIBILITY_CTE_PARAM_COUNT,
  wrapWithVisibilityScope,
} from '../../services/resultsVnext/platform/visibilityScopedQuery.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { getCorrelationId } from './correlationId.js';
import logger from '../../utils/Logger.js';
import {
  AddScorecardItemSchema,
  CreateReviewSnapshotSchema,
  CreateScorecardSchema,
  ListReviewSnapshotsQuerySchema,
  ListScorecardsQuerySchema,
  PublishReviewSnapshotSchema,
  RemoveScorecardItemSchema,
  ReorderScorecardItemsSchema,
  ScorecardIdParamsSchema,
  ScorecardItemIdParamsSchema,
  ScorecardLifecycleActionSchema,
  ScorecardSnapshotIdParamsSchema,
  ScorecardStatusQuerySchema,
} from '../../validators/resultsVnextKpiScorecard.validators.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// SHARED HELPERS (same shape as kpi.routes.ts / kpiDeviation.routes.ts —
// see those files' own doc comments for the rationale; not exported there,
// so re-declared here)
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

// getCorrelationId moved to ./correlationId.js (RN-G6 P0 fix — F1): shared,
// UUID-shape-validated implementation for all resultsVnext routes instead of
// six copies each trusting the header/attached value as-is once non-empty.
// See that file's doc comment for the full root-cause writeup.

function resolveIdempotencyKey(bodyKey: string | undefined | null): string {
  return normalizeOptionalString(bodyKey ?? undefined) || randomUUID();
}

/**
 * RN-G5 (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md): resolves the
 * REAL effective access context (capabilities + platformRole) for the
 * authenticated actor — this is what `commandCapabilityGuard.ts`'s
 * `assertCommandCapability` checks inside every scorecard command's
 * `applyMutation`. Same shape/rationale as `kpiDeviation.routes.ts`'s own
 * `resolveAccess` — no `projectId` (Scorecards are organization-scoped, no
 * project association), so only the org-level baseline plus OWNER/ADMIN/
 * SUPERADMIN's `'*'` apply.
 */
async function resolveAccess(req: AuthenticatedRequest, auth: RouteAuth): Promise<CommandAccessContext> {
  return resolveEffectiveAccess({
    userId: auth.userId,
    organizationId: auth.organizationId,
    applicationRole: req.user?.role,
  });
}

/**
 * Shared error -> HTTP mapping for every write endpoint below. Same shape
 * (typed error classes checked first, generic 500 fallback last, never leak
 * a stack trace) as `kpi.routes.ts`'s `handleKpiRouteError` /
 * `kpiDeviation.routes.ts`'s `handleDeviationRouteError`.
 */
function handleScorecardRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof CommandCapabilityDeniedError) {
    // RN-G5: same rationale as kpiDeviation.routes.ts's identical branch —
    // `details.capability` is server-side-log-only, never wire.
    logger.warn(`[resultsVnext/kpiScorecard.routes] ${op} denied`, { capability: err.details.capability });
    res.status(403).json({ error: err.message, code: err.code });
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
    // Same rationale as kpi.routes.ts's own handling of this error: a
    // well-formed request the org/domain's current state cannot satisfy yet
    // (no active 'kpi'-domain visibility policy provisioned — decision #1),
    // not a malformed request (400) nor a missing resource (404).
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err instanceof KpiScorecardValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  logger.error(`[resultsVnext/kpiScorecard.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'KPI_SCORECARD_INTERNAL_ERROR' });
}

/** See file header — the repository has no single-row `getScorecard`, so
 * this is a narrow, self-contained equivalent: the same visibility-scoped
 * shape `kpiScorecardRepository.ts`'s `listScorecards` uses
 * (`wrapWithVisibilityScope`, resourceType `'kpi_scorecard'`, `::text` cast
 * on the UUID side of the join per that file's own documented fix),
 * narrowed to one `scorecard_id`. Returns `null` for "not found OR not
 * visible" — same non-distinguishing behavior `getKpi`/`getDeviationCase`
 * already have (their callers 404 either way, never leaking existence). */
async function loadVisibleScorecard(
  userId: string,
  organizationId: string,
  scorecardId: string
): Promise<KpiScorecard | null> {
  const baseQuerySql = `
    SELECT sc.* FROM rvn_kpi_scorecards sc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id::text
     WHERE sc.organization_id = $1 AND sc.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: 'kpi_scorecard',
  });
  const values = [...wrapped.values, scorecardId];
  const client = await acquirePgClient();
  try {
    const result = await client.query<KpiScorecardRow>(wrapped.sql, values);
    const row = result.rows[0];
    return row ? toKpiScorecard(row) : null;
  } finally {
    client.release();
  }
}

// ==========================================
// POST /api/vnext/results/kpi/scorecards — createScorecard
// ==========================================

router.post(
  '/',
  validateBody(CreateScorecardSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof CreateScorecardSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await createScorecard({
        organizationId: auth.organizationId,
        name: body.name,
        description: body.description ?? null,
        scopeType: body.scopeType,
        scopeId: body.scopeId ?? null,
        ownerUserId: body.ownerUserId ?? null,
        reviewFrequency: body.reviewFrequency,
        sensitivity: body.sensitivity ?? null,
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
        scorecard: outcome.result.scorecard,
      });
    } catch (err) {
      handleScorecardRouteError(res, err, 'createScorecard');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/scorecards — listScorecards
// ==========================================

router.get(
  '/',
  validateQuery(ListScorecardsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListScorecardsQuerySchema>;
      const scorecards = await listScorecards({
        userId: auth.userId,
        organizationId: auth.organizationId,
        lifecycleStatus: query.lifecycleStatus,
        ownerUserId: query.ownerUserId,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ scorecards });
    } catch (err) {
      handleScorecardRouteError(res, err, 'listScorecards');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/scorecards/:scorecardId — getScorecard
// (see file header — no repository export, local minimal equivalent)
// ==========================================

router.get(
  '/:scorecardId',
  validateParams(ScorecardIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const scorecard = await loadVisibleScorecard(auth.userId, auth.organizationId, scorecardId);
      if (!scorecard) {
        res.status(404).json({ error: 'Scorecard not found', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ scorecard });
    } catch (err) {
      handleScorecardRouteError(res, err, 'getScorecard');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/scorecards/:scorecardId/items — listScorecardItems
// ==========================================

router.get(
  '/:scorecardId/items',
  validateParams(ScorecardIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const items = await listScorecardItems({
        userId: auth.userId,
        organizationId: auth.organizationId,
        scorecardId,
      });
      res.status(200).json({ items });
    } catch (err) {
      handleScorecardRouteError(res, err, 'listScorecardItems');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/scorecards/:scorecardId/items — addScorecardItem
// ==========================================

router.post(
  '/:scorecardId/items',
  validateParams(ScorecardIdParamsSchema),
  validateBody(AddScorecardItemSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const body = req.body as import('zod').infer<typeof AddScorecardItemSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await addScorecardItem({
        scorecardId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        kpiId: body.kpiId,
        role: body.role,
        sortOrder: body.sortOrder,
        displayConfig: body.displayConfig ?? null,
        access,
      });
      res.status(outcome.outcome === 'applied' ? 201 : 200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        scorecard: outcome.result.scorecard,
        item: outcome.result.item,
      });
    } catch (err) {
      handleScorecardRouteError(res, err, 'addScorecardItem');
    }
  }
);

// ==========================================
// DELETE /api/vnext/results/kpi/scorecards/:scorecardId/items/:itemId — removeScorecardItem
// ==========================================

router.delete(
  '/:scorecardId/items/:itemId',
  validateParams(ScorecardItemIdParamsSchema),
  validateBody(RemoveScorecardItemSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId, itemId } = req.params as { scorecardId: string; itemId: string };
      const body = req.body as import('zod').infer<typeof RemoveScorecardItemSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await removeScorecardItem({
        scorecardId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        itemId,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        scorecard: outcome.result.scorecard,
        removedItemId: outcome.result.removedItemId,
      });
    } catch (err) {
      handleScorecardRouteError(res, err, 'removeScorecardItem');
    }
  }
);

// ==========================================
// PATCH /api/vnext/results/kpi/scorecards/:scorecardId/items/reorder — reorderScorecardItems
// (decision #4: item `role` change folded in here — no separate endpoint)
// ==========================================

router.patch(
  '/:scorecardId/items/reorder',
  validateParams(ScorecardIdParamsSchema),
  validateBody(ReorderScorecardItemsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const body = req.body as import('zod').infer<typeof ReorderScorecardItemsSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await reorderScorecardItems({
        scorecardId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        reason: body.reason ?? null,
        items: body.items,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        scorecard: outcome.result.scorecard,
        items: outcome.result.items,
      });
    } catch (err) {
      handleScorecardRouteError(res, err, 'reorderScorecardItems');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/scorecards/:scorecardId/status — getScorecardStatusDistribution
// ==========================================

router.get(
  '/:scorecardId/status',
  validateParams(ScorecardIdParamsSchema),
  validateQuery(ScorecardStatusQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const query = req.query as unknown as import('zod').infer<typeof ScorecardStatusQuerySchema>;
      const distribution = await getScorecardStatusDistribution({
        userId: auth.userId,
        organizationId: auth.organizationId,
        scorecardId,
        asOf: query.asOf,
      });
      res.status(200).json({ distribution });
    } catch (err) {
      handleScorecardRouteError(res, err, 'getScorecardStatusDistribution');
    }
  }
);

// ==========================================
// POST .../activate | .../suspend | .../archive — lifecycle transitions
// ==========================================

function mountLifecycleRoute(path: string, op: string, runner: typeof activateScorecard): void {
  router.post(
    path,
    validateParams(ScorecardIdParamsSchema),
    validateBody(ScorecardLifecycleActionSchema),
    async (req: AuthenticatedRequest, res: Response) => {
      const auth = requireAuth(req, res);
      if (!auth) return;
      try {
        const { scorecardId } = req.params as { scorecardId: string };
        const body = req.body as import('zod').infer<typeof ScorecardLifecycleActionSchema>;
        const access = await resolveAccess(req, auth);
        const outcome = await runner({
          scorecardId,
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
          scorecard: outcome.result,
        });
      } catch (err) {
        handleScorecardRouteError(res, err, op);
      }
    }
  );
}

mountLifecycleRoute('/:scorecardId/activate', 'activateScorecard', activateScorecard);
mountLifecycleRoute('/:scorecardId/suspend', 'suspendScorecard', suspendScorecard);
mountLifecycleRoute('/:scorecardId/archive', 'archiveScorecard', archiveScorecard);

// ==========================================
// POST /api/vnext/results/kpi/scorecards/:scorecardId/review-snapshots — createReviewSnapshot
// ==========================================

router.post(
  '/:scorecardId/review-snapshots',
  validateParams(ScorecardIdParamsSchema),
  validateBody(CreateReviewSnapshotSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const body = req.body as import('zod').infer<typeof CreateReviewSnapshotSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await createReviewSnapshot({
        scorecardId,
        organizationId: auth.organizationId,
        reviewPeriodStart: body.reviewPeriodStart,
        reviewPeriodEnd: body.reviewPeriodEnd,
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
        snapshot: outcome.result,
      });
    } catch (err) {
      handleScorecardRouteError(res, err, 'createReviewSnapshot');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/scorecards/:scorecardId/review-snapshots — listReviewSnapshots
// -- MOUNT-ORDER NOTE (within this router, not Gateway.ts): declared BEFORE
// `GET .../review-snapshots/published` below would be fine either way since
// that path has an extra static segment Express matches unambiguously
// against `GET /:scorecardId/review-snapshots` (no dynamic segment collision
// the way `/:kpiId` vs `/deviation-cases` had) — kept in this order (list,
// then the more specific "published" reader) to match the design doc's own
// §C.3 enumeration (§5 "Published snapshots" after §7 "History").
// ==========================================

router.get(
  '/:scorecardId/review-snapshots',
  validateParams(ScorecardIdParamsSchema),
  validateQuery(ListReviewSnapshotsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const query = req.query as unknown as import('zod').infer<
        typeof ListReviewSnapshotsQuerySchema
      >;
      const snapshots = await listReviewSnapshots({
        userId: auth.userId,
        organizationId: auth.organizationId,
        scorecardId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ snapshots });
    } catch (err) {
      handleScorecardRouteError(res, err, 'listReviewSnapshots');
    }
  }
);

// ==========================================
// GET .../review-snapshots/published — getPublishedSnapshot (decision #6b —
// this is the endpoint with the critical dual-layer non-leak protection;
// calls the repository function directly, does NOT duplicate its
// read-time-redaction logic here — see kpiScorecardRepository.ts's own
// header comment for why both layers are required).
// ==========================================

router.get(
  '/:scorecardId/review-snapshots/published',
  validateParams(ScorecardIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId } = req.params as { scorecardId: string };
      const snapshot = await getPublishedSnapshot({
        userId: auth.userId,
        organizationId: auth.organizationId,
        scorecardId,
      });
      if (!snapshot) {
        res
          .status(404)
          .json({ error: 'No published review snapshot for this scorecard', code: 'NOT_FOUND' });
        return;
      }
      res.status(200).json({ snapshot });
    } catch (err) {
      handleScorecardRouteError(res, err, 'getPublishedSnapshot');
    }
  }
);

// ==========================================
// POST .../review-snapshots/:snapshotId/publish — publishReviewSnapshot
// ==========================================

router.post(
  '/:scorecardId/review-snapshots/:snapshotId/publish',
  validateParams(ScorecardSnapshotIdParamsSchema),
  validateBody(PublishReviewSnapshotSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { scorecardId, snapshotId } = req.params as {
        scorecardId: string;
        snapshotId: string;
      };
      const body = req.body as import('zod').infer<typeof PublishReviewSnapshotSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await publishReviewSnapshot({
        snapshotId,
        scorecardId,
        organizationId: auth.organizationId,
        expectedVersion: body.expectedVersion,
        publishedBy: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey: resolveIdempotencyKey(body.idempotencyKey),
        correlationId: getCorrelationId(req),
        access,
        reason: body.reason ?? null,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        snapshot: outcome.result,
      });
    } catch (err) {
      handleScorecardRouteError(res, err, 'publishReviewSnapshot');
    }
  }
);

export default router;
