/**
 * ROI-E001 — shared row + DTO types.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §3.
 * Schema: server/migrations/20260815_rvn_roi_core.sql.
 *
 * Row interfaces (`*Row`) are snake_case, matching DB columns 1:1 — the
 * shape a raw `client.query<...Row>()` call returns. DTO interfaces are
 * camelCase — the shape command/repository functions return to their
 * callers. Same convention as `kpi/kpiTypes.ts`, whose `toNullableNumber`
 * helper is reused here rather than restated (design doc §8 file list).
 */
import { toNullableNumber } from '../kpi/kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const ROI_CASE_STATUSES = [
  'not_started',
  'draft',
  'modeling',
  'ready_for_review',
  'submitted_for_approval',
  'changes_requested',
  'approved',
  'rejected',
  'tracking',
  'benefits_realization',
  'post_investment_review_due',
  'post_investment_review',
  'closed',
  'cancelled',
] as const;
export type RoiCaseStatus = (typeof ROI_CASE_STATUSES)[number];

export const ROI_CASE_GRANULARITIES = ['monthly', 'annual'] as const;
export type RoiCaseGranularity = (typeof ROI_CASE_GRANULARITIES)[number];

export const ROI_BASELINE_PROJECTION_METHODS = ['flat', 'growth_rate', 'custom'] as const;
export type RoiBaselineProjectionMethod = (typeof ROI_BASELINE_PROJECTION_METHODS)[number];

export const ROI_BASELINE_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type RoiBaselineConfidence = (typeof ROI_BASELINE_CONFIDENCE_LEVELS)[number];

// ==========================================
// rvn_roi_cases
// ==========================================

export interface RoiCaseRow {
  case_id: string;
  organization_id: string;
  initiative_id: string;
  title: string;
  owner_user_id: string;
  status: RoiCaseStatus;
  currency: string;
  granularity: RoiCaseGranularity;
  analysis_start: string | null;
  analysis_end: string | null;
  original_approved_snapshot_id: string | null;
  latest_approved_snapshot_id: string | null;
  current_forecast_version_id: string | null;
  current_actual_snapshot_id: string | null;
  next_action_type: string | null;
  next_action_due_at: string | null;
  next_review_at: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  /** ROI-E003 §3 (D5): pins the calculation run the readiness guard
   * validated as fresh at submit time — the "decision request pins a
   * specific economic-model version under review" (AC-02). */
  decision_calculation_run_id: string | null;
  /** ROI-E003 §3 (D6): distinct from rejection — 'changes_requested' stays
   * editable, these columns are never reused for a true rejection. */
  changes_requested_by: string | null;
  changes_requested_at: string | null;
  changes_requested_reason: string | null;
  archived_at: string | null;
  archived_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface RoiCase {
  caseId: string;
  organizationId: string;
  initiativeId: string;
  title: string;
  ownerUserId: string;
  status: RoiCaseStatus;
  currency: string;
  granularity: RoiCaseGranularity;
  analysisStart: string | null;
  analysisEnd: string | null;
  originalApprovedSnapshotId: string | null;
  latestApprovedSnapshotId: string | null;
  currentForecastVersionId: string | null;
  currentActualSnapshotId: string | null;
  nextActionType: string | null;
  nextActionDueAt: string | null;
  nextReviewAt: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  decisionCalculationRunId: string | null;
  changesRequestedBy: string | null;
  changesRequestedAt: string | null;
  changesRequestedReason: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toRoiCase(row: RoiCaseRow): RoiCase {
  return {
    caseId: row.case_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    title: row.title,
    ownerUserId: row.owner_user_id,
    status: row.status,
    currency: row.currency,
    granularity: row.granularity,
    analysisStart: row.analysis_start,
    analysisEnd: row.analysis_end,
    originalApprovedSnapshotId: row.original_approved_snapshot_id,
    latestApprovedSnapshotId: row.latest_approved_snapshot_id,
    currentForecastVersionId: row.current_forecast_version_id,
    currentActualSnapshotId: row.current_actual_snapshot_id,
    nextActionType: row.next_action_type,
    nextActionDueAt: row.next_action_due_at,
    nextReviewAt: row.next_review_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    decisionCalculationRunId: row.decision_calculation_run_id,
    changesRequestedBy: row.changes_requested_by,
    changesRequestedAt: row.changes_requested_at,
    changesRequestedReason: row.changes_requested_reason,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_roi_baselines
// ==========================================

export interface RoiBaselineRow {
  baseline_id: string;
  case_id: string;
  organization_id: string;
  baseline_period_start: string | null;
  baseline_period_end: string | null;
  current_measured_value: string | null;
  current_measured_unit: string | null;
  current_measured_as_of: string | null;
  bau_projection_method: RoiBaselineProjectionMethod;
  bau_growth_rate_pct: string | null;
  bau_reference_value: string | null;
  intervention_comparison_notes: string | null;
  source: string | null;
  confidence: RoiBaselineConfidence | null;
  owner_user_id: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoiBaseline {
  baselineId: string;
  caseId: string;
  organizationId: string;
  baselinePeriodStart: string | null;
  baselinePeriodEnd: string | null;
  currentMeasuredValue: number | null;
  currentMeasuredUnit: string | null;
  currentMeasuredAsOf: string | null;
  bauProjectionMethod: RoiBaselineProjectionMethod;
  bauGrowthRatePct: number | null;
  bauReferenceValue: number | null;
  interventionComparisonNotes: string | null;
  source: string | null;
  confidence: RoiBaselineConfidence | null;
  ownerUserId: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoiBaseline(row: RoiBaselineRow): RoiBaseline {
  return {
    baselineId: row.baseline_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    baselinePeriodStart: row.baseline_period_start,
    baselinePeriodEnd: row.baseline_period_end,
    currentMeasuredValue: toNullableNumber(row.current_measured_value),
    currentMeasuredUnit: row.current_measured_unit,
    currentMeasuredAsOf: row.current_measured_as_of,
    bauProjectionMethod: row.bau_projection_method,
    bauGrowthRatePct: toNullableNumber(row.bau_growth_rate_pct),
    bauReferenceValue: toNullableNumber(row.bau_reference_value),
    interventionComparisonNotes: row.intervention_comparison_notes,
    source: row.source,
    confidence: row.confidence,
    ownerUserId: row.owner_user_id,
    frozenAt: row.frozen_at,
    frozenBy: row.frozen_by,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
