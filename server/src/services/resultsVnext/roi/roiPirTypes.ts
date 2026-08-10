/**
 * ROI-E006 — shared row + DTO types for the Post-Investment Review.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §3.
 * Schema: server/migrations/20260819_rvn_roi_pir_learning.sql.
 *
 * Same `*Row` (snake_case, 1:1 with DB columns) / DTO (camelCase) split
 * every other file in this package uses. `review_snapshot_payload` is the
 * frozen JSONB shape stored at `startRoiCasePostInvestmentReview` time
 * (AC-02: frozen at reviewer START, not finalize) — pointer IDs plus a
 * frozen copy of the compare/benefits-realization views and all Variances
 * (Decision D8), never re-derived, `review_snapshot_hash` computed once via
 * `computeStateHash` (fixed key order).
 */
import type { RoiCaseBenefitsRealizationView } from './roiBenefitsRealizationRepository.js';
import type { RoiCaseCompareView } from './roiCompareRepository.js';
import type { RoiVariance } from './roiForecastActualTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const ROI_PIR_STATUSES = ['draft', 'finalized'] as const;
export type RoiPirStatus = (typeof ROI_PIR_STATUSES)[number];

export const ROI_PIR_OUTCOMES = [
  'benefits_fully_realized',
  'benefits_partially_realized',
  'benefits_not_realized',
] as const;
export type RoiPirOutcome = (typeof ROI_PIR_OUTCOMES)[number];

export const ROI_PIR_TERESA_DRAFT_DISPOSITIONS = ['accepted', 'rejected', 'edited_then_accepted'] as const;
export type RoiPirTeresaDraftDisposition = (typeof ROI_PIR_TERESA_DRAFT_DISPOSITIONS)[number];

// ==========================================
// D8: frozen review-snapshot payload shape
// ==========================================

/**
 * Decision D8: pointer IDs plus a frozen copy of the compare/benefits
 * -realization views and all Variances — never the full multi-KB
 * ApprovalSnapshot payload (that data is already immutable and ID-reachable
 * via `latestApprovedSnapshotId`). Assembled once, at
 * `startRoiCasePostInvestmentReview` time, from the case's own
 * `latestApprovedSnapshotId`/`currentForecastVersionId`/
 * `currentActualSnapshotId` pointer columns (read off the LOCKED case row,
 * same transaction) plus `getRoiCaseCompareView`/
 * `getRoiCaseBenefitsRealizationView`/`listVariances` (reused verbatim,
 * read-only).
 */
export interface RoiPirReviewSnapshotPayload {
  caseId: string;
  latestApprovedSnapshotId: string | null;
  currentForecastVersionId: string | null;
  currentActualSnapshotId: string | null;
  compareView: RoiCaseCompareView;
  benefitsRealizationView: RoiCaseBenefitsRealizationView;
  variances: RoiVariance[];
}

// ==========================================
// rvn_roi_post_investment_reviews
// ==========================================

export interface RoiPostInvestmentReviewRow {
  pir_id: string;
  case_id: string;
  organization_id: string;

  sequence_number: number;
  status: RoiPirStatus;

  started_by: string;
  started_at: string;
  review_snapshot_payload: RoiPirReviewSnapshotPayload;
  review_snapshot_hash: string;

  outcome: RoiPirOutcome | null;
  lessons_learned: string | null;
  recommendation: string | null;

  open_variance_waiver_reason: string | null;

  teresa_draft_lessons_payload: Record<string, unknown> | null;
  teresa_draft_generated_at: string | null;
  teresa_draft_disposition: RoiPirTeresaDraftDisposition | null;
  teresa_draft_disposition_by: string | null;
  teresa_draft_disposition_at: string | null;

  finalized_by: string | null;
  finalized_at: string | null;

  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface RoiPostInvestmentReview {
  pirId: string;
  caseId: string;
  organizationId: string;

  sequenceNumber: number;
  status: RoiPirStatus;

  startedBy: string;
  startedAt: string;
  reviewSnapshotPayload: RoiPirReviewSnapshotPayload;
  reviewSnapshotHash: string;

  outcome: RoiPirOutcome | null;
  lessonsLearned: string | null;
  recommendation: string | null;

  openVarianceWaiverReason: string | null;

  teresaDraftLessonsPayload: Record<string, unknown> | null;
  teresaDraftGeneratedAt: string | null;
  teresaDraftDisposition: RoiPirTeresaDraftDisposition | null;
  teresaDraftDispositionBy: string | null;
  teresaDraftDispositionAt: string | null;

  finalizedBy: string | null;
  finalizedAt: string | null;

  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toRoiPostInvestmentReview(row: RoiPostInvestmentReviewRow): RoiPostInvestmentReview {
  return {
    pirId: row.pir_id,
    caseId: row.case_id,
    organizationId: row.organization_id,
    sequenceNumber: row.sequence_number,
    status: row.status,
    startedBy: row.started_by,
    startedAt: row.started_at,
    reviewSnapshotPayload: row.review_snapshot_payload,
    reviewSnapshotHash: row.review_snapshot_hash,
    outcome: row.outcome,
    lessonsLearned: row.lessons_learned,
    recommendation: row.recommendation,
    openVarianceWaiverReason: row.open_variance_waiver_reason,
    teresaDraftLessonsPayload: row.teresa_draft_lessons_payload,
    teresaDraftGeneratedAt: row.teresa_draft_generated_at,
    teresaDraftDisposition: row.teresa_draft_disposition,
    teresaDraftDispositionBy: row.teresa_draft_disposition_by,
    teresaDraftDispositionAt: row.teresa_draft_disposition_at,
    finalizedBy: row.finalized_by,
    finalizedAt: row.finalized_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}
