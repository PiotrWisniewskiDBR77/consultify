/**
 * OKR-E001 — Program row/DTO types + policy-snapshot shape.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §4/§6.1-§6.3.
 * Schema: server/migrations/20260822_rvn_okr_program_cycle.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1. DTO
 * interfaces are camelCase. Same convention as `roi/roiTypes.ts`/
 * `kpi/kpiTypes.ts`.
 */

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const OKR_PROGRAM_STATUSES = ['draft', 'active', 'suspended', 'retired'] as const;
export type OkrProgramStatus = (typeof OKR_PROGRAM_STATUSES)[number];

export const OKR_CYCLE_MODELS = ['quarterly', 'trimester', 'half_year', 'annual', 'custom'] as const;
export type OkrCycleModel = (typeof OKR_CYCLE_MODELS)[number];

export const OKR_CHECKIN_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'custom'] as const;
export type OkrCheckinFrequency = (typeof OKR_CHECKIN_FREQUENCIES)[number];

export const OKR_SCORING_MODELS = ['zero_to_one', 'percentage', 'categories', 'custom'] as const;
export type OkrScoringModel = (typeof OKR_SCORING_MODELS)[number];

export const OKR_OBJECTIVE_ROLLUP_MODELS = ['equal_average', 'weighted_average', 'manual', 'none'] as const;
export type OkrObjectiveRollupModel = (typeof OKR_OBJECTIVE_ROLLUP_MODELS)[number];

export const OKR_CONFIDENCE_MODELS = ['high_medium_low', 'numeric', 'custom'] as const;
export type OkrConfidenceModel = (typeof OKR_CONFIDENCE_MODELS)[number];

export const OKR_OBJECTIVE_CONFIDENCE_MODELS = ['lowest_kr', 'owner_selected', 'custom'] as const;
export type OkrObjectiveConfidenceModel = (typeof OKR_OBJECTIVE_CONFIDENCE_MODELS)[number];

/** Design §4: "platform's real enum spelling (visibilityResolver.ts), not
 * the plan doc's prose spelling" — identical value set to
 * `rvn_platform_visibility_policies.visibility_mode`. */
export const OKR_VISIBILITY_DEFAULTS = [
  'OPEN_ORG',
  'SCOPE',
  'MANAGEMENT_CHAIN',
  'PRIVATE',
  'RESTRICTED_ACL',
] as const;
export type OkrVisibilityDefault = (typeof OKR_VISIBILITY_DEFAULTS)[number];

// ==========================================
// okr_vnext_programs
// ==========================================

export interface OkrProgramRow {
  program_id: string;
  organization_id: string;
  name: string;
  status: OkrProgramStatus;
  cycle_model: OkrCycleModel;
  annual_direction_enabled: boolean;
  objective_min_recommended: number | null;
  objective_max_recommended: number | null;
  kr_min_required: number;
  kr_max_recommended: number | null;
  checkin_frequency: OkrCheckinFrequency;
  approval_required: boolean;
  scoring_model: OkrScoringModel;
  objective_rollup_model: OkrObjectiveRollupModel;
  confidence_enabled: boolean;
  confidence_model: OkrConfidenceModel;
  objective_confidence_model: OkrObjectiveConfidenceModel;
  visibility_default: OkrVisibilityDefault;
  committed_vs_aspirational_enabled: boolean;
  manager_review_required: boolean;
  self_review_required: boolean;
  reflection_required_for_close: boolean;
  recognition_enabled: boolean;
  active_policy_version_id: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OkrProgram {
  programId: string;
  organizationId: string;
  name: string;
  status: OkrProgramStatus;
  cycleModel: OkrCycleModel;
  annualDirectionEnabled: boolean;
  objectiveMinRecommended: number | null;
  objectiveMaxRecommended: number | null;
  krMinRequired: number;
  krMaxRecommended: number | null;
  checkinFrequency: OkrCheckinFrequency;
  approvalRequired: boolean;
  scoringModel: OkrScoringModel;
  objectiveRollupModel: OkrObjectiveRollupModel;
  confidenceEnabled: boolean;
  confidenceModel: OkrConfidenceModel;
  objectiveConfidenceModel: OkrObjectiveConfidenceModel;
  visibilityDefault: OkrVisibilityDefault;
  committedVsAspirationalEnabled: boolean;
  managerReviewRequired: boolean;
  selfReviewRequired: boolean;
  /** EVIDENCE_NEEDED #3 (design §2, plan §20) still OPEN — `false` is the
   * fail-safe default until a Founder decision concretizes this, not a
   * final policy statement. */
  reflectionRequiredForClose: boolean;
  recognitionEnabled: boolean;
  activePolicyVersionId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toOkrProgram(row: OkrProgramRow): OkrProgram {
  return {
    programId: row.program_id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status,
    cycleModel: row.cycle_model,
    annualDirectionEnabled: row.annual_direction_enabled,
    objectiveMinRecommended: row.objective_min_recommended,
    objectiveMaxRecommended: row.objective_max_recommended,
    krMinRequired: row.kr_min_required,
    krMaxRecommended: row.kr_max_recommended,
    checkinFrequency: row.checkin_frequency,
    approvalRequired: row.approval_required,
    scoringModel: row.scoring_model,
    objectiveRollupModel: row.objective_rollup_model,
    confidenceEnabled: row.confidence_enabled,
    confidenceModel: row.confidence_model,
    objectiveConfidenceModel: row.objective_confidence_model,
    visibilityDefault: row.visibility_default,
    committedVsAspirationalEnabled: row.committed_vs_aspirational_enabled,
    managerReviewRequired: row.manager_review_required,
    selfReviewRequired: row.self_review_required,
    reflectionRequiredForClose: row.reflection_required_for_close,
    recognitionEnabled: row.recognition_enabled,
    activePolicyVersionId: row.active_policy_version_id,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// okr_vnext_program_policy_versions
// ==========================================

/**
 * Immutable snapshot of every POLICY field on `okr_vnext_programs` at the
 * moment `publishProgram()` was called — administrative columns
 * (program_id/status/row_version/created_by/created_at/updated_by/
 * updated_at/active_policy_version_id) are deliberately excluded; only the
 * fields a Cycle's behavior actually depends on are pinned. This is the
 * mechanism satisfying OKR-F-001-AC-01 (design §4/§6.3).
 */
export interface OkrProgramPolicySnapshot {
  cycleModel: OkrCycleModel;
  annualDirectionEnabled: boolean;
  objectiveMinRecommended: number | null;
  objectiveMaxRecommended: number | null;
  krMinRequired: number;
  krMaxRecommended: number | null;
  checkinFrequency: OkrCheckinFrequency;
  approvalRequired: boolean;
  scoringModel: OkrScoringModel;
  objectiveRollupModel: OkrObjectiveRollupModel;
  confidenceEnabled: boolean;
  confidenceModel: OkrConfidenceModel;
  objectiveConfidenceModel: OkrObjectiveConfidenceModel;
  visibilityDefault: OkrVisibilityDefault;
  committedVsAspirationalEnabled: boolean;
  managerReviewRequired: boolean;
  selfReviewRequired: boolean;
  reflectionRequiredForClose: boolean;
  recognitionEnabled: boolean;
}

export function buildProgramPolicySnapshot(row: OkrProgramRow): OkrProgramPolicySnapshot {
  return {
    cycleModel: row.cycle_model,
    annualDirectionEnabled: row.annual_direction_enabled,
    objectiveMinRecommended: row.objective_min_recommended,
    objectiveMaxRecommended: row.objective_max_recommended,
    krMinRequired: row.kr_min_required,
    krMaxRecommended: row.kr_max_recommended,
    checkinFrequency: row.checkin_frequency,
    approvalRequired: row.approval_required,
    scoringModel: row.scoring_model,
    objectiveRollupModel: row.objective_rollup_model,
    confidenceEnabled: row.confidence_enabled,
    confidenceModel: row.confidence_model,
    objectiveConfidenceModel: row.objective_confidence_model,
    visibilityDefault: row.visibility_default,
    committedVsAspirationalEnabled: row.committed_vs_aspirational_enabled,
    managerReviewRequired: row.manager_review_required,
    selfReviewRequired: row.self_review_required,
    reflectionRequiredForClose: row.reflection_required_for_close,
    recognitionEnabled: row.recognition_enabled,
  };
}

export interface OkrProgramPolicyVersionRow {
  policy_version_id: string;
  program_id: string;
  organization_id: string;
  version_number: number;
  snapshot: OkrProgramPolicySnapshot;
  published_by: string;
  published_at: string;
}

export interface OkrProgramPolicyVersion {
  policyVersionId: string;
  programId: string;
  organizationId: string;
  versionNumber: number;
  snapshot: OkrProgramPolicySnapshot;
  publishedBy: string;
  publishedAt: string;
}

export function toOkrProgramPolicyVersion(row: OkrProgramPolicyVersionRow): OkrProgramPolicyVersion {
  return {
    policyVersionId: row.policy_version_id,
    programId: row.program_id,
    organizationId: row.organization_id,
    versionNumber: row.version_number,
    snapshot: row.snapshot,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
  };
}
