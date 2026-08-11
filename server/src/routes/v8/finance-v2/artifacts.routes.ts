/**
 * Finance v3 canonical adapter — artifact lifecycle surface,
 * `/api/v8/finance-v2/artifacts/*`.
 *
 * Pakiet B (API & Runtime Integration). Priority (a) of the brief: "bez
 * tego nic nie działa" — artifact CRUD/list, version listing, and the
 * `capabilities` endpoint the UI needs to draw its action bar
 * (`lifecycleService.allowedActionsFromStatus`, WP-B02 §4.3
 * `allowedActionsFromCurrentStatus`).
 *
 * Router-only: every DB statement below lives in
 * `services/finance/canonical/artifactVersionService.ts` /
 * `lifecycleService.ts`, already reviewed and tested (47 files / 722 tests,
 * `server/src/services/finance/canonical/__tests__`). This file only reads
 * `req`, calls the service, and maps the result to an HTTP status/body —
 * per this package's explicit "nie pisz nowej logiki domenowej w
 * routerach" constraint.
 *
 * Auth/org-scoping: mounted under the shared `v8Router`
 * (`server/src/routes/v8/index.ts`), which already runs `verifyToken` ->
 * `requireV8OrgContext` -> `v8OrgGate` -> `attachV8Context` ->
 * `v8MetricsMiddleware` -> `mutationAbortCanary` before any leaf router —
 * identical chain to `models.routes.ts`. `getV8Context(req).organizationId`
 * is the ONLY tenant boundary this router (or any service function it
 * calls) trusts; every service call below passes it explicitly.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  createArtifact,
  getArtifact,
  getBusinessVersion,
  listBusinessVersions,
  type CreateArtifactParams,
} from '../../../services/finance/canonical/artifactVersionService.js';
import {
  allowedActionsFromStatus,
  type FinanceArtifactType,
} from '../../../services/finance/canonical/lifecycleService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, mapOrgRoleToFinanceRole, sendError } from './_shared.js';

const router = Router();

const VALID_ARTIFACT_TYPES: readonly FinanceArtifactType[] = [
  'STATEMENT_PACK',
  'HISTORICAL_ANALYSIS',
  'BASELINE_MODEL',
  'PREDICTION_SCENARIO',
  'VALUATION_CASE',
  'REPORT_EXPORT',
];

function isValidArtifactType(value: unknown): value is FinanceArtifactType {
  return typeof value === 'string' && (VALID_ARTIFACT_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// POST /artifacts — create (T1)
// ---------------------------------------------------------------------------

router.post(
  '/artifacts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};

    if (!isValidArtifactType(body.artifactType)) {
      return sendError(res, 400, 'INVALID_ARTIFACT_TYPE', `artifactType must be one of ${VALID_ARTIFACT_TYPES.join(', ')}`);
    }

    const params: CreateArtifactParams = {
      organizationId,
      artifactType: body.artifactType,
      naturalKey: typeof body.naturalKey === 'string' ? body.naturalKey : null,
      createdBy: userId,
    };

    const result = await createArtifact(params);

    return res.status(201).json({
      data: {
        artifactId: result.artifact.artifact_id,
        artifactType: result.artifact.artifact_type,
        naturalKey: result.artifact.natural_key,
        createdAt: result.artifact.created_at,
        currentBusinessVersion: {
          businessVersionId: result.businessVersion.business_version_id,
          versionNo: result.businessVersion.version_no,
          version: result.businessVersion.version,
          status: result.businessVersion.status,
          riskTier: result.businessVersion.risk_tier,
        },
        workingRevisionId: result.workingRevision.working_revision_id,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /artifacts/:artifactId — get (fail-closed cross-tenant: NOT_FOUND, not leak)
// ---------------------------------------------------------------------------

router.get(
  '/artifacts/:artifactId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const artifactId = String(req.params.artifactId || '');

    const artifact = await getArtifact(organizationId, artifactId);
    if (!artifact) {
      return sendError(res, 404, 'NOT_FOUND', 'Artifact not found');
    }

    let currentVersion = null;
    if (artifact.current_business_version_id) {
      currentVersion = await getBusinessVersion(organizationId, artifact.current_business_version_id);
    }
    // `current_business_version_id` is only ever back-filled by future work
    // (createArtifact leaves it NULL, see that function's own INSERT list) —
    // fall back to the latest version by version_no so `GET` is useful today.
    if (!currentVersion) {
      const versions = await listBusinessVersions(organizationId, artifactId);
      currentVersion = versions.length > 0 ? versions[versions.length - 1] : null;
    }

    return res.status(200).json({
      data: {
        artifactId: artifact.artifact_id,
        artifactType: artifact.artifact_type,
        naturalKey: artifact.natural_key,
        createdAt: artifact.created_at,
        archivedAt: artifact.archived_at,
        archivedReason: artifact.archived_reason,
        currentBusinessVersion: currentVersion
          ? {
              businessVersionId: currentVersion.business_version_id,
              versionNo: currentVersion.version_no,
              version: currentVersion.version,
              status: currentVersion.status,
              freshness: currentVersion.freshness,
              freshnessReason: currentVersion.freshness_reason,
              riskTier: currentVersion.risk_tier,
            }
          : null,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /artifacts/:artifactId/versions — list (T-any, read-only)
// ---------------------------------------------------------------------------

router.get(
  '/artifacts/:artifactId/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const artifactId = String(req.params.artifactId || '');

    const artifact = await getArtifact(organizationId, artifactId);
    if (!artifact) {
      return sendError(res, 404, 'NOT_FOUND', 'Artifact not found');
    }

    const versions = await listBusinessVersions(organizationId, artifactId);

    return res.status(200).json({
      data: versions.map((v) => ({
        businessVersionId: v.business_version_id,
        versionNo: v.version_no,
        version: v.version,
        status: v.status,
        freshness: v.freshness,
        freshnessReason: v.freshness_reason,
        riskTier: v.risk_tier,
        versionKind: v.version_kind,
        parentVersionId: v.parent_version_id,
        supersededByVersionId: v.superseded_by_version_id,
        createdAt: v.created_at,
        approvedAt: v.approved_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /artifacts/:artifactId/capabilities — role-driven action bar
// (WP-B02 §4.3 `allowedActionsFromCurrentStatus`, OWN-FIN-012).
// ---------------------------------------------------------------------------

router.get(
  '/artifacts/:artifactId/capabilities',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userRole } = getV8Context(req);
    const artifactId = String(req.params.artifactId || '');

    const artifact = await getArtifact(organizationId, artifactId);
    if (!artifact) {
      return sendError(res, 404, 'NOT_FOUND', 'Artifact not found');
    }

    const versions = await listBusinessVersions(organizationId, artifactId);
    const current = versions.length > 0 ? versions[versions.length - 1] : null;
    const role = mapOrgRoleToFinanceRole(userRole);

    if (!current) {
      return res.status(200).json({
        data: { artifactId, businessVersionId: null, status: null, role, allowedActions: [] },
        meta: financeV2Meta(),
      });
    }

    const allowedActions = allowedActionsFromStatus(current.status, role);

    return res.status(200).json({
      data: {
        artifactId,
        businessVersionId: current.business_version_id,
        status: current.status,
        version: current.version,
        freshness: current.freshness,
        role,
        allowedActions,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
