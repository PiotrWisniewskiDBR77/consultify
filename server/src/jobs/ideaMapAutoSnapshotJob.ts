/**
 * Idea Map Auto-Snapshot Job (M06 F0.5)
 *
 * Periodically snapshots idea workspace maps (`my_idea_maps`) into the
 * canonical snapshot store (`my_idea_map_snapshots`) — the same table the
 * SnapshotHistory UI reads via GET /api/my-work/my-ideas/:id/map/snapshots.
 * Writes go through the shared service extracted from the manual endpoint
 * (server/src/services/ideaMapSnapshotService.ts) — no duplicated SQL.
 *
 * NOTE: docs referenced `my_idea_map_versions` ("auto-snapshot every 5 min"),
 * but that table was retired with zero runtime readers/writers
 * (server/migrations/901_drop_my_idea_map_versions.sql). This job targets the
 * live canon instead.
 *
 * Policy:
 * - Runs from Scheduler (cron) every N minutes
 *   (IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN, default 15).
 * - Snapshots ONLY maps changed since their latest snapshot
 *   (my_idea_maps.updated_at > MAX(my_idea_map_snapshots.created_at) for the
 *   same idea+user+org scope). Empty maps are skipped.
 * - Retention: keeps the newest IDEA_MAP_AUTO_SNAPSHOT_RETENTION (default 20)
 *   AUTO snapshots per map scope; older auto snapshots are pruned. Auto
 *   snapshots are recognized by the `auto:` label prefix — manual snapshots
 *   are never deleted.
 * - Best-effort: per-map try/catch, never throws out of the run loop.
 * - Never runs in tests: the Scheduler is not initialized under NODE_ENV=test,
 *   and the runner itself refuses test environments unless `force` is passed
 *   (used by unit tests).
 *
 * node-pg pitfalls handled (see finding_pg_bigint_jsonb_serialization):
 * - timestamps may arrive as Date objects or strings → toTime() normalizes;
 * - JSON columns may arrive as parsed objects (jsonb) or TEXT → parseMaybeJson.
 */

import {
  AUTO_SNAPSHOT_LABEL_PREFIX,
  createIdeaMapSnapshot,
  isAutoSnapshotLabel,
} from '../services/ideaMapSnapshotService.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { parseMaybeJson } from '../utils/pgFlags.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export const AUTO_SNAPSHOT_LABEL = `${AUTO_SNAPSHOT_LABEL_PREFIX}snapshot`;
export const DEFAULT_INTERVAL_MINUTES = 15;
export const DEFAULT_RETENTION = 20;
export const DEFAULT_BATCH_LIMIT = 200;

const clampInt = (v: unknown, def: number, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};

/** Interval in minutes (env IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN, default 15, clamp 1..1440). */
export function getAutoSnapshotIntervalMinutes(env: NodeJS.ProcessEnv = process.env): number {
  return clampInt(env.IDEA_MAP_AUTO_SNAPSHOT_INTERVAL_MIN, DEFAULT_INTERVAL_MINUTES, 1, 24 * 60);
}

/** Max auto snapshots kept per map scope (env IDEA_MAP_AUTO_SNAPSHOT_RETENTION, default 20, clamp 1..200). */
export function getAutoSnapshotRetention(env: NodeJS.ProcessEnv = process.env): number {
  return clampInt(env.IDEA_MAP_AUTO_SNAPSHOT_RETENTION, DEFAULT_RETENTION, 1, 200);
}

/** node-cron expression derived from the configured interval. */
export function autoSnapshotCronExpression(env: NodeJS.ProcessEnv = process.env): string {
  const minutes = getAutoSnapshotIntervalMinutes(env);
  if (minutes < 60) return `*/${minutes} * * * *`;
  const hours = clampInt(Math.round(minutes / 60), 1, 1, 23);
  return `0 */${hours} * * *`;
}

/** Normalize a timestamp that may be a Date (node-pg), ISO string, SQLite 'YYYY-MM-DD HH:MM:SS', or epoch number. */
const toTime = (v: unknown): number => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) {
    const direct = Date.parse(v);
    if (Number.isFinite(direct)) return direct;
    // SQLite 'YYYY-MM-DD HH:MM:SS' (no timezone) — treat as UTC.
    return Date.parse(v.trim().replace(' ', 'T') + 'Z');
  }
  return NaN;
};

export interface SnapshotCandidate {
  updatedAt: unknown;
  lastSnapshotAt: unknown;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Change-detection policy (pure, unit-tested):
 * - empty maps (0 nodes AND 0 edges) → never snapshot;
 * - no prior snapshot → snapshot;
 * - unparseable last-snapshot time → snapshot (fail towards preserving data;
 *   retention caps churn);
 * - unparseable map updated_at → skip (change cannot be proven);
 * - otherwise snapshot iff the map changed after the latest snapshot.
 */
export function shouldSnapshot(c: SnapshotCandidate): boolean {
  if (Number(c.nodeCount || 0) <= 0 && Number(c.edgeCount || 0) <= 0) return false;
  if (c.lastSnapshotAt == null) return true;
  const last = toTime(c.lastSnapshotAt);
  if (!Number.isFinite(last)) return true;
  const updated = toTime(c.updatedAt);
  if (!Number.isFinite(updated)) return false;
  return updated > last;
}

export interface RetentionSnapshotRow {
  id: string;
  label: unknown;
  createdAt: unknown;
}

/**
 * Retention policy (pure, unit-tested): given ALL snapshots of one map scope,
 * return ids of AUTO snapshots (label prefix `auto:`) beyond the newest
 * `keep`. Manual snapshots are never returned.
 */
export function selectSnapshotsToPrune(snapshots: RetentionSnapshotRow[], keep: number): string[] {
  const autos = snapshots
    .filter((s) => isAutoSnapshotLabel(s.label))
    .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  return autos.slice(Math.max(1, Math.trunc(keep))).map((s) => String(s.id));
}

export interface AutoSnapshotRunResult {
  scanned: number;
  snapshotted: number;
  skippedUnchanged: number;
  skippedEmpty: number;
  pruned: number;
  errors: number;
  disabledReason: string | null;
}

const emptyResult = (disabledReason: string | null = null): AutoSnapshotRunResult => ({
  scanned: 0,
  snapshotted: 0,
  skippedUnchanged: 0,
  skippedEmpty: 0,
  pruned: 0,
  errors: 0,
  disabledReason,
});

const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || !!process.env.VITEST;

let running = false;

export async function runIdeaMapAutoSnapshots(
  options: { limit?: number; retention?: number; force?: boolean } = {}
): Promise<AutoSnapshotRunResult> {
  if (!options.force && isTestEnv()) return emptyResult('test_env');
  if (process.env.DISABLE_IDEA_MAP_AUTO_SNAPSHOTS === 'true') return emptyResult('env_disabled');
  if (running) return emptyResult('already_running');
  running = true;
  try {
    return await runInner(options);
  } finally {
    running = false;
  }
}

async function runInner(options: {
  limit?: number;
  retention?: number;
}): Promise<AutoSnapshotRunResult> {
  const result = emptyResult();

  // Honest degradation: skip quietly (with a log) when the schema is not there.
  const snapCols = await getTableColumns('my_idea_map_snapshots');
  const mapCols = await getTableColumns('my_idea_maps');
  if (!snapCols || snapCols.size === 0 || !mapCols || mapCols.size === 0) {
    result.disabledReason = 'missing_tables';
    logger.warn('[IdeaMapAutoSnapshotJob] Required tables missing — skipping run');
    return result;
  }

  const limit = clampInt(options.limit, DEFAULT_BATCH_LIMIT, 1, 1000);
  const retention = clampInt(options.retention, getAutoSnapshotRetention(), 1, 200);

  const rows = await queryHelpers.queryAll<any>(
    `SELECT m.id,
            m.idea_id AS "ideaId",
            m.user_id AS "userId",
            m.organization_id AS "organizationId",
            m.nodes_json AS "nodesJson",
            m.edges_json AS "edgesJson",
            m.extensions_json AS "extensionsJson",
            m.updated_at AS "updatedAt",
            (SELECT MAX(s.created_at)
               FROM my_idea_map_snapshots s
              WHERE s.idea_id = m.idea_id
                AND s.user_id = m.user_id
                AND s.organization_id = m.organization_id) AS "lastSnapshotAt"
     FROM my_idea_maps m
     ORDER BY m.updated_at DESC
     LIMIT ?`,
    [limit]
  );

  result.scanned = rows?.length || 0;

  for (const r of rows || []) {
    try {
      const nodes = parseMaybeJson<unknown[]>(r.nodesJson, []);
      const edges = parseMaybeJson<unknown[]>(r.edgesJson, []);
      const extensions = parseMaybeJson<Record<string, unknown>>(r.extensionsJson, {});
      const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
      const edgeCount = Array.isArray(edges) ? edges.length : 0;

      const candidate: SnapshotCandidate = {
        updatedAt: r.updatedAt,
        lastSnapshotAt: r.lastSnapshotAt,
        nodeCount,
        edgeCount,
      };
      if (!shouldSnapshot(candidate)) {
        if (nodeCount <= 0 && edgeCount <= 0) result.skippedEmpty++;
        else result.skippedUnchanged++;
        continue;
      }

      const ideaId = String(r.ideaId);
      const userId = String(r.userId);
      const orgId = String(r.organizationId);

      await createIdeaMapSnapshot({
        ideaId,
        userId,
        organizationId: orgId,
        label: AUTO_SNAPSHOT_LABEL,
        nodes: Array.isArray(nodes) ? nodes : [],
        edges: Array.isArray(edges) ? edges : [],
        extensions: extensions && typeof extensions === 'object' ? extensions : null,
      });
      result.snapshotted++;

      // Retention — only for the map scope we just snapshotted.
      const retentionRows = await queryHelpers.queryAll<any>(
        `SELECT id, label, created_at AS "createdAt"
           FROM my_idea_map_snapshots
          WHERE idea_id = ? AND user_id = ? AND organization_id = ?
          ORDER BY created_at DESC
          LIMIT 500`,
        [ideaId, userId, orgId]
      );
      const toDelete = selectSnapshotsToPrune(
        (retentionRows || []).map((s: any) => ({
          id: String(s.id),
          label: s.label,
          createdAt: s.createdAt,
        })),
        retention
      );
      if (toDelete.length > 0) {
        const placeholders = toDelete.map(() => '?').join(', ');
        await queryHelpers.queryRun(
          `DELETE FROM my_idea_map_snapshots
            WHERE idea_id = ? AND user_id = ? AND organization_id = ? AND id IN (${placeholders})`,
          [ideaId, userId, orgId, ...toDelete]
        );
        result.pruned += toDelete.length;
      }
    } catch (e: any) {
      result.errors++;
      logger.error('[IdeaMapAutoSnapshotJob] Failed to snapshot map', {
        mapId: String(r?.id || ''),
        ideaId: String(r?.ideaId || ''),
        error: String(e?.message || e),
      });
    }
  }

  return result;
}

export default { runIdeaMapAutoSnapshots };
