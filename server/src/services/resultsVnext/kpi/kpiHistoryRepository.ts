/** Day 17 K.2 — immutable, keyset-paginated KPI event history. */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

export type KpiHistoryKind =
  | 'LIFECYCLE'
  | 'DEFINITION_VERSION'
  | 'MEASUREMENT'
  | 'MEASUREMENT_CORRECTION'
  | 'VISIBILITY';
export interface KpiHistoryEntry {
  entryId: string;
  occurredAt: string;
  kind: KpiHistoryKind;
  summaryCode: string;
  actorUserId: string | null;
  sourceVersion: number;
  references: Record<string, string>;
}
export interface KpiHistoryResult {
  found: boolean;
  entries: KpiHistoryEntry[];
  nextCursor: string | null;
}
interface EventRow extends QueryResultRow {
  event_id: string;
  sequence: string;
  event_type: string;
  occurred_at: string;
  actor_user_id: string | null;
  resulting_version: number;
  payload: Record<string, unknown> | null;
}

function kindFor(eventType: string): KpiHistoryKind | null {
  if (['kpi.activated', 'kpi.suspended', 'kpi.archived'].includes(eventType)) return 'LIFECYCLE';
  if (eventType.startsWith('kpi.definition_')) return 'DEFINITION_VERSION';
  if (eventType === 'kpi.measurement_corrected') return 'MEASUREMENT_CORRECTION';
  if (eventType.startsWith('kpi.measurement_')) return 'MEASUREMENT';
  if (eventType.startsWith('kpi.visibility_')) return 'VISIBILITY';
  return null;
}
function referencesFor(payload: Record<string, unknown> | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ['definitionVersionId', 'measurementId', 'supersededMeasurementId']) {
    const value = payload?.[key];
    if (typeof value === 'string' && value) result[key] = value;
  }
  return result;
}
async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function getKpiHistory(params: {
  userId: string;
  organizationId: string;
  kpiId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<KpiHistoryResult> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
  const visible = await wrapWithVisibilityScope(
    `SELECT kd.kpi_id FROM rvn_kpi_definitions kd INNER JOIN rvn_visible_resources vr ON vr.resource_type='kpi' AND vr.resource_id=kd.kpi_id::text WHERE kd.organization_id=$1 AND kd.kpi_id=$${VISIBILITY_CTE_PARAM_COUNT + 1}`,
    { userId: params.userId, organizationId: params.organizationId, resourceType: 'kpi' }
  );
  return withClient(async (client) => {
    const gate = await client.query(visible.sql, [...visible.values, params.kpiId]);
    if (gate.rowCount === 0) return { found: false, entries: [], nextCursor: null };
    const values: unknown[] = [params.organizationId, params.kpiId];
    let cursorSql = '';
    if (params.cursor) {
      values.push(params.cursor);
      cursorSql = `AND sequence > $${values.length}::bigint`;
    }
    values.push(limit + 1);
    const rows = (
      await client.query<EventRow>(
        `SELECT event_id, sequence::text, event_type, occurred_at, actor_user_id, resulting_version, payload FROM rvn_platform_events WHERE organization_id=$1 AND aggregate_type='kpi' AND aggregate_id=$2 ${cursorSql} ORDER BY sequence ASC LIMIT $${values.length}`,
        values
      )
    ).rows;
    const page = rows.slice(0, limit);
    const entries = page.flatMap<KpiHistoryEntry>((row) => {
      const kind = kindFor(row.event_type);
      return kind
        ? [
            {
              entryId: row.event_id,
              occurredAt: new Date(row.occurred_at).toISOString(),
              kind,
              summaryCode: row.event_type.replaceAll('.', '_').toUpperCase(),
              actorUserId: row.actor_user_id,
              sourceVersion: row.resulting_version,
              references: referencesFor(row.payload),
            },
          ]
        : [];
    });
    return {
      found: true,
      entries,
      nextCursor: rows.length > limit ? (page.at(-1)?.sequence ?? null) : null,
    };
  });
}
