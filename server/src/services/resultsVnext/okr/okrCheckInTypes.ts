/**
 * OKR-E004 — Check-in row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §6.
 * Schema: server/migrations/20260825_rvn_okr_checkin.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `okrKeyResultTypes.ts`/
 * `okrObjectiveTypes.ts`/`okrSetTypes.ts`.
 *
 * D5 (renamed at implementation time, see migration header): `confidence`/
 * `confidence_numeric_value` reuse the exact vocabulary/shape of
 * `okr_vnext_key_results.confidence`/`.confidence_numeric_value` — this is
 * the write-through target (design D6), so the DTO shapes match on purpose.
 */

/** Reuses okr_vnext_key_results.status's own vocabulary (design §6) —
 * declared independently here per this program's established convention of
 * not sharing field-shape helpers across file boundaries within the same
 * domain. */
export const OKR_CHECKIN_STATUS_VALUES = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
  'cancelled',
] as const;
export type OkrCheckInStatus = (typeof OKR_CHECKIN_STATUS_VALUES)[number];

export const OKR_CHECKIN_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrCheckInConfidence = (typeof OKR_CHECKIN_CONFIDENCE_VALUES)[number];

// ==========================================
// okr_vnext_checkins
// ==========================================

export interface OkrCheckInRow {
  checkin_id: string;
  organization_id: string;
  key_result_id: string;
  objective_id: string;
  set_id: string;
  cadence_occurrence_id: string;
  previous_value: string | null;
  new_value: string | null;
  calculated_progress: string | null;
  owner_declared_status: OkrCheckInStatus | null;
  system_suggested_status: OkrCheckInStatus | null;
  confidence: OkrCheckInConfidence | null;
  confidence_numeric_value: string | null;
  note: string;
  blocker: string | null;
  support_requested: string | null;
  evidence_refs: unknown[];
  correction_of_checkin_id: string | null;
  correction_reason: string | null;
  submitted_by: string;
  submitted_at: string;
}

export interface OkrCheckIn {
  checkInId: string;
  organizationId: string;
  keyResultId: string;
  objectiveId: string;
  setId: string;
  cadenceOccurrenceId: string;
  previousValue: string | null;
  newValue: string | null;
  calculatedProgress: string | null;
  ownerDeclaredStatus: OkrCheckInStatus | null;
  systemSuggestedStatus: OkrCheckInStatus | null;
  confidence: OkrCheckInConfidence | null;
  confidenceNumericValue: string | null;
  note: string;
  blocker: string | null;
  supportRequested: string | null;
  evidenceRefs: unknown[];
  correctionOfCheckInId: string | null;
  correctionReason: string | null;
  submittedBy: string;
  submittedAt: string;
}

export function toOkrCheckIn(row: OkrCheckInRow): OkrCheckIn {
  return {
    checkInId: row.checkin_id,
    organizationId: row.organization_id,
    keyResultId: row.key_result_id,
    objectiveId: row.objective_id,
    setId: row.set_id,
    cadenceOccurrenceId: row.cadence_occurrence_id,
    previousValue: row.previous_value,
    newValue: row.new_value,
    calculatedProgress: row.calculated_progress,
    ownerDeclaredStatus: row.owner_declared_status,
    systemSuggestedStatus: row.system_suggested_status,
    confidence: row.confidence,
    confidenceNumericValue: row.confidence_numeric_value,
    note: row.note,
    blocker: row.blocker,
    supportRequested: row.support_requested,
    evidenceRefs: Array.isArray(row.evidence_refs) ? row.evidence_refs : [],
    correctionOfCheckInId: row.correction_of_checkin_id,
    correctionReason: row.correction_reason,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
  };
}
