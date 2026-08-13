/**
 * OKR-E007 — Set history read repository (OKR-F-024, D12-D14).
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.8/§5.
 *
 * D12/D14: every Set-scoped event (Set, Reflection, Review — and, by the
 * same convention E003/E004/E005 already established for their own child
 * events, Objective/KeyResult/CheckIn/Alignment) carries
 * `aggregate_type='okr_set'`/`aggregate_id=setId` — so a single query
 * against the shared `rvn_platform_events` (RN-G1) reconstructs the whole
 * Set-scoped audit trail. No `okr_vnext_events` table exists anywhere in
 * this program (D14 — that name is a doc-vs-platform naming drift, never a
 * real table). Merged, in application code, with `okr_vnext_set_versions`
 * (E002's `OKRMaterialChange`).
 *
 * Visibility: gated by the SAME check `getOkrSet` uses — if the caller
 * cannot see the Set, the result is an empty page, never a 403/leak of the
 * Set's existence (matches this repository file family's own established
 * "not found, not forbidden" posture).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { VISIBILITY_CTE_PARAM_COUNT, wrapWithVisibilityScope } from '../platform/visibilityScopedQuery.js';

import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import { toOkrSetVersion, type OkrSetVersionRow } from './okrSetTypes.js';

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

// ==========================================
// getOkrSetHistory
// ==========================================

export interface OkrSetHistoryEventEntry {
  kind: 'event';
  eventId: string;
  sequence: string;
  eventType: string;
  actorUserId: string | null;
  actorEffectiveRole: string;
  occurredAt: string;
  reason: string | null;
  payload: Record<string, unknown>;
}

export interface OkrSetHistoryMaterialChangeEntry {
  kind: 'material_change';
  versionId: string;
  versionNumber: number;
  fieldName: string;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

export type OkrSetHistoryEntry = OkrSetHistoryEventEntry | OkrSetHistoryMaterialChangeEntry;

export interface GetOkrSetHistoryParams {
  userId: string;
  organizationId: string;
  setId: string;
  /** Keyset pagination on `rvn_platform_events.sequence` — the LAST
   * sequence value seen on the prior page. `okr_vnext_set_versions`
   * entries (small enough per Set to not need their own pagination, per
   * design §4.8) are only included on the FIRST page (`cursor` omitted) to
   * avoid re-emitting them on every subsequent page — an explicit,
   * documented tradeoff, not an oversight. */
  cursor?: string | null;
  limit?: number;
}

export interface GetOkrSetHistoryResult {
  entries: OkrSetHistoryEntry[];
  nextCursor: string | null;
}

interface HistoryEventRow {
  event_id: string;
  sequence: string;
  event_type: string;
  actor_user_id: string | null;
  actor_effective_role: string;
  occurred_at: string;
  reason: string | null;
  payload: Record<string, unknown>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export async function getOkrSetHistory(params: GetOkrSetHistoryParams): Promise<GetOkrSetHistoryResult> {
  const { userId, organizationId, setId } = params;
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = params.cursor ?? null;

  // Visibility gate, up front — identical posture to `getOkrSet` (if you
  // cannot see the Set, you cannot see its history).
  const visibilityQuerySql = `
    SELECT s.set_id
      FROM okr_vnext_sets s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = s.set_id::text
     WHERE s.organization_id = $1
       AND s.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrappedVisibility = await wrapWithVisibilityScope(visibilityQuerySql, {
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });

  return withReadClient(async (client) => {
    const visibilityRows = await queryRows<{ set_id: string }>(client, wrappedVisibility.sql, [
      ...wrappedVisibility.values,
      setId,
    ]);
    if (visibilityRows.length === 0) {
      return { entries: [], nextCursor: null };
    }

    const eventValues: unknown[] = [organizationId, setId];
    let cursorClause = '';
    if (cursor) {
      eventValues.push(cursor);
      cursorClause = `AND sequence > $${eventValues.length}`;
    }
    eventValues.push(limit + 1);
    const limitParamIndex = eventValues.length;

    const eventRows = await queryRows<HistoryEventRow>(
      client,
      `SELECT event_id, sequence, event_type, actor_user_id, actor_effective_role, occurred_at, reason, payload
         FROM rvn_platform_events
        WHERE organization_id = $1 AND aggregate_type = '${OKR_SET_RESOURCE_TYPE}' AND aggregate_id = $2
          ${cursorClause}
        ORDER BY sequence ASC
        LIMIT $${limitParamIndex}`,
      eventValues
    );

    let nextCursor: string | null = null;
    let pageEventRows = eventRows;
    if (eventRows.length > limit) {
      pageEventRows = eventRows.slice(0, limit);
      nextCursor = pageEventRows[pageEventRows.length - 1]?.sequence ?? null;
    }

    const eventEntries: OkrSetHistoryEventEntry[] = pageEventRows.map((row) => ({
      kind: 'event',
      eventId: row.event_id,
      sequence: row.sequence,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      actorEffectiveRole: row.actor_effective_role,
      occurredAt: row.occurred_at,
      reason: row.reason,
      payload: row.payload ?? {},
    }));

    let materialChangeEntries: OkrSetHistoryMaterialChangeEntry[] = [];
    if (!cursor) {
      const versionRows = await queryRows<OkrSetVersionRow>(
        client,
        `SELECT * FROM okr_vnext_set_versions WHERE set_id = $1 AND organization_id = $2 ORDER BY version_number ASC`,
        [setId, organizationId]
      );
      materialChangeEntries = versionRows.map((row) => {
        const version = toOkrSetVersion(row);
        return {
          kind: 'material_change',
          versionId: version.versionId,
          versionNumber: version.versionNumber,
          fieldName: version.fieldName,
          beforeValue: version.beforeValue,
          afterValue: version.afterValue,
          reason: version.reason,
          requestedBy: version.requestedBy,
          requestedAt: version.requestedAt,
        };
      });
    }

    const entries: OkrSetHistoryEntry[] = [...eventEntries, ...materialChangeEntries].sort((a, b) => {
      const aTime = a.kind === 'event' ? a.occurredAt : a.requestedAt;
      const bTime = b.kind === 'event' ? b.occurredAt : b.requestedAt;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

    return { entries, nextCursor };
  });
}
