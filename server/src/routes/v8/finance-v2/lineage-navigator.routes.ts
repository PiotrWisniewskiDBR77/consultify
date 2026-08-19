/**
 * Finance v3 canonical adapter — Lineage Navigator presentation surface,
 * `GET /api/v8/finance-v2/versions/:businessVersionId/lineage-navigator`.
 *
 * OWN-FIN-007 / OWN-FIN-022. `server/src/services/finance/workspace/
 * lineageNavigatorContract.ts` (~1480 lines: compact breadcrumb trail,
 * Related panel with parents/children/indirect ancestors+descendants/
 * siblings, stale/terminal badges, tenant isolation, cycle reporting) was
 * fully implemented and tested but had ZERO HTTP callers and ZERO route —
 * this file is the missing wiring, nothing more. All domain logic
 * (traversal, badges, tenant refusal, cycle detection) stays in that module;
 * this router only (a) fetches the edges + node metadata the contract's pure
 * functions need and (b) maps the result to JSON.
 *
 * DELIBERATELY NOT a duplicate of the existing `GET /versions/:businessVersionId/
 * lineage` route (`crosscutting.routes.ts`, Pakiet B2): that route returns
 * RAW edge rows (source/target ids + edge types), unshaped. This route
 * returns the SHAPED presentation (trail + Related panel) the Lineage
 * Navigator contract exists to produce. Both routes stay, unchanged,
 * side by side — no path collision (`/lineage` vs `/lineage-navigator`).
 *
 * Node metadata (`LineageNodeMetadata`) is assembled from THREE tables in one
 * batched query, scoped to the caller's own `organization_id` throughout:
 *   - `finance_business_versions` — version_no (-> versionLabel `v${n}`),
 *     status, freshness;
 *   - `finance_artifacts` — artifact_type, natural_key (-> display name,
 *     falling back to the Polish artifact-type label
 *     `lineageNavigatorContract.ARTIFACT_TYPE_LABEL_PL` when natural_key is
 *     unset);
 *   - `finance_prediction_scenarios.name` / `finance_valuation_variants.name`
 *     (both UNIQUE on business_version_id) — the only two tables in the
 *     schema that carry a per-version "variant" name (e.g. "Bull", "Downside
 *     comps") — LEFT JOINed, `null` for every other artifact type.
 * `periodLabel` is always `null`: no canonical table models "the one period"
 * for an entire business version (a Statement Pack alone spans many
 * `finance_stmt_periods` rows) — inventing one here would be exactly the
 * kind of new domain concept this package's mandate (additive HTTP surface
 * only, no new semantics) is meant to avoid.
 *
 * ★ `POST /versions/lineage-edges` — the write half of this same gap,
 * flagged mid-package by an independent verifier (Pakiet H, Enterprise
 * Valuation): `lineageService.insertEdge()` had ZERO production callers
 * anywhere in the repo, ONLY test fixtures — meaning the entire Statement ->
 * Analysis -> Baseline -> Prediction -> Valuation DAG this file's read side
 * exists to display could not be BUILT through the API at all. This endpoint
 * is a thin wrapper: all rank/cycle validation, the assumption-hash
 * requirement rule, and tenant isolation are enforced by `insertEdge()`
 * itself (app-level pre-check) and the `finance_lineage_edges` migration's
 * own triggers/composite FKs (DB-level, authoritative) — this router adds
 * only the pre-check that turns a cross-tenant `source`/`targetVersionId`
 * into a clean 404 instead of a raw FK-violation 500 (same pattern
 * `comments.routes.ts`'s `POST /comments` uses for the identical reason).
 */

import { createHash } from 'node:crypto';

import type { Response } from 'express';
import { Router } from 'express';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  createArtifact,
  getBusinessVersion,
  listBusinessVersions,
} from '../../../services/finance/canonical/artifactVersionService.js';
import type { BusinessVersionStatus } from '../../../services/finance/canonical/lifecycleService.js';
import {
  getAncestors,
  getDescendants,
  insertEdge,
  type InsertEdgeParams,
  type LineageEdgeRow,
} from '../../../services/finance/canonical/lineageService.js';
import {
  FinanceArtifactTypeValues,
  type FinanceArtifactType,
} from '../../../types/finance/ArtifactRef.js';
import type { FinanceArtifactFreshness } from '../../../types/finance/financeValueSemantics.js';
import {
  ARTIFACT_TYPE_LABEL_PL,
  buildLineageTrail,
  buildRelatedPanel,
  LINEAGE_FULL_GRAPH_VIEW,
  LINEAGE_TERMINAL_VISIBILITY_DEFAULT,
  type LineageMetadataResolver,
  type LineageNodeMetadata,
  type LineageTerminalVisibility,
} from '../../../services/finance/workspace/lineageNavigatorContract.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { financeV2Meta, readIdempotencyKey, sendError } from './_shared.js';

const router = Router();

interface LineageNodeMetadataRow {
  business_version_id: string;
  artifact_id: string;
  version_no: number;
  status: BusinessVersionStatus;
  freshness: string;
  artifact_type: FinanceArtifactType;
  natural_key: string | null;
  scenario_name: string | null;
  variant_name: string | null;
}

/** Batched metadata fetch for a set of business_version_id — see file header for the join rationale. `organizationId` is applied on every joined table, not only the outer one. */
async function loadLineageNodeMetadata(
  organizationId: string,
  versionIds: readonly string[]
): Promise<Map<string, LineageNodeMetadata>> {
  const map = new Map<string, LineageNodeMetadata>();
  if (versionIds.length === 0) return map;

  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<LineageNodeMetadataRow>(
      `SELECT bv.business_version_id, bv.artifact_id, bv.version_no, bv.status, bv.freshness,
              a.artifact_type, a.natural_key,
              ps.name AS scenario_name, vv.name AS variant_name
         FROM finance_business_versions bv
         JOIN finance_artifacts a
           ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
         LEFT JOIN finance_prediction_scenarios ps
           ON ps.business_version_id = bv.business_version_id AND ps.organization_id = bv.organization_id
         LEFT JOIN finance_valuation_variants vv
           ON vv.business_version_id = bv.business_version_id AND vv.organization_id = bv.organization_id
        WHERE bv.organization_id = ? AND bv.business_version_id = ANY(?)`,
      [organizationId, Array.from(new Set(versionIds))]
    )
  );

  for (const row of rows) {
    map.set(row.business_version_id, {
      organizationId,
      versionId: row.business_version_id,
      artifactId: row.artifact_id,
      artifactType: row.artifact_type,
      name: row.natural_key ?? ARTIFACT_TYPE_LABEL_PL[row.artifact_type],
      versionLabel: `v${row.version_no}`,
      periodLabel: null,
      status: row.status,
      freshness: row.freshness as FinanceArtifactFreshness,
      variantLabel: row.scenario_name ?? row.variant_name ?? null,
    });
  }
  return map;
}

function collectVersionIds(focusVersionId: string, ancestors: readonly LineageEdgeRow[], descendants: readonly LineageEdgeRow[]): string[] {
  const ids = new Set<string>([focusVersionId]);
  for (const edge of ancestors) {
    ids.add(edge.source_version_id);
    ids.add(edge.target_version_id);
  }
  for (const edge of descendants) {
    ids.add(edge.source_version_id);
    ids.add(edge.target_version_id);
  }
  return [...ids];
}

const TERMINAL_VISIBILITY_VALUES: readonly LineageTerminalVisibility[] = ['show', 'dim', 'hide'];

function isTerminalVisibility(value: unknown): value is LineageTerminalVisibility {
  return typeof value === 'string' && (TERMINAL_VISIBILITY_VALUES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// POST /versions/lineage-edges — create one append-only lineage edge.
// body: { sourceVersionId, sourceArtifactType, targetVersionId, targetArtifactType,
//         edgeType, transformationKind, assumptionSnapshotHash?, assumptionSnapshotId?, computeRunId? }
// ---------------------------------------------------------------------------

// Mirrors `LineageEdgeType`/`LineageTransformationKind` (lineageService.ts) — that file exports
// them as TYPES only (no runtime array), so this list is a local, deliberately duplicated
// allowlist. Kept in sync manually; the `finance_lineage_edges` CHECK constraints are the
// authoritative backstop if the two ever drift (a stale allowlist here fails CLOSED — it would
// reject a newly-added legal value with 400, never accept an illegal one).
const LINEAGE_EDGE_TYPE_VALUES = [
  'STATEMENT_TO_ANALYSIS',
  'STATEMENT_TO_MODEL',
  'ANALYSIS_TO_MODEL',
  'MODEL_TO_SCENARIO',
  'MODEL_TO_VALUATION',
  'SCENARIO_TO_VALUATION',
  'VERSION_TO_REPORT',
  'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT',
] as const;

const LINEAGE_TRANSFORMATION_KIND_VALUES = [
  'COMPUTE',
  'MANUAL_LINK',
  'PROMOTION',
  'RESTATEMENT_CARRY',
  'REOPEN_CARRY',
  'RETRACTION',
] as const;

// ---------------------------------------------------------------------------
// POST /versions/:sourceVersionId/derived-analysis — create the canonical
// HISTORICAL_ANALYSIS root and its source edge as ONE unit of work. This is
// deliberately narrower than the generic artifact/edge pair: Statement Pack
// `+ New Analysis` must never leave an orphan artifact if lineage insertion
// fails between two independent HTTP requests.
// ---------------------------------------------------------------------------

router.post(
  '/versions/:sourceVersionId/derived-analysis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const sourceVersionId = String(req.params.sourceVersionId || '');
    const idempotencyKey = readIdempotencyKey(req);
    if (!idempotencyKey) {
      return sendError(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key is required');
    }
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    const naturalKey = `derived-analysis:${keyHash}`;

    const result = await withPgTransaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
        `${organizationId}:${naturalKey}`,
      ]);

      const source = (
        await tx.query<{
          business_version_id: string;
          artifact_id: string;
          artifact_type: FinanceArtifactType;
        }>(
          `SELECT bv.business_version_id, bv.artifact_id, a.artifact_type
             FROM finance_business_versions bv
             JOIN finance_artifacts a
               ON a.artifact_id = bv.artifact_id AND a.organization_id = bv.organization_id
            WHERE bv.organization_id = ? AND bv.business_version_id = ?`,
          [organizationId, sourceVersionId]
        )
      ).rows[0];
      if (!source) return { error: 'NOT_FOUND' as const };
      if (source.artifact_type !== 'STATEMENT_PACK') {
        return { error: 'INVALID_SOURCE_TYPE' as const };
      }

      const replay = (
        await tx.query<{
          artifact_id: string;
          business_version_id: string;
          working_revision_id: string;
          edge_id: string;
          source_version_id: string;
        }>(
          `SELECT a.artifact_id, bv.business_version_id, wr.working_revision_id,
                  e.id AS edge_id, e.source_version_id
             FROM finance_artifacts a
             JOIN finance_business_versions bv
               ON bv.artifact_id = a.artifact_id AND bv.organization_id = a.organization_id
             JOIN finance_working_revisions wr
               ON wr.business_version_id = bv.business_version_id
              AND wr.organization_id = bv.organization_id AND wr.is_current = TRUE
             JOIN finance_lineage_edges e
               ON e.target_version_id = bv.business_version_id
              AND e.organization_id = bv.organization_id
            WHERE a.organization_id = ? AND a.natural_key = ?`,
          [organizationId, naturalKey]
        )
      ).rows[0];
      if (replay) {
        if (replay.source_version_id !== sourceVersionId) {
          return { error: 'IDEMPOTENCY_KEY_COLLISION' as const };
        }
        return { replay };
      }

      const created = await createArtifact({
        organizationId,
        artifactType: 'HISTORICAL_ANALYSIS',
        naturalKey,
        createdBy: userId,
      });
      const lineage = await insertEdge({
        organizationId,
        sourceVersionId,
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: created.businessVersion.business_version_id,
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'MANUAL_LINK',
        authorId: userId,
      });
      if (!lineage.ok) throw new Error(`derived analysis lineage failed: ${lineage.code}`);
      return { created, edge: lineage.edge, replay: null };
    });

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return sendError(res, 404, 'NOT_FOUND', 'Source business version not found');
      }
      if (result.error === 'IDEMPOTENCY_KEY_COLLISION') {
        return sendError(
          res,
          409,
          'IDEMPOTENCY_KEY_COLLISION',
          'Idempotency-Key is already bound to a different source version'
        );
      }
      return sendError(res, 409, 'INVALID_SOURCE_TYPE', 'Source version must be a STATEMENT_PACK');
    }

    const replayed = Boolean(result.replay);
    const artifactId = result.replay?.artifact_id ?? result.created.artifact.artifact_id;
    const businessVersionId =
      result.replay?.business_version_id ?? result.created.businessVersion.business_version_id;
    const workingRevisionId =
      result.replay?.working_revision_id ?? result.created.workingRevision.working_revision_id;
    const edgeId = result.replay?.edge_id ?? result.edge.id;

    return res.status(replayed ? 200 : 201).json({
      data: {
        artifactId,
        businessVersionId,
        workingRevisionId,
        edgeId,
        sourceVersionId,
        artifactType: 'HISTORICAL_ANALYSIS',
        replayed,
      },
      meta: financeV2Meta(),
    });
  })
);

function httpStatusForInsertEdgeError(code: string): number {
  switch (code) {
    case 'LINEAGE_CYCLE_REJECTED':
      return 409;
    case 'DUPLICATE_EDGE':
      return 409;
    case 'ASSUMPTION_SNAPSHOT_HASH_REQUIRED':
    case 'ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN':
      return 400;
    default:
      return 400;
  }
}

router.post(
  '/versions/lineage-edges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const body = req.body ?? {};

    if (typeof body.sourceVersionId !== 'string' || !body.sourceVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'sourceVersionId is required');
    }
    if (typeof body.targetVersionId !== 'string' || !body.targetVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'targetVersionId is required');
    }
    if (!(FinanceArtifactTypeValues as readonly string[]).includes(body.sourceArtifactType)) {
      return sendError(res, 400, 'INVALID_BODY', `sourceArtifactType must be one of ${FinanceArtifactTypeValues.join(', ')}`);
    }
    if (!(FinanceArtifactTypeValues as readonly string[]).includes(body.targetArtifactType)) {
      return sendError(res, 400, 'INVALID_BODY', `targetArtifactType must be one of ${FinanceArtifactTypeValues.join(', ')}`);
    }
    if (!(LINEAGE_EDGE_TYPE_VALUES as readonly string[]).includes(body.edgeType)) {
      return sendError(res, 400, 'INVALID_BODY', `edgeType must be one of ${LINEAGE_EDGE_TYPE_VALUES.join(', ')}`);
    }
    if (!(LINEAGE_TRANSFORMATION_KIND_VALUES as readonly string[]).includes(body.transformationKind)) {
      return sendError(res, 400, 'INVALID_BODY', `transformationKind must be one of ${LINEAGE_TRANSFORMATION_KIND_VALUES.join(', ')}`);
    }

    // Tenant-scoped existence pre-check on BOTH ends — without it, a foreign
    // source/targetVersionId surfaces as a raw Postgres FK-violation 500
    // (`fk_finance_lineage_source`/`fk_finance_lineage_target`) instead of a
    // clean 404. The FK stays the authoritative enforcement; this is purely
    // an error-shape improvement, same convention `comments.routes.ts` uses.
    const [sourceVersion, targetVersion] = await Promise.all([
      getBusinessVersion(organizationId, body.sourceVersionId),
      getBusinessVersion(organizationId, body.targetVersionId),
    ]);
    if (!sourceVersion) {
      return sendError(res, 404, 'NOT_FOUND', 'sourceVersionId not found in this organization');
    }
    if (!targetVersion) {
      return sendError(res, 404, 'NOT_FOUND', 'targetVersionId not found in this organization');
    }

    const params: InsertEdgeParams = {
      organizationId,
      sourceVersionId: body.sourceVersionId,
      sourceArtifactType: body.sourceArtifactType as FinanceArtifactType,
      targetVersionId: body.targetVersionId,
      targetArtifactType: body.targetArtifactType as FinanceArtifactType,
      edgeType: body.edgeType,
      transformationKind: body.transformationKind,
      authorId: userId,
      assumptionSnapshotHash: typeof body.assumptionSnapshotHash === 'string' ? body.assumptionSnapshotHash : undefined,
      assumptionSnapshotId: typeof body.assumptionSnapshotId === 'string' ? body.assumptionSnapshotId : undefined,
      computeRunId: typeof body.computeRunId === 'string' ? body.computeRunId : undefined,
    };

    const result = await insertEdge(params);
    if (!result.ok) {
      return sendError(res, httpStatusForInsertEdgeError(result.code), result.code, result.message);
    }

    const edge = result.edge;
    return res.status(201).json({
      data: {
        edgeId: edge.id,
        sourceVersionId: edge.source_version_id,
        sourceArtifactType: edge.source_artifact_type,
        targetVersionId: edge.target_version_id,
        targetArtifactType: edge.target_artifact_type,
        edgeType: edge.edge_type,
        transformationKind: edge.transformation_kind,
        assumptionSnapshotHash: edge.assumption_snapshot_hash,
        authorId: edge.author_id,
        createdAt: edge.created_at,
      },
      meta: financeV2Meta(),
    });
  })
);

// ---------------------------------------------------------------------------
// GET /versions/:businessVersionId/lineage-navigator — compact trail + Related panel
// query: maxTrailNodes?, terminalVisibility? ('show'|'dim'|'hide'), maxDepth?
// ---------------------------------------------------------------------------

router.get(
  '/versions/:businessVersionId/lineage-navigator',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const businessVersionId = String(req.params.businessVersionId || '');

    const maxDepthRaw = req.query.maxDepth;
    const maxDepth = typeof maxDepthRaw === 'string' && Number.isFinite(Number(maxDepthRaw)) ? Number(maxDepthRaw) : undefined;
    if (maxDepthRaw !== undefined && maxDepth === undefined) {
      return sendError(res, 400, 'INVALID_QUERY', 'maxDepth must be a finite number');
    }

    const maxTrailNodesRaw = req.query.maxTrailNodes;
    const maxTrailNodes =
      typeof maxTrailNodesRaw === 'string' && Number.isFinite(Number(maxTrailNodesRaw)) ? Number(maxTrailNodesRaw) : undefined;
    if (maxTrailNodesRaw !== undefined && maxTrailNodes === undefined) {
      return sendError(res, 400, 'INVALID_QUERY', 'maxTrailNodes must be a finite number');
    }

    const terminalVisibilityRaw = req.query.terminalVisibility;
    let terminalVisibility: LineageTerminalVisibility = LINEAGE_TERMINAL_VISIBILITY_DEFAULT;
    if (terminalVisibilityRaw !== undefined) {
      if (!isTerminalVisibility(terminalVisibilityRaw)) {
        return sendError(res, 400, 'INVALID_QUERY', `terminalVisibility must be one of ${TERMINAL_VISIBILITY_VALUES.join(', ')}`);
      }
      terminalVisibility = terminalVisibilityRaw;
    }

    // Tenant-scoped existence check FIRST — same 404-with-code contract every
    // other route in this package uses, and the cheapest possible rejection
    // of a foreign business_version_id (no edge/metadata queries run at all).
    const focus = await getBusinessVersion(organizationId, businessVersionId);
    if (!focus) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    const [ancestors, descendants, siblingVersions] = await Promise.all([
      getAncestors(organizationId, businessVersionId, maxDepth),
      getDescendants(organizationId, businessVersionId, maxDepth),
      listBusinessVersions(organizationId, focus.artifact_id),
    ]);

    const versionIds = collectVersionIds(businessVersionId, ancestors, descendants);
    const metadataById = await loadLineageNodeMetadata(organizationId, versionIds);
    const resolve: LineageMetadataResolver = (versionId) => metadataById.get(versionId);

    const siblingVersionIds = siblingVersions
      .map((v) => v.business_version_id)
      .filter((id) => id !== businessVersionId);

    const trail = buildLineageTrail({
      organizationId,
      focusVersionId: businessVersionId,
      ancestorEdges: ancestors,
      resolve,
      maxNodes: maxTrailNodes,
    });

    const relatedPanel = buildRelatedPanel({
      organizationId,
      focusVersionId: businessVersionId,
      ancestorEdges: ancestors,
      descendantEdges: descendants,
      resolve,
      siblingVersionIds,
      terminalVisibility,
    });

    // Cannot happen given the tenant-scoped `getBusinessVersion` check above
    // succeeded and `loadLineageNodeMetadata` is scoped to the SAME
    // organizationId — kept as a defensive 404 (not a 500) rather than an
    // assumption, matching this package's "never trust a downstream `null`
    // silently" convention (see `versions.routes.ts`'s own NOT_FOUND checks).
    if (!relatedPanel) {
      return sendError(res, 404, 'NOT_FOUND', 'Business version not found');
    }

    return res.status(200).json({
      data: {
        businessVersionId,
        trail,
        relatedPanel,
        fullGraphView: LINEAGE_FULL_GRAPH_VIEW,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
