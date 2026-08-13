/**
 * OKR-E003 — Objective row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §8.
 * Schema: server/migrations/20260824_rvn_okr_objective_key_result.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `okrSetTypes.ts`/
 * `okrCycleTypes.ts`.
 */

export const OKR_OBJECTIVE_AMBITION_TYPES = ['committed', 'aspirational', 'standard'] as const;
export type OkrObjectiveAmbitionType = (typeof OKR_OBJECTIVE_AMBITION_TYPES)[number];

export const OKR_OBJECTIVE_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'active',
  'at_risk',
  'completed',
  'cancelled',
  'closed',
] as const;
export type OkrObjectiveStatus = (typeof OKR_OBJECTIVE_STATUSES)[number];

/** Shared with OkrKeyResult's own confidence field — same vocabulary,
 * declared independently here per this program's stated convention of not
 * sharing field-shape helpers across file boundaries within the same
 * domain (mirrors OkrSetConfidence in okrSetTypes.ts). */
export const OKR_OBJECTIVE_CONFIDENCE_VALUES = ['high', 'medium', 'low', 'numeric'] as const;
export type OkrObjectiveConfidence = (typeof OKR_OBJECTIVE_CONFIDENCE_VALUES)[number];

// ==========================================
// okr_vnext_objectives
// ==========================================

export interface OkrObjectiveRow {
  objective_id: string;
  set_id: string;
  organization_id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  rationale: string | null;
  ambition_type: OkrObjectiveAmbitionType;
  status: OkrObjectiveStatus;
  progress: string | null;
  progress_calc_policy_version_id: string | null;
  progress_calc_reason: string | null;
  confidence: OkrObjectiveConfidence | null;
  confidence_numeric_value: string | null;
  confidence_calc_policy_version_id: string | null;
  confidence_calc_reason: string | null;
  sort_order: number;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  approved_at: string | null;
}

export interface OkrObjective {
  objectiveId: string;
  setId: string;
  organizationId: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  rationale: string | null;
  ambitionType: OkrObjectiveAmbitionType;
  status: OkrObjectiveStatus;
  progress: string | null;
  progressCalcPolicyVersionId: string | null;
  progressCalcReason: string | null;
  confidence: OkrObjectiveConfidence | null;
  confidenceNumericValue: string | null;
  confidenceCalcPolicyVersionId: string | null;
  confidenceCalcReason: string | null;
  sortOrder: number;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  approvedAt: string | null;
}

export function toOkrObjective(row: OkrObjectiveRow): OkrObjective {
  return {
    objectiveId: row.objective_id,
    setId: row.set_id,
    organizationId: row.organization_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    rationale: row.rationale,
    ambitionType: row.ambition_type,
    status: row.status,
    progress: row.progress,
    progressCalcPolicyVersionId: row.progress_calc_policy_version_id,
    progressCalcReason: row.progress_calc_reason,
    confidence: row.confidence,
    confidenceNumericValue: row.confidence_numeric_value,
    confidenceCalcPolicyVersionId: row.confidence_calc_policy_version_id,
    confidenceCalcReason: row.confidence_calc_reason,
    sortOrder: row.sort_order,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  };
}
