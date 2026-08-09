/**
 * Finance v3 canonical adapter router — `/api/v8/finance-v2/models/*`.
 *
 * Gate C, WP-C02. Two representative ADAPTER_TARGET endpoints from
 * `docs/validation/finance-v3/generated/gate-a/WP-A02_api_freeze.md` /
 * `WP-A02_api_fixtures.json` (fixture F4, `POST /models/:modelId/approve`)
 * plus one brand-new canonical-only operation the legacy surface never had
 * correctly (`reopen` — see WP-B02 §6.1 "reopen mutates Approved in place"
 * bug this whole work package exists to fix):
 *
 *   - `POST /models/:modelId/approve` — legacy shape preserved BIT-IDENTICAL
 *     to fixture F4 for the two documented outcomes (`success_200`,
 *     `error_409_version_conflict`); internally calls
 *     `artifactVersionService.approveVersion` against the canonical
 *     `finance_business_versions` schema, not the legacy `financial_models`
 *     table. `:modelId` here is a canonical `finance_artifacts.artifact_id`
 *     (artifact_type `BASELINE_MODEL`) — there is no legacy-id bridge in
 *     this work package (`finance_artifact_aliases`, WP-C03, not yet
 *     populated), so this adapter proves the CONTRACT shape, not a live
 *     legacy-row cutover.
 *   - `POST /models/:modelId/reopen` — no legacy twin exists (grepped
 *     `finance.routes.ts` / `financial-modeling.routes.ts`: zero `reopen`
 *     routes; the legacy "reopen" behavior is the in-place `UPDATE ...
 *     SET status='draft' WHERE status='approved'` bug itself, not a frozen
 *     contract worth preserving). This is therefore a NEW canonical-only
 *     route, response-shaped like the rest of this router's `{data, meta}`
 *     envelope rather than mimicking a legacy shape that never existed.
 *
 * Auth/middleware chain matches fixture F4 exactly because this router is
 * mounted under the shared `v8Router` in `server/src/routes/v8/index.ts`,
 * which already applies `verifyToken` -> `requireV8OrgContext` ->
 * `v8OrgGate` -> `attachV8Context` -> `v8MetricsMiddleware` ->
 * `mutationAbortCanary` before any leaf router (see fixture F4's `auth`
 * array).
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  approveVersion,
  getArtifact,
  reopenVersion,
  type BusinessVersionRow,
} from '../../../services/finance/canonical/artifactVersionService.js';
import type { FinanceRole } from '../../../services/finance/canonical/lifecycleService.js';
import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';

const router = Router();

/** Stable contract id, mirrors the convention in `v8/finance.routes.ts`'s `V8_FINANCE_READ_CONTRACT`. */
export const FINANCE_V2_CONTRACT = 'finance_v3_canonical_v1';

function financeV2Meta() {
  return { version: 'v2' as const, contract: FINANCE_V2_CONTRACT };
}

/**
 * WP-B02 §7.1 — until per-user Finance role assignment (AP-09, out of scope
 * here) exists, map today's org roles onto the five ADR roles using the
 * ADR's own documented default mapping.
 */
function mapOrgRoleToFinanceRole(orgRole: string | undefined | null): FinanceRole {
  const role = String(orgRole || '').toLowerCase();
  if (role === 'finance_admin') return 'finance_admin';
  if (role === 'owner' || role === 'admin') return 'approver';
  if (role === 'editor' || role === 'finance_editor') return 'preparer';
  return 'viewer';
}

async function findCurrentArtifactVersion(
  organizationId: string,
  artifactId: string,
  statuses: readonly string[]
): Promise<BusinessVersionRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions
        WHERE artifact_id = ? AND organization_id = ? AND status = ANY(?)
        ORDER BY version_no DESC LIMIT 1`,
      [artifactId, organizationId, statuses]
    )
  );
}

function readExpectedVersion(req: AuthRequest): number | undefined {
  const raw = (req.body ?? {}).expectedVersion ?? req.headers['x-model-version'];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN; // NaN signals "supplied but invalid" to the caller below
}

function readIdempotencyKey(req: AuthRequest): string | undefined {
  const header = req.headers['idempotency-key'];
  if (typeof header === 'string' && header.trim()) return header;
  const body = (req.body ?? {}).idempotencyKey;
  return typeof body === 'string' && body.trim() ? body : undefined;
}

router.post(
  '/models/:modelId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const artifactId = String(req.params.modelId || '');

    const artifact = await getArtifact(organizationId, artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const expectedVersion = readExpectedVersion(req);
    if (expectedVersion !== undefined && Number.isNaN(expectedVersion)) {
      return res.status(400).json({ error: 'expectedVersion must be a finite number' });
    }

    const current = await findCurrentArtifactVersion(organizationId, artifactId, ['IN_REVIEW']);
    if (!current) {
      return res.status(409).json({
        error: 'Cannot approve: no version of this model is in IN_REVIEW',
        code: 'STATE_PRECONDITION_FAILED',
      });
    }

    const result = await approveVersion({
      organizationId,
      businessVersionId: current.business_version_id,
      actorId: userId,
      role: mapOrgRoleToFinanceRole(userRole),
      expectedVersion: expectedVersion ?? current.version,
      idempotencyKey: readIdempotencyKey(req),
    });

    if (!result.ok) {
      // Fixture F4 only freezes VERSION_CONFLICT -> 409 {code}. Every other
      // canonical outcome is additive coverage this adapter needs (the
      // legacy endpoint had no SoD/freshness/blocking-exception gate at
      // all) and is intentionally NOT required to be byte-identical to
      // anything, since nothing froze it.
      const httpStatus =
        result.code === 'VERSION_CONFLICT'
          ? 409
          : result.code === 'NOT_FOUND'
            ? 404
            : result.code === 'STATE_PRECONDITION_FAILED'
              ? 409
              : result.code === 'SELF_APPROVAL_FORBIDDEN'
                ? 403
                : result.code === 'APPROVAL_BLOCKED' || result.code === 'WORKING_REVISION_NOT_FOUND'
                  ? 422
                  : 400;

      if (result.code === 'VERSION_CONFLICT') {
        // Bit-identical to WP-A02_api_fixtures.json fixture F4 `error_409_version_conflict`.
        return res.status(409).json({ code: 'VERSION_CONFLICT' });
      }
      return res.status(httpStatus).json({ error: result.message, code: result.code });
    }

    // Bit-identical to fixture F4 `success_200` for the non-replay case.
    // `idempotentReplay` is additive (fixture's prose documents the replay
    // behavior but its `response` object does not enumerate a distinct
    // shape for it), only present when true so the base case matches byte
    // for byte.
    return res.status(200).json({
      success: true,
      status: 'approved',
      ...(result.idempotentReplay ? { idempotentReplay: true } : {}),
    });
  })
);

router.post(
  '/models/:modelId/reopen',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const artifactId = String(req.params.modelId || '');

    const artifact = await getArtifact(organizationId, artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const idempotencyKey = readIdempotencyKey(req);
    if (!idempotencyKey) {
      // WP-B02 §4.2 — every mutating lifecycle operation requires
      // Idempotency-Key. This route has no legacy twin to stay
      // backward-compatible with (see file header), so it enforces the ADR
      // requirement in full rather than the "optional" compromise F2/F4 use
      // for backward compatibility with pre-ADR legacy behavior.
      return res.status(400).json({ error: 'Idempotency-Key header is required for this operation', code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    const reason = typeof (req.body ?? {}).reason === 'string' ? (req.body.reason as string) : '';
    const expectedVersion = readExpectedVersion(req);
    if (expectedVersion !== undefined && Number.isNaN(expectedVersion)) {
      return res.status(400).json({ error: 'expectedVersion must be a finite number' });
    }

    const current = await findCurrentArtifactVersion(organizationId, artifactId, ['APPROVED']);
    if (!current) {
      return res.status(409).json({
        error: 'Cannot reopen: no APPROVED version exists for this model',
        code: 'STATE_PRECONDITION_FAILED',
      });
    }

    const result = await reopenVersion({
      organizationId,
      businessVersionId: current.business_version_id,
      actorId: userId,
      role: mapOrgRoleToFinanceRole(userRole),
      expectedVersion: expectedVersion ?? current.version,
      reason,
      idempotencyKey,
    });

    if (!result.ok) {
      const httpStatus =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'FORBIDDEN'
            ? 403
            : result.code === 'REASON_REQUIRED'
              ? 400
              : 409; // VERSION_CONFLICT / STATE_PRECONDITION_FAILED / DRAFT_ALREADY_EXISTS
      return res.status(httpStatus).json({
        error: result.message,
        code: result.code,
        ...(result.existingDraftVersionId ? { existingDraftVersionId: result.existingDraftVersionId } : {}),
      });
    }

    return res.status(result.idempotentReplay ? 200 : 201).json({
      data: {
        artifactId,
        previousBusinessVersionId: result.previousBusinessVersionId,
        businessVersionId: result.businessVersion.business_version_id,
        versionNo: result.businessVersion.version_no,
        status: result.businessVersion.status,
        workingRevisionId: result.workingRevision.working_revision_id,
        idempotentReplay: result.idempotentReplay,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
