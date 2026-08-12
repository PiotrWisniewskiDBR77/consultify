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
  renameArtifact,
  type CreateArtifactParams,
} from '../../../services/finance/canonical/artifactVersionService.js';
import { isLegacyFinanceTable, resolveLegacyFinanceArtifact } from '../../../services/finance/canonical/legacyIdBridgeService.js';
import {
  allowedActionsFromStatus,
  type FinanceArtifactType,
} from '../../../services/finance/canonical/lifecycleService.js';
import { canRenameArtifact, validateWorkspaceName } from '../../../services/finance/workspace/workspaceBarContract.js';
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
// GET /artifacts/resolve-legacy/:legacyTable/:legacyId — ID BRIDGE (Gate E).
//
// Translates an OLD `/api/v8/finance/*` list-row id (`financial_models.id` /
// `financial_analyses.id` / `financial_statement_packs.id` / `valuations.id`)
// into the NEW canonical `{artifactId, businessVersionId}` pair the four v3
// detail workspaces (Baseline/Prediction/Analysis/Valuation) are built
// against — see `legacyIdBridgeService.ts` header for the full context and
// why this reads `finance_artifact_aliases` rather than inventing a new
// mapping.
//
// Three DISTINGUISHABLE outcomes in the response body (never collapsed —
// CLAUDE.md §2.3), all at HTTP 200 (this is a normal, successful *query*
// regardless of which of the three domain states it finds — a 4xx/5xx is
// reserved for an actual request/transport problem, e.g. bad legacyTable ->
// 400, which the FRONTEND then treats as its own third "coś poszło nie tak"
// state, distinct from both of these):
//   - `{status:'RESOLVED', artifactId, businessVersionId, artifactType}` — a
//     migrated alias exists; the caller may mount the real v3 workspace.
//   - `{status:'NOT_MIGRATED'}` — no alias row for this legacy id at all
//     (never backfilled, or the org's backfill has not been run yet).
//   - `{status:'QUARANTINED', reason}` — an alias row exists but the
//     backfill deliberately did not migrate it (WP-A01 classification
//     QUARANTINE/EXCLUDE_WITH_REASON) — a different situation from
//     NOT_MIGRATED (the record was LOOKED AT and rejected, not simply never
//     processed), so the reason (when the backfill recorded one) is passed
//     through rather than folded into the same generic copy.
// ---------------------------------------------------------------------------

router.get(
  '/artifacts/resolve-legacy/:legacyTable/:legacyId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const legacyTable = String(req.params.legacyTable || '');
    const legacyId = String(req.params.legacyId || '');

    if (!isLegacyFinanceTable(legacyTable)) {
      return sendError(res, 400, 'INVALID_LEGACY_TABLE', `legacyTable must be one of the known legacy Finance tables, got "${legacyTable}"`);
    }
    if (!legacyId.trim()) {
      return sendError(res, 400, 'INVALID_LEGACY_ID', 'legacyId is required');
    }

    const resolution = await resolveLegacyFinanceArtifact(organizationId, legacyTable, legacyId);

    if (resolution.status === 'RESOLVED') {
      return res.status(200).json({
        data: {
          status: 'RESOLVED',
          artifactId: resolution.artifactId,
          businessVersionId: resolution.businessVersionId,
          artifactType: resolution.artifactType,
          mappingConfidence: resolution.mappingConfidence,
        },
        meta: financeV2Meta(),
      });
    }
    if (resolution.status === 'QUARANTINED') {
      return res.status(200).json({
        data: {
          status: 'QUARANTINED',
          mappingConfidence: resolution.mappingConfidence,
          reason: resolution.reason,
        },
        meta: financeV2Meta(),
      });
    }
    return res.status(200).json({
      data: { status: 'NOT_MIGRATED' },
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

// ---------------------------------------------------------------------------
// POST /artifacts/:artifactId/rename — D3 fix (Pakiet B2). OWN-FIN-011
// editable Workspace Bar name. Router-level gating reuses the CLIENT
// contract this program already shipped (`workspaceBarContract.ts`
// `canRenameArtifact`/`validateWorkspaceName`) rather than inventing a
// second rule set — same "one source of truth" reasoning `_shared.ts`'s own
// header documents for `mapOrgRoleToFinanceRole`.
// ---------------------------------------------------------------------------

router.post(
  '/artifacts/:artifactId/rename',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userRole } = getV8Context(req);
    const artifactId = String(req.params.artifactId || '');
    const body = req.body ?? {};

    const artifact = await getArtifact(organizationId, artifactId);
    if (!artifact) {
      return sendError(res, 404, 'NOT_FOUND', 'Artifact not found');
    }

    const versions = await listBusinessVersions(organizationId, artifactId);
    const current = versions.length > 0 ? versions[versions.length - 1] : null;
    const role = mapOrgRoleToFinanceRole(userRole);

    if (current) {
      const gate = canRenameArtifact(current.status, role);
      if (!gate.editable) {
        return sendError(res, 403, gate.reason, `Rename blocked: ${gate.reason}`);
      }
    }

    if (typeof body.naturalKey !== 'string') {
      return sendError(res, 400, 'INVALID_BODY', 'naturalKey is required and must be a string');
    }
    const nameCheck = validateWorkspaceName(body.naturalKey);
    if (!nameCheck.ok) {
      return sendError(res, 400, nameCheck.code, nameCheck.message);
    }

    const updated = await renameArtifact(organizationId, artifactId, nameCheck.normalized);
    if (!updated) {
      // Fail-closed / not-a-leak: identical to the `getArtifact` guard above
      // racing a concurrent archive/cross-tenant change between the two
      // reads — never distinguishable from "not found" to the caller.
      return sendError(res, 404, 'NOT_FOUND', 'Artifact not found');
    }

    return res.status(200).json({
      data: { artifactId: updated.artifact_id, naturalKey: updated.natural_key },
      meta: financeV2Meta(),
    });
  })
);

export default router;
