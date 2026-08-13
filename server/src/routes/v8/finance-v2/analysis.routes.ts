/**
 * Finance v3 canonical adapter — Analysis (KPI) surface,
 * `/api/v8/finance-v2/analysis/*`.
 *
 * Pakiet B2 (Domain HTTP Surface), priority 2. Wraps
 * `kpiComputeService.computeAnalysisKpis` (the compute engine — resolves the
 * source Statement Pack via lineage, evaluates every selected KPI, wraps in
 * a `compute_jobs` row) plus the two thin readers this package added
 * (DEC-FIN-012): `listKpiCatalog` (the three-layer universal/industry/
 * org-custom catalog) and `listKpiValues` (computed results joined against
 * the catalog for display). Router-only, no domain logic — see
 * `statements.routes.ts`'s header for the shared constraint every router in
 * this package follows.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { getBusinessVersion } from '../../../services/finance/canonical/artifactVersionService.js';
import {
  computeAnalysisKpis,
  listKpiCatalog,
  listKpiValues,
  type ComputeAnalysisKpisParams,
} from '../../../services/finance/canonical/kpiComputeService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, mapOrgRoleToFinanceRole, readExpectedVersion, sendError } from './_shared.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /analysis/kpi-catalog — three-layer catalog (universal/industry/org-custom)
// query: tier? / includeAllStatuses?
// ---------------------------------------------------------------------------

router.get(
  '/analysis/kpi-catalog',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const tierRaw = req.query.tier;
    const tier =
      tierRaw === 'UNIVERSAL' || tierRaw === 'INDUSTRY' || tierRaw === 'ORG_CUSTOM' ? tierRaw : undefined;
    if (tierRaw !== undefined && !tier) {
      return sendError(res, 400, 'INVALID_QUERY', 'tier must be one of UNIVERSAL, INDUSTRY, ORG_CUSTOM');
    }

    const rows = await listKpiCatalog(organizationId, {
      tier,
      includeAllStatuses: req.query.includeAllStatuses === 'true',
    });

    return res.status(200).json({
      data: rows.map((r) => ({
        kpiCatalogId: r.id,
        kpiCode: r.kpi_code,
        catalogVersion: r.catalog_version,
        status: r.status,
        tier: r.tier,
        industryCode: r.industry_code,
        category: r.category,
        kpiName: r.kpi_name,
        description: r.description,
        unitType: r.unit_type,
        compileStatus: r.compile_status,
        resolvedOutputUnit: r.resolved_output_unit,
        periodConvention: r.period_convention,
        negativeDenominatorPolicy: r.negative_denominator_policy,
        requiredCanonicalLineCodes: r.required_canonical_line_codes,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /analysis/:businessVersionId/compute
// body: { attemptReadinessTransition?, expectedVersion? }
// ---------------------------------------------------------------------------

router.post(
  '/analysis/:businessVersionId/compute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const attemptReadinessTransition = body.attemptReadinessTransition === true;
    const expectedVersion = attemptReadinessTransition ? readExpectedVersion(req) : undefined;
    if (attemptReadinessTransition && (expectedVersion === undefined || Number.isNaN(expectedVersion))) {
      return sendError(res, 400, 'EXPECTED_VERSION_REQUIRED', 'expectedVersion is required when attemptReadinessTransition=true');
    }

    const params: ComputeAnalysisKpisParams = {
      organizationId,
      businessVersionId,
      requestedByUserId: userId,
      attemptReadinessTransition,
      actorId: attemptReadinessTransition ? userId : undefined,
      role: attemptReadinessTransition ? mapOrgRoleToFinanceRole(userRole) : undefined,
      expectedVersion,
    };

    const result = await computeAnalysisKpis(params);

    if (!result.ok) {
      const status = result.code === 'NO_SOURCE_STATEMENT_PACK_EDGE' || result.code === 'BUSINESS_VERSION_NOT_FOUND' ? 404 : 409;
      return sendError(res, status, result.code, result.message);
    }

    return res.status(200).json({
      data: {
        jobId: result.job.id,
        jobStatus: result.job.status,
        resultsCount: result.results.length,
        results: result.results,
        readiness: result.readiness,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /analysis/:businessVersionId/kpi-values
// ---------------------------------------------------------------------------

router.get(
  '/analysis/:businessVersionId/kpi-values',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const rows = await listKpiValues(organizationId, businessVersionId);

    return res.status(200).json({
      data: rows.map((r) => ({
        kpiValueId: r.id,
        kpiCatalogId: r.kpi_catalog_id,
        kpiCode: r.kpi_code,
        kpiName: r.kpi_name,
        category: r.category,
        tier: r.tier,
        unitType: r.unit_type,
        entityId: r.entity_id,
        periodId: r.period_id,
        value: {
          status: r.value_status,
          valueDecimal: r.value_decimal,
          nativeCurrency: r.native_currency,
          presentationCurrency: r.presentation_currency,
          unit: r.unit,
          multiplier: r.multiplier,
        },
        qualityFlag: r.quality_flag,
        deltaVsPriorPeriod: r.delta_vs_prior_period,
        deltaPctVsPriorPeriod: r.delta_pct_vs_prior_period,
        interpretationText: r.interpretation_text,
        // Benchmark (peer-set percentile) is a real gap, not a silent zero: this program ships
        // no writer for `finance_analysis_benchmarks` yet — see `listKpiValues`'s own doc comment.
        benchmark: null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

export default router;
