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
 */

import type { Response } from 'express';
import { Router } from 'express';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import {
  getBusinessVersion,
  listBusinessVersions,
} from '../../../services/finance/canonical/artifactVersionService.js';
import type { BusinessVersionStatus } from '../../../services/finance/canonical/lifecycleService.js';
import { getAncestors, getDescendants, type LineageEdgeRow } from '../../../services/finance/canonical/lineageService.js';
import type { FinanceArtifactType } from '../../../types/finance/ArtifactRef.js';
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
import { financeV2Meta, sendError } from './_shared.js';

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
