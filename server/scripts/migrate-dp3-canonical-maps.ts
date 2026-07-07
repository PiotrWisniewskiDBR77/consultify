/**
 * DP-3 T2 — DATA migration: per-user `my_idea_maps` copies → ONE canonical row.
 *
 * Context (Harvard/wdrozenie-100/_M06_DP3_MULTIPLAYER_PLAN_2026-07-04.md §1):
 *   Today `my_idea_maps` holds one row per (idea_id, user_id). DP-3 promotes a
 *   single canonical row per idea_id and gives every org member shared access.
 *   The T1 schema migration (20260705_dp3_shared_idea_maps.sql) already added
 *   is_canonical / last_editor_user_id / archived_from_user_id + the partial
 *   unique index uq_idea_maps_canonical (idea_id) WHERE is_canonical = TRUE.
 *
 *   BUT: is_canonical DEFAULTs to TRUE, so every legacy per-user row is
 *   is_canonical=TRUE — multiple rows per idea_id would violate that unique
 *   index. This script resolves the duplicates so exactly ONE row per idea_id
 *   is canonical, snapshotting the copies it demotes (zero data loss).
 *
 * Per idea_id (scoped inside its organization_id):
 *   1. Owner's copy (my_ideas.user_id) → is_canonical=TRUE, last_editor=owner.
 *   2. Owner has NO copy → promote the freshest copy (updated_at DESC, then
 *      version DESC) to canonical; last_editor = that row's user_id.
 *   3. Every OTHER (non-canonical) copy → snapshot to my_idea_map_snapshots
 *      (label "DP-3 pre-merge (autor: <userId>)", data_json = full graph
 *      {nodes, edges, extensions}, node_count/edge_count) and leave the row in
 *      place with is_canonical=FALSE (cleanup is a later release, plan §1.3).
 *   4. Bump the canonical row's version by +1 (open clients → 409 → rehydrate).
 *      archived_from_user_id stamped when we promoted a NON-owner copy.
 *
 * Idempotent: a second run is a no-op. Detection: an idea that already has an
 * is_canonical=TRUE row (and no more than one) is considered done and skipped —
 * we never re-snapshot and never re-bump version.
 *
 * Safety:
 *   - --dry-run is the DEFAULT. Nothing is written unless --execute is passed.
 *   - One transaction PER idea. A failure on one idea rolls back only that idea
 *     and is collected into an error report; the rest of the run continues.
 *   - node-pg gotchas (pgFlags.ts): JSONB comes back as an object, TEXT as a
 *     string — nodes_json/edges_json/extensions_json are TEXT here, parsed with
 *     parseMaybeJson. Never mix `?` and `$n` placeholders in one SQL string
 *     (PostgresDatabase.ts:377 translates `?` sequentially).
 *
 * DO NOT run against a real database (PROD/staging/trolley). Tests only cover
 * the logic (tests/migrations/dp3-idea-map-canonical.test.ts).
 *
 * Usage:
 *   # dry-run (default) — reports the plan, writes nothing:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." \
 *     npx tsx server/scripts/migrate-dp3-canonical-maps.ts
 *
 *   # execute:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." \
 *     npx tsx server/scripts/migrate-dp3-canonical-maps.ts --execute
 *
 *   # restrict to a single organization:
 *   MIGRATE_ORG_ID=<organization id> npx tsx ... --execute
 */
import crypto from 'crypto';

import dotenv from 'dotenv';

import type { IDatabase } from '../src/database/IDatabase.js';
import { parseMaybeJson } from '../src/utils/pgFlags.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single `my_idea_maps` row as we read it back for planning. */
export interface MapRow {
  id: string;
  idea_id: string;
  user_id: string;
  organization_id: string;
  nodes_json: unknown;
  edges_json: unknown;
  extensions_json?: unknown;
  version: unknown;
  updated_at: unknown;
  is_canonical?: unknown;
}

export interface IdeaGroup {
  ideaId: string;
  organizationId: string;
  ownerUserId: string | null; // my_ideas.user_id (may be null if idea row missing)
  rows: MapRow[];
}

export type IdeaAction =
  | { kind: 'skip-already-canonical'; ideaId: string }
  | { kind: 'skip-no-rows'; ideaId: string }
  | {
      kind: 'migrate';
      ideaId: string;
      organizationId: string;
      canonicalRowId: string;
      canonicalUserId: string;
      /** owner copy promoted (false = promoted a non-owner copy) */
      promotedOwner: boolean;
      newVersion: number;
      /** rows to demote + snapshot (row ids, with their author user_id) */
      snapshots: { rowId: string; userId: string; nodeCount: number; edgeCount: number }[];
    };

export interface MigrationReport {
  dryRun: boolean;
  ideasScanned: number;
  ideasMigrated: number;
  ideasSkippedAlreadyCanonical: number;
  ideasSkippedNoRows: number;
  snapshotsCreated: number;
  rowsDemoted: number;
  errors: { ideaId: string; message: string }[];
}

// ── Pure planning logic (unit-testable, no DB) ──────────────────────────────────

/** Coerce PG bigint/string version into a finite number (default 1). */
export function coerceVersion(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Guard null/undefined/'' explicitly: Number(null)===0 and Number('')===0
  // would otherwise silently coerce a missing version to 0 instead of the
  // default 1 (and a +1 bump off 0 would collide with fresh rows).
  if (v == null || v === '') return 1;
  const n = Number(v);
  return Number.isFinite(n) ? n : 1;
}

/** Milliseconds for updated_at sort; unparseable → 0 (oldest). */
function updatedAtMs(v: unknown): number {
  if (v == null) return 0;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Given all `my_idea_maps` rows for one idea (+ its owner), decide what to do.
 *
 * Idempotency rule: if EXACTLY one row is already is_canonical=TRUE we treat the
 * idea as already migrated and skip (no re-snapshot, no version bump). If ZERO
 * or MORE-THAN-ONE rows are canonical, we (re)compute the canonical winner and
 * demote the rest — this is the legacy state (every row defaults canonical) as
 * well as any half-applied run.
 */
export function planIdea(group: IdeaGroup): IdeaAction {
  const { ideaId, organizationId, ownerUserId, rows } = group;

  if (!rows || rows.length === 0) {
    return { kind: 'skip-no-rows', ideaId };
  }

  const canonicalRows = rows.filter((r) => isCanonicalFlag(r.is_canonical));
  if (canonicalRows.length === 1) {
    // Already migrated — leave untouched.
    return { kind: 'skip-already-canonical', ideaId };
  }

  // Choose the winner:
  //   1. owner's copy if present, else
  //   2. freshest copy (updated_at DESC, tie-break version DESC).
  let winner: MapRow | undefined;
  let promotedOwner = false;

  if (ownerUserId) {
    winner = rows.find((r) => r.user_id === ownerUserId);
    if (winner) promotedOwner = true;
  }

  if (!winner) {
    winner = [...rows].sort((a, b) => {
      const ta = updatedAtMs(a.updated_at);
      const tb = updatedAtMs(b.updated_at);
      if (tb !== ta) return tb - ta; // newest first
      const va = coerceVersion(a.version);
      const vb = coerceVersion(b.version);
      if (vb !== va) return vb - va; // higher version first
      // Final deterministic tie-break on id so runs are stable.
      return String(a.id).localeCompare(String(b.id));
    })[0];
  }

  const canonicalRow = winner!;
  const newVersion = coerceVersion(canonicalRow.version) + 1;

  const snapshots = rows
    .filter((r) => r.id !== canonicalRow.id)
    .map((r) => {
      const nodes = parseMaybeJson<unknown[]>(r.nodes_json, []);
      const edges = parseMaybeJson<unknown[]>(r.edges_json, []);
      return {
        rowId: r.id,
        userId: r.user_id,
        nodeCount: Array.isArray(nodes) ? nodes.length : 0,
        edgeCount: Array.isArray(edges) ? edges.length : 0,
      };
    });

  return {
    kind: 'migrate',
    ideaId,
    organizationId,
    canonicalRowId: canonicalRow.id,
    canonicalUserId: canonicalRow.user_id,
    promotedOwner,
    newVersion,
    snapshots,
  };
}

/** node-pg may return BOOLEAN as boolean, or 't'/'f'/1/0 depending on driver. */
export function isCanonicalFlag(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === 'number') return v === 1;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 't' || s === '1';
}

/** Build the snapshot data_json ({nodes, edges, extensions}) for a demoted row. */
export function buildSnapshotDataJson(row: MapRow): string {
  const nodes = parseMaybeJson<unknown[]>(row.nodes_json, []);
  const edges = parseMaybeJson<unknown[]>(row.edges_json, []);
  const extensions = parseMaybeJson<Record<string, unknown>>(row.extensions_json, {});
  return JSON.stringify({
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
    extensions: extensions && typeof extensions === 'object' ? extensions : {},
  });
}

// ── DB execution ───────────────────────────────────────────────────────────────

/** Loads every my_idea_maps row for the given orgs, grouped by idea_id. */
export async function loadIdeaGroups(
  db: IDatabase,
  opts: { orgId?: string | null; hasExtensions: boolean }
): Promise<IdeaGroup[]> {
  const extSelect = opts.hasExtensions ? ', m.extensions_json' : '';
  const params: unknown[] = [];
  let where = '';
  if (opts.orgId) {
    where = 'WHERE m.organization_id = ?';
    params.push(opts.orgId);
  }

  const rows = await db.all<MapRow & { owner_user_id: string | null }>(
    `SELECT m.id, m.idea_id, m.user_id, m.organization_id, m.nodes_json, m.edges_json,
            m.version, m.updated_at, m.is_canonical${extSelect},
            i.user_id AS owner_user_id
       FROM my_idea_maps m
       LEFT JOIN my_ideas i ON i.id = m.idea_id
       ${where}
       ORDER BY m.idea_id ASC`,
    params
  );

  const byIdea = new Map<string, IdeaGroup>();
  for (const r of rows) {
    let g = byIdea.get(r.idea_id);
    if (!g) {
      g = {
        ideaId: r.idea_id,
        organizationId: r.organization_id,
        ownerUserId: r.owner_user_id ?? null,
        rows: [],
      };
      byIdea.set(r.idea_id, g);
    }
    // First-seen owner wins; all rows for an idea share the same idea owner.
    if (g.ownerUserId == null && r.owner_user_id != null) g.ownerUserId = r.owner_user_id;
    g.rows.push(r);
  }
  return [...byIdea.values()];
}

/** Applies one idea's migration inside its own transaction. */
async function executeIdea(
  db: IDatabase,
  group: IdeaGroup,
  action: Extract<IdeaAction, { kind: 'migrate' }>,
  isPostgres: boolean
): Promise<void> {
  const rowsById = new Map(group.rows.map((r) => [r.id, r]));

  await db.run(isPostgres ? 'BEGIN' : 'BEGIN IMMEDIATE');
  try {
    // 1. Demote every non-canonical copy to is_canonical=FALSE FIRST, so the
    //    partial unique index never sees two canonical rows mid-transaction.
    for (const snap of action.snapshots) {
      await db.run(
        `UPDATE my_idea_maps SET is_canonical = FALSE WHERE id = ?`,
        [snap.rowId]
      );
    }

    // 2. Snapshot each demoted copy to my_idea_map_snapshots (zero-loss).
    for (const snap of action.snapshots) {
      const src = rowsById.get(snap.rowId)!;
      const snapshotId = crypto.randomUUID();
      await db.run(
        `INSERT INTO my_idea_map_snapshots
           (id, idea_id, user_id, organization_id, label, node_count, edge_count, data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${isPostgres ? 'NOW()' : "datetime('now')"})`,
        [
          snapshotId,
          action.ideaId,
          snap.userId,
          action.organizationId,
          `DP-3 pre-merge (autor: ${snap.userId})`,
          snap.nodeCount,
          snap.edgeCount,
          buildSnapshotDataJson(src),
        ]
      );
    }

    // 3. Promote the winner: is_canonical=TRUE, stamp last_editor, bump version,
    //    record archived_from_user_id when we promoted a NON-owner copy.
    if (action.promotedOwner) {
      await db.run(
        `UPDATE my_idea_maps
            SET is_canonical = TRUE,
                last_editor_user_id = ?,
                version = ?
          WHERE id = ?`,
        [action.canonicalUserId, action.newVersion, action.canonicalRowId]
      );
    } else {
      await db.run(
        `UPDATE my_idea_maps
            SET is_canonical = TRUE,
                last_editor_user_id = ?,
                archived_from_user_id = ?,
                version = ?
          WHERE id = ?`,
        [action.canonicalUserId, action.canonicalUserId, action.newVersion, action.canonicalRowId]
      );
    }

    await db.run('COMMIT');
  } catch (e) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('[dp3-migrate] ROLLBACK failed', { ideaId: group.ideaId, rollbackErr });
    }
    throw e;
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────────

export interface RunOptions {
  dryRun: boolean;
  orgId?: string | null;
}

/**
 * Runs the migration against `db`. Pure-ish: takes an injected IDatabase so the
 * test suite can drive it with an in-memory stub. Returns a full report.
 */
export async function runMigration(
  db: IDatabase,
  opts: RunOptions,
  helpers: {
    hasColumn: (table: string, column: string) => Promise<boolean>;
    isPostgres: boolean;
  }
): Promise<MigrationReport> {
  const report: MigrationReport = {
    dryRun: opts.dryRun,
    ideasScanned: 0,
    ideasMigrated: 0,
    ideasSkippedAlreadyCanonical: 0,
    ideasSkippedNoRows: 0,
    snapshotsCreated: 0,
    rowsDemoted: 0,
    errors: [],
  };

  // Guard: the T1 schema migration must have run first.
  const hasCanonical = await helpers.hasColumn('my_idea_maps', 'is_canonical');
  if (!hasCanonical) {
    throw new Error(
      '[dp3-migrate] my_idea_maps.is_canonical column missing — run migration 20260705_dp3_shared_idea_maps.sql (T1) first.'
    );
  }
  const hasExtensions = await helpers.hasColumn('my_idea_maps', 'extensions_json');

  const groups = await loadIdeaGroups(db, { orgId: opts.orgId, hasExtensions });
  report.ideasScanned = groups.length;

  for (const group of groups) {
    const action = planIdea(group);

    if (action.kind === 'skip-already-canonical') {
      report.ideasSkippedAlreadyCanonical++;
      continue;
    }
    if (action.kind === 'skip-no-rows') {
      report.ideasSkippedNoRows++;
      continue;
    }

    // action.kind === 'migrate'
    logger.info('[dp3-migrate] plan', {
      ideaId: action.ideaId,
      canonicalUserId: action.canonicalUserId,
      promotedOwner: action.promotedOwner,
      newVersion: action.newVersion,
      demoteCount: action.snapshots.length,
      dryRun: opts.dryRun,
    });

    if (opts.dryRun) {
      report.ideasMigrated++;
      report.snapshotsCreated += action.snapshots.length;
      report.rowsDemoted += action.snapshots.length;
      continue;
    }

    try {
      await executeIdea(db, group, action, helpers.isPostgres);
      report.ideasMigrated++;
      report.snapshotsCreated += action.snapshots.length;
      report.rowsDemoted += action.snapshots.length;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report.errors.push({ ideaId: action.ideaId, message });
      logger.error('[dp3-migrate] idea failed (rolled back, continuing)', {
        ideaId: action.ideaId,
        message,
      });
    }
  }

  return report;
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const execute = argv.includes('--execute');
  const dryRun = !execute; // dry-run is the DEFAULT
  const orgId = (process.env.MIGRATE_ORG_ID || '').trim() || null;

  process.env.DB_TYPE = process.env.DB_TYPE || 'postgres';

  logger.info('[dp3-migrate] start', {
    mode: dryRun ? 'DRY-RUN (default; pass --execute to write)' : 'EXECUTE',
    orgId: orgId ?? '(all orgs)',
  });

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const { getTableColumns } = await import('../src/utils/dbSchema.js');

  const db = await getDatabaseAsync();
  // Same convention as server/scripts/migrate.ts:481 — sqliteAsyncAdapter has no
  // getDatabaseType export on this base; DATABASE_URL presence implies postgres.
  const isPostgres =
    (process.env.DB_TYPE || '').toLowerCase() === 'postgres' || Boolean(process.env.DATABASE_URL);

  const hasColumn = async (table: string, column: string) => {
    const cols = await getTableColumns(table);
    return cols.has(column);
  };

  const report = await runMigration(db, { dryRun, orgId }, { hasColumn, isPostgres });

  logger.info('[dp3-migrate] DONE', report as unknown as Record<string, unknown>);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));

  if (report.errors.length > 0) {
    logger.error('[dp3-migrate] completed WITH errors', { count: report.errors.length });
    process.exitCode = 1;
  }
}

// Only auto-run when invoked directly (not when imported by tests).
const isMain = (() => {
  try {
    return (
      typeof process !== 'undefined' &&
      Array.isArray(process.argv) &&
      /migrate-dp3-canonical-maps\.(ts|js)$/.test(process.argv[1] || '')
    );
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((e) => {
    logger.error('[dp3-migrate] FATAL', e);
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}
