/**
 * ROI-E008 — Legacy Archive / Ops Exclusion — HTTP layer.
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §3/B1.
 *
 * 15 GET-only endpoints (1 index + 7 legacy tables × list/get) exposing the
 * legacy/parallel ROI tables identified in the design's §B0 inventory as a
 * read-only archive, so nothing on the vNext `rvn_roi_*` surface ever needs
 * to reach into them directly (AC-05).
 *
 * Middleware chain, in this EXACT order — copied verbatim from the actual
 * LANDED `kpiLegacyArchive.routes.ts` (KPI-E007), NOT that file's own design
 * doc's illustrative pseudocode, per this epic's own explicit instruction:
 *   denyMutations -> apiAuthRateLimiter -> verifyToken -> requireOrgAccess()
 *   -> demoContextMiddleware
 *
 * `router.use(denyMutations)` (no path argument, no Express-5 wildcard
 * syntax needed) rather than `router.all('*', denyMutations)` — this repo
 * runs Express 5.2.1, whose router uses path-to-regexp v6+, where a bare
 * `'*'` path string throws at router construction time. See
 * `kpiLegacyArchive.routes.ts`'s own header comment for the full
 * Express-5-compatibility rationale; this file reuses the same fix, not a
 * fresh derivation.
 *
 * `validateParams`/`validateQuery` middleware (`validation.middleware.ts`)
 * rather than inline `Schema.parse(req.query)` — same reason as
 * `kpiLegacyArchive.routes.ts`'s own header comment: this repo's actual
 * global error handler has no ZodError branch, so an uncaught ZodError
 * would fall through to a generic 500, not 400. `validateParams`/
 * `validateQuery` DO return a structured 400 on failure, matching every
 * sibling router in this directory.
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
  getLegacyAnalysisFinancial,
  getLegacyBenefitsRegisterEntry,
  getLegacyDigitizationAnalysis,
  getLegacyInitiativeBenefit,
  getLegacyRoiAssumption,
  getLegacyRoiRealizedValue,
  getLegacyV8RoiRealizationEntry,
  getRoiLegacyArchiveIndex,
  listLegacyAnalysisFinancials,
  listLegacyBenefitsRegister,
  listLegacyDigitizationAnalyses,
  listLegacyInitiativeBenefits,
  listLegacyRoiAssumptions,
  listLegacyRoiRealizedValues,
  listLegacyV8RoiRealizationEntries,
  type RoiLegacyOriginDomain,
} from '../../services/resultsVnext/roi/roiLegacyArchiveRepository.js';
import { resultsVnextRoiLegacyArchiveHitsTotal } from '../../services/metricsService.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import logger from '../../utils/Logger.js';
import {
  ListRoiLegacyQuerySchema,
  RoiLegacyIdParamsSchema,
} from '../../validators/resultsVnextRoiLegacy.validators.js';

const router = Router();

// denyMutations FIRST — before auth/rate-limit/org-access — see file header.
router.use(denyMutations);
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// SHARED HELPERS (same shape as kpiLegacyArchive.routes.ts's own
// `requireAuth`/`legacyMeta`/`handleLegacyRouteError` — not exported there,
// re-declared here)
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
  originDomain: RoiLegacyOriginDomain;
  sourceTable: string;
  readOnly: true;
  organizationId: string;
  fetchedAt: string;
  total?: number;
  limit?: number;
  offset?: number;
}

/** Design §3/B1's 4-bucket labeling table (Decision D14), literal. */
const LEGACY_LABELS: Record<string, { originDomain: RoiLegacyOriginDomain; label: string }> = {
  'analysis-financials': {
    originDomain: 'initiatives_module_live',
    label: "Initiatives module `/roi` — live, external to Results vNext",
  },
  'digitization-analyses': {
    originDomain: 'initiatives_module_live',
    label: "Initiatives module `/roi` — live, external to Results vNext",
  },
  'initiative-benefits': {
    originDomain: 'finance_benefits_live',
    label: 'Legacy Benefits (initiative_benefits) — live, external to Results vNext',
  },
  'roi-assumptions': {
    originDomain: 'results_v8_live',
    label: "Results V8 `/api/v8/results/roi` — live, external to Results vNext",
  },
  'roi-realized-values': {
    originDomain: 'results_v8_live',
    label: "Results V8 `/api/v8/results/roi` — live, external to Results vNext",
  },
  'benefits-register': {
    originDomain: 'finance_benefits_live',
    label: 'Benefits Register (M14→M15) — live, external to Results vNext',
  },
  'v8-roi-realization-entries': {
    originDomain: 'results_v8_live',
    label: 'Results V8 ROI Continuity — live, external to Results vNext',
  },
};

/** Builds the `LegacyArchiveMeta` envelope per design §3/B1's table — avoids
 * repeating the label/originDomain pair per route. `routeKey` is the
 * kebab-case route segment (e.g. `'analysis-financials'`), NOT the raw SQL
 * table name — kept distinct from `sourceTable` (the DB table name reported
 * in the response body) on purpose, matching KPI-E007's own
 * `sourceTable`-in-body convention. */
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
  logger.error(`[resultsVnext/roiLegacyArchive.routes] ${op} failed`, {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ error: 'Internal server error', code: 'ROI_LEGACY_ARCHIVE_INTERNAL_ERROR' });
}

// ==========================================
// GET /api/vnext/results/roi/legacy — index
// ==========================================

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  try {
    const data = await getRoiLegacyArchiveIndex(auth.organizationId);
    res.json({
      data,
      meta: {
        label: 'ROI legacy archive index',
        readOnly: true,
        organizationId: auth.organizationId,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    handleLegacyRouteError(res, err, 'getRoiLegacyArchiveIndex');
  }
});

// ==========================================
// analysis-financials
// ==========================================

router.get(
  '/analysis-financials',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyAnalysisFinancials(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'analysis_financials' });
      res.json({
        data: rows,
        meta: legacyMeta('analysis-financials', 'analysis_financials', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyAnalysisFinancials');
    }
  }
);

router.get(
  '/analysis-financials/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyAnalysisFinancial(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('analysis-financials', 'analysis_financials', auth.organizationId) });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'analysis_financials' });
      res.json({ data: row, meta: legacyMeta('analysis-financials', 'analysis_financials', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyAnalysisFinancial');
    }
  }
);

// ==========================================
// digitization-analyses
// ==========================================

router.get(
  '/digitization-analyses',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyDigitizationAnalyses(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'digitization_analyses' });
      res.json({
        data: rows,
        meta: legacyMeta('digitization-analyses', 'digitization_analyses', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyDigitizationAnalyses');
    }
  }
);

router.get(
  '/digitization-analyses/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyDigitizationAnalysis(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({
          data: null,
          meta: legacyMeta('digitization-analyses', 'digitization_analyses', auth.organizationId),
        });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'digitization_analyses' });
      res.json({
        data: row,
        meta: legacyMeta('digitization-analyses', 'digitization_analyses', auth.organizationId),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyDigitizationAnalysis');
    }
  }
);

// ==========================================
// initiative-benefits
// ==========================================

router.get(
  '/initiative-benefits',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyInitiativeBenefits(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'initiative_benefits' });
      res.json({
        data: rows,
        meta: legacyMeta('initiative-benefits', 'initiative_benefits', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyInitiativeBenefits');
    }
  }
);

router.get(
  '/initiative-benefits/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyInitiativeBenefit(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('initiative-benefits', 'initiative_benefits', auth.organizationId) });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'initiative_benefits' });
      res.json({ data: row, meta: legacyMeta('initiative-benefits', 'initiative_benefits', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyInitiativeBenefit');
    }
  }
);

// ==========================================
// roi-assumptions
// ==========================================

router.get(
  '/roi-assumptions',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyRoiAssumptions(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'roi_assumptions' });
      res.json({
        data: rows,
        meta: legacyMeta('roi-assumptions', 'roi_assumptions', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyRoiAssumptions');
    }
  }
);

router.get(
  '/roi-assumptions/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyRoiAssumption(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({ data: null, meta: legacyMeta('roi-assumptions', 'roi_assumptions', auth.organizationId) });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'roi_assumptions' });
      res.json({ data: row, meta: legacyMeta('roi-assumptions', 'roi_assumptions', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyRoiAssumption');
    }
  }
);

// ==========================================
// roi-realized-values
// ==========================================

router.get(
  '/roi-realized-values',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyRoiRealizedValues(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'roi_realized_values' });
      res.json({
        data: rows,
        meta: legacyMeta('roi-realized-values', 'roi_realized_values', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyRoiRealizedValues');
    }
  }
);

router.get(
  '/roi-realized-values/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyRoiRealizedValue(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('roi-realized-values', 'roi_realized_values', auth.organizationId) });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'roi_realized_values' });
      res.json({ data: row, meta: legacyMeta('roi-realized-values', 'roi_realized_values', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyRoiRealizedValue');
    }
  }
);

// ==========================================
// benefits-register
// ==========================================

router.get(
  '/benefits-register',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyBenefitsRegister(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'benefits_register' });
      res.json({
        data: rows,
        meta: legacyMeta('benefits-register', 'benefits_register', auth.organizationId, total, limit, offset),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyBenefitsRegister');
    }
  }
);

router.get(
  '/benefits-register/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyBenefitsRegisterEntry(auth.organizationId, legacyId);
      if (!row) {
        res
          .status(404)
          .json({ data: null, meta: legacyMeta('benefits-register', 'benefits_register', auth.organizationId) });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'benefits_register' });
      res.json({ data: row, meta: legacyMeta('benefits-register', 'benefits_register', auth.organizationId) });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyBenefitsRegisterEntry');
    }
  }
);

// ==========================================
// v8-roi-realization-entries
// ==========================================

router.get(
  '/v8-roi-realization-entries',
  validateQuery(ListRoiLegacyQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const query = req.query as unknown as import('zod').infer<typeof ListRoiLegacyQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const { rows, total } = await listLegacyV8RoiRealizationEntries(auth.organizationId, limit, offset);
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'v8_roi_realization_entries' });
      res.json({
        data: rows,
        meta: legacyMeta(
          'v8-roi-realization-entries',
          'v8_roi_realization_entries',
          auth.organizationId,
          total,
          limit,
          offset
        ),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'listLegacyV8RoiRealizationEntries');
    }
  }
);

router.get(
  '/v8-roi-realization-entries/:legacyId',
  validateParams(RoiLegacyIdParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    try {
      const { legacyId } = req.params as unknown as import('zod').infer<typeof RoiLegacyIdParamsSchema>;
      const row = await getLegacyV8RoiRealizationEntry(auth.organizationId, legacyId);
      if (!row) {
        res.status(404).json({
          data: null,
          meta: legacyMeta('v8-roi-realization-entries', 'v8_roi_realization_entries', auth.organizationId),
        });
        return;
      }
      resultsVnextRoiLegacyArchiveHitsTotal.inc({ source_table: 'v8_roi_realization_entries' });
      res.json({
        data: row,
        meta: legacyMeta('v8-roi-realization-entries', 'v8_roi_realization_entries', auth.organizationId),
      });
    } catch (err) {
      handleLegacyRouteError(res, err, 'getLegacyV8RoiRealizationEntry');
    }
  }
);

export default router;
