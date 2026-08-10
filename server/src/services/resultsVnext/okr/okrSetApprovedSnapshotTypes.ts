/**
 * OKR-E002 — `OKRApprovedSnapshot` types (design §4.5/§5, D5/D8).
 *
 * Schema: server/migrations/20260823_rvn_okr_set.sql.
 *
 * Same `*Row` (snake_case, 1:1 with DB columns) / DTO (camelCase) split
 * every other file in this package uses — direct structural precedent
 * `roiApprovalSnapshotTypes.ts`. `OkrSetApprovalSnapshotPayload` is the
 * frozen JSONB shape stored in `snapshot_payload` at INSERT time
 * (`approveOkrSet`, okrSetCommands.ts) — never recomputed, `content_hash`
 * is computed once from exactly this shape via `computeStateHash` (fixed
 * key order).
 */
import type { OkrSet } from './okrSetTypes.js';

// ==========================================
// okr_vnext_approved_snapshots
// ==========================================

export interface OkrSetApprovedSnapshotRow {
  snapshot_id: string;
  set_id: string;
  organization_id: string;
  sequence_number: number;
  approved_by: string;
  approved_at: string;
  content_hash: string;
  snapshot_payload: OkrSetApprovalSnapshotPayload;
  created_at: string;
}

/**
 * D8: `objectives: []` — Objectives/KRs do not exist until OKR-E003. An
 * honest, structurally-present-but-empty array beats fabricating content
 * that didn't exist at approval time. Exported so OKR-E003 can extend this
 * shape (and `buildOkrSetApprovalSnapshotPayload`) without redesigning the
 * envelope.
 */
export interface OkrSetApprovalSnapshotPayload {
  set: OkrSet;
  objectives: unknown[];
}

export interface OkrSetApprovedSnapshot {
  snapshotId: string;
  setId: string;
  sequenceNumber: number;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
  payload: OkrSetApprovalSnapshotPayload;
  createdAt: string;
}

export interface OkrSetApprovedSnapshotSummary {
  snapshotId: string;
  setId: string;
  sequenceNumber: number;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
}

export function toOkrSetApprovedSnapshot(row: OkrSetApprovedSnapshotRow): OkrSetApprovedSnapshot {
  return {
    snapshotId: row.snapshot_id,
    setId: row.set_id,
    sequenceNumber: row.sequence_number,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    contentHash: row.content_hash,
    payload: row.snapshot_payload,
    createdAt: row.created_at,
  };
}

export function toOkrSetApprovedSnapshotSummary(row: OkrSetApprovedSnapshotRow): OkrSetApprovedSnapshotSummary {
  return {
    snapshotId: row.snapshot_id,
    setId: row.set_id,
    sequenceNumber: row.sequence_number,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    contentHash: row.content_hash,
  };
}
