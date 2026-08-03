/**
 * Artifact Approval Routes (HP-7, Harvey-Parity §Blok B, Workflow Engine)
 *
 * REST surface for `server/src/services/artifactApprovalService.ts` — the
 * draft->review->approved/rejected state machine for ARTEFAKTY (Insight,
 * Decision, Report, Initiative, Deck, ...) built in HP-6/HP-7 and confirmed
 * by 07-15 audit as having ZERO route importing it (unreachable from the
 * outside). This file is that missing wiring — nothing more.
 *
 * Mounted at `/api/artifact-approvals` (NOT `/api/artifacts`): that prefix is
 * already mounted in Gateway.ts for the unrelated v8 canvas-artifact registry
 * (`artifactsRoutes`, behind `v8FeatureGate` + `requireInternalToolsAccess`),
 * with its own `/:id`-shaped routes. Reusing it would either collide with
 * those routes or silently inherit v8/internal-tools gating that has nothing
 * to do with this approval workflow. A dedicated prefix keeps this additive
 * (zero risk to the existing `/api/artifacts` surface) while preserving the
 * path shape from the task brief (`:type/:id/approval-state`,
 * `:type/:id/approval/submit|approve|reject`).
 *
 * Org scoping: every handler reads `organizationId` from `req.user`
 * (attached by `verifyToken`) — never from the request body/params — so a
 * caller can only ever read/mutate approval state for artifacts inside their
 * own org. See `tests/integration/routes/artifactApprovals.routes.test.ts`
 * for the cross-org isolation test.
 *
 * Actor identity (`approvedByUserId` / `rejectedByUserId` / `userId` for
 * acknowledge) is likewise always `req.user.id`, never taken from the body —
 * a caller cannot approve/reject "as" someone else.
 */
import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import ArtifactApprovalService from '../services/artifactApprovalService.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(verifyToken);

// ==========================================
// HELPERS
// ==========================================

interface ServiceError extends Error {
  status?: number;
}

function isServiceError(err: unknown): err is ServiceError {
  return err instanceof Error;
}

/**
 * The service throws plain Errors with a `.status` property (see
 * artifactApprovalService.ts's makeError) — NOT `.statusCode`, which is what
 * server/src/middleware/errorHandler.ts's global handler reads. Forwarding
 * via next(err) would therefore turn every 400/404/409 from this service
 * into a misleading 500. Handle locally instead.
 */
function respondWithServiceError(res: Response, err: unknown): void {
  if (isServiceError(err) && typeof err.status === 'number') {
    // Controlled application error (see comment above) — `.message` here is a
    // deliberately safe, user-facing string set by the service, not a raw
    // exception. Fine to forward.
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Genuinely unexpected error (no `.status` set by the service) — zero
  // wycieku wnętrza (docs/standards/ERROR_HANDLING_STANDARD.md §1/§3): log
  // the real detail server-side, never forward err.message to the client.
  logger.error('[ArtifactApprovals] Unexpected service error', { err });
  res
    .status(500)
    .json({ error: 'Wystąpił błąd serwera', code: 'ARTIFACT_APPROVALS_UNEXPECTED_FAILED' });
}

function requireOrgId(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
}

function requireUserId(req: AuthRequest, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return userId;
}

/** `:type` / `:id` are free-form (no fixed artifact-type enum exists yet —
 * see HP-6 audit note in artifactApprovalService.ts), just require non-empty
 * after Express's own URL decoding. */
function requireParams(
  req: AuthRequest,
  res: Response
): { artifactType: string; artifactId: string } | null {
  const artifactType = String(req.params.type || '').trim();
  const artifactId = String(req.params.id || '').trim();
  if (!artifactType || !artifactId) {
    res.status(400).json({ error: 'type and id path params are required' });
    return null;
  }
  return { artifactType, artifactId };
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// ==========================================
// GET /:type/:id/approval-state — read current state (draft/review/approved/rejected)
// ==========================================

router.get('/:type/:id/approval-state', async (req: AuthRequest, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  const params = requireParams(req, res);
  if (!params) return;

  try {
    const status = await ArtifactApprovalService.getArtifactApprovalStatus(
      orgId,
      params.artifactType,
      params.artifactId
    );
    res.json(status);
  } catch (err) {
    respondWithServiceError(res, err);
  }
});

// ==========================================
// POST /:type/:id/approval/submit — draft -> review
// ==========================================

router.post('/:type/:id/approval/submit', async (req: AuthRequest, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = requireParams(req, res);
  if (!params) return;

  const assignedToUserId = String(req.body?.assignedToUserId || '').trim();
  if (!assignedToUserId) {
    res.status(400).json({ error: 'assignedToUserId is required' });
    return;
  }

  try {
    const assignment = await ArtifactApprovalService.submitForReview({
      orgId,
      artifactType: params.artifactType,
      artifactId: params.artifactId,
      assignedToUserId,
      submittedBy: userId,
      slaDueAt: parseOptionalDate(req.body?.slaDueAt),
    });
    res.status(201).json({ assignment, state: ArtifactApprovalService.ARTIFACT_STATES.REVIEW });
  } catch (err) {
    respondWithServiceError(res, err);
  }
});

// ==========================================
// POST /:type/:id/approval/acknowledge — review (PENDING) -> review (ACKED)
// ==========================================

router.post('/:type/:id/approval/acknowledge', async (req: AuthRequest, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = requireParams(req, res);
  if (!params) return;

  try {
    const assignment = await ArtifactApprovalService.acknowledgeReview({
      orgId,
      artifactType: params.artifactType,
      artifactId: params.artifactId,
      userId,
    });
    res.json({ assignment, state: ArtifactApprovalService.ARTIFACT_STATES.REVIEW });
  } catch (err) {
    respondWithServiceError(res, err);
  }
});

// ==========================================
// POST /:type/:id/approval/approve — review -> approved
// ==========================================

router.post('/:type/:id/approval/approve', async (req: AuthRequest, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = requireParams(req, res);
  if (!params) return;

  try {
    const assignment = await ArtifactApprovalService.approveArtifact({
      orgId,
      artifactType: params.artifactType,
      artifactId: params.artifactId,
      approvedByUserId: userId,
    });
    res.json({ assignment, state: ArtifactApprovalService.ARTIFACT_STATES.APPROVED });
  } catch (err) {
    respondWithServiceError(res, err);
  }
});

// ==========================================
// POST /:type/:id/approval/reject — review -> rejected
// ==========================================

router.post('/:type/:id/approval/reject', async (req: AuthRequest, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = requireParams(req, res);
  if (!params) return;

  const reason = req.body?.reason ? String(req.body.reason) : undefined;

  try {
    const assignment = await ArtifactApprovalService.rejectArtifact({
      orgId,
      artifactType: params.artifactType,
      artifactId: params.artifactId,
      rejectedByUserId: userId,
      reason,
    });
    res.json({ assignment, state: ArtifactApprovalService.ARTIFACT_STATES.REJECTED });
  } catch (err) {
    respondWithServiceError(res, err);
  }
});

export default router;
