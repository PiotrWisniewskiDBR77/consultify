/**
 * OKR-E005 — Alignment read repository.
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §F/§G.
 *
 * ★ IO-1 divergence (restated from `okrAlignmentCommands.ts`'s own header):
 * `okr_vnext_alignments` does NOT get its own `rvn_platform_resource_visibility`
 * row, and — unlike the frozen draft's assumption — there is no
 * `'okr_objective'` resource type to join against either (E003 landed
 * differently: Objectives inherit visibility through their owning Set's own
 * `'okr_set'` row). Every read below therefore joins the visibility CTE
 * TWICE against `resourceType: OKR_SET_RESOURCE_TYPE` — once per endpoint,
 * via each Objective's own `set_id` — never a raw, unscoped query over
 * `okr_vnext_alignments`.
 *
 * OKR-F-017-AC-01 (the isolating AC this file exists to satisfy): hidden/
 * restricted Objectives must not leak through alignment nodes, edge counts,
 * search, analytics, or Teresa — "absent, not redacted"
 * (`04_OKR_IMPLEMENTATION_PLAN.md` §7.4). Both endpoints must independently
 * pass the ABAC visibility CTE for an edge to appear at all; a viewer who
 * can see only one side sees no edge — see
 * `tests/resultsVnext/okr/okrAlignmentVisibilityJoin.realdb.test.ts`.
 *
 * `rvn_platform_resource_visibility.resource_id` is TEXT;
 * `okr_vnext_objectives.set_id` (and `okr_vnext_alignments.source_objective_id`/
 * `target_objective_id`, joined through `okr_vnext_objectives`) are UUID —
 * every join below casts `::text`. This exact cast has already been missed
 * 7 times in one KPI epic (this program's single most-repeated real bug).
 *
 * No materialized closure table (design §F: management-chain's own closure
 * table does not transfer — alignment is optional/many-to-many/sparse, not
 * a mandatory single-parent tree, and this read surface is not a hot path
 * shared platform-wide). `getAlignmentTreeUnderObjective`'s bounded
 * recursive CTE prunes visibility AT EACH RECURSION STEP (design §F: "stop,
 * don't skip" — the walk halts at the first invisible node rather than
 * revealing a visible-but-more-distant node beyond it, which would itself
 * leak that a hidden intermediate exists).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  VISIBILITY_CTE_PARAM_COUNT,
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
} from '../platform/visibilityScopedQuery.js';

import { toOkrAlignment, type OkrAlignment, type OkrAlignmentRow, type OkrAlignmentStatus } from './okrAlignmentTypes.js';
import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(client: PoolClient, sql: string, values: unknown[]): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

/**
 * The double-join fragment shared by every read below: BOTH endpoints must
 * independently resolve to a visible Set. `wrapWithVisibilityScope` only
 * supports ONE CTE injection point, so this joins the SAME
 * `rvn_visible_resources` CTE instance twice, aliased differently, against
 * each endpoint's Objective's `set_id` (via a join through
 * `okr_vnext_objectives`, never a denormalized column on the alignment row
 * itself — no "move objective to another Set" command exists in E003, but
 * joining live avoids any denormalization-drift risk regardless).
 */
function buildDoubleVisibilityJoin(alignmentAlias: string): string {
  return `
      JOIN okr_vnext_objectives src_obj ON src_obj.objective_id = ${alignmentAlias}.source_objective_id
      JOIN okr_vnext_objectives tgt_obj ON tgt_obj.objective_id = ${alignmentAlias}.target_objective_id
      JOIN rvn_visible_resources vis_source
        ON vis_source.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vis_source.resource_id = src_obj.set_id::text
      JOIN rvn_visible_resources vis_target
        ON vis_target.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vis_target.resource_id = tgt_obj.set_id::text
  `;
}

// ==========================================
// listAlignmentsForObjective
// ==========================================

export interface ListAlignmentsForObjectiveParams {
  userId: string;
  organizationId: string;
  objectiveId: string;
  direction: 'outgoing' | 'incoming';
  status?: OkrAlignmentStatus;
}

/**
 * Direct edges only (one hop) — powers the MVP list/tree view (design §F).
 * `direction: 'outgoing'` = edges where `objectiveId` is the source (this
 * Objective contributes to others); `'incoming'` = edges where it is the
 * target (others contribute to it).
 */
export async function listAlignmentsForObjective(
  params: ListAlignmentsForObjectiveParams
): Promise<OkrAlignment[]> {
  const { userId, organizationId, objectiveId, direction, status } = params;
  const anchorColumn = direction === 'outgoing' ? 'a.source_objective_id' : 'a.target_objective_id';

  const filters: string[] = [`a.organization_id = $1`, `${anchorColumn} = $${VISIBILITY_CTE_PARAM_COUNT + 1}`];
  const extraValues: unknown[] = [objectiveId];
  if (status) {
    extraValues.push(status);
    filters.push(`a.status = $${VISIBILITY_CTE_PARAM_COUNT + 1 + extraValues.length - 1}`);
  }

  const baseQuerySql = `
    SELECT a.*
      FROM okr_vnext_alignments a
      ${buildDoubleVisibilityJoin('a')}
     WHERE ${filters.join(' AND ')}
     ORDER BY a.proposed_at ASC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const values = [...wrapped.values, ...extraValues];

  return withReadClient(async (client) => {
    const rows = await queryRows<OkrAlignmentRow>(client, wrapped.sql, values);
    return rows.map(toOkrAlignment);
  });
}

// ==========================================
// getAlignmentTreeUnderObjective
// ==========================================

export interface GetAlignmentTreeUnderObjectiveParams {
  userId: string;
  organizationId: string;
  rootObjectiveId: string;
  maxDepth?: number;
}

export interface OkrAlignmentTreeNode {
  alignment: OkrAlignment;
  depth: number;
}

/** Design §F: an arbitrary, generously-sized default (individual -> team ->
 * BU -> division -> company plus slack) — NOT sourced from any AC. */
const DEFAULT_ALIGNMENT_TREE_MAX_DEPTH = 6;

/**
 * Bounded recursive CTE walking `target_objective_id -> source_objective_id`
 * edges — "who contributes to me, and who contributes to them...". Only
 * `status = 'accepted'` edges count (a `proposed` edge is not yet a live
 * contribution relationship). Visibility is enforced INSIDE the recursive
 * term (design §F's "stop, don't skip" semantics) — the walk halts the
 * instant either endpoint of a candidate edge is invisible to the caller,
 * rather than continuing past it to a visible-but-more-distant node, which
 * would itself leak that a hidden intermediate exists.
 */
export async function getAlignmentTreeUnderObjective(
  params: GetAlignmentTreeUnderObjectiveParams
): Promise<OkrAlignmentTreeNode[]> {
  const { userId, organizationId, rootObjectiveId, maxDepth = DEFAULT_ALIGNMENT_TREE_MAX_DEPTH } = params;
  const boundedMaxDepth = Math.max(1, Math.min(maxDepth, 50));

  // `alignment_tree` self-references, so the WHOLE statement must be
  // `WITH RECURSIVE`, not just `WITH` — `wrapWithVisibilityScope` only ever
  // emits a plain `WITH`, so it cannot be used here. Per
  // `buildVisibilityScopedCte`'s own documented alternate usage mode ("a
  // caller ... can strip the leading 'WITH ' (5 characters) from sql and
  // splice the remainder in as one more comma-separated CTE definition"),
  // this builds the CTE text directly and assembles `WITH RECURSIVE
  // <visibility-cte>, alignment_tree AS (...)` by hand.
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE });
  const visibilityCteBody = cte.sql.replace(/^WITH\s+/, '');

  const rootObjectiveParamIndex = VISIBILITY_CTE_PARAM_COUNT + 1;
  const maxDepthParamIndex = VISIBILITY_CTE_PARAM_COUNT + 2;

  const sql = `
    WITH RECURSIVE ${visibilityCteBody},
    alignment_tree AS (
      SELECT a.*, 1 AS depth
        FROM okr_vnext_alignments a
        ${buildDoubleVisibilityJoin('a')}
       WHERE a.organization_id = $1
         AND a.status = 'accepted'
         AND a.target_objective_id = $${rootObjectiveParamIndex}
      UNION ALL
      SELECT a.*, t.depth + 1
        FROM okr_vnext_alignments a
        ${buildDoubleVisibilityJoin('a')}
        JOIN alignment_tree t ON a.target_objective_id = t.source_objective_id
       WHERE a.organization_id = $1
         AND a.status = 'accepted'
         AND t.depth < $${maxDepthParamIndex}
    )
    SELECT * FROM alignment_tree ORDER BY depth ASC, proposed_at ASC
  `;
  const values = [...cte.values, rootObjectiveId, boundedMaxDepth];

  return withReadClient(async (client) => {
    const rows = await queryRows<OkrAlignmentRow & { depth: number }>(client, sql, values);
    return rows.map((row) => ({ alignment: toOkrAlignment(row), depth: row.depth }));
  });
}
