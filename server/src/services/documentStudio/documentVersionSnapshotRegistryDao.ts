/**
 * Consultify Document Studio — Version Snapshot Registry DAO (W5 wave5 persistence).
 *
 * Replaces the in-memory `persistedSnapshotStore` Map in
 * `documentVersionSnapshotService.ts` with real Postgres reads/writes.
 * Backing table: `document_version_snapshots` (migration 776).
 *
 * Design contract (mirrors `documentEditorStateRegistryDao.ts`):
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `[]` on any error and does NOT throw — the service falls back to its
 *     in-process Map cache when persistence is unavailable.
 *   - Snapshots are append-only (ON CONFLICT DO NOTHING on insert).
 *   - Tenant safety: every query carries `organization_id` in WHERE.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { DocumentVersionSnapshot } from './documentStudioTypes.js';

interface SnapshotRow {
  version_id: string;
  artifact_id: string;
  organization_id: string;
  version_number: number | string;
  captured_at: string | Date;
  captured_by: string;
  label?: string | null;
  reason?: string | null;
  status_at_capture: string;
  schema_json: unknown;
  origin: string;
  content_hash?: string | null;
  parent_version_id?: string | null;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function rowToSnapshot(row: SnapshotRow): DocumentVersionSnapshot | null {
  const schema = parseJson<DocumentVersionSnapshot['schema'] | null>(row.schema_json, null);
  if (!schema) return null;
  return {
    versionId: row.version_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    versionNumber: Number(row.version_number),
    capturedAt:
      row.captured_at instanceof Date ? row.captured_at.toISOString() : String(row.captured_at),
    capturedBy: row.captured_by,
    label: row.label ?? undefined,
    reason: row.reason ?? undefined,
    statusAtCapture: row.status_at_capture as DocumentVersionSnapshot['statusAtCapture'],
    schema,
    origin: row.origin as DocumentVersionSnapshot['origin'],
    // 20260912_claude_c_document_version_lineage — both columns are
    // nullable (additive migration; pre-existing rows have neither), so
    // `null`/missing collapses to `undefined` on the domain object, never
    // an empty string that could be confused with a real hash/id.
    contentHash: row.content_hash ?? undefined,
    parentVersionId: row.parent_version_id ?? null,
  };
}

/**
 * Load all snapshots for a given organization. Used by the service's
 * cold-start hydration pass (once per org, lazy).
 */
export async function loadSnapshotsForOrg(
  organizationId: string
): Promise<DocumentVersionSnapshot[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<SnapshotRow>(
      `SELECT * FROM document_version_snapshots
         WHERE organization_id = $1
         ORDER BY artifact_id ASC, version_number ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToSnapshot).filter((s): s is DocumentVersionSnapshot => s !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] loadSnapshotsForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Point lookup by primary key, tenant-scoped. Added for MAT-010's
 * durability-confirmation poll (Codex final review, Blocker 2): after
 * `createDocumentVersionSnapshot`'s fire-and-forget `persistSnapshot` call,
 * the route polls THIS function to confirm the row actually landed in
 * Postgres before responding — closing the race where a process killed
 * between the HTTP response and the async write completing would lose data
 * the client was told was saved.
 */
export async function loadSnapshotById(
  versionId: string,
  organizationId: string
): Promise<DocumentVersionSnapshot | null> {
  if (!versionId || !organizationId) return null;
  try {
    const rows = await dbAll<SnapshotRow>(
      `SELECT * FROM document_version_snapshots
         WHERE version_id = $1 AND organization_id = $2
         LIMIT 1`,
      [versionId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToSnapshot(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] loadSnapshotById failed', {
      versionId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Append a snapshot. Idempotent — ON CONFLICT (version_id) DO NOTHING
 * so a duplicate write from a retry or race is safe.
 */
export async function persistSnapshot(snapshot: DocumentVersionSnapshot): Promise<{ ok: boolean }> {
  if (!snapshot?.versionId || !snapshot.artifactId || !snapshot.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_version_snapshots (
         version_id, artifact_id, organization_id, version_number, captured_at,
         captured_by, label, reason, status_at_capture, schema_json, origin,
         content_hash, parent_version_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
       ON CONFLICT (version_id) DO NOTHING`,
      [
        snapshot.versionId,
        snapshot.artifactId,
        snapshot.organizationId,
        snapshot.versionNumber,
        snapshot.capturedAt,
        snapshot.capturedBy,
        snapshot.label ?? null,
        snapshot.reason ?? null,
        snapshot.statusAtCapture,
        JSON.stringify(snapshot.schema),
        snapshot.origin,
        snapshot.contentHash ?? null,
        snapshot.parentVersionId ?? null,
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] persistSnapshot failed', {
      versionId: snapshot.versionId,
      organizationId: snapshot.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Delete a single snapshot row (retention pruning of `autosave`-origin
 * snapshots once an artifact exceeds the auto-snapshot cap). Best-effort:
 * on any DAO failure the in-process registry has already dropped the
 * snapshot from its cache/index, so a stale row simply survives in
 * Postgres until the next successful prune pass — never surfaced to the
 * caller as an error.
 */
export async function deleteSnapshot(
  versionId: string,
  organizationId: string
): Promise<{ ok: boolean }> {
  if (!versionId || !organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `DELETE FROM document_version_snapshots WHERE version_id = $1 AND organization_id = $2`,
      [versionId, organizationId]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] deleteSnapshot failed', {
      versionId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * MAT-MVP-DOC-001 (Lane C) — direct, always-cold read of the CURRENT latest
 * snapshot's identity for an artifact. Used both to INFER the CAS token a
 * checkpoint request did not supply explicitly, and to report `serverLatest`
 * on a checkpoint conflict. Deliberately bypasses the in-process cache
 * (`snapshotStore`) entirely — the whole point is to observe what Postgres
 * itself currently holds, not a possibly-stale process-local view.
 */
export async function loadLatestSnapshotMeta(
  artifactId: string,
  organizationId: string
): Promise<{ versionId: string; versionNumber: number } | null> {
  if (!artifactId || !organizationId) return null;
  try {
    const row = await dbAll<{ version_id: string; version_number: number | string }>(
      `SELECT version_id, version_number FROM document_version_snapshots
         WHERE artifact_id = $1 AND organization_id = $2
         ORDER BY version_number DESC
         LIMIT 1`,
      [artifactId, organizationId],
      { fallback: false }
    );
    if (row.length === 0) return null;
    return { versionId: row[0].version_id, versionNumber: Number(row[0].version_number) };
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] loadLatestSnapshotMeta failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface InsertCheckpointSnapshotCasParams {
  versionId: string;
  artifactId: string;
  organizationId: string;
  capturedAt: string;
  capturedBy: string;
  label?: string | null;
  reason?: string | null;
  statusAtCapture: string;
  /** Already `JSON.stringify`-ed by the caller. */
  schemaJson: string;
  origin: string;
  contentHash: string;
  /**
   * The CAS gate: the `versionId` of the snapshot the caller believes is
   * CURRENTLY latest for this artifact, or `null` when the caller believes
   * no snapshot exists yet. Whatever value is passed here — whether
   * explicitly supplied by an HTTP caller or INFERRED by the service via
   * `loadLatestSnapshotMeta` immediately before this call — is re-validated
   * ATOMICALLY inside this single statement against Postgres's own
   * then-current state, so a stale inferred read is still caught correctly.
   */
  expectedParentVersionId: string | null;
}

export type InsertCheckpointSnapshotCasResult =
  | { outcome: 'inserted'; versionNumber: number; parentVersionId: string | null }
  | { outcome: 'conflict'; serverLatest: { versionId: string; versionNumber: number } | null }
  | { outcome: 'error' };

/**
 * MAT-MVP-DOC-001 (Lane C) part (b) — the CAS half of "close the checkpoint
 * hole". `documentStudioService.createDocumentSnapshot` previously called
 * straight into the sync, unconditional `createDocumentVersionSnapshot`
 * (still used unmodified by autosave / the rollback-revert snapshot — see
 * that function's own doc comment for why its sync, fire-and-forget
 * contract is frozen), which computed `version_number` in JS from an
 * in-process read and had no guard against two concurrent callers doing the
 * same. This function is the checkpoint path's own, ANSWERED-BY-POSTGRES
 * insert: `version_number` and `parent_version_id` are computed inside the
 * SAME statement as the INSERT (a `LEFT JOIN` against the current latest
 * row), not in JS beforehand, and the whole statement is additionally
 * gated by a `WHERE` clause comparing that same latest row's `version_id`
 * against `expectedParentVersionId`.
 *
 * Two ways this produces "exactly one of two concurrent checkpoints wins":
 *
 *   1. Stale caller: `expectedParentVersionId` does not match the ACTUAL
 *      current latest at all (caller observed an old state). The `WHERE`
 *      clause filters the row out before the INSERT even runs — 0 rows
 *      returned, no error, straightforward 409.
 *   2. True race: two callers both observe the SAME (correct-at-the-time)
 *      latest and both pass the `WHERE` gate. Both then attempt to insert
 *      the same computed `version_number` (each is `latest.version_number +
 *      1` against the same latest row). The table's own
 *      `idx_dvs_artifact_version` UNIQUE index (`artifact_id,
 *      version_number`) — already used, unmodified, by `776_document_
 *      studio_wave5_persistence.sql` — forces one of the two physical
 *      INSERTs to wait and then fail with `23505 unique_violation` once the
 *      other commits. That is caught below and reported as the same
 *      conflict shape.
 *
 * This is a SINGLE statement — atomic by Postgres's own single-statement
 * guarantee, no explicit `BEGIN`/`COMMIT` needed — mirroring the existing,
 * already-proven `persistSchemaOverlay(..., expectedVersion)` conditional
 * UPDATE idiom in `documentEditorStateRegistryDao.ts` (manual-save CAS).
 */
export async function insertCheckpointSnapshotWithCas(
  params: InsertCheckpointSnapshotCasParams
): Promise<InsertCheckpointSnapshotCasResult> {
  try {
    const rows = await dbAll<{ version_number: number | string; parent_version_id: string | null }>(
      `INSERT INTO document_version_snapshots (
         version_id, artifact_id, organization_id, version_number, captured_at,
         captured_by, label, reason, status_at_capture, schema_json, origin,
         content_hash, parent_version_id
       )
       SELECT $1, $2, $3, COALESCE(cur.version_number, 0) + 1, $4, $5, $6, $7, $8, $9::jsonb, $10, $11,
              cur.version_id
       FROM (SELECT 1) AS one
       LEFT JOIN (
         SELECT version_id, version_number
         FROM document_version_snapshots
         WHERE artifact_id = $2 AND organization_id = $3
         ORDER BY version_number DESC
         LIMIT 1
       ) AS cur ON true
       WHERE
         ($12::text IS NULL AND cur.version_id IS NULL)
         OR ($12::text IS NOT NULL AND cur.version_id = $12::text)
       RETURNING version_number, parent_version_id`,
      [
        params.versionId,
        params.artifactId,
        params.organizationId,
        params.capturedAt,
        params.capturedBy,
        params.label ?? null,
        params.reason ?? null,
        params.statusAtCapture,
        params.schemaJson,
        params.origin,
        params.contentHash,
        params.expectedParentVersionId,
      ],
      { fallback: false }
    );
    if (rows.length === 0) {
      const serverLatest = await loadLatestSnapshotMeta(params.artifactId, params.organizationId);
      return { outcome: 'conflict', serverLatest };
    }
    return {
      outcome: 'inserted',
      versionNumber: Number(rows[0].version_number),
      parentVersionId: rows[0].parent_version_id ?? null,
    };
  } catch (err) {
    const pgCode = (err as { code?: string } | null)?.code;
    if (pgCode === '23505') {
      // Concurrent race, both passed the WHERE gate — see doc comment
      // scenario 2. Report the (now-updated) actual latest as the conflict.
      const serverLatest = await loadLatestSnapshotMeta(params.artifactId, params.organizationId);
      return { outcome: 'conflict', serverLatest };
    }
    logger.warn('[DocumentStudio][SnapshotDao] insertCheckpointSnapshotWithCas failed', {
      artifactId: params.artifactId,
      organizationId: params.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { outcome: 'error' };
  }
}

export interface DocumentVersionLineageEntry {
  versionId: string;
  versionNumber: number;
  parentVersionId: string | null;
  contentHash: string | null;
  capturedAt: string;
  capturedBy: string;
  origin: string;
  label: string | null;
}

/**
 * MAT-MVP-DOC-001 (Lane C) part (c) — "immutable-lineage readback". Always
 * a direct, COLD Postgres read (never the in-process cache) so a caller can
 * prove the chain survived a process restart, not just that the in-memory
 * registry currently agrees with itself. Tenant-scoped via the mandatory
 * `organization_id` predicate, same as every other reader in this file.
 * Ordered oldest → newest (`version_number ASC`) so the array's own index
 * order already reads as the chain; `parentVersionId` makes the chain
 * EXPLICIT rather than merely implied by that ordering.
 */
export async function loadVersionLineage(
  artifactId: string,
  organizationId: string
): Promise<DocumentVersionLineageEntry[]> {
  if (!artifactId || !organizationId) return [];
  try {
    const rows = await dbAll<{
      version_id: string;
      version_number: number | string;
      parent_version_id: string | null;
      content_hash: string | null;
      captured_at: string | Date;
      captured_by: string;
      origin: string;
      label: string | null;
    }>(
      `SELECT version_id, version_number, parent_version_id, content_hash, captured_at, captured_by, origin, label
         FROM document_version_snapshots
         WHERE artifact_id = $1 AND organization_id = $2
         ORDER BY version_number ASC`,
      [artifactId, organizationId],
      { fallback: false }
    );
    return rows.map((row) => ({
      versionId: row.version_id,
      versionNumber: Number(row.version_number),
      parentVersionId: row.parent_version_id ?? null,
      contentHash: row.content_hash ?? null,
      capturedAt: row.captured_at instanceof Date ? row.captured_at.toISOString() : String(row.captured_at),
      capturedBy: row.captured_by,
      origin: row.origin,
      label: row.label ?? null,
    }));
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] loadVersionLineage failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** @internal Test-only reset — best-effort DELETE of the snapshot table. */
export async function __resetSnapshotRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_version_snapshots', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
