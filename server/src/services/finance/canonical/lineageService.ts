/**
 * Finance v3 canonical — lineage DAG service.
 *
 * Gate C, WP-C02 "compatibility services". Wraps `finance_lineage_edges`
 * (migration `20260809_finance_v3_b03_lineage_freshness.sql`), whose DB
 * triggers already enforce cycle-prevention and append-only per
 * `docs/validation/finance-v3/generated/gate-b/WP-B03_lineage_staleness_ADR.md`
 * section 4 and `GATE_B_INTEGRATION_RECONCILIATION.md`.
 *
 * This module adds:
 *   1. A pure, DB-free re-implementation of the rank-comparison cycle rule
 *      (`STAGE_RANK`/`validateEdgeRank`) that MIRRORS the SQL function
 *      `finance_artifact_stage_rank` + trigger `finance_lineage_prevent_cycle`
 *      1:1 — used for fast client-facing 4xx validation BEFORE round-tripping
 *      to the DB, and unit-tested without a database. The DB trigger remains
 *      the authoritative enforcement point (defense in depth, not a
 *      replacement) — this app-level copy can drift only if someone edits
 *      one side and not the other, which the unit test in
 *      `__tests__/lineageService.test.ts` is the safety net for.
 *   2. Real DB operations (`insertEdge`, `getAncestors`, `getDescendants`)
 *      using `withPinnedPostgresTransaction`, never `DbPromise` — this is a
 *      new canonical write path and must surface real DB errors (unique
 *      violations, cycle-trigger rejections) to the caller rather than the
 *      `fallback:true` empty-result swallow `DbPromise.run`/`.get`/`.all`
 *      default to.
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { getCurrentPgTransactionClient } from '../../../utils/queryHelpers.js';
import type { FinanceArtifactType } from './lifecycleService.js';

// ---------------------------------------------------------------------------
// Pure rank/cycle logic — mirrors finance_artifact_stage_rank() (B03 migration).
// ---------------------------------------------------------------------------

const STAGE_RANK: Readonly<Record<FinanceArtifactType, number>> = {
  STATEMENT_PACK: 0,
  HISTORICAL_ANALYSIS: 1,
  BASELINE_MODEL: 2,
  PREDICTION_SCENARIO: 3,
  VALUATION_CASE: 4,
  REPORT_EXPORT: 5,
};

export type LineageEdgeType =
  | 'STATEMENT_TO_ANALYSIS'
  | 'STATEMENT_TO_MODEL'
  | 'ANALYSIS_TO_MODEL'
  | 'MODEL_TO_SCENARIO'
  | 'MODEL_TO_VALUATION'
  | 'SCENARIO_TO_VALUATION'
  | 'VERSION_TO_REPORT'
  | 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT';

export type LineageTransformationKind =
  | 'COMPUTE'
  | 'MANUAL_LINK'
  | 'PROMOTION'
  | 'RESTATEMENT_CARRY'
  | 'REOPEN_CARRY'
  | 'RETRACTION';

/** B03 §3.3 — these edge types require an assumption_snapshot_hash; the rest must NOT carry one. */
const EDGE_TYPES_REQUIRING_ASSUMPTION_HASH: ReadonlySet<LineageEdgeType> = new Set([
  'ANALYSIS_TO_MODEL',
  'MODEL_TO_SCENARIO',
  'MODEL_TO_VALUATION',
  'SCENARIO_TO_VALUATION',
]);

export function stageRank(artifactType: FinanceArtifactType): number {
  return STAGE_RANK[artifactType];
}

export type EdgeRankValidation =
  | { ok: true }
  | { ok: false; code: 'LINEAGE_CYCLE_REJECTED' | 'ASSUMPTION_SNAPSHOT_HASH_REQUIRED' | 'ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN'; message: string };

/**
 * WP-B03 §4 rank rule, mirroring the DB trigger `finance_lineage_prevent_cycle`:
 * `target stage_rank must be > source stage_rank`, except
 * `VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT` which is an explicit same-rank
 * sibling/variant exemption (WP-B06 §4.5). Also checks the assumption-hash
 * presence rule from §3.3 (mirrors `chk_finance_lineage_assumption_hash`).
 */
export function validateEdgeRank(
  sourceArtifactType: FinanceArtifactType,
  targetArtifactType: FinanceArtifactType,
  edgeType: LineageEdgeType,
  assumptionSnapshotHash?: string | null
): EdgeRankValidation {
  const requiresHash = EDGE_TYPES_REQUIRING_ASSUMPTION_HASH.has(edgeType);
  if (requiresHash && !assumptionSnapshotHash) {
    return {
      ok: false,
      code: 'ASSUMPTION_SNAPSHOT_HASH_REQUIRED',
      message: `edge_type ${edgeType} requires assumption_snapshot_hash`,
    };
  }

  if (edgeType === 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT') {
    // Sibling/variant annotation, exempt from the downstream-flow rank rule (WP-B06 4.5).
    return { ok: true };
  }

  const sourceRank = stageRank(sourceArtifactType);
  const targetRank = stageRank(targetArtifactType);
  if (targetRank <= sourceRank) {
    return {
      ok: false,
      code: 'LINEAGE_CYCLE_REJECTED',
      message: `target stage_rank (${targetRank}) must be greater than source stage_rank (${sourceRank}) for edge_type ${edgeType}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DB operations
// ---------------------------------------------------------------------------

export interface LineageEdgeRow {
  id: string;
  organization_id: string;
  source_version_id: string;
  source_artifact_type: FinanceArtifactType;
  target_version_id: string;
  target_artifact_type: FinanceArtifactType;
  edge_type: LineageEdgeType;
  transformation_kind: LineageTransformationKind;
  assumption_snapshot_hash: string | null;
  assumption_snapshot_id: string | null;
  compute_run_id: string | null;
  author_id: string;
  created_at: string;
}

export interface InsertEdgeParams {
  organizationId: string;
  sourceVersionId: string;
  sourceArtifactType: FinanceArtifactType;
  targetVersionId: string;
  targetArtifactType: FinanceArtifactType;
  edgeType: LineageEdgeType;
  transformationKind: LineageTransformationKind;
  authorId: string;
  assumptionSnapshotHash?: string | null;
  assumptionSnapshotId?: string | null;
  computeRunId?: string | null;
}

/**
 * `ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN` is part of this union for the same reason it is part of
 * `EdgeRankValidation`: `validateEdgeRank` can grow that rejection under a future stricter B03
 * amendment, and `insertEdge` forwards pre-check rejections verbatim. It is NOT produced today
 * (see the explicit fall-through in `insertEdge`), so callers exhaustively switching on `code`
 * gain a branch, not a behaviour change. Keeping the two unions in sync is what makes that
 * forward-compat comment true rather than aspirational — before this, forwarding the value did
 * not even type-check (`tsc -p server/tsconfig.json` TS2322 at the `return preCheck`).
 */
export type InsertEdgeResult =
  | { ok: true; edge: LineageEdgeRow }
  | {
      ok: false;
      code:
        | 'LINEAGE_CYCLE_REJECTED'
        | 'ASSUMPTION_SNAPSHOT_HASH_REQUIRED'
        | 'ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN'
        | 'DUPLICATE_EDGE';
      message: string;
    };

/**
 * Insert one lineage edge. Pre-validates rank/hash rules app-side for a fast,
 * typed rejection; the DB trigger is still the source of truth (it derives
 * artifact_type from the DB rather than trusting the caller — see the B03
 * migration header note 3) and its rejection is translated the same way a
 * pre-check rejection would be.
 */
export async function insertEdge(params: InsertEdgeParams): Promise<InsertEdgeResult> {
  const preCheck = validateEdgeRank(
    params.sourceArtifactType,
    params.targetArtifactType,
    params.edgeType,
    params.assumptionSnapshotHash
  );
  if (!preCheck.ok) {
    if (preCheck.code === 'ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN') {
      // Not reachable from validateEdgeRank today (no edge type forbids a
      // supplied hash outright) but kept in the union for forward-compat
      // with a future stricter B03 amendment; fall through to DB semantics.
    } else {
      return preCheck;
    }
  }

  try {
    const insertInTransaction = async (tx: {
      queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
    }) => {
      const row = await tx.queryOne<LineageEdgeRow>(
        `INSERT INTO finance_lineage_edges (
           id, organization_id, source_version_id, source_artifact_type,
           target_version_id, target_artifact_type, edge_type, transformation_kind,
           assumption_snapshot_hash, assumption_snapshot_id, compute_run_id, author_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *`,
        [
          uuidv4(),
          params.organizationId,
          params.sourceVersionId,
          params.sourceArtifactType,
          params.targetVersionId,
          params.targetArtifactType,
          params.edgeType,
          params.transformationKind,
          params.assumptionSnapshotHash ?? null,
          params.assumptionSnapshotId ?? null,
          params.computeRunId ?? null,
          params.authorId,
        ]
      );
      if (!row) throw new Error('finance_lineage_edges insert returned no row');
      return { ok: true, edge: row } as const;
    };
    const ambient = getCurrentPgTransactionClient();
    if (ambient) {
      return await insertInTransaction({
        queryOne: async <T>(sql: string, queryParams: unknown[] = []) =>
          (await ambient.query<T>(sql, queryParams)).rows[0] ?? null,
    });
    }
    return await withPinnedPostgresTransaction((tx) => insertInTransaction(tx));
  } catch (error: any) {
    const message = String(error?.message || error);
    if (error?.code === '23505' || /uq_finance_lineage_edge/.test(message)) {
      return { ok: false, code: 'DUPLICATE_EDGE', message: 'This lineage edge already exists' };
    }
    if (/finance_lineage_edges: target stage_rank/.test(message) || /does not match actual artifact_type/.test(message)) {
      return { ok: false, code: 'LINEAGE_CYCLE_REJECTED', message };
    }
    throw error;
  }
}

/** Ancestors: every version that (transitively) feeds INTO `businessVersionId`. */
export async function getAncestors(
  organizationId: string,
  businessVersionId: string,
  maxDepth = 50
): Promise<LineageEdgeRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<LineageEdgeRow>(
      `WITH RECURSIVE ancestors AS (
         SELECT e.*, 1 AS depth
           FROM finance_lineage_edges e
          WHERE e.organization_id = ? AND e.target_version_id = ?
         UNION ALL
         SELECT e.*, a.depth + 1
           FROM finance_lineage_edges e
           JOIN ancestors a ON e.target_version_id = a.source_version_id
          WHERE e.organization_id = ? AND a.depth < ?
       )
       SELECT DISTINCT id, organization_id, source_version_id, source_artifact_type,
              target_version_id, target_artifact_type, edge_type, transformation_kind,
              assumption_snapshot_hash, assumption_snapshot_id, compute_run_id, author_id, created_at
         FROM ancestors`,
      [organizationId, businessVersionId, organizationId, maxDepth]
    )
  );
}

/** Descendants: every version that (transitively) is derived FROM `businessVersionId`. */
export async function getDescendants(
  organizationId: string,
  businessVersionId: string,
  maxDepth = 50
): Promise<LineageEdgeRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<LineageEdgeRow>(
      `WITH RECURSIVE descendants AS (
         SELECT e.*, 1 AS depth
           FROM finance_lineage_edges e
          WHERE e.organization_id = ? AND e.source_version_id = ?
         UNION ALL
         SELECT e.*, d.depth + 1
           FROM finance_lineage_edges e
           JOIN descendants d ON e.source_version_id = d.target_version_id
          WHERE e.organization_id = ? AND d.depth < ?
       )
       SELECT DISTINCT id, organization_id, source_version_id, source_artifact_type,
              target_version_id, target_artifact_type, edge_type, transformation_kind,
              assumption_snapshot_hash, assumption_snapshot_id, compute_run_id, author_id, created_at
         FROM descendants`,
      [organizationId, businessVersionId, organizationId, maxDepth]
    )
  );
}
