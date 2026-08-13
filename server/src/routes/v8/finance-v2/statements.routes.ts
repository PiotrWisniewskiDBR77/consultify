/**
 * Finance v3 canonical adapter — Statement Pack surface,
 * `/api/v8/finance-v2/statements/*`.
 *
 * Pakiet B2 (Domain HTTP Surface), priority 1 ("bez tego statements nie
 * działa"). Wraps `statementMappingService.mapStatementLines` (the "map"
 * step) and `statementReconciliationService.runReconciliation` (the
 * "reconcile" step) — kept as two separate endpoints because that IS the
 * real two-step workflow the schema/services already implement (map writes
 * `finance_stmt_lines`; reconcile reads the map's own row-level result back
 * and persists the waterfall + raises exceptions) — not fused into one call.
 * Plus the read-side this package added (D2-shaped gap: no prior HTTP caller
 * could read `finance_stmt_lines`/`finance_reconciliation_runs` back out —
 * see `statementMappingService.listStatementLines` /
 * `statementReconciliationService.listReconciliationRuns` doc comments).
 *
 * Router-only: every DB statement lives in `services/finance/canonical/
 * statementMappingService.ts` / `statementReconciliationService.ts`
 * (existing compute logic) or their new thin readers added by this package
 * (DEC-FIN-012, see those files' own "Pakiet B2" sections). No domain logic
 * here — only body validation, org-scoping, and HTTP status mapping, same
 * constraint `artifacts.routes.ts`'s header documents.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { getBusinessVersion } from '../../../services/finance/canonical/artifactVersionService.js';
import {
  listStatementLines,
  mapStatementLines,
  type MapStatementLinesParams,
  type StatementType,
} from '../../../services/finance/canonical/statementMappingService.js';
import {
  getReconciliationRun,
  listReconciliationDetail,
  listReconciliationRuns,
  runReconciliation,
  type RunReconciliationParams,
} from '../../../services/finance/canonical/statementReconciliationService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, mapOrgRoleToFinanceRole, readExpectedVersion, sendError } from './_shared.js';

const router = Router();

const VALID_STATEMENT_TYPES: readonly StatementType[] = ['P&L', 'BS', 'CF'];

// ---------------------------------------------------------------------------
// POST /statements/:businessVersionId/map
// body: { unit, presentationCurrency, accumulationBasis?, rawLines[], rules[] }
// ---------------------------------------------------------------------------

router.post(
  '/statements/:businessVersionId/map',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }
    if (!Array.isArray(body.rawLines) || !Array.isArray(body.rules)) {
      return sendError(res, 400, 'INVALID_BODY', 'rawLines and rules must both be arrays');
    }
    if (typeof body.unit !== 'string' || typeof body.presentationCurrency !== 'string') {
      return sendError(res, 400, 'INVALID_BODY', 'unit and presentationCurrency are required strings');
    }

    const params: MapStatementLinesParams = {
      organizationId,
      businessVersionId,
      unit: body.unit,
      presentationCurrency: body.presentationCurrency,
      accumulationBasis: body.accumulationBasis,
      createdBy: userId,
      rawLines: body.rawLines,
      rules: body.rules,
    };

    const results = await mapStatementLines(params);

    return res.status(201).json({
      data: {
        businessVersionId,
        rowCount: results.length,
        mappedCount: results.filter((r) => r.bucket === 'MAPPED' || r.bucket === 'RECLASS' || r.bucket === 'ELIMINATION').length,
        unmappedCount: results.filter((r) => r.bucket === 'UNMAPPED').length,
        results,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /statements/:businessVersionId/reconcile
// body: { sourceSystem, mappingResults[], materialityThresholdPct?, attemptReadinessTransition?, expectedVersion? }
// ---------------------------------------------------------------------------

router.post(
  '/statements/:businessVersionId/reconcile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }
    if (typeof body.sourceSystem !== 'string' || !body.sourceSystem.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'sourceSystem is required');
    }
    if (!Array.isArray(body.mappingResults)) {
      return sendError(res, 400, 'INVALID_BODY', 'mappingResults must be an array (the array `POST .../map` returned in `data.results`)');
    }

    const attemptReadinessTransition = body.attemptReadinessTransition === true;
    const expectedVersion = attemptReadinessTransition ? readExpectedVersion(req) : undefined;
    if (attemptReadinessTransition && (expectedVersion === undefined || Number.isNaN(expectedVersion))) {
      return sendError(res, 400, 'EXPECTED_VERSION_REQUIRED', 'expectedVersion is required when attemptReadinessTransition=true');
    }

    const params: RunReconciliationParams = {
      organizationId,
      artifactId: bv.artifact_id,
      businessVersionId,
      sourceSystem: body.sourceSystem,
      mappingResults: body.mappingResults,
      materialityThresholdPct: typeof body.materialityThresholdPct === 'number' ? body.materialityThresholdPct : undefined,
      createdBy: userId,
      attemptReadinessTransition,
      actorId: attemptReadinessTransition ? userId : undefined,
      role: attemptReadinessTransition ? mapOrgRoleToFinanceRole(userRole) : undefined,
      expectedVersion,
      runPeriodJumpCheck: typeof body.runPeriodJumpCheck === 'boolean' ? body.runPeriodJumpCheck : undefined,
    };

    const result = await runReconciliation(params);

    return res.status(201).json({
      data: {
        reconciliationRunId: result.run.id,
        status: result.run.status,
        resultQuality: result.resultQuality,
        totals: result.totals,
        materialityThresholdPct: result.materialityThresholdPct,
        exceptionId: result.exception?.id ?? null,
        coverageExceptionId: result.coverageException?.id ?? null,
        periodJumpsCount: result.periodJumps.length,
        readiness: result.readiness,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /statements/:businessVersionId/lines
// query: statementType? / entityId? / periodId?
// ---------------------------------------------------------------------------

router.get(
  '/statements/:businessVersionId/lines',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const statementTypeRaw = req.query.statementType;
    const statementType =
      typeof statementTypeRaw === 'string' && (VALID_STATEMENT_TYPES as readonly string[]).includes(statementTypeRaw)
        ? (statementTypeRaw as StatementType)
        : undefined;
    if (statementTypeRaw !== undefined && !statementType) {
      return sendError(res, 400, 'INVALID_QUERY', `statementType must be one of ${VALID_STATEMENT_TYPES.join(', ')}`);
    }

    const lines = await listStatementLines(organizationId, businessVersionId, {
      statementType,
      entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
      periodId: typeof req.query.periodId === 'string' ? req.query.periodId : undefined,
    });

    return res.status(200).json({
      data: lines.map((l) => ({
        stmtLineId: l.id,
        statementType: l.statement_type,
        canonicalLineId: l.canonical_line_id,
        lineCode: l.line_code,
        entityId: l.entity_id,
        entityCode: l.entity_code,
        periodId: l.period_id,
        periodLabel: l.period_label,
        accumulationBasis: l.accumulation_basis,
        consolidationScope: l.consolidation_scope,
        value: {
          status: l.value_status,
          valueDecimal: l.value_decimal,
          nativeCurrency: l.native_currency,
          presentationCurrency: l.presentation_currency,
          unit: l.unit,
          multiplier: l.multiplier,
          sourceRef: l.source_ref,
          isAdjustment: l.is_adjustment,
          adjustmentReason: l.adjustment_reason,
        },
        signConvention: l.sign_convention,
        accountingPolicy: l.accounting_policy,
        reclassifiedFromLineId: l.reclassified_from_line_id,
        createdBy: l.created_by,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /statements/:businessVersionId/reconciliation-runs — the ledger, newest first
// ---------------------------------------------------------------------------

router.get(
  '/statements/:businessVersionId/reconciliation-runs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const runs = await listReconciliationRuns(organizationId, businessVersionId);

    return res.status(200).json({
      data: runs.map((r) => ({
        reconciliationRunId: r.id,
        artifactId: r.artifact_id,
        businessVersionId: r.business_version_id,
        sourceSystem: r.source_system,
        status: r.status,
        resultQuality: r.result_quality,
        totals: {
          sourceTotal: r.source_total,
          mappedTotal: r.mapped_total,
          excludedTotal: r.excluded_total,
          unmappedTotal: r.unmapped_total,
          duplicateTotal: r.duplicate_total,
          reclassNetTotal: r.reclass_net_total,
          eliminationNetTotal: r.elimination_net_total,
          canonicalTotal: r.canonical_total,
          residual: r.residual,
          residualPct: r.residual_pct,
        },
        materialityThresholdApplied: r.materiality_threshold_applied,
        sourceValueCoveragePct: r.source_value_coverage_pct,
        linkedExceptionId: r.linked_exception_id,
        coverageExceptionId: r.coverage_exception_id,
        createdAt: r.created_at,
        createdBy: r.created_by,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /statements/reconciliation-runs/:reconciliationRunId — one run + row-level detail
// ---------------------------------------------------------------------------

router.get(
  '/statements/reconciliation-runs/:reconciliationRunId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const reconciliationRunId = String(req.params.reconciliationRunId || '');

    const run = await getReconciliationRun(organizationId, reconciliationRunId);
    if (!run) {
      return sendError(res, 404, 'NOT_FOUND', 'Reconciliation run not found');
    }
    const detail = await listReconciliationDetail(organizationId, reconciliationRunId);

    return res.status(200).json({
      data: {
        reconciliationRunId: run.id,
        artifactId: run.artifact_id,
        businessVersionId: run.business_version_id,
        sourceSystem: run.source_system,
        status: run.status,
        resultQuality: run.result_quality,
        residual: run.residual,
        residualPct: run.residual_pct,
        createdAt: run.created_at,
        rows: detail.map((d) => ({
          id: d.id,
          canonicalLineId: d.canonical_line_id,
          entityId: d.entity_id,
          periodId: d.period_id,
          bucket: d.bucket,
          sourceAmount: d.source_amount,
          mappedAmount: d.mapped_amount,
          duplicateOfRowId: d.duplicate_of_row_id,
          reclassTargetLineId: d.reclass_target_line_id,
          eliminationCounterpartyEntityId: d.elimination_counterparty_entity_id,
          reasonCode: d.reason_code,
          sourceRowRef: d.source_row_ref,
        })),
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
