/**
 * OKR-E007 — Review row/DTO types.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §3, D5/D6.
 * Schema: server/migrations/20260826_rvn_okr_review_reflection.sql.
 */

export const OKR_REVIEW_TYPES = ['self', 'manager'] as const;
export type OkrReviewType = (typeof OKR_REVIEW_TYPES)[number];

export const OKR_REVIEW_STATUSES = ['draft', 'submitted', 'approved', 'changes_requested'] as const;
export type OkrReviewStatus = (typeof OKR_REVIEW_STATUSES)[number];

export const OKR_REVIEW_COMMENT_LEVELS = ['set', 'objective', 'key_result'] as const;
export type OkrReviewCommentLevel = (typeof OKR_REVIEW_COMMENT_LEVELS)[number];

export interface OkrReviewComment {
  level: OkrReviewCommentLevel;
  targetId: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

// ==========================================
// okr_vnext_reviews
// ==========================================

export interface OkrReviewRow {
  review_id: string;
  set_id: string;
  organization_id: string;
  review_type: OkrReviewType;
  reviewer_user_id: string;
  status: OkrReviewStatus;
  outcome: string | null;
  comments: OkrReviewComment[];
  reviewed_set_version: number | null;
  submitted_by: string | null;
  submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

export interface OkrReview {
  reviewId: string;
  setId: string;
  organizationId: string;
  reviewType: OkrReviewType;
  reviewerUserId: string;
  status: OkrReviewStatus;
  outcome: string | null;
  comments: OkrReviewComment[];
  reviewedSetVersion: number | null;
  submittedBy: string | null;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function toOkrReview(row: OkrReviewRow): OkrReview {
  return {
    reviewId: row.review_id,
    setId: row.set_id,
    organizationId: row.organization_id,
    reviewType: row.review_type,
    reviewerUserId: row.reviewer_user_id,
    status: row.status,
    outcome: row.outcome,
    comments: row.comments ?? [],
    reviewedSetVersion: row.reviewed_set_version,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}
