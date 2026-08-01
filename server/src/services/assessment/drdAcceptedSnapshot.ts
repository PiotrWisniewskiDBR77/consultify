/**
 * ASM-07 — Accepted snapshot store for DRD quality review outputs.
 *
 * Append-only, immutable-once-written accepted output: a row is inserted
 * once per accept event and is NEVER updated afterwards. The only mutation
 * ever performed on an existing row is flipping `is_current` to false when a
 * newer snapshot for the same assessment is accepted — the content columns
 * (`snapshot_json`, `provenance_json`, `accepted_by`, `accepted_at`) of any
 * pre-existing row are never touched again once written.
 *
 * The partial unique index `idx_accepted_snapshots_current` on
 * `assessment_accepted_snapshots (assessment_id) WHERE is_current` guarantees
 * at most one current row per assessment, so the old current row must be
 * flipped to false BEFORE the new row is inserted.
 *
 * Do NOT add any update/patch/edit function to this file, and do NOT add any
 * function that writes to `snapshot_json` or `provenance_json` for an
 * existing row under any circumstance.
 */

import { v4 as uuidv4 } from 'uuid';
import * as queryHelpers from '../../utils/queryHelpers.js';

export interface SnapshotRecord {
  id: string;
  organizationId: string;
  assessmentId: string;
  reviewId: string;
  snapshot: unknown;
  provenance: unknown;
  acceptedBy: string;
  acceptedAt: string;
  isCurrent: boolean;
}

interface AcceptedSnapshotRow {
  id: string;
  organization_id: string;
  assessment_id: string;
  review_id: string;
  snapshot_json: string;
  provenance_json: string;
  accepted_by: string;
  accepted_at: string | Date;
  is_current: boolean;
}

/**
 * Small local re-implementation of the `parseJsonSafely` pattern used
 * elsewhere in this codebase (e.g. server/src/routes/v8/assessment.routes.ts).
 * Reimplemented here rather than imported so this file has no dependency on
 * that route file.
 */
function parseJsonSafely<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toSnapshotRecord(row: AcceptedSnapshotRow): SnapshotRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    reviewId: row.review_id,
    snapshot: parseJsonSafely(row.snapshot_json, {}),
    provenance: parseJsonSafely(row.provenance_json, {}),
    acceptedBy: row.accepted_by,
    acceptedAt:
      row.accepted_at instanceof Date ? (row.accepted_at as Date).toISOString() : String(row.accepted_at),
    isCurrent: Boolean(row.is_current),
  };
}

/**
 * Creates a new accepted snapshot for an assessment.
 *
 * Order of operations matters here (see partial unique index note above):
 *  1. Flip any existing current row for this assessment to is_current=false.
 *     This is the ONLY time an existing row is ever touched, and is_current
 *     is the ONLY column that ever changes on an existing row.
 *  2. Insert the new row as the current one.
 */
export async function createAcceptedSnapshot(params: {
  organizationId: string;
  assessmentId: string;
  reviewId: string;
  acceptedBy: string;
  snapshot: unknown;
  provenance: unknown;
}): Promise<SnapshotRecord> {
  const { organizationId, assessmentId, reviewId, acceptedBy, snapshot, provenance } = params;

  // Step 1: flip prior current row (if any) — no-op if none exists.
  await queryHelpers.queryRun(
    `UPDATE assessment_accepted_snapshots SET is_current = false WHERE organization_id = ? AND assessment_id = ? AND is_current = true`,
    [organizationId, assessmentId]
  );

  // Step 2: insert the new current row.
  const id = uuidv4();
  const acceptedAt = new Date().toISOString();
  const snapshotJson = JSON.stringify(snapshot);
  const provenanceJson = JSON.stringify(provenance);

  await queryHelpers.queryRun(
    `INSERT INTO assessment_accepted_snapshots (id, organization_id, assessment_id, review_id, snapshot_json, provenance_json, accepted_by, accepted_at, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)`,
    [id, organizationId, assessmentId, reviewId, snapshotJson, provenanceJson, acceptedBy, acceptedAt]
  );

  return {
    id,
    organizationId,
    assessmentId,
    reviewId,
    snapshot,
    provenance,
    acceptedBy,
    acceptedAt,
    isCurrent: true,
  };
}

/**
 * Returns the current accepted snapshot for an assessment, or null if none
 * exists yet.
 */
export async function getCurrentAcceptedSnapshot(params: {
  organizationId: string;
  assessmentId: string;
}): Promise<SnapshotRecord | null> {
  const row = await queryHelpers.queryOne<AcceptedSnapshotRow>(
    `SELECT * FROM assessment_accepted_snapshots WHERE organization_id = ? AND assessment_id = ? AND is_current = true LIMIT 1`,
    [params.organizationId, params.assessmentId]
  );

  if (!row) return null;
  return toSnapshotRecord(row);
}

/**
 * Returns the full accept-cycle history (current and superseded rows) for an
 * assessment, newest first. Not required for any caller yet — exposed so
 * immutability/provenance can be proven across multiple accept cycles if
 * ever needed.
 */
export async function listAcceptedSnapshotHistory(params: {
  organizationId: string;
  assessmentId: string;
}): Promise<SnapshotRecord[]> {
  const rows = await queryHelpers.queryAll<AcceptedSnapshotRow>(
    `SELECT * FROM assessment_accepted_snapshots WHERE organization_id = ? AND assessment_id = ? ORDER BY accepted_at DESC`,
    [params.organizationId, params.assessmentId]
  );

  return rows.map(toSnapshotRecord);
}
