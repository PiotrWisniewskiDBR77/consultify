/**
 * Finance v3 canonical adapter — cross-cutting surface (lineage, freshness,
 * exception ledger/inbox), `/api/v8/finance-v2/{versions,exceptions}/*`.
 *
 * Pakiet B2 (Domain HTTP Surface), priority 6. Wraps already-existing,
 * already-tested reader services with zero new SQL of this router's own:
 * `lineageService.getAncestors`/`getDescendants`, `lineageFreshnessService.
 * listFreshnessEvents`, `exceptionLedgerService.listOpen`,
 * `exceptionInboxService.listExceptionInbox`. All four are org-scoped
 * directly in the service (`WHERE organization_id = ?`), so no artifact/
 * business-version existence pre-check is needed for the tenant boundary
 * itself — an empty result for a wrong-org id is indistinguishable from "no
 * lineage/exceptions yet", which is the correct, safe shape for a read-only
 * relationship/ledger query (unlike `GET /artifacts/:id` returning a single
 * resource, where an empty array would look like a false "yours, but
 * empty").
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { listExceptionInbox } from '../../../services/finance/canonical/exceptionInboxService.js';
import { listOpen } from '../../../services/finance/canonical/exceptionLedgerService.js';
import { listFreshnessEvents } from '../../../services/finance/canonical/lineageFreshnessService.js';
import { getAncestors, getDescendants } from '../../../services/finance/canonical/lineageService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, sendError } from './_shared.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /versions/:businessVersionId/lineage — ancestors + descendants
// query: maxDepth?
// ---------------------------------------------------------------------------

router.get(
  '/versions/:businessVersionId/lineage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const maxDepthRaw = req.query.maxDepth;
    const maxDepth = typeof maxDepthRaw === 'string' && Number.isFinite(Number(maxDepthRaw)) ? Number(maxDepthRaw) : undefined;
    if (maxDepthRaw !== undefined && maxDepth === undefined) {
      return sendError(res, 400, 'INVALID_QUERY', 'maxDepth must be a finite number');
    }

    const [ancestors, descendants] = await Promise.all([
      getAncestors(organizationId, businessVersionId, maxDepth),
      getDescendants(organizationId, businessVersionId, maxDepth),
    ]);

    const toDto = (e: (typeof ancestors)[number]) => ({
      edgeId: e.id,
      sourceVersionId: e.source_version_id,
      sourceArtifactType: e.source_artifact_type,
      targetVersionId: e.target_version_id,
      targetArtifactType: e.target_artifact_type,
      edgeType: e.edge_type,
      transformationKind: e.transformation_kind,
      assumptionSnapshotHash: e.assumption_snapshot_hash,
      computeRunId: e.compute_run_id,
      authorId: e.author_id,
      createdAt: e.created_at,
    });

    return res.status(200).json({
      data: { businessVersionId, ancestors: ancestors.map(toDto), descendants: descendants.map(toDto) },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /versions/:businessVersionId/freshness-events — OWN-FIN-022 "source changed" evidence
// query: limit?
// ---------------------------------------------------------------------------

router.get(
  '/versions/:businessVersionId/freshness-events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : undefined;
    if (limitRaw !== undefined && limit === undefined) {
      return sendError(res, 400, 'INVALID_QUERY', 'limit must be a finite number');
    }

    const events = await listFreshnessEvents(organizationId, businessVersionId, limit);

    return res.status(200).json({
      data: events.map((e) => ({
        id: e.id,
        triggeringEdgeId: e.triggering_edge_id,
        triggeringVersionId: e.triggering_version_id,
        targetVersionId: e.target_version_id,
        previousState: e.previous_state,
        newState: e.new_state,
        reasonCode: e.reason_code,
        createdAt: e.created_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /exceptions/open — the exception ledger's current OPEN entries
// query: artifactId?
// ---------------------------------------------------------------------------

router.get(
  '/exceptions/open',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const artifactId = typeof req.query.artifactId === 'string' ? req.query.artifactId : undefined;

    const rows = await listOpen(organizationId, artifactId);

    return res.status(200).json({
      data: rows.map((e) => ({
        exceptionGroupId: e.exception_group_id,
        artifactId: e.artifact_id,
        businessVersionId: e.business_version_id,
        severity: e.severity,
        state: e.state,
        sourceRef: e.source_ref,
        expected: e.expected,
        observed: e.observed,
        delta: e.delta,
        unit: e.unit,
        reasonCode: e.reason_code,
        createdAt: e.created_at,
      })),
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /exceptions/inbox — deduplicated, SLA-annotated cross-source inbox (WP-B05)
// query: artifactId?
// ---------------------------------------------------------------------------

router.get(
  '/exceptions/inbox',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const artifactId = typeof req.query.artifactId === 'string' ? req.query.artifactId : undefined;

    const entries = await listExceptionInbox({ organizationId, artifactId });

    return res.status(200).json({ data: entries, meta: financeV2Meta() });
  })
);

export default router;
