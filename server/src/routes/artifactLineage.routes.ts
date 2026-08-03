/**
 * MAT-010 — Artifact lineage receipt API.
 *
 * The single place that answers "trace this artifact's full history", for
 * Documents, Workbooks and Presentations alike, instead of three different
 * tables with three different shapes.
 *
 *   GET  /api/artifact-lineage/receipts
 *   GET  /api/artifact-lineage/pending
 *   POST /api/artifact-lineage/reconcile
 *   GET  /api/artifact-lineage/by-artifact/:canonicalArtifactId
 *   GET  /api/artifact-lineage/:artifactKind/:sourceRecordId
 *   POST /api/artifact-lineage/:artifactKind/:sourceRecordId/events
 *
 * TENANT ISOLATION: `organizationId` and the actor are ALWAYS taken from
 * `req.user` (session-derived). A client-supplied `organizationId` / `userId`
 * in the body or query is ignored outright — never merged, never used as a
 * fallback. Anything belonging to another organization returns the byte-identical
 * 404 body that a genuinely unknown id returns, so no status code or error
 * shape can be used as an existence oracle.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { verifyToken } from '../middleware/auth.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import {
  artifactBelongsToOrganization,
  type ArtifactKind,
  ArtifactLineageError,
  getLineageReceipt,
  getLineageReceiptByCanonicalArtifactId,
  isArtifactKind,
  isLineageEventType,
  listLineageReceipts,
  listPendingLineageEvents,
  reconcilePendingLineageEvents,
  recordLineageEvent,
} from '../services/lineage/artifactLineageService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * The ONE not-found body. Used for: unknown id, unknown kind-with-valid-shape,
 * and cross-tenant. Deliberately a single shared constant so the three cases
 * cannot drift apart and become distinguishable to a prober.
 */
const NOT_FOUND_BODY = { error: 'Lineage receipt not found' } as const;

const lineageWriteRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

router.use(verifyToken);

/**
 * GET /api/artifact-lineage/receipts?kind=&limit=
 * Tenant-scoped listing of the org's artifact receipts, most recent activity
 * first. Registered before the generic two-segment route below (a single
 * path segment cannot match it, but keeping the order explicit is cheaper
 * than relying on that).
 */
router.get(
  '/receipts',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const kindRaw = req.query?.kind;
    if (kindRaw !== undefined && !isArtifactKind(kindRaw)) {
      res.status(400).json({ error: 'Invalid artifact kind' });
      return;
    }
    const receipts = await listLineageReceipts({
      organizationId: user.organizationId,
      artifactKind: kindRaw as ArtifactKind | undefined,
      limit: Number(req.query?.limit) || undefined,
    });
    res.json({ receipts });
  })
);

/**
 * GET /api/artifact-lineage/pending?status=&limit=
 *
 * The durable outbox, tenant-scoped: lineage events whose DIRECT write failed
 * and which were persisted for replay. `status=pending` is the outstanding
 * backlog; `status=consumed` is the audit trail of what needed recovery
 * (consumed rows are marked, never deleted).
 *
 * Single path segment, so it cannot be shadowed by the two-segment generic
 * trace route below — order kept explicit anyway.
 */
router.get(
  '/pending',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const statusRaw = req.query?.status;
    if (statusRaw !== undefined && statusRaw !== 'pending' && statusRaw !== 'consumed') {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const pending = await listPendingLineageEvents({
      organizationId: user.organizationId,
      status: statusRaw as 'pending' | 'consumed' | undefined,
      limit: Number(req.query?.limit) || undefined,
    });
    res.json({ pending });
  })
);

/**
 * POST /api/artifact-lineage/reconcile
 *
 * Replays this organization's durable pending lineage events. Deliberately
 * operator-triggerable (rather than only a background timer) so recovery after
 * an incident is immediate and deterministically testable.
 *
 * ALWAYS scoped to the caller's own organization — a reconciliation run can
 * never touch, or reveal the existence of, another tenant's backlog.
 *
 * Safe to invoke repeatedly: consumed rows are not re-selected, and the stable
 * idempotency key makes a replay converge on the existing event rather than
 * appending a duplicate.
 */
router.post(
  '/reconcile',
  lineageWriteRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reconcilePendingLineageEvents({
      organizationId: user.organizationId,
      limit: Number((req.body ?? {}).limit) || undefined,
    });
    res.json(result);
  })
);

/**
 * GET /api/artifact-lineage/by-artifact/:canonicalArtifactId
 * Reverse lookup from the canonical `v8_output_artifacts.artifact_id`.
 * MUST stay registered before the generic `/:artifactKind/:sourceRecordId`
 * route — it is also two segments and would otherwise be shadowed.
 */
router.get(
  '/by-artifact/:canonicalArtifactId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const receipt = await getLineageReceiptByCanonicalArtifactId({
      organizationId: user.organizationId,
      canonicalArtifactId: String(req.params.canonicalArtifactId),
    });
    if (!receipt) {
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }
    res.json({ receipt });
  })
);

/**
 * GET /api/artifact-lineage/:artifactKind/:sourceRecordId
 * The canonical "trace this artifact" read: receipt + complete ordered lineage.
 *
 * Durable read-back: this reads live server state on every call (no cache
 * layer, no localStorage anywhere in the path), so a hard browser reload
 * necessarily reflects committed DB state.
 */
router.get(
  '/:artifactKind/:sourceRecordId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { artifactKind, sourceRecordId } = req.params;
    if (!isArtifactKind(artifactKind)) {
      // Same 404 body as a genuine miss: an invalid kind must not be
      // distinguishable from an unknown record.
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }
    const receipt = await getLineageReceipt({
      organizationId: user.organizationId,
      artifactKind,
      sourceRecordId: String(sourceRecordId),
    });
    if (!receipt) {
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }
    res.json({ receipt });
  })
);

/**
 * POST /api/artifact-lineage/:artifactKind/:sourceRecordId/events
 *
 * Idempotent create/append. Ensures the receipt exists and appends one event,
 * atomically. Safe to retry: pass a stable `idempotencyKey` and a retried
 * request appends the event once (`deduped: true` on the replay). Two
 * simultaneous first calls produce exactly ONE receipt.
 *
 * NO FALSE SUCCESS: `recordLineageEvent` only resolves after its Postgres
 * transaction has COMMITTED. Any failure propagates here as a 500 — this route
 * never returns 2xx for a write that did not land.
 */
router.post(
  '/:artifactKind/:sourceRecordId/events',
  lineageWriteRateLimiter,
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { artifactKind, sourceRecordId } = req.params;
    if (!isArtifactKind(artifactKind)) {
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!isLineageEventType(body.eventType)) {
      res.status(400).json({ error: 'Invalid eventType' });
      return;
    }
    // `public_open` is only ever emitted server-side by the unauthenticated
    // public reader hook. Accepting it from an authenticated client would let
    // a caller forge public-open history.
    if (body.eventType === 'public_open') {
      res.status(400).json({ error: 'Invalid eventType' });
      return;
    }

    // Ownership gate. The artifact must exist in the CALLER'S org, otherwise
    // this endpoint would let any authenticated user mint receipts for
    // arbitrary ids. Cross-tenant and non-existent collapse to the same 404
    // body as every other miss — no existence oracle.
    //
    // Fails closed: an error in the ownership probe is treated as "not owned".
    let owned = false;
    try {
      owned = await artifactBelongsToOrganization({
        organizationId: user.organizationId,
        artifactKind,
        sourceRecordId: String(sourceRecordId),
      });
    } catch (err) {
      logger.warn('[ArtifactLineage] ownership probe failed; denying write', {
        organizationId: user.organizationId,
        artifactKind,
        message: err instanceof Error ? err.message : String(err),
      });
      owned = false;
    }
    if (!owned) {
      res.status(404).json(NOT_FOUND_BODY);
      return;
    }

    try {
      const result = await recordLineageEvent({
        // Session-derived. `body.organizationId` / `body.actorUserId` are
        // deliberately NOT read.
        organizationId: user.organizationId,
        actorUserId: user.id,
        artifactKind,
        sourceRecordId: String(sourceRecordId),
        eventType: body.eventType,
        titleSnapshot: typeof body.title === 'string' ? body.title : null,
        sourceContext: body.sourceContext,
        detail: body.detail,
        idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null,
      });

      await req.emitAuditEvent?.({
        actorType: 'USER',
        action: 'create',
        resourceType: 'artifact_lineage_event',
        resourceId: result.receiptId,
        after: { eventType: body.eventType, deduped: result.deduped },
        metadata: {
          organizationId: user.organizationId,
          artifactKind,
          sourceRecordId: String(sourceRecordId),
        },
      });

      res.status(result.deduped ? 200 : 201).json(result);
    } catch (err) {
      if (err instanceof ArtifactLineageError && err.code === 'INVALID_ARGUMENT') {
        res.status(400).json({ error: err.message });
        return;
      }
      logger.error('[ArtifactLineage] failed to record lineage event', {
        organizationId: user.organizationId,
        artifactKind,
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to record lineage event' });
    }
  })
);

export default router;
