/**
 * KPI-E007 — Legacy Archive / Ops Exclusion — HTTP layer.
 *
 * Design: docs/product/results-vnext/KPI_E007_DESIGN.md §2.
 *
 * 9 GET-only endpoints (1 index + 4 legacy tables × list/get) exposing the
 * legacy/parallel KPI-definition tables identified in the design's §0.1
 * inventory as a read-only archive, so nothing on the new `rvn_kpi_*` /
 * Registry surface (RN-G2, out of scope here) ever needs to reach into them
 * directly.
 *
 * Middleware chain, in this EXACT order — `denyMutations` first, before
 * auth, so a misconfigured auth layer can never open a write hole (design's
 * own stated rationale, §2):
 *   denyMutations -> apiAuthRateLimiter -> verifyToken -> requireOrgAccess()
 *   -> demoContextMiddleware
 *
 * -- DEVIATION FROM DESIGN §2's LITERAL SNIPPET (`router.all('*',
 * denyMutations)`): this repo runs Express 5.2.1 (`package.json`), whose
 * router uses path-to-regexp v6+ — a bare `'*'` path string throws at router
 * construction time (Express 5 requires a named wildcard, e.g. `/{*splat}`;
 * verified against this repo's own Express-5-compatible precedent,
 * `t01BrowserFixtureServer.ts`'s `app.all('/api/v8/transformation-cases/*path', ...)`).
 * `router.use(denyMutations)` (no path argument) is functionally identical
 * for this purpose — Express runs a pathless `router.use` middleware for
 * every request under this router regardless of method or sub-path — and
 * needs no wildcard syntax at all. Still registered first, so the security
 * property the design calls out (denyMutations before auth) is unchanged.
 *
 * -- DEVIATION FROM DESIGN §2.2's LITERAL SNIPPET (inline
 * `Schema.parse(req.query)` inside the try/catch, relying on "the existing
 * global error middleware" to turn a thrown ZodError into a 400): this
 * repo's actual global error handler (`server/src/utils/ErrorHandler.ts`'s
 * `errorHandlerMiddleware`, verified by reading it) has no ZodError branch
 * — an uncaught ZodError falls through to its generic 500 response, not
 * 400. Every sibling router in this directory
 * (`kpi.routes.ts`/`kpiPerspectives.routes.ts`) instead validates via the
 * `validateQuery`/`validateParams` middleware (`validation.middleware.ts`),
 * which DOES return 400 with a structured `{ error, details }` body on
 * failure. This file follows that real, already-correct pattern — which is
 * what the design doc's own words actually ask for ("matching the pattern
 * every other resultsVnext route file already uses") — rather than the
 * illustrative inline-`.parse()` pseudocode, which would have silently
 * turned every malformed query/param into a 500.
 */
import { Router } from 'express';
import type { Response } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { denyMutations } from '../../middleware/readOnlyGuard.middleware.js';
import { validateParams, validateQuery } from '../../middleware/validation.middleware.js';
import {
  getLegacyArchiveIndex,
  getLegacyKpi,
  getLegacyKpiDefinition,
  getLegacyTpKpiDefinition,
  getLegacyV8KpiDefinition,
  listLegacyKpiDefinitions,
  listLegacyKpis,
  listLegacyTpKpiDefinitions,
  listLegacyV8KpiDefinitions,
} from '../../services/resultsVnext/kpi/kpiLegacyArchiveRepository.js';
import { resultsVnextLegacyArchiveHitsTotal } from '../../services/metricsService.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  LegacyIdParamsSchema,
  ListLegacyQuerySchema,
} from '../../validators/resultsVnextKpiLegacy.validators.js';

const router = Router();

// denyMutations FIRST — before auth/rate-limit/org-access — see file header.
router.use(denyMutations);
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// SHARED HELPERS (same shape as kpi.routes.ts's own `requireAuth` — see that
// file's doc comment; not exported there, so re-declared here)
// ==========================================

interface RouteAuth {
  organizationId: string;
}

function requireAuth(req: AuthenticatedRequest, res: Response): RouteAuth | null {
  const organizationId = req.user?.organizationId || req.user?.organization_id;
  if (!organizationId) {
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }
  return { organizationId };
}

type OriginDomain = 'results_legacy' | 'table_platform_live';

interface LegacyArchiveMeta {
  label: string;
  originDomain: OriginDomain;
  sourceTable: string;
  readOnly: true;
  organizationId: string;
  fetchedAt: string;
  total?: number;
  limit?: number;
  offset?: number;
}

const LEGACY_LABELS: Record<OriginDomain, string> = {
  results_legacy: 'Legacy archive — read-only',
  table_platform_live: 'Table Platform — live, external to Results',
};

/** Builds the `LegacyArchiveMeta` envelope per design §2.1's table — avoids
 * repeating the label string 8 times. */
function legacyMeta(
  sourceTable: string,
  originDomain: OriginDomain,
  organizationId: string,
  total?: number,
  limit?: number,
  offset?: number
): LegacyArchiveMeta {
  return {
    label: LEGACY_LABELS[originDomain],
    originDomain,
    sourceTable,
    readOnly: true,
    organizationId,
    fetchedAt: new Date().toISOString(),
    ...(total !== undefined ? { total } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(offset !== undefined ? { offset } : {}),
  };
}

function handleLegacyRouteError(res: Response, err: unknown, op: string): void {
  logger.error(`[resultsVnext/kpiLegacyArchive.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'KPI_LEGACY_ARCHIVE_INTERNAL_ERROR' });
}

// ==========================================
// GET /api/vnext/results/kpi/legacy — index
// ==========================================

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const data = await getLegacyArchiveIndex(auth.organizationId);
    res.json({
      data,
      meta: {
        label: 'Legacy archive index',
        readOnly: true,
        organizationId: auth.organizationId,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    handleLegacyRouteError(res, err, 'getLegacyArchiveIndex');
  }
});

// ==========================================
// kpis
// ==========================================

router.get(
  '/kpis',
  validateQuery(ListLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyKpis(auth.organizationId, limit, offset);
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'kpis' });
      res.json({ data: rows, meta: legacyMeta('kpis', 'results_legacy', auth.organizationId, total, limit, offset) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyKpis');
    }
  }
);

router.get(
  '/kpis/:legacyId',
  validateParams(LegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof LegacyIdParamsSchema>;
      const row = await getLegacyKpi(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({ data: null, meta: legacyMeta('kpis', 'results_legacy', auth.organizationId) });
        return;
      }
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'kpis' });
      res.json({ data: row, meta: legacyMeta('kpis', 'results_legacy', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyKpi');
    }
  }
);

// ==========================================
// kpi-definitions
// ==========================================

router.get(
  '/kpi-definitions',
  validateQuery(ListLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyKpiDefinitions(auth.organizationId, limit, offset);
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'kpi_definitions' });
      res.json({
        data: rows,
        meta: legacyMeta('kpi_definitions', 'results_legacy', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyKpiDefinitions');
    }
  }
);

router.get(
  '/kpi-definitions/:legacyId',
  validateParams(LegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof LegacyIdParamsSchema>;
      const row = await getLegacyKpiDefinition(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('kpi_definitions', 'results_legacy', auth.organizationId) });
        return;
      }
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'kpi_definitions' });
      res.json({ data: row, meta: legacyMeta('kpi_definitions', 'results_legacy', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyKpiDefinition');
    }
  }
);

// ==========================================
// v8-kpi-definitions
// ==========================================

router.get(
  '/v8-kpi-definitions',
  validateQuery(ListLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyV8KpiDefinitions(auth.organizationId, limit, offset);
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'v8_kpi_definitions' });
      res.json({
        data: rows,
        meta: legacyMeta('v8_kpi_definitions', 'results_legacy', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyV8KpiDefinitions');
    }
  }
);

router.get(
  '/v8-kpi-definitions/:legacyId',
  validateParams(LegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof LegacyIdParamsSchema>;
      const row = await getLegacyV8KpiDefinition(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('v8_kpi_definitions', 'results_legacy', auth.organizationId) });
        return;
      }
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'v8_kpi_definitions' });
      res.json({ data: row, meta: legacyMeta('v8_kpi_definitions', 'results_legacy', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyV8KpiDefinition');
    }
  }
);

// ==========================================
// tp-kpi-definitions — Table Platform, live external product (Decision D3)
// ==========================================

router.get(
  '/tp-kpi-definitions',
  validateQuery(ListLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyTpKpiDefinitions(auth.organizationId, limit, offset);
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'tp_kpi_definitions' });
      res.json({
        data: rows,
        meta: legacyMeta('tp_kpi_definitions', 'table_platform_live', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyTpKpiDefinitions');
    }
  }
);

router.get(
  '/tp-kpi-definitions/:legacyId',
  validateParams(LegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof LegacyIdParamsSchema>;
      const row = await getLegacyTpKpiDefinition(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('tp_kpi_definitions', 'table_platform_live', auth.organizationId) });
        return;
      }
      resultsVnextLegacyArchiveHitsTotal.inc({ source_table: 'tp_kpi_definitions' });
      res.json({ data: row, meta: legacyMeta('tp_kpi_definitions', 'table_platform_live', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyTpKpiDefinition');
    }
  }
);

export default router;
