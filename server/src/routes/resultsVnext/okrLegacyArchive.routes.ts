/**
 * OKR-E008 Half C — Legacy Archive / Ops Exclusion — HTTP layer.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §5.2/§5.4/§5.6.
 *
 * 9 GET-only endpoints (1 index + 4 legacy tables × list/get) exposing the
 * legacy OKR tables (`okr_cycles`, `okr_objectives`, `okr_key_results`,
 * `okr_check_ins` — `server/migrations/914_okr_management.sql` +
 * `20260803_res009_okr_key_result_definition_version.sql`) as a read-only
 * archive, so nothing on the new `okr_vnext_*` surface (OKR-E001..E007)
 * ever needs to reach into them directly (OKR-F-029, the "izolujący AC").
 *
 * Middleware chain, in this EXACT order — copied verbatim from the two
 * REAL landed files (`kpiLegacyArchive.routes.ts` / `roiLegacyArchive
 * .routes.ts`), not their design docs' pseudocode:
 *   denyMutations -> apiAuthRateLimiter -> verifyToken -> requireOrgAccess()
 *   -> demoContextMiddleware
 *
 * `router.use(denyMutations)` (no path argument), NOT `router.all('*',
 * denyMutations)` — this repo runs Express 5.2.1, whose router uses
 * path-to-regexp v6+, where a bare `'*'` path string throws at router
 * construction time. See `kpiLegacyArchive.routes.ts`'s own header comment
 * for the full Express-5-compatibility rationale; this file reuses the same
 * fix, not a fresh derivation.
 *
 * `validateParams`/`validateQuery` middleware (`validation.middleware.ts`)
 * rather than inline `Schema.parse(req.query)` — this repo's actual global
 * error handler (`ErrorHandler.ts::errorHandlerMiddleware`) has no ZodError
 * branch, so an uncaught ZodError would 500, not 400.
 *
 * `requireOrgAccess` imports from `../../middleware/rbac.middleware.js`
 * (NOT `orgAccess.middleware.js`) — confirmed against the two landed files.
 *
 * Response envelope: `LegacyArchiveMeta`/`legacyMeta()`/
 * `handleLegacyRouteError()` — all local to this route file (not
 * exported/shared from elsewhere), same as both landed precedents.
 *
 * Labeling (D-OKR8-17): SINGLE bucket, `okr_legacy_live` — all 4 tables
 * genuinely belong to ONE owning surface (`resultsStrategic.routes.ts`'s
 * `/:projectId/okr/*`, `okrService.ts`), unlike ROI's 3 genuinely-separate
 * live systems. Live, not dead (D-OKR8-18) — write endpoints exist behind
 * `requireProjectCapability(..., {shadow:true})`, shadow-only unless
 * `CAPABILITY_ENFORCE=enforce`.
 *
 * `key-results`'s list/get responses carry an extra `warnings` array
 * (D-OKR8-19) — `okr_key_results.kpi_id`/`kpi_definition_version_id` are
 * live D09-violating cross-domain FKs (-> `initiative_kpis`,
 * -> `kpi_definition_versions`), informational-only since 2026-07-12
 * (D7/Piotr) and never used for scoring; `okr_vnext_*` carries no
 * equivalent FK. Neither KPI-E007 nor ROI-E008 needed this — this is the
 * first legacy inventory in this program where the archived rows carry a
 * live INBOUND cross-domain FK, so the warning is added here at the ROUTE
 * layer, not hidden at the repository layer (which deliberately still
 * `SELECT *`s both columns).
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
  getLegacyOkrCheckIn,
  getLegacyOkrCycle,
  getLegacyOkrKeyResult,
  getLegacyOkrObjective,
  getOkrLegacyArchiveIndex,
  listLegacyOkrCheckIns,
  listLegacyOkrCycles,
  listLegacyOkrKeyResults,
  listLegacyOkrObjectives,
  type OkrLegacyOriginDomain,
} from '../../services/resultsVnext/okr/okrLegacyArchiveRepository.js';
import { resultsVnextOkrLegacyArchiveHitsTotal } from '../../services/metricsService.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  ListOkrLegacyQuerySchema,
  OkrLegacyIdParamsSchema,
} from '../../validators/resultsVnextOkrLegacy.validators.js';

const router = Router();

// denyMutations FIRST — before auth/rate-limit/org-access — see file header.
router.use(denyMutations);
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// SHARED HELPERS (same shape as kpiLegacyArchive.routes.ts's /
// roiLegacyArchive.routes.ts's own `requireAuth`/`legacyMeta`/
// `handleLegacyRouteError` — not exported there, re-declared here)
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

interface LegacyArchiveMeta {
  label: string;
  originDomain: OkrLegacyOriginDomain;
  sourceTable: string;
  readOnly: true;
  organizationId: string;
  fetchedAt: string;
  total?: number;
  limit?: number;
  offset?: number;
}

/** Design §5.2's single-bucket labeling table (Decision D-OKR8-17), literal. */
const LEGACY_LABELS: Record<string, { originDomain: OkrLegacyOriginDomain; label: string }> = {
  cycles: {
    originDomain: 'okr_legacy_live',
    label: 'Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext',
  },
  objectives: {
    originDomain: 'okr_legacy_live',
    label: 'Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext',
  },
  'key-results': {
    originDomain: 'okr_legacy_live',
    label: 'Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext',
  },
  'check-ins': {
    originDomain: 'okr_legacy_live',
    label: 'Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext',
  },
};

/** Builds the `LegacyArchiveMeta` envelope per design §5.2's table —
 * `routeKey` is the kebab-case route segment (e.g. `'key-results'`), NOT
 * the raw SQL table name — kept distinct from `sourceTable` (the DB table
 * name reported in the response body), same convention as the landed ROI
 * file. */
function legacyMeta(
  routeKey: keyof typeof LEGACY_LABELS,
  sourceTable: string,
  organizationId: string,
  total?: number,
  limit?: number,
  offset?: number
): LegacyArchiveMeta {
  const { originDomain, label } = LEGACY_LABELS[routeKey]!;
  return {
    label,
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
  logger.error(`[resultsVnext/okrLegacyArchive.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'OKR_LEGACY_ARCHIVE_INTERNAL_ERROR' });
}

// ==========================================
// GET /api/vnext/results/okr/legacy — index
// ==========================================

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const data = await getOkrLegacyArchiveIndex(auth.organizationId);
    res.json({
      data,
      meta: {
        label: 'OKR legacy archive index',
        readOnly: true,
        organizationId: auth.organizationId,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    handleLegacyRouteError(res, err, 'getOkrLegacyArchiveIndex');
  }
});

// ==========================================
// cycles
// ==========================================

router.get('/cycles', validateQuery(ListOkrLegacyQuerySchema), async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const query = req.query as unknown as import('zod').infer<typeof ListOkrLegacyQuerySchema>;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { rows, total } = await listLegacyOkrCycles(auth.organizationId, limit, offset);
    resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_cycles' });
    res.json({
      data: rows,
      meta: legacyMeta('cycles', 'okr_cycles', auth.organizationId, total, limit, offset),
    });
  } catch (err) {
    handleLegacyRouteError(res, err, 'listLegacyOkrCycles');
  }
});

router.get(
  '/cycles/:legacyId',
  validateParams(OkrLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof OkrLegacyIdParamsSchema>;
      const row = await getLegacyOkrCycle(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({ data: null, meta: legacyMeta('cycles', 'okr_cycles', auth.organizationId) });
        return;
      }
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_cycles' });
      res.json({ data: row, meta: legacyMeta('cycles', 'okr_cycles', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyOkrCycle');
    }
  }
);

// ==========================================
// objectives
// ==========================================

router.get(
  '/objectives',
  validateQuery(ListOkrLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyOkrObjectives(auth.organizationId, limit, offset);
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_objectives' });
      res.json({
        data: rows,
        meta: legacyMeta('objectives', 'okr_objectives', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyOkrObjectives');
    }
  }
);

router.get(
  '/objectives/:legacyId',
  validateParams(OkrLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof OkrLegacyIdParamsSchema>;
      const row = await getLegacyOkrObjective(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({ data: null, meta: legacyMeta('objectives', 'okr_objectives', auth.organizationId) });
        return;
      }
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_objectives' });
      res.json({ data: row, meta: legacyMeta('objectives', 'okr_objectives', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyOkrObjective');
    }
  }
);

// ==========================================
// key-results (D-OKR8-19: extra `warnings` array, list + get)
// ==========================================

const KEY_RESULTS_D09_WARNING =
  'kpi_id and kpi_definition_version_id are legacy-only cross-references to ' +
  'initiative_kpis / kpi_definition_versions. Informational only since ' +
  '2026-07-12 (D7, migration 914 header) — never used for scoring. ' +
  'okr_vnext_* carries no equivalent FK (D09).';

router.get(
  '/key-results',
  validateQuery(ListOkrLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyOkrKeyResults(auth.organizationId, limit, offset);
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_key_results' });
      res.json({
        data: rows,
        meta: legacyMeta('key-results', 'okr_key_results', auth.organizationId, total, limit, offset),
        warnings: [KEY_RESULTS_D09_WARNING],
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyOkrKeyResults');
    }
  }
);

router.get(
  '/key-results/:legacyId',
  validateParams(OkrLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof OkrLegacyIdParamsSchema>;
      const row = await getLegacyOkrKeyResult(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({
          data: null,
          meta: legacyMeta('key-results', 'okr_key_results', auth.organizationId),
          warnings: [KEY_RESULTS_D09_WARNING],
        });
        return;
      }
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_key_results' });
      res.json({
        data: row,
        meta: legacyMeta('key-results', 'okr_key_results', auth.organizationId),
        warnings: [KEY_RESULTS_D09_WARNING],
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyOkrKeyResult');
    }
  }
);

// ==========================================
// check-ins
// ==========================================

router.get(
  '/check-ins',
  validateQuery(ListOkrLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListOkrLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyOkrCheckIns(auth.organizationId, limit, offset);
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_check_ins' });
      res.json({
        data: rows,
        meta: legacyMeta('check-ins', 'okr_check_ins', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyOkrCheckIns');
    }
  }
);

router.get(
  '/check-ins/:legacyId',
  validateParams(OkrLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof OkrLegacyIdParamsSchema>;
      const row = await getLegacyOkrCheckIn(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({ data: null, meta: legacyMeta('check-ins', 'okr_check_ins', auth.organizationId) });
        return;
      }
      resultsVnextOkrLegacyArchiveHitsTotal.inc({ source_table: 'okr_check_ins' });
      res.json({ data: row, meta: legacyMeta('check-ins', 'okr_check_ins', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyOkrCheckIn');
    }
  }
);

export default router;
