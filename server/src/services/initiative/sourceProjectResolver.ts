/**
 * Zwornik project inheritance — best-effort resolve a `project_id` from a
 * discovery-artifact source so AI-created initiatives anchor to the SAME
 * project as their source (Insight/assessment/audit) instead of always
 * falling to the generic system "Portfel" bucket.
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md §5.2 +
 * server/src/services/initiativeProjectPolicyService.ts (the funnel's
 * fallback auto-anchor for when this resolver comes up empty).
 *
 * Only `assessment` and `audit` source rows carry a `project_id` column in
 * the current schema (see server/migrations/000_z_core_baseline.sql,
 * 20260627_audits.sql). `interview_insight` and any other/unknown source
 * type have no project concept to inherit — resolving to null there is
 * CORRECT, not a bug: the caller falls through to the funnel's system
 * "Portfel" auto-anchor (§5.2.3) exactly as intended.
 *
 * Fail-soft by construction: any DB/schema hiccup returns null rather than
 * throwing, mirroring every other lookup in the zwornik funnel.
 */
import type { QueryResultRow } from 'pg';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface ProjectSourceDb {
  queryOne<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T | null>;
}

const defaultDb: ProjectSourceDb = {
  queryOne: (sql, params = []) => queryHelpers.queryOne(sql, params),
};

/** Fixed whitelist — never built from caller input, so no SQL-injection surface. */
const SOURCE_TABLE_BY_TYPE: Record<string, string> = {
  assessment: 'assessments',
  audit: 'audits',
};

/**
 * Resolve the `project_id` of the artifact identified by (sourceType, sourceId),
 * scoped to `orgId`. Returns null when the source type carries no project
 * concept, the row isn't found, the column is empty, or any lookup fails.
 */
export async function resolveProjectIdFromSource(
  orgId: string | undefined | null,
  sourceType: string | undefined | null,
  sourceId: string | undefined | null,
  db: ProjectSourceDb = defaultDb
): Promise<string | null> {
  if (!orgId || !sourceId) return null;
  const table =
    SOURCE_TABLE_BY_TYPE[
      String(sourceType || '')
        .trim()
        .toLowerCase()
    ];
  if (!table) return null; // e.g. interview_insight/manual/teresa_chat — nothing to inherit

  try {
    const row = await db.queryOne<{ project_id?: string | null }>(
      `SELECT project_id FROM ${table} WHERE id = ? AND organization_id = ? LIMIT 1`,
      [sourceId, orgId]
    );
    return row?.project_id ? String(row.project_id) : null;
  } catch (err) {
    logger.warn(
      `[sourceProjectResolver] lookup failed for ${sourceType}#${sourceId} (ignored): ${
        (err as Error)?.message || err
      }`
    );
    return null;
  }
}

export default { resolveProjectIdFromSource };
