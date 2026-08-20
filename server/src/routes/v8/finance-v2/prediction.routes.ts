/**
 * Finance v3 canonical adapter — Prediction Scenario surface,
 * `/api/v8/finance-v2/prediction/*`.
 *
 * Pakiet B2 (Domain HTTP Surface), priority 4. DEC-FIN-004: preflight
 * (stage 1, read-only/analytical, never blocks assumption-building) and
 * calculation (stage 2, gated on `finance_prediction_can_start_compute()`)
 * are TWO SEPARATE endpoints — this router must never fuse them into one
 * call, per this package's brief. `predictionPreflightService.ts` /
 * `predictionComputeService.ts` are explicitly READ-ONLY for this package
 * (frozen — Pakiet A changed them right before this session; this router
 * only calls their already-exported `runPreflight`/`runPredictionCompute`,
 * it does not modify either file).
 *
 * Router-only, no domain logic — see `statements.routes.ts`'s header.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { getBusinessVersion } from '../../../services/finance/canonical/artifactVersionService.js';
import { runPreflight, type RunPreflightParams } from '../../../services/finance/canonical/predictionPreflightService.js';
import { runPredictionCompute, type RunPredictionComputeParams } from '../../../services/finance/canonical/predictionComputeService.js';
import {
  getPredictionDraft,
  PredictionDraftError,
  replacePredictionDraft,
} from '../../../services/finance/canonical/predictionDraftService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

router.get(
  '/prediction/:businessVersionId/draft',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    try {
      const data = await getPredictionDraft(
        organizationId,
        String(req.params.businessVersionId || '')
      );
      return res.status(200).json({ data, meta: financeV2Meta() });
    } catch (error) {
      if (error instanceof PredictionDraftError) {
        return sendError(res, error.status, error.code, error.message, error.details);
      }
      throw error;
    }
  })
);

router.put(
  '/prediction/:businessVersionId/draft',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};
    const idempotencyKey = String(req.header('Idempotency-Key') || '');
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return sendError(res, 400, 'INVALID_EXPECTED_VERSION', 'expectedVersion must be a positive integer');
    }
    if (!body.draft || typeof body.draft !== 'object' || Array.isArray(body.draft)) {
      return sendError(res, 400, 'INVALID_DRAFT', 'draft object is required');
    }
    try {
      const data = await replacePredictionDraft({
        organizationId,
        businessVersionId: String(req.params.businessVersionId || ''),
        actorId: userId,
        expectedVersion: body.expectedVersion,
        idempotencyKey,
        draft: body.draft,
      });
      return res.status(200).json({ data, meta: financeV2Meta() });
    } catch (error) {
      if (error instanceof PredictionDraftError) {
        return sendError(res, error.status, error.code, error.message, error.details);
      }
      throw error;
    }
  })
);

// ---------------------------------------------------------------------------
// POST /prediction/:businessVersionId/preflight — stage 1 (DEC-FIN-004)
// body: { openingBalanceSheetPeriodId?, entityId? }
// ---------------------------------------------------------------------------

router.post(
  '/prediction/:businessVersionId/preflight',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    const bv = await getBusinessVersion(organizationId, businessVersionId);
    if (!bv) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const params: RunPreflightParams = {
      organizationId,
      businessVersionId,
      runBy: userId,
      openingBalanceSheetPeriodId: typeof body.openingBalanceSheetPeriodId === 'string' ? body.openingBalanceSheetPeriodId : undefined,
      entityId: typeof body.entityId === 'string' ? body.entityId : undefined,
    };

    const result = await runPreflight(params);

    if (!result.ok) {
      return sendError(res, 404, result.code, result.message);
    }

    return res.status(201).json({
      data: {
        preflightRunId: result.preflightRunId,
        findingsCount: result.findingsCount,
        requiredResolutionsCount: result.requiredResolutionsCount,
        findings: result.findings,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /prediction/:businessVersionId/calculate — stage 2 (DEC-FIN-004)
// body: { entityId, forecastPeriodIds[], openingBalanceSheetPeriodId, engineManifestId? }
// ---------------------------------------------------------------------------

router.post(
  '/prediction/:businessVersionId/calculate',
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

    const params: RunPredictionComputeParams = {
      organizationId,
      businessVersionId,
      requestedByUserId: userId,
      engineManifestId: typeof body.engineManifestId === 'string' ? body.engineManifestId : bv.engine_manifest_id,
      entityId: body.entityId,
      forecastPeriodIds: body.forecastPeriodIds,
      openingBalanceSheetPeriodId: body.openingBalanceSheetPeriodId,
    };

    const result = await runPredictionCompute(params);

    if (!result.ok) {
      const status =
        result.code === 'NO_SCENARIO_ROW' || result.code === 'NO_BASELINE_LINEAGE_EDGE'
          ? 404
          : result.code === 'READINESS_GATE_FAILED'
            ? 422
            : 409;
      return sendError(res, status, result.code, result.message, {
        ...(result.readiness ? { readiness: result.readiness } : {}),
      });
    }

    if (result.mode === 'STANDARD_BASE') {
      return res.status(200).json({
        data: { mode: result.mode, jobId: result.job.id, jobStatus: result.job.status, baselineJobId: result.baselineJob?.id ?? null, passthroughRowCount: result.passthroughRowCount },
        meta: financeV2Meta(),
      });
    }

    return res.status(200).json({
      data: { mode: result.mode, jobId: result.job.id, jobStatus: result.job.status, periodsComputed: result.periodsComputed, periods: result.periods },
      meta: financeV2Meta(),
    });
  })
);

export default router;
