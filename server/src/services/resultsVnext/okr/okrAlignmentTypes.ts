/**
 * OKR-E005 — Alignment row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §A.
 * Schema: server/migrations/20260825_rvn_okr_alignment.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `okrObjectiveTypes.ts`/
 * `okrSetTypes.ts`.
 */

export const OKR_ALIGNMENT_RELATIONS = ['contributes_to'] as const;
export type OkrAlignmentRelation = (typeof OKR_ALIGNMENT_RELATIONS)[number];

export const OKR_ALIGNMENT_STATUSES = ['proposed', 'accepted', 'rejected', 'removed'] as const;
export type OkrAlignmentStatus = (typeof OKR_ALIGNMENT_STATUSES)[number];

// ==========================================
// okr_vnext_alignments
// ==========================================

export interface OkrAlignmentRow {
  alignment_id: string;
  organization_id: string;
  source_objective_id: string;
  target_objective_id: string;
  relation: OkrAlignmentRelation;
  rationale: string | null;
  status: OkrAlignmentStatus;
  source_cycle_id: string;
  target_cycle_id: string;
  proposed_by: string;
  proposed_at: string;
  responded_by: string | null;
  responded_at: string | null;
  response_reason: string | null;
  removed_by: string | null;
  removed_at: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
}

export interface OkrAlignment {
  alignmentId: string;
  organizationId: string;
  sourceObjectiveId: string;
  targetObjectiveId: string;
  relation: OkrAlignmentRelation;
  rationale: string | null;
  status: OkrAlignmentStatus;
  sourceCycleId: string;
  targetCycleId: string;
  proposedBy: string;
  proposedAt: string;
  respondedBy: string | null;
  respondedAt: string | null;
  responseReason: string | null;
  removedBy: string | null;
  removedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toOkrAlignment(row: OkrAlignmentRow): OkrAlignment {
  return {
    alignmentId: row.alignment_id,
    organizationId: row.organization_id,
    sourceObjectiveId: row.source_objective_id,
    targetObjectiveId: row.target_objective_id,
    relation: row.relation,
    rationale: row.rationale,
    status: row.status,
    sourceCycleId: row.source_cycle_id,
    targetCycleId: row.target_cycle_id,
    proposedBy: row.proposed_by,
    proposedAt: row.proposed_at,
    respondedBy: row.responded_by,
    respondedAt: row.responded_at,
    responseReason: row.response_reason,
    removedBy: row.removed_by,
    removedAt: row.removed_at,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
