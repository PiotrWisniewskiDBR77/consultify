/**
 * OKR-E002 — Set row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §3.
 * Schema: server/migrations/20260823_rvn_okr_set.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `okrProgramTypes.ts`/
 * `okrCycleTypes.ts`.
 */

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const OKR_SET_SCOPE_TYPES = ['company', 'business_unit', 'team', 'individual'] as const;
export type OkrSetScopeType = (typeof OKR_SET_SCOPE_TYPES)[number];

/** Full lifecycle forward-declared (plan §4.4). `'not_required'`/`'required'`
 * reserved with zero E002 code path (D2). `'review'`/`'closed'` reserved for
 * OKR-E004/E007 — no E002 transition reaches them. */
export const OKR_SET_STATUSES = [
  'not_required',
  'required',
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'active',
  'review',
  'closed',
  'cancelled',
] as const;
export type OkrSetStatus = (typeof OKR_SET_STATUSES)[number];

export const OKR_SET_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrSetConfidence = (typeof OKR_SET_CONFIDENCE_VALUES)[number];

export const OKR_SET_ATTENTION_STATES = ['none', 'watch', 'action_required', 'escalated'] as const;
export type OkrSetAttentionState = (typeof OKR_SET_ATTENTION_STATES)[number];

// ==========================================
// okr_vnext_sets
// ==========================================

export interface OkrSetRow {
  set_id: string;
  organization_id: string;
  program_id: string;
  cycle_id: string;
  scope_type: OkrSetScopeType;
  scope_id: string;
  owner_user_id: string;
  reviewer_user_id: string | null;
  title: string;
  status: OkrSetStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  changes_requested_by: string | null;
  changes_requested_at: string | null;
  changes_requested_reason: string | null;
  current_version: number;
  approved_version: number | null;
  latest_approved_snapshot_id: string | null;
  overall_progress: string | null;
  overall_confidence: OkrSetConfidence | null;
  attention_state: OkrSetAttentionState;
  last_checkin_at: string | null;
  next_checkin_due_at: string | null;
  /** OKR-E007 (D15): lineage pointer to the closed source Set this one was
   * carried forward from (`carryForwardOkrSet`) — NULL for every Set
   * created any other way. Additive column, reserved by this epic's own
   * migration. */
  carried_from_set_id: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OkrSet {
  setId: string;
  organizationId: string;
  programId: string;
  cycleId: string;
  scopeType: OkrSetScopeType;
  scopeId: string;
  ownerUserId: string;
  reviewerUserId: string | null;
  title: string;
  status: OkrSetStatus;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  changesRequestedBy: string | null;
  changesRequestedAt: string | null;
  changesRequestedReason: string | null;
  currentVersion: number;
  approvedVersion: number | null;
  latestApprovedSnapshotId: string | null;
  /** Reserved for OKR-E003/E004 rollups — NOT populated, NOT read, by any
   * E002 command (design §3). */
  overallProgress: string | null;
  overallConfidence: OkrSetConfidence | null;
  attentionState: OkrSetAttentionState;
  lastCheckinAt: string | null;
  nextCheckinDueAt: string | null;
  carriedFromSetId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toOkrSet(row: OkrSetRow): OkrSet {
  return {
    setId: row.set_id,
    organizationId: row.organization_id,
    programId: row.program_id,
    cycleId: row.cycle_id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    ownerUserId: row.owner_user_id,
    reviewerUserId: row.reviewer_user_id,
    title: row.title,
    status: row.status,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    changesRequestedBy: row.changes_requested_by,
    changesRequestedAt: row.changes_requested_at,
    changesRequestedReason: row.changes_requested_reason,
    currentVersion: row.current_version,
    approvedVersion: row.approved_version,
    latestApprovedSnapshotId: row.latest_approved_snapshot_id,
    overallProgress: row.overall_progress,
    overallConfidence: row.overall_confidence,
    attentionState: row.attention_state,
    lastCheckinAt: row.last_checkin_at,
    nextCheckinDueAt: row.next_checkin_due_at,
    carriedFromSetId: row.carried_from_set_id,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// okr_vnext_set_versions — OKRMaterialChange (design §4.8)
// ==========================================

export const OKR_SET_VERSION_FIELD_NAMES = ['title', 'owner_user_id', 'reviewer_user_id'] as const;
export type OkrSetVersionFieldName = (typeof OKR_SET_VERSION_FIELD_NAMES)[number];

export const OKR_SET_VERSION_RECOMMIT_STATUSES = ['pending', 'recommitted', 'waived'] as const;
export type OkrSetVersionRecommitStatus = (typeof OKR_SET_VERSION_RECOMMIT_STATUSES)[number];

export interface OkrSetVersionRow {
  version_id: string;
  set_id: string;
  organization_id: string;
  version_number: number;
  field_name: OkrSetVersionFieldName;
  before_value: string | null;
  after_value: string | null;
  reason: string;
  requested_by: string;
  requested_at: string;
  /** Reserved (plan §4.8, D17) — no E002 command ever writes these; the
   * recommit workflow is unbuilt and unowned. */
  reviewer_user_id: string | null;
  recommit_status: OkrSetVersionRecommitStatus | null;
  recommit_by: string | null;
  recommit_at: string | null;
  created_at: string;
}

export interface OkrSetVersion {
  versionId: string;
  setId: string;
  organizationId: string;
  versionNumber: number;
  fieldName: OkrSetVersionFieldName;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  reviewerUserId: string | null;
  recommitStatus: OkrSetVersionRecommitStatus | null;
  recommitBy: string | null;
  recommitAt: string | null;
  createdAt: string;
}

export function toOkrSetVersion(row: OkrSetVersionRow): OkrSetVersion {
  return {
    versionId: row.version_id,
    setId: row.set_id,
    organizationId: row.organization_id,
    versionNumber: row.version_number,
    fieldName: row.field_name,
    beforeValue: row.before_value,
    afterValue: row.after_value,
    reason: row.reason,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewerUserId: row.reviewer_user_id,
    recommitStatus: row.recommit_status,
    recommitBy: row.recommit_by,
    recommitAt: row.recommit_at,
    createdAt: row.created_at,
  };
}
