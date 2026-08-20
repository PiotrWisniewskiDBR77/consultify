/**
 * Finance v3 canonical adapter — Baseline Model surface,
 * `/api/v8/finance-v2/baseline/*`.
 *
 * Pakiet B2 (Domain HTTP Surface), priority 3. Wraps
 * `baselineComputeService.runBaselineCompute` (the compute engine) plus the
 * three thin read/write additions this package made to that file (DEC-FIN-012,
 * see its own "Pakiet B2" section): `listBaselineAssumptions` /
 * `upsertAssumptionsBatch` (this file's header explicitly scopes assumption
 * AUTHORING as a Kreator-surface concern the compute engine itself does not
 * own — this package's brief lists it as an explicit priority-3 item, so it
 * is built here) and `listBaselineOutputs` (the three forecast statements the
 * compute engine writes but no prior HTTP caller could read back).
 *
 * Router-only, no domain logic — see `statements.routes.ts`'s header.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { getBusinessVersion } from '../../../services/finance/canonical/artifactVersionService.js';
import {
  BaselineContextError,
  configureBaselineWorkspaceContext,
  getBaselineWorkspaceContext,
} from '../../../services/finance/canonical/baselineContextService.js';
import {
  BASELINE_ASSUMPTION_RULES,
  BASELINE_SCHEDULE_TYPES,
  listBaselineAssumptions,
  listBaselineOutputs,
  runBaselineCompute,
  upsertAssumptionsBatch,
  type BaselineAssumptionRule,
  type BaselineScheduleType,
  type RunBaselineComputeParams,
  type UpsertAssumptionInput,
} from '../../../services/finance/canonical/baselineComputeService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

router.get(
  '/baseline/:businessVersionId/context',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const data = await getBaselineWorkspaceContext(
        organizationId,
        String(req.params.businessVersionId || '')
      );
      return res.status(200).json({ data, meta: financeV2Meta() });
    } catch (error) {
      if (error instanceof BaselineContextError) {
        return sendError(res, error.status, error.code, error.message, error.details);
      }
      throw error;
    }
  })
);

router.put(
  '/baseline/:businessVersionId/context',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) {
      return sendError(
        res,
        400,
        'INVALID_EXPECTED_VERSION',
        'expectedVersion must be a non-negative integer'
      );
    }
    if (
      !Array.isArray(body.forecastPeriodIds) ||
      body.forecastPeriodIds.length === 0 ||
      body.forecastPeriodIds.some(
        (value: unknown) => typeof value !== 'string' || !value.trim()
      )
    ) {
      return sendError(
        res,
        400,
        'INVALID_CONTEXT',
        'forecastPeriodIds must be a non-empty array of non-blank strings'
      );
    }
    try {
      const data = await configureBaselineWorkspaceContext({
        organizationId,
        businessVersionId: String(req.params.businessVersionId || ''),
        actorId: userId,
        expectedVersion: body.expectedVersion,
        idempotencyKey: String(req.header('Idempotency-Key') || ''),
        entityId: typeof body.entityId === 'string' ? body.entityId : '',
        openingBalanceSheetPeriodId:
          typeof body.openingBalanceSheetPeriodId === 'string'
            ? body.openingBalanceSheetPeriodId
            : '',
        forecastPeriodIds: body.forecastPeriodIds,
      });
      return res.status(200).json({ data, meta: financeV2Meta() });
    } catch (error) {
      if (error instanceof BaselineContextError) {
        return sendError(res, error.status, error.code, error.message, error.details);
      }
      throw error;
    }
  })
);

function isScheduleType(v: unknown): v is BaselineScheduleType {
  return typeof v === 'string' && (BASELINE_SCHEDULE_TYPES as readonly string[]).includes(v);
}
function isRule(v: unknown): v is BaselineAssumptionRule {
  return typeof v === 'string' && (BASELINE_ASSUMPTION_RULES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// GET /baseline/:businessVersionId/assumptions
// query: scheduleType? / entityId?
// ---------------------------------------------------------------------------

router.get(
  '/baseline/:businessVersionId/assumptions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const scheduleTypeRaw = req.query.scheduleType;
    if (scheduleTypeRaw !== undefined && !isScheduleType(scheduleTypeRaw)) {
      return sendError(res, 400, 'INVALID_QUERY', `scheduleType must be one of ${BASELINE_SCHEDULE_TYPES.join(', ')}`);
    }

    const rows = await listBaselineAssumptions(organizationId, businessVersionId, {
      scheduleType: isScheduleType(scheduleTypeRaw) ? scheduleTypeRaw : undefined,
      entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
    });

    return res.status(200).json({
      data: rows.map((a) => ({
        assumptionId: a.id,
        scheduleType: a.schedule_type,
        driverCode: a.driver_code,
        entityId: a.entity_id,
        periodId: a.period_id,
        basePeriodId: a.base_period_id,
        rule: a.rule,
        value: { status: a.value_status, valueDecimal: a.value_decimal, unit: a.unit, sourceRef: a.source_ref },
        rangeLow: a.range_low,
        rangeHigh: a.range_high,
        quality: a.quality,
        createdBy: a.created_by,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /baseline/:businessVersionId/assumptions — batch upsert
// body: { assumptions: [{ scheduleType, driverCode, entityId, periodId, rule, valueStatus, valueDecimal, unit, ... }] }
// ---------------------------------------------------------------------------

router.post(
  '/baseline/:businessVersionId/assumptions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }
    if (!Array.isArray(body.assumptions) || body.assumptions.length === 0) {
      return sendError(res, 400, 'INVALID_BODY', 'assumptions must be a non-empty array');
    }

    const inputs: UpsertAssumptionInput[] = [];
    for (let i = 0; i < body.assumptions.length; i++) {
      const a = body.assumptions[i];
      if (!isScheduleType(a?.scheduleType)) {
        return sendError(res, 400, 'INVALID_BODY', `assumptions[${i}].scheduleType must be one of ${BASELINE_SCHEDULE_TYPES.join(', ')}`);
      }
      if (!isRule(a?.rule)) {
        return sendError(res, 400, 'INVALID_BODY', `assumptions[${i}].rule must be one of ${BASELINE_ASSUMPTION_RULES.join(', ')}`);
      }
      if (typeof a.driverCode !== 'string' || typeof a.entityId !== 'string' || typeof a.periodId !== 'string' || typeof a.unit !== 'string') {
        return sendError(res, 400, 'INVALID_BODY', `assumptions[${i}] requires string driverCode/entityId/periodId/unit`);
      }
      if (typeof a.valueStatus !== 'string') {
        return sendError(res, 400, 'INVALID_BODY', `assumptions[${i}].valueStatus is required`);
      }
      inputs.push({
        scheduleType: a.scheduleType,
        driverCode: a.driverCode,
        entityId: a.entityId,
        periodId: a.periodId,
        basePeriodId: typeof a.basePeriodId === 'string' ? a.basePeriodId : null,
        rule: a.rule,
        valueStatus: a.valueStatus,
        valueDecimal: typeof a.valueDecimal === 'number' ? a.valueDecimal : null,
        unit: a.unit,
        sourceRef: a.sourceRef ?? null,
        rangeLow: typeof a.rangeLow === 'number' ? a.rangeLow : null,
        rangeHigh: typeof a.rangeHigh === 'number' ? a.rangeHigh : null,
        quality: a.quality,
      });
    }

    const written = await upsertAssumptionsBatch({ organizationId, businessVersionId, createdBy: userId, assumptions: inputs });

    return res.status(200).json({
      data: { businessVersionId, writtenCount: written.length, assumptions: written.map((a) => ({ assumptionId: a.id, scheduleType: a.schedule_type, driverCode: a.driver_code, entityId: a.entity_id, periodId: a.period_id })) },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /baseline/:businessVersionId/compute
// body: { entityId, forecastPeriodIds[], openingBalanceSheetPeriodId, engineManifestId? }
// ---------------------------------------------------------------------------

router.post(
  '/baseline/:businessVersionId/compute',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }
    if (typeof body.entityId !== 'string' || !body.entityId.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'entityId is required');
    }
    if (!Array.isArray(body.forecastPeriodIds) || body.forecastPeriodIds.some((p: unknown) => typeof p !== 'string')) {
      return sendError(res, 400, 'INVALID_BODY', 'forecastPeriodIds must be an array of period id strings');
    }
    if (typeof body.openingBalanceSheetPeriodId !== 'string' || !body.openingBalanceSheetPeriodId.trim()) {
      return sendError(res, 400, 'INVALID_BODY', 'openingBalanceSheetPeriodId is required');
    }

    const params: RunBaselineComputeParams = {
      organizationId,
      businessVersionId,
      requestedByUserId: userId,
      engineManifestId: typeof body.engineManifestId === 'string' ? body.engineManifestId : bv.engine_manifest_id,
      entityId: body.entityId,
      forecastPeriodIds: body.forecastPeriodIds,
      openingBalanceSheetPeriodId: body.openingBalanceSheetPeriodId,
    };

    const result = await runBaselineCompute(params);

    if (!result.ok) {
      const status = result.code === 'NO_SOURCE_STATEMENT_PACK_EDGE' || result.code === 'NO_BASELINE_MODEL_ROW' ? 404 : 409;
      return sendError(res, status, result.code, result.message, {
        ...(result.failedAtPeriodId ? { failedAtPeriodId: result.failedAtPeriodId } : {}),
        ...(result.partialResults ? { partialResults: result.partialResults } : {}),
      });
    }

    return res.status(200).json({
      data: { jobId: result.job.id, jobStatus: result.job.status, periodsComputed: result.periodsComputed, monthlyResults: result.monthlyResults },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /baseline/:businessVersionId/outputs — the three forecast statements
// query: statementType? / entityId? / periodId?
// ---------------------------------------------------------------------------

router.get(
  '/baseline/:businessVersionId/outputs',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const statementTypeRaw = req.query.statementType;
    const statementType =
      statementTypeRaw === 'P&L' || statementTypeRaw === 'BS' || statementTypeRaw === 'CF' ? statementTypeRaw : undefined;
    if (statementTypeRaw !== undefined && !statementType) {
      return sendError(res, 400, 'INVALID_QUERY', "statementType must be one of 'P&L', 'BS', 'CF'");
    }

    const rows = await listBaselineOutputs(organizationId, businessVersionId, {
      statementType,
      entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
      periodId: typeof req.query.periodId === 'string' ? req.query.periodId : undefined,
    });

    return res.status(200).json({
      data: rows.map((o) => ({
        outputId: o.id,
        statementType: o.statement_type,
        canonicalLineId: o.canonical_line_id,
        lineCode: o.line_code,
        entityId: o.entity_id,
        periodId: o.period_id,
        periodLabel: o.period_label,
        consolidationScope: o.consolidation_scope,
        value: {
          status: o.value_status,
          valueDecimal: o.value_decimal,
          nativeCurrency: o.native_currency,
          presentationCurrency: o.presentation_currency,
          unit: o.unit,
          multiplier: o.multiplier,
        },
        valueKind: o.value_kind,
        drivingScheduleType: o.driving_schedule_type,
        createdBy: o.created_by,
        createdAt: o.created_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

export default router;
