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
    return rows
      .map(rowToSnapshot)
      .filter((s): s is DocumentVersionSnapshot => s !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][SnapshotDao] loadSnapshotsForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Append a snapshot. Idempotent — ON CONFLICT (version_id) DO NOTHING
 * so a duplicate write from a retry or race is safe.
 */
export async function persistSnapshot(
  snapshot: DocumentVersionSnapshot
): Promise<{ ok: boolean }> {
  if (!snapshot?.versionId || !snapshot.artifactId || !snapshot.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_version_snapshots (
         version_id, artifact_id, organization_id, version_number, captured_at,
         captured_by, label, reason, status_at_capture, schema_json, origin
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
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

/** @internal Test-only reset — best-effort DELETE of the snapshot table. */
export async function __resetSnapshotRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_version_snapshots', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
