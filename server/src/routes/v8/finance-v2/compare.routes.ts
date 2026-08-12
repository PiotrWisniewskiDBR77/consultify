/**
 * Finance v3 canonical adapter — Compare engine surface,
 * `/api/v8/finance-v2/compare/*`.
 *
 * `financeCompareService.ts` (AP-05, ~1119 lines: period/period, actual/
 * forecast, version/version, scenario/baseline, entity/entity, valuation
 * method/method — five axes named in the task brief plus the entity axis
 * the service itself also exposes) had exactly ONE caller anywhere in the
 * repo before this file: its own unit test importing three pure helpers
 * (`buildMatchKey`/`diffPair`/`toFullUnitValue`). The six `compare*`
 * entry points that actually run a comparison (`comparePeriods`,
 * `compareVersions`, `compareEntities`, `compareScenarios`,
 * `compareValuationMethods`, `compareActualVsForecast`) had ZERO callers —
 * this router is the missing wiring, one thin POST endpoint per axis, no
 * new comparison logic.
 *
 * Every endpoint takes the caller's authenticated `organizationId` from
 * `getV8Context`, NEVER from the request body — `compareValues()` itself
 * still independently checks every `artifactRef.organizationId` against the
 * `organizationId` it is called with and returns `ORGANIZATION_MISMATCH`
 * (mapped to 403 here) if a caller's `artifactRef` claims a different
 * tenant, so this is defense in depth, not the only guard.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  compareActualVsForecast,
  compareEntities,
  comparePeriods,
  compareScenarios,
  compareValuationMethods,
  compareVersions,
  type CompareErrorCode,
  type CompareResult,
  type CompareValuesResult,
} from '../../../services/finance/canonical/financeCompareService.js';
import { FinanceArtifactTypeValues, parseArtifactRef, type FinanceArtifactType } from '../../../types/finance/ArtifactRef.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

function httpStatusForCompareError(code: CompareErrorCode): number {
  switch (code) {
    case 'ARTIFACT_NOT_FOUND':
    case 'ENTITY_CODE_NOT_FOUND':
      return 404;
    case 'ORGANIZATION_MISMATCH':
      return 403;
    case 'UNSUPPORTED_ARTIFACT_TYPE':
    case 'AMBIGUOUS_MATCH_KEY':
    case 'VERSION_ARTIFACT_MISMATCH':
      return 400;
    default:
      return 400;
  }
}

function respondCompare(res: Response, result: (CompareValuesResult & { relationship?: string }) | CompareValuesResult) {
  if (!result.ok) {
    return sendError(res, httpStatusForCompareError(result.code), result.code, result.message);
  }
  const relationship = (result as { relationship?: string }).relationship;
  const data: CompareResult & { relationship?: string } = relationship ? { ...result.result, relationship } : result.result;
  return res.status(200).json({ data, meta: financeV2Meta() });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function optionalStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}
function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
function optionalNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

// ---------------------------------------------------------------------------
// POST /compare/periods — same artifact/version, two periods
// ---------------------------------------------------------------------------

router.post(
  '/compare/periods',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    const parsedRef = parseArtifactRef(body.artifactRef);
    if (!parsedRef.ok) return sendError(res, 400, 'INVALID_ARTIFACT_REF', parsedRef.message);
    if (typeof body.periodIdA !== 'string' || typeof body.periodIdB !== 'string' || !body.periodIdA || !body.periodIdB) {
      return sendError(res, 400, 'INVALID_BODY', 'periodIdA and periodIdB are required strings');
    }

    const result = await comparePeriods({
      organizationId,
      artifactRef: parsedRef.ref,
      periodIdA: body.periodIdA,
      periodIdB: body.periodIdB,
      entityId: optionalString(body.entityId),
      canonicalLineIds: optionalStringArray(body.canonicalLineIds),
      kpiCatalogIds: optionalStringArray(body.kpiCatalogIds),
      consolidationScope: body.consolidationScope,
      accumulationBasis: body.accumulationBasis,
      materialityThresholdPct: optionalNumber(body.materialityThresholdPct),
      onlyMaterial: optionalBoolean(body.onlyMaterial),
      labelA: optionalString(body.labelA),
      labelB: optionalString(body.labelB),
    });
    return respondCompare(res, result);
  })
);

// ---------------------------------------------------------------------------
// POST /compare/versions — two business_version_id of the SAME artifact
// ---------------------------------------------------------------------------

router.post(
  '/compare/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    if (!(FinanceArtifactTypeValues as readonly string[]).includes(body.artifactType)) {
      return sendError(res, 400, 'INVALID_BODY', `artifactType must be one of ${FinanceArtifactTypeValues.join(', ')}`);
    }
    if (typeof body.artifactId !== 'string' || !body.artifactId) {
      return sendError(res, 400, 'INVALID_BODY', 'artifactId is required');
    }
    if (typeof body.businessVersionIdA !== 'string' || typeof body.businessVersionIdB !== 'string' || !body.businessVersionIdA || !body.businessVersionIdB) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionIdA and businessVersionIdB are required strings');
    }

    const result = await compareVersions({
      organizationId,
      artifactType: body.artifactType as FinanceArtifactType,
      artifactId: body.artifactId,
      businessVersionIdA: body.businessVersionIdA,
      businessVersionIdB: body.businessVersionIdB,
      entityCode: optionalString(body.entityCode),
      canonicalLineIds: optionalStringArray(body.canonicalLineIds),
      kpiCatalogIds: optionalStringArray(body.kpiCatalogIds),
      consolidationScope: body.consolidationScope,
      accumulationBasis: body.accumulationBasis,
      materialityThresholdPct: optionalNumber(body.materialityThresholdPct),
      onlyMaterial: optionalBoolean(body.onlyMaterial),
      labelA: optionalString(body.labelA),
      labelB: optionalString(body.labelB),
    });
    return respondCompare(res, result);
  })
);

// ---------------------------------------------------------------------------
// POST /compare/entities — same period, two entities, within a Statement Pack
// ---------------------------------------------------------------------------

router.post(
  '/compare/entities',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    const parsedRef = parseArtifactRef(body.artifactRef);
    if (!parsedRef.ok) return sendError(res, 400, 'INVALID_ARTIFACT_REF', parsedRef.message);
    if (typeof body.periodId !== 'string' || !body.periodId) {
      return sendError(res, 400, 'INVALID_BODY', 'periodId is required');
    }
    if (typeof body.entityIdA !== 'string' || typeof body.entityIdB !== 'string' || !body.entityIdA || !body.entityIdB) {
      return sendError(res, 400, 'INVALID_BODY', 'entityIdA and entityIdB are required strings');
    }

    const result = await compareEntities({
      organizationId,
      artifactRef: parsedRef.ref,
      periodId: body.periodId,
      entityIdA: body.entityIdA,
      entityIdB: body.entityIdB,
      canonicalLineIds: optionalStringArray(body.canonicalLineIds),
      consolidationScope: body.consolidationScope,
      accumulationBasis: body.accumulationBasis,
      materialityThresholdPct: optionalNumber(body.materialityThresholdPct),
      onlyMaterial: optionalBoolean(body.onlyMaterial),
      labelA: optionalString(body.labelA),
      labelB: optionalString(body.labelB),
    });
    return respondCompare(res, result);
  })
);

// ---------------------------------------------------------------------------
// POST /compare/scenarios — Base vs Upside/Downside (or any two scenarios)
// ---------------------------------------------------------------------------

router.post(
  '/compare/scenarios',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    if (
      typeof body.businessVersionIdBase !== 'string' ||
      typeof body.businessVersionIdOther !== 'string' ||
      !body.businessVersionIdBase ||
      !body.businessVersionIdOther
    ) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionIdBase and businessVersionIdOther are required strings');
    }

    const result = await compareScenarios({
      organizationId,
      businessVersionIdBase: body.businessVersionIdBase,
      businessVersionIdOther: body.businessVersionIdOther,
      entityCode: optionalString(body.entityCode),
      canonicalLineIds: optionalStringArray(body.canonicalLineIds),
      consolidationScope: body.consolidationScope,
      materialityThresholdPct: optionalNumber(body.materialityThresholdPct),
      onlyMaterial: optionalBoolean(body.onlyMaterial),
      labelBase: optionalString(body.labelBase),
      labelOther: optionalString(body.labelOther),
    });
    return respondCompare(res, result);
  })
);

// ---------------------------------------------------------------------------
// POST /compare/valuation-methods — DCF vs comps (or any two methods), same variant
// ---------------------------------------------------------------------------

router.post(
  '/compare/valuation-methods',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required');
    }
    if (typeof body.methodTypeA !== 'string' || typeof body.methodTypeB !== 'string' || !body.methodTypeA || !body.methodTypeB) {
      return sendError(res, 400, 'INVALID_BODY', 'methodTypeA and methodTypeB are required strings');
    }

    const result = await compareValuationMethods({
      organizationId,
      businessVersionId: body.businessVersionId,
      methodTypeA: body.methodTypeA,
      methodTypeB: body.methodTypeB,
      materialityThresholdPct: optionalNumber(body.materialityThresholdPct),
      labelA: optionalString(body.labelA),
      labelB: optionalString(body.labelB),
    });
    return respondCompare(res, result);
  })
);

// ---------------------------------------------------------------------------
// POST /compare/actual-vs-forecast — Statement Pack (actual) vs Baseline/Scenario (forecast)
// ---------------------------------------------------------------------------

router.post(
  '/compare/actual-vs-forecast',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    const parsedActual = parseArtifactRef(body.actualArtifactRef);
    if (!parsedActual.ok) return sendError(res, 400, 'INVALID_ARTIFACT_REF', `actualArtifactRef: ${parsedActual.message}`);
    const parsedForecast = parseArtifactRef(body.forecastArtifactRef);
    if (!parsedForecast.ok) return sendError(res, 400, 'INVALID_ARTIFACT_REF', `forecastArtifactRef: ${parsedForecast.message}`);
    if (typeof body.entityCode !== 'string' || !body.entityCode) {
      return sendError(res, 400, 'INVALID_BODY', 'entityCode is required');
    }
    const periodIds = optionalStringArray(body.periodIds);
    if (!periodIds || periodIds.length === 0) {
      return sendError(res, 400, 'INVALID_BODY', 'periodIds must be a non-empty array of strings');
    }
    if (typeof body.accumulationBasis !== 'string' || !body.accumulationBasis) {
      return sendError(res, 400, 'INVALID_BODY', 'accumulationBasis is required');
    }

    const result = await compareActualVsForecast({
      organizationId,
      actualArtifactRef: parsedActual.ref,
      forecastArtifactRef: parsedForecast.ref,
      entityCode: body.entityCode,
      periodIds,
      accumulationBasis: body.accumulationBasis,
      canonicalLineIds: optionalStringArray(body.canonicalLineIds),
      consolidationScope: body.consolidationScope,
      materialityThresholdPct: optionalNumber(body.materialityThresholdPct),
      onlyMaterial: optionalBoolean(body.onlyMaterial),
    });
    return respondCompare(res, result);
  })
);

export default router;
