/**
 * OKR-E001 — Cycle row/DTO types + checkin-occurrence shell type.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §4/§6.4-§6.6.
 * Schema: server/migrations/20260822_rvn_okr_program_cycle.sql.
 *
 * REGRESSION GUARD (OKR-F-002-AC-02): no dept_id/team_id/scope_type/
 * scope_id field anywhere in this file — that was the exact AS-IS mistake
 * (okr_cycles.dept_id/team_id flattening Set into Cycle). Scope belongs
 * exclusively to okr_vnext_sets (OKR-E002), not this epic.
 */

export const OKR_CYCLE_STATUSES = ['planned', 'drafting', 'active', 'review', 'closed', 'cancelled'] as const;
export type OkrCycleStatus = (typeof OKR_CYCLE_STATUSES)[number];

// ==========================================
// okr_vnext_cycles
// ==========================================

export interface OkrCycleRow {
  cycle_id: string;
  organization_id: string;
  program_id: string;
  name: string;
  start_date: string;
  end_date: string;
  draft_open_at: string;
  submission_due_at: string;
  approval_due_at: string | null;
  active_start_at: string;
  midcycle_review_at: string | null;
  final_update_due_at: string;
  review_open_at: string;
  reflection_due_at: string;
  manager_review_due_at: string | null;
  close_at: string;
  status: OkrCycleStatus;
  policy_version_id: string;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OkrCycle {
  cycleId: string;
  organizationId: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  draftOpenAt: string;
  submissionDueAt: string;
  approvalDueAt: string | null;
  activeStartAt: string;
  midcycleReviewAt: string | null;
  finalUpdateDueAt: string;
  reviewOpenAt: string;
  reflectionDueAt: string;
  managerReviewDueAt: string | null;
  closeAt: string;
  status: OkrCycleStatus;
  /** Set once at creation from `okr_vnext_programs.active_policy_version_id`
   * — NEVER updated afterward (OKR-F-001-AC-01's pinned-pointer proof). */
  policyVersionId: string;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toOkrCycle(row: OkrCycleRow): OkrCycle {
  return {
    cycleId: row.cycle_id,
    organizationId: row.organization_id,
    programId: row.program_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    draftOpenAt: row.draft_open_at,
    submissionDueAt: row.submission_due_at,
    approvalDueAt: row.approval_due_at,
    activeStartAt: row.active_start_at,
    midcycleReviewAt: row.midcycle_review_at,
    finalUpdateDueAt: row.final_update_due_at,
    reviewOpenAt: row.review_open_at,
    reflectionDueAt: row.reflection_due_at,
    managerReviewDueAt: row.manager_review_due_at,
    closeAt: row.close_at,
    status: row.status,
    policyVersionId: row.policy_version_id,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// okr_vnext_checkin_occurrences — minimal shell (design §4, Decision P11)
// ==========================================

export interface OkrCheckinOccurrenceRow {
  cadence_occurrence_id: string;
  organization_id: string;
  cycle_id: string;
  window_start: string;
  window_end: string;
  generated_at: string;
  generated_by: string;
}

export interface OkrCheckinOccurrence {
  cadenceOccurrenceId: string;
  organizationId: string;
  cycleId: string;
  windowStart: string;
  windowEnd: string;
  generatedAt: string;
  generatedBy: string;
}

export function toOkrCheckinOccurrence(row: OkrCheckinOccurrenceRow): OkrCheckinOccurrence {
  return {
    cadenceOccurrenceId: row.cadence_occurrence_id,
    organizationId: row.organization_id,
    cycleId: row.cycle_id,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
  };
}
