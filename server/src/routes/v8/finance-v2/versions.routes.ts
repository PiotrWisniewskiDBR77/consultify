/**
 * Finance v3 canonical adapter — business-version lifecycle transitions,
 * `/api/v8/finance-v2/versions/*`.
 *
 * Pakiet B (API & Runtime Integration), priority (a). Covers the T2-T7,
 * T10-T11 generic transitions (`artifactVersionService.transition`) and
 * the pre-approval `createComputeSnapshot` (T8a) — `approve`/`reopen`
 * (T8/T12) already exist at `POST /models/:modelId/{approve,reopen}`
 * (`models.routes.ts`, WP-C02) and are deliberately NOT duplicated here.
 *
 * Router-only, same constraint as `artifacts.routes.ts`: no domain logic,
 * only `artifactVersionService.transition`/`createComputeSnapshot` calls
 * and HTTP status mapping.
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  createComputeSnapshot,
  getBusinessVersion,
  transition,
  type TransitionParams,
} from '../../../services/finance/canonical/artifactVersionService.js';
import type { LifecycleAction } from '../../../services/finance/canonical/lifecycleService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, mapOrgRoleToFinanceRole, readExpectedVersion, sendError } from './_shared.js';

const router = Router();

/** `approve`/`reopen` route through `models.routes.ts` instead — see file header. */
const ROUTABLE_ACTIONS: readonly TransitionParams['action'][] = [
  'submit_for_review',
  'withdraw',
  'start_review',
  'request_changes',
  'resume_editing',
  'archive',
  'invalidate',
];

function isRoutableAction(value: unknown): value is TransitionParams['action'] {
  return typeof value === 'string' && (ROUTABLE_ACTIONS as readonly string[]).includes(value);
}

function httpStatusForTransitionError(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    case 'REASON_REQUIRED':
      return 400;
    case 'VERSION_CONFLICT':
    case 'STATE_PRECONDITION_FAILED':
      return 409;
    default:
      return 400;
  }
}

// ---------------------------------------------------------------------------
// GET /versions/:businessVersionId
// ---------------------------------------------------------------------------

router.get(
  '/versions/:businessVersionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const version = await getBusinessVersion(organizationId, businessVersionId);
    if (!version) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    return res.status(200).json({
      data: {
        businessVersionId: version.business_version_id,
        artifactId: version.artifact_id,
        versionNo: version.version_no,
        version: version.version,
        status: version.status,
        freshness: version.freshness,
        freshnessReason: version.freshness_reason,
        staleSince: version.stale_since,
        riskTier: version.risk_tier,
        versionKind: version.version_kind,
        parentVersionId: version.parent_version_id,
        supersededByVersionId: version.superseded_by_version_id,
        computeSnapshotId: version.compute_snapshot_id,
        computeRunId: version.compute_run_id,
        contentSemanticHash: version.content_semantic_hash,
        submittedBy: version.submitted_by,
        submittedAt: version.submitted_at,
        approvedBy: version.approved_by,
        approvedAt: version.approved_at,
        reopenReason: version.reopen_reason,
        reopenedBy: version.reopened_by,
        reopenedAt: version.reopened_at,
        createdAt: version.created_at,
        updatedAt: version.updated_at,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /versions/:businessVersionId/transitions — generic T2-T7/T10-T11
// body: { action, reason?, expectedVersion }
// ---------------------------------------------------------------------------

router.post(
  '/versions/:businessVersionId/transitions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const body = req.body ?? {};

    if (!isRoutableAction(body.action)) {
      return sendError(
        res,
        400,
        'INVALID_ACTION',
        `action must be one of ${ROUTABLE_ACTIONS.join(', ')} (approve/reopen use POST /models/:modelId/{approve,reopen})`
      );
    }

    const expectedVersion = readExpectedVersion(req);
    if (expectedVersion === undefined || Number.isNaN(expectedVersion)) {
      return sendError(res, 400, 'EXPECTED_VERSION_REQUIRED', 'expectedVersion (or X-Model-Version header) is required and must be a finite number');
    }

    const params: TransitionParams = {
      organizationId,
      businessVersionId,
      action: body.action as Exclude<LifecycleAction, 'approve' | 'reopen'>,
      actorId: userId,
      role: mapOrgRoleToFinanceRole(userRole),
      expectedVersion,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    };

    const result = await transition(params);

    if (!result.ok) {
      return sendError(res, httpStatusForTransitionError(result.code), result.code, result.message, {
        ...(result.currentVersion !== undefined ? { currentVersion: result.currentVersion } : {}),
        ...(result.currentStatus !== undefined ? { currentStatus: result.currentStatus } : {}),
      });
    }

    return res.status(200).json({
      data: {
        businessVersionId: result.businessVersion.business_version_id,
        status: result.businessVersion.status,
        version: result.businessVersion.version,
        freshnessPropagation: result.freshnessPropagation ?? null,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// POST /versions/:businessVersionId/compute-snapshot — T8a pre-approval freeze
// ---------------------------------------------------------------------------

router.post(
  '/versions/:businessVersionId/compute-snapshot',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const result = await createComputeSnapshot({
      organizationId,
      businessVersionId,
      actorId: userId,
    });

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_STATUS' ? 409 : 422;
      return sendError(res, status, result.code, result.message, {
        ...(result.currentStatus !== undefined ? { currentStatus: result.currentStatus } : {}),
      });
    }

    return res.status(result.reused ? 200 : 201).json({
      data: {
        computeSnapshotId: result.computeSnapshotId,
        workingRevisionId: result.snapshot.working_revision_id,
        asOf: result.snapshot.as_of,
        reused: result.reused,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
