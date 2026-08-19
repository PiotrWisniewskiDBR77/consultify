import { Response, Router } from 'express';

import {
  type AuthRequest,
  validateOrgMembership,
  verifyToken,
} from '../middleware/auth.middleware.js';
import { emitOrgContextRebuilt } from '../realtime/orgContextRealtime.js';
import organizationContextService, {
  NoApprovedGovernedClaimsError,
} from '../services/organizationContext/OrganizationContextService.js';
import { resolveLatestGovernedSnapshotRef } from '../services/organizationContext/governedSnapshotConsumerBindingService.js';
import {
  getOrganizationSnapshotCandidateHandoff,
  handoffOrganizationSnapshotToCandidate,
  OrganizationSnapshotCandidateHandoffError,
} from '../services/organizationContext/organizationSnapshotCandidateHandoffService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function requireOrgId(req: AuthRequest, res: Response): string | null {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
}

function isAdminLike(req: AuthRequest): boolean {
  const normalizedRole = String(req.user?.role || '')
    .trim()
    .toLowerCase();
  return ['admin', 'administrator', 'owner', 'superadmin', 'super_admin'].includes(normalizedRole);
}

router.use(verifyToken);
router.use(validateOrgMembership);

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const context = await organizationContextService.buildResolvedContext(orgId);
    res.json(context);
  })
);

router.get(
  '/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 25), 100));
    const timeline = await organizationContextService.listTimeline(orgId, limit);
    res.json({ timeline });
  })
);

router.get(
  '/claims',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 100), 200));
    const claims = await organizationContextService.listClaims(orgId, limit);
    res.json({ claims });
  })
);

router.post(
  '/rebuild',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    await organizationContextService.rebuildSnapshot(orgId);
    const context = await organizationContextService.buildResolvedContext(orgId);
    // M16 P1-3: notify other open clients for this org so their context banner refreshes live.
    emitOrgContextRebuilt({
      organizationId: orgId,
      rebuiltAt: context.snapshotUpdatedAt,
      counts: context.counts,
    });
    res.json({ ok: true, rebuiltAt: context.snapshotUpdatedAt, counts: context.counts });
  })
);

// ───────────────────────────────────────────────────────────────────────────
// ORG-BVP-001 / ORG-OPS-001 — governed snapshot spine
//
// Consumer contract (for the integrator wiring Chat/Idea to a PINNED,
// reproducible context instead of the live `buildResolvedContext()`):
//   GET /api/organization-context/governed/versions/:version
//     -> 200 PinnedSnapshotRead { organizationId, version, schemaVersion,
//        contentHash, claimCount, createdAt, createdBy,
//        claims: GovernedSnapshotClaimEntry[], sourceRefs: DanglingSourceRef[] }
//     -> 404 if that version was never published for this org (tenant-scoped).
//     `sourceRefs[i].dangling === true` means the cited `knowledge_docs` row
//     was hard/soft-deleted, or its content changed (file_hash mismatch)
//     SINCE this version was published — the citation is stale; the
//     consumer should surface that rather than presenting it as current
//     fact. `contentHash` is stable forever for a given version (the row is
//     append-only/immutable at the DB level).
//   GET /api/organization-context/governed/versions
//     -> 200 { versions: GovernedSnapshotVersion[] } (metadata only, newest first).
// ───────────────────────────────────────────────────────────────────────────

router.get(
  '/governed/claims',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 200), 500));
    const claims = await organizationContextService.listGovernedClaims(orgId, {
      includeRestricted: isAdminLike(req),
      limit,
    });
    res.json({ claims });
  })
);

router.post(
  '/governed/claims/:claimId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const actorId = req.user?.id;
    if (!actorId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const note = typeof req.body?.note === 'string' ? req.body.note : null;
    const result = await organizationContextService.approveClaim(
      orgId,
      req.params.claimId,
      actorId,
      note
    );
    if (!result) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/governed/claims/:claimId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const actorId = req.user?.id;
    if (!actorId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const note = typeof req.body?.note === 'string' ? req.body.note : null;
    const result = await organizationContextService.rejectClaim(
      orgId,
      req.params.claimId,
      actorId,
      note
    );
    if (!result) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/governed/publish',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const actorId = req.user?.id;
    if (!actorId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const version = await organizationContextService.publishSnapshotVersion(orgId, actorId);
      res.status(201).json(version);
    } catch (error) {
      if (error instanceof NoApprovedGovernedClaimsError) {
        res.status(422).json({ error: error.message, code: error.code });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/governed/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 100));
    const versions = await organizationContextService.listSnapshotVersions(orgId, limit);
    res.json({ versions });
  })
);

router.get(
  '/governed/resolve-latest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const snapshotRef = await resolveLatestGovernedSnapshotRef(orgId);
    if (!snapshotRef) {
      res.status(404).json({ error: 'No governed snapshot has been published' });
      return;
    }
    // This endpoint resolves "latest" NOW into an exact immutable ref. The
    // returned ref must be persisted in the consumer command; no execution
    // path is allowed to call buildResolvedContext/latest again on replay.
    res.json({ snapshotRef });
  })
);

router.get(
  '/governed/versions/:version',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const version = Number(req.params.version);
    if (!Number.isFinite(version) || version < 1) {
      res.status(400).json({ error: 'Invalid version' });
      return;
    }
    const snapshot = await organizationContextService.getSnapshotVersion(orgId, version, {
      includeRestricted: isAdminLike(req),
    });
    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot version not found' });
      return;
    }
    res.json(snapshot);
  })
);

router.post(
  '/governed/versions/:version/candidate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isAdminLike(req)) return void res.status(403).json({ error: 'Admin access required' });
    const actorId = req.user?.id;
    if (!actorId) return void res.status(401).json({ error: 'Unauthorized' });
    try {
      const result = await handoffOrganizationSnapshotToCandidate({
        organizationId: orgId,
        snapshotId: String(req.body?.snapshotId || ''),
        snapshotVersion: Number(req.params.version),
        snapshotContentHash: String(req.body?.contentHash || ''),
        actorId,
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof OrganizationSnapshotCandidateHandoffError) {
        return void res.status(error.status).json({ error: error.message, code: error.code });
      }
      throw error;
    }
  })
);

router.get(
  '/governed/versions/:version/candidate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const snapshot = await organizationContextService.getSnapshotVersion(
      orgId,
      Number(req.params.version),
      {
        includeRestricted: isAdminLike(req),
      }
    );
    if (!snapshot) return void res.status(404).json({ error: 'Snapshot version not found' });
    const receipt = await getOrganizationSnapshotCandidateHandoff(orgId, snapshot.snapshotId);
    if (!receipt)
      return void res
        .status(404)
        .json({ error: 'No candidate handoff exists', code: 'NO_CANDIDATE_HANDOFF' });
    res.json({ receipt });
  })
);

export default router;
