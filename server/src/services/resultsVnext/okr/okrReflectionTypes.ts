/**
 * OKR-E007 — Reflection row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §3, D1-D4.
 * Schema: server/migrations/20260826_rvn_okr_review_reflection.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `okrSetTypes.ts`/
 * `okrObjectiveTypes.ts`.
 */

export const OKR_REFLECTION_STATUSES = ['draft', 'finalized'] as const;
export type OkrReflectionStatus = (typeof OKR_REFLECTION_STATUSES)[number];

export const OKR_REFLECTION_DISPOSITIONS = ['complete', 'carry_forward', 'drop', 'redefine'] as const;
export type OkrReflectionDisposition = (typeof OKR_REFLECTION_DISPOSITIONS)[number];

/** Frozen pointer-plus-copy of one KeyResult's state at scoring time (D3) —
 * embedded in `final_score_payload`, never a second live join. */
export interface OkrFinalScoreKeyResultSnapshot {
  keyResultId: string;
  progress: string | null;
  confidence: string | null;
  weight: string | null;
}

// ==========================================
// okr_vnext_reflections
// ==========================================

export interface OkrReflectionRow {
  reflection_id: string;
  set_id: string;
  objective_id: string;
  organization_id: string;
  status: OkrReflectionStatus;
  final_score: string | null;
  scoring_model_unsupported: boolean;
  final_score_payload: OkrFinalScoreKeyResultSnapshot[] | null;
  scoring_policy_version_id: string | null;
  scored_by: string | null;
  scored_at: string | null;
  what_worked: string | null;
  what_did_not_work: string | null;
  why: string | null;
  learning: string | null;
  next_cycle_change: string | null;
  disposition: OkrReflectionDisposition | null;
  finalized_by: string | null;
  finalized_at: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OkrReflection {
  reflectionId: string;
  setId: string;
  objectiveId: string;
  organizationId: string;
  status: OkrReflectionStatus;
  finalScore: string | null;
  scoringModelUnsupported: boolean;
  finalScorePayload: OkrFinalScoreKeyResultSnapshot[] | null;
  scoringPolicyVersionId: string | null;
  scoredBy: string | null;
  scoredAt: string | null;
  whatWorked: string | null;
  whatDidNotWork: string | null;
  why: string | null;
  learning: string | null;
  nextCycleChange: string | null;
  disposition: OkrReflectionDisposition | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toOkrReflection(row: OkrReflectionRow): OkrReflection {
  return {
    reflectionId: row.reflection_id,
    setId: row.set_id,
    objectiveId: row.objective_id,
    organizationId: row.organization_id,
    status: row.status,
    finalScore: row.final_score,
    scoringModelUnsupported: row.scoring_model_unsupported,
    finalScorePayload: row.final_score_payload,
    scoringPolicyVersionId: row.scoring_policy_version_id,
    scoredBy: row.scored_by,
    scoredAt: row.scored_at,
    whatWorked: row.what_worked,
    whatDidNotWork: row.what_did_not_work,
    why: row.why,
    learning: row.learning,
    nextCycleChange: row.next_cycle_change,
    disposition: row.disposition,
    finalizedBy: row.finalized_by,
    finalizedAt: row.finalized_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}
