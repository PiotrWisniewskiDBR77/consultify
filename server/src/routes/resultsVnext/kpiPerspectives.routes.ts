/**
 * KPI-E005 Perspectives & Links — HTTP layer.
 *
 * Design: docs/product/results-vnext/KPI_E005_DESIGN.md §A (My KPIs), §B
 * (Organization/manager view), §C.3 (InitiativeKPIImpact commands) — the
 * package explicitly left as "next package" by EXECUTION_LEDGER.md §27
 * ("Not in this package: `/api/vnext/results/kpi/my`, `/attention`,
 * `/initiative-impacts/*` HTTP routes"). This file is that next package.
 *
 * Thin HTTP layer over `services/resultsVnext/kpi/kpiPerspectivesRepository.ts`
 * / `kpiInitiativeImpactCommands.ts` / `kpiInitiativeImpactRepository.ts` —
 * same division of responsibility and structural precedent (inline handlers
 * + a shared `handle*Error` mapper + a local `requireAuth` helper) as
 * `kpi.routes.ts`/`kpiDeviation.routes.ts`/`kpiScorecard.routes.ts`.
 *
 * -- TWO MOUNT PREFIXES, TWO ROUTERS. The task's own endpoint list spans two
 * different URL families:
 *   - `/api/vnext/results/kpi/{my,attention,initiative-impacts/*,:kpiId/
 *     initiative-impacts}` — children of the SAME generic prefix
 *     `kpi.routes.ts` already owns (`GET /:kpiId`), unlike
 *     `kpiDeviation.routes.ts`/`kpiScorecard.routes.ts`, which each carved
 *     out their OWN more-specific sub-prefix (`/deviation-cases`,
 *     `/scorecards`) precisely so they would never collide with that
 *     `GET /:kpiId`. `/my` and `/attention` cannot do that — the task
 *     names them as direct children of `/api/vnext/results/kpi` itself, so
 *     this router (`router`, the default export) is mounted at that exact
 *     SAME prefix as `kpi.routes.ts` and MUST be registered in Gateway.ts
 *     BEFORE it (see that file's own mount-order comment). Without that
 *     ordering, `GET /api/vnext/results/kpi/my` would hit
 *     `kpi.routes.ts`'s `GET /:kpiId` first (`kpiId="my"`), and
 *     `validateParams(KpiIdParamsSchema)` (a UUID check) would 400 it
 *     directly — never reaching this router. Verified explicitly with a
 *     test that mounts BOTH routers in the correct order and asserts
 *     `GET /my`/`GET /attention` resolve HERE, not through `kpi.routes.ts`'s
 *     `getKpi` (`kpiPerspectives.routes.test.ts`'s own "mount-order
 *     regression guard" describe block) — same shape
 *     `kpiDeviation.routes.test.ts`'s own guard test uses for its
 *     `/deviation-cases` prefix.
 *     Registration order relative to `kpiDeviation.routes.ts`'s
 *     `/deviation-cases` and `kpiScorecard.routes.ts`'s `/scorecards`
 *     routers does not matter (same reasoning `kpiScorecard.routes.ts`'s own
 *     header comment gives for its relation to `/deviation-cases`): none of
 *     THIS router's literal path segments (`my`, `attention`,
 *     `initiative-impacts`) collide with `deviation-cases`/`scorecards`, and
 *     this router's only dynamic-segment route (`GET /:kpiId/initiative-impacts`)
 *     requires a literal SECOND segment ("initiative-impacts"), so it never
 *     matches a bare `/deviation-cases` or `/scorecards` request either.
 *   - `GET /api/vnext/results/initiatives/:initiativeId/kpi-impacts` — an
 *     entirely different prefix family (no existing `/api/vnext/results/
 *     initiatives` mount exists anywhere in Gateway.ts today, verified by
 *     grep), so `initiativesKpiImpactsRouter` (named export) is mounted
 *     there as a brand-new prefix with no ordering risk at all.
 *
 * -- managerId / userId derivation: task brief says "managerId z tokena" /
 * "userId z tokena" — both `listMyKpis` and `listOrganizationKpiAttention`
 * read the AUTHENTICATED actor's own id (`auth.userId`) as, respectively,
 * the "whose obligations" and "which manager's chain" parameter. Neither
 * endpoint accepts a client-supplied user/manager id — impersonating another
 * user's "My KPIs" or another manager's attention view is not a feature this
 * package adds (same "server derives identity, client supplies content"
 * split every write endpoint below also follows for `proposedBy`/
 * `committedBy`/`reviewedBy`/`actorUserId`).
 *
 * -- Error mapping: `InitiativeKpiImpactSelfApprovalDeniedError` -> 403,
 * mirroring `kpi.routes.ts`'s `SelfApprovalDeniedError` /
 * `kpiDeviation.routes.ts`'s `DeviationSelfApprovalDeniedError` (design
 * §C.3: "mirrors SelfApprovalDeniedError/DeviationSelfApprovalDeniedError,
 * not UI-only"). `AtomicWriteConflictError` (STALE_VERSION) -> 409,
 * `AtomicWriteAggregateNotFoundError` -> 404, `KpiInitiativeImpactValidationError`
 * (ACTIVE_IMPACT_EXISTS / NOT_PROPOSED / NOT_COMMITTED / NOT_ACTIVE) -> 409 —
 * same "typed error classes checked first, generic 500 fallback last, never
 * leak a stack trace" shape as every sibling `handle*Error` in this
 * directory.
 *
 * Neither `listMyKpis`/`listOrganizationKpiAttention` (reads, scoped only
 * through `buildVisibilityScopedCte`) nor the InitiativeKPIImpact commands
 * (this table deliberately has no own `rvn_platform_resource_visibility`
 * row — design §C) can throw `KpiNoActiveVisibilityPolicyError` — verified
 * by reading `kpiPerspectivesRepository.ts`/`kpiInitiativeImpactCommands.ts`
 * (neither imports or throws it), so unlike `kpi.routes.ts`/
 * `kpiScorecard.routes.ts` this file's error mapper does not carry that
 * branch.
 */
import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';

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
import {
  commitInitiativeKpiImpact,
  InitiativeKpiImpactSelfApprovalDeniedError,
  KpiInitiativeImpactValidationError,
  proposeInitiativeKpiImpact,
  recordReviewedAttribution,
  supersedeInitiativeKpiImpact,
} from '../../services/resultsVnext/kpi/kpiInitiativeImpactCommands.js';
import {
  listInitiativeImpactsForKpi,
  listKpiImpactsForInitiative,
} from '../../services/resultsVnext/kpi/kpiInitiativeImpactRepository.js';
import {
  listMyKpis,
  listOrganizationKpiAttention,
} from '../../services/resultsVnext/kpi/kpiPerspectivesRepository.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
} from '../../services/resultsVnext/platform/atomicWrite.js';
import {
  CommandCapabilityDeniedError,
  type CommandAccessContext,
} from '../../services/resultsVnext/platform/commandCapabilityGuard.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  CommitInitiativeKpiImpactSchema,
  ImpactIdParamsSchema,
  InitiativeIdParamsSchema,
  KpiIdParamsSchema,
  ListImpactsQuerySchema,
  ListMyKpisQuerySchema,
  ListOrganizationKpiAttentionQuerySchema,
  ProposeInitiativeKpiImpactSchema,
  RecordReviewedAttributionSchema,
  SupersedeInitiativeKpiImpactSchema,
} from '../../validators/resultsVnextKpiPerspectives.validators.js';

// ==========================================
// SHARED HELPERS (same shape as kpi.routes.ts / kpiDeviation.routes.ts /
// kpiScorecard.routes.ts — see those files' own doc comments for the
// rationale; not exported there, so re-declared here)
// ==========================================

interface RouteAuth {
  organizationId: string;
  userId: string;
  role: string;
}

/** Defense-in-depth re-check on top of `verifyToken`/`requireOrgAccess()` —
 * same pattern as every sibling `requireAuth` in this directory. */
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
 * RN-G5 (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md): resolves the
 * REAL effective access context for the authenticated actor — same shape as
 * `kpiDeviation.routes.ts`/`kpiScorecard.routes.ts`'s own `resolveAccess`.
 * No `projectId` — InitiativeKPIImpact is organization-scoped (design §C:
 * "Initiative (legacy module) does not participate in RVN ABAC").
 */
async function resolveAccess(req: AuthenticatedRequest, auth: RouteAuth): Promise<CommandAccessContext> {
  return resolveEffectiveAccess({
    userId: auth.userId,
    organizationId: auth.organizationId,
    applicationRole: req.user?.role,
  });
}

/**
 * Shared error -> HTTP mapping for every write endpoint below. See file
 * header for why this mapper has no `KpiNoActiveVisibilityPolicyError`
 * branch, unlike its siblings.
 */
function handlePerspectivesRouteError(res: Response, err: unknown, op: string): void {
  if (err instanceof CommandCapabilityDeniedError) {
    // RN-G5: same rationale as kpiDeviation.routes.ts's identical branch —
    // `details.capability` is server-side-log-only, never wire.
    logger.warn(`[resultsVnext/kpiPerspectives.routes] ${op} denied`, { capability: err.details.capability });
    res.status(403).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof InitiativeKpiImpactSelfApprovalDeniedError) {
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
  if (err instanceof KpiInitiativeImpactValidationError) {
    res.status(409).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  logger.error(`[resultsVnext/kpiPerspectives.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'KPI_PERSPECTIVES_INTERNAL_ERROR' });
}

// ==========================================
// Router A — mounted at /api/vnext/results/kpi (Gateway.ts, BEFORE
// resultsVnextKpiRoutes — see file header).
// ==========================================

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// GET /api/vnext/results/kpi/my — listMyKpis
// ==========================================

router.get(
  '/my',
  validateQuery(ListMyKpisQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListMyKpisQuerySchema>;
      const items = await listMyKpis({
        userId: auth.userId,
        organizationId: auth.organizationId,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ items });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'listMyKpis');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/attention — listOrganizationKpiAttention
// ==========================================

router.get(
  '/attention',
  validateQuery(ListOrganizationKpiAttentionQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<
        typeof ListOrganizationKpiAttentionQuerySchema
      >;
      const attention = await listOrganizationKpiAttention({
        managerId: auth.userId,
        organizationId: auth.organizationId,
        includeSelf: query.includeSelf,
        recurrenceWindowDays: query.recurrenceWindowDays,
      });
      res.status(200).json({ attention });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'listOrganizationKpiAttention');
    }
  }
);

// ==========================================
// POST /api/vnext/results/kpi/initiative-impacts — proposeInitiativeKpiImpact
// ==========================================

router.post(
  '/initiative-impacts',
  validateBody(ProposeInitiativeKpiImpactSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const body = req.body as import('zod').infer<typeof ProposeInitiativeKpiImpactSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await proposeInitiativeKpiImpact({
        organizationId: auth.organizationId,
        kpiId: body.kpiId,
        initiativeId: body.initiativeId,
        expectedContributionValue: body.expectedContributionValue ?? null,
        expectedContributionDirection: body.expectedContributionDirection ?? null,
        targetCompletionDate: body.targetCompletionDate ?? null,
        proposedBy: auth.userId,
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
        impact: outcome.result.impact,
      });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'proposeInitiativeKpiImpact');
    }
  }
);

// ==========================================
// POST .../initiative-impacts/:impactId/commit — commitInitiativeKpiImpact
// ==========================================

router.post(
  '/initiative-impacts/:impactId/commit',
  validateParams(ImpactIdParamsSchema),
  validateBody(CommitInitiativeKpiImpactSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { impactId } = req.params as { impactId: string };
      const body = req.body as import('zod').infer<typeof CommitInitiativeKpiImpactSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await commitInitiativeKpiImpact({
        organizationId: auth.organizationId,
        impactId,
        expectedVersion: body.expectedVersion,
        committedBy: auth.userId,
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
        impact: outcome.result.impact,
      });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'commitInitiativeKpiImpact');
    }
  }
);

// ==========================================
// POST .../initiative-impacts/:impactId/review — recordReviewedAttribution
// (self-approval denial: reviewedBy [auth.userId] === committed_by -> 403,
// see design §C.3 / handlePerspectivesRouteError above)
// ==========================================

router.post(
  '/initiative-impacts/:impactId/review',
  validateParams(ImpactIdParamsSchema),
  validateBody(RecordReviewedAttributionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { impactId } = req.params as { impactId: string };
      const body = req.body as import('zod').infer<typeof RecordReviewedAttributionSchema>;
      const access = await resolveAccess(req, auth);
      const outcome = await recordReviewedAttribution({
        organizationId: auth.organizationId,
        impactId,
        expectedVersion: body.expectedVersion,
        reviewedAttributionValue: body.reviewedAttributionValue,
        reviewedAttributionMeasurementId: body.reviewedAttributionMeasurementId ?? null,
        reviewRationale: body.reviewRationale,
        reviewedBy: auth.userId,
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
        impact: outcome.result.impact,
      });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'recordReviewedAttribution');
    }
  }
);

// ==========================================
// POST .../initiative-impacts/:impactId/supersede — supersedeInitiativeKpiImpact
// ==========================================

router.post(
  '/initiative-impacts/:impactId/supersede',
  validateParams(ImpactIdParamsSchema),
  validateBody(SupersedeInitiativeKpiImpactSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { impactId } = req.params as { impactId: string };
      const body = req.body as import('zod').infer<typeof SupersedeInitiativeKpiImpactSchema>;
      const idempotencyKey = resolveIdempotencyKey(body.idempotencyKey);
      const correlationId = getCorrelationId(req);
      const reason = body.reason ?? null;
      const access = await resolveAccess(req, auth);
      const outcome = await supersedeInitiativeKpiImpact({
        organizationId: auth.organizationId,
        impactId,
        expectedVersion: body.expectedVersion,
        replacementInput: {
          expectedContributionValue: body.replacement.expectedContributionValue ?? null,
          expectedContributionDirection: body.replacement.expectedContributionDirection ?? null,
          targetCompletionDate: body.replacement.targetCompletionDate ?? null,
          proposedBy: auth.userId,
          actorEffectiveRole: auth.role,
          idempotencyKey,
          correlationId,
          reason,
          access,
        },
        actorUserId: auth.userId,
        actorEffectiveRole: auth.role,
        idempotencyKey,
        correlationId,
        reason,
        access,
      });
      res.status(200).json({
        outcome: outcome.outcome,
        eventId: outcome.eventId,
        resultingVersion: outcome.resultingVersion,
        superseded: outcome.result.superseded,
        replacement: outcome.result.replacement,
      });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'supersedeInitiativeKpiImpact');
    }
  }
);

// ==========================================
// GET /api/vnext/results/kpi/:kpiId/initiative-impacts — listInitiativeImpactsForKpi
// -- MOUNT-ORDER NOTE: this is a two-segment path, second segment a literal
// "initiative-impacts" — it never collides with kpi.routes.ts's OWN
// single-segment `GET /:kpiId`, regardless of which router is registered
// first (see file header for the routes that DO need the ordering fix).
// Declared last in this router as it is the least specific pattern here.
// ==========================================

router.get(
  '/:kpiId/initiative-impacts',
  validateParams(KpiIdParamsSchema),
  validateQuery(ListImpactsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { kpiId } = req.params as { kpiId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListImpactsQuerySchema>;
      const impacts = await listInitiativeImpactsForKpi({
        userId: auth.userId,
        organizationId: auth.organizationId,
        kpiId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ impacts });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'listInitiativeImpactsForKpi');
    }
  }
);

export default router;

// ==========================================
// Router B — mounted at /api/vnext/results/initiatives (Gateway.ts, brand
// new prefix, no ordering risk — see file header).
// ==========================================

export const initiativesKpiImpactsRouter = Router();

initiativesKpiImpactsRouter.use(apiAuthRateLimiter);
initiativesKpiImpactsRouter.use(verifyToken);
initiativesKpiImpactsRouter.use(requireOrgAccess());
initiativesKpiImpactsRouter.use(demoContextMiddleware);

// ==========================================
// GET /api/vnext/results/initiatives/:initiativeId/kpi-impacts — listKpiImpactsForInitiative
// ==========================================

initiativesKpiImpactsRouter.get(
  '/:initiativeId/kpi-impacts',
  validateParams(InitiativeIdParamsSchema),
  validateQuery(ListImpactsQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { initiativeId } = req.params as { initiativeId: string };
      const query = req.query as unknown as import('zod').infer<typeof ListImpactsQuerySchema>;
      const impacts = await listKpiImpactsForInitiative({
        userId: auth.userId,
        organizationId: auth.organizationId,
        initiativeId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });
      res.status(200).json({ impacts });
    } catch (err) {
      handlePerspectivesRouteError(res, err, 'listKpiImpactsForInitiative');
    }
  }
);
