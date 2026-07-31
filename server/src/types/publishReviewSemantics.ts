/**
 * V8 Shared Publish and Review Semantics — WP-W6-OUT-04
 *
 * Unified publish lifecycle, review gates, coordinated publish for paired
 * outputs, output recall, and finance locked state across all output types
 * (reports, presentations, finance outputs, results artifacts).
 *
 * Decisions applied:
 *   W6-11 — finance locked state extends shared lifecycle
 *   W6-12 — coordinated publish for paired outputs (independent by capability, coordinated by workflow)
 *   W6-13 — output recall: explicit, auditable, lineage preserved
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const PublishLifecycleStateValues = [
  'private_draft',
  'reviewable_share',
  'team_visible',
  'in_review',
  'approved',
  'published',
  'recalled',
  'archived',
] as const;
export type PublishLifecycleState = (typeof PublishLifecycleStateValues)[number];

export const ArtifactTypeValues = [
  'report',
  'presentation',
  'sheet',
  'finance_output',
  'results_artifact',
] as const;
export type ArtifactType = (typeof ArtifactTypeValues)[number];

export const ReviewTypeValues = [
  'peer_review',
  'manager_approval',
  'compliance_review',
  'quality_gate',
] as const;
export type ReviewType = (typeof ReviewTypeValues)[number];

export const ReviewResultValues = ['approved', 'rejected', 'changes_requested'] as const;
export type ReviewResult = (typeof ReviewResultValues)[number];

export const ReviewPolicyValues = ['ALL'] as const;
export type ReviewPolicy = (typeof ReviewPolicyValues)[number];

export const CoordinationModeValues = ['coordinated', 'independent'] as const;
export type CoordinationMode = (typeof CoordinationModeValues)[number];

export const LockLevelValues = ['standard', 'finance_strict'] as const;
export type LockLevel = (typeof LockLevelValues)[number];

/**
 * Valid state transitions for the publish lifecycle state machine.
 * Forward-only happy path with rejection loop back to reviewable_share.
 */
export const VALID_STATE_TRANSITIONS: Record<PublishLifecycleState, PublishLifecycleState[]> = {
  private_draft: ['reviewable_share'],
  reviewable_share: ['team_visible', 'in_review'],
  team_visible: ['in_review'],
  in_review: ['approved', 'reviewable_share'],
  approved: ['published'],
  published: ['recalled', 'archived'],
  recalled: ['archived'],
  archived: [],
};

// ==========================================
// INTERFACES
// ==========================================

export interface PublishRecord {
  recordId: string;
  artifactId: string;
  artifactType: ArtifactType;
  organizationId: string;
  currentState: PublishLifecycleState;
  publishedBy: string;
  publishedAt: string | null;
  reviewers: string[];
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewReadiness?: ReviewReadiness;
}

export interface ReviewReadiness {
  policy: ReviewPolicy;
  required: string[];
  approved: string[];
  pending: string[];
  rejected: string[];
  satisfied: boolean;
}

export interface ReviewGate {
  gateId: string;
  artifactId: string;
  organizationId: string;
  reviewType: ReviewType;
  reviewerId: string;
  result: ReviewResult;
  comments: string | null;
  createdAt: string;
}

export interface CoordinatedPublish {
  coordinationId: string;
  primaryArtifactId: string;
  pairedArtifactId: string;
  organizationId: string;
  coordinationMode: CoordinationMode;
  coordinatedPublishAt: string | null;
  createdAt: string;
}

export interface OutputRecall {
  recallId: string;
  artifactId: string;
  organizationId: string;
  recalledBy: string;
  reason: string;
  recalledAt: string;
  postRecallState: 'recalled';
  lineagePreserved: true;
}

export interface FinanceLockedState {
  lockId: string;
  artifactId: string;
  organizationId: string;
  lockedBy: string;
  lockReason: string;
  lockLevel: LockLevel;
  lockedAt: string;
  unlockedAt: string | null;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const PublishRecordSchema = z.object({
  recordId: z.string().uuid(),
  artifactId: z.string().uuid(),
  artifactType: z.enum(ArtifactTypeValues),
  organizationId: z.string().uuid(),
  currentState: z.enum(PublishLifecycleStateValues),
  publishedBy: z.string().uuid(),
  publishedAt: z.string().nullable(),
  reviewers: z.array(z.string().uuid()),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  reviewReadiness: z
    .object({
      policy: z.enum(ReviewPolicyValues),
      required: z.array(z.string().uuid()),
      approved: z.array(z.string().uuid()),
      pending: z.array(z.string().uuid()),
      rejected: z.array(z.string().uuid()),
      satisfied: z.boolean(),
    })
    .optional(),
});

export const ReviewGateSchema = z.object({
  gateId: z.string().uuid(),
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  reviewType: z.enum(ReviewTypeValues),
  reviewerId: z.string().uuid(),
  result: z.enum(ReviewResultValues),
  comments: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const CoordinatedPublishSchema = z.object({
  coordinationId: z.string().uuid(),
  primaryArtifactId: z.string().uuid(),
  pairedArtifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  coordinationMode: z.enum(CoordinationModeValues),
  coordinatedPublishAt: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const OutputRecallSchema = z.object({
  recallId: z.string().uuid(),
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  recalledBy: z.string().uuid(),
  reason: z.string().min(1),
  recalledAt: z.string().min(1),
  postRecallState: z.literal('recalled'),
  lineagePreserved: z.literal(true),
});

export const FinanceLockedStateSchema = z.object({
  lockId: z.string().uuid(),
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  lockedBy: z.string().uuid(),
  lockReason: z.string().min(1),
  lockLevel: z.enum(LockLevelValues),
  lockedAt: z.string().min(1),
  unlockedAt: z.string().nullable(),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreatePublishRecordParams {
  artifactId: string;
  artifactType: ArtifactType;
  organizationId: string;
  publishedBy: string;
  reviewers?: string[];
}

export const CreatePublishRecordParamsSchema = z.object({
  artifactId: z.string().uuid(),
  artifactType: z.enum(ArtifactTypeValues),
  organizationId: z.string().uuid(),
  publishedBy: z.string().uuid(),
  reviewers: z.array(z.string().uuid()).optional().default([]),
});

export interface TransitionPublishStateParams {
  recordId: string;
  organizationId: string;
  newState: PublishLifecycleState;
  actor: string;
}

export const TransitionPublishStateParamsSchema = z.object({
  recordId: z.string().uuid(),
  organizationId: z.string().uuid(),
  newState: z.enum(PublishLifecycleStateValues),
  actor: z.string().uuid(),
});

export interface SubmitReviewGateParams {
  artifactId: string;
  organizationId: string;
  reviewType: ReviewType;
  reviewerId: string;
  result: ReviewResult;
  comments?: string | null;
}

export const SubmitReviewGateParamsSchema = z.object({
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  reviewType: z.enum(ReviewTypeValues),
  reviewerId: z.string().uuid(),
  result: z.enum(ReviewResultValues),
  comments: z.string().nullable().optional().default(null),
});

export interface CreateCoordinatedPublishParams {
  primaryArtifactId: string;
  pairedArtifactId: string;
  organizationId: string;
  coordinationMode: CoordinationMode;
}

export const CreateCoordinatedPublishParamsSchema = z.object({
  primaryArtifactId: z.string().uuid(),
  pairedArtifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  coordinationMode: z.enum(CoordinationModeValues),
});

export interface RecallOutputParams {
  artifactId: string;
  organizationId: string;
  recalledBy: string;
  reason: string;
}

export const RecallOutputParamsSchema = z.object({
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  recalledBy: z.string().uuid(),
  reason: z.string().min(1),
});

export interface ApplyFinanceLockParams {
  artifactId: string;
  organizationId: string;
  lockedBy: string;
  lockReason: string;
  lockLevel: LockLevel;
}

export const ApplyFinanceLockParamsSchema = z.object({
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  lockedBy: z.string().uuid(),
  lockReason: z.string().min(1),
  lockLevel: z.enum(LockLevelValues),
});
