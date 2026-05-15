/**
 * V8 Execution/Approval Spine — Core Type Family
 *
 * Shared proposal/approval governance system for the V8 runtime.
 * Used by rebaseline, tool governance, and publish/review flows.
 * Separate from the legacy ai_playbook_runs / ai_playbook_run_steps model.
 */

import { z } from 'zod';

import type { V8ArtifactRef } from './contextSnapshot.js';
import { V8ArtifactRefSchema } from './contextSnapshot.js';
import type { OperationContract } from './operationContract.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const RunStateValues = [
  'drafting',
  'planning',
  'proposals_ready',
  'waiting_for_review',
  'approved_for_apply',
  'rejected',
  'applying',
  'completed',
  'failed',
  'cancelled',
  'expired',
] as const;
export type RunState = (typeof RunStateValues)[number];

export const RiskClassValues = [
  'safe_additive',
  'safe_update',
  'sensitive_update',
  'destructive',
  'governance_transition',
] as const;
export type RiskClass = (typeof RiskClassValues)[number];

export const ApprovalClassValues = [
  'requires_human_approval',
  'policy_approvable',
  'auto_executable',
] as const;
export type ApprovalClass = (typeof ApprovalClassValues)[number];

export const ProposalStatusValues = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'expired',
  'policy_allowed',
] as const;
export type ProposalStatus = (typeof ProposalStatusValues)[number];

export const ProposalTypeValues = [
  'create_artifact',
  'update_artifact',
  'transform_artifact',
  'link_artifacts',
  'workflow_transition',
  'generate_structured_output',
  'review_or_quality_pass',
  'request_human_decision',
] as const;
export type ProposalType = (typeof ProposalTypeValues)[number];

export const MutationOperationValues = [
  'create',
  'update',
  'delete',
  'transition',
  'link',
] as const;
export type MutationOperation = (typeof MutationOperationValues)[number];

export const ReversibilityValues = ['reversible', 'partially_reversible', 'irreversible'] as const;
export type Reversibility = (typeof ReversibilityValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface MutationDescriptor {
  operation: MutationOperation;
  targetFields: string[] | null;
  payloadSummary: Record<string, unknown> | null;
  reversibility: Reversibility;
  estimatedImpact: string | null;
}

export interface ActionPreview {
  diff: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdObjects: string[];
  updatedFields: string[];
  destructiveImpact: string | null;
  followupEffects: string[];
}

export interface ExecutionAgentRun {
  runId: string;
  organizationId: string;
  contextSnapshotId: string;
  initiatorUserId: string;
  state: RunState;
  planVersion: number;
  goal: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
}

export interface ActionProposal {
  proposalId: string;
  executionRunId: string;
  contextSnapshotRef: string;
  proposalType: ProposalType;
  targetRef: V8ArtifactRef;
  summary: string;
  reason: string;
  mutationDescription: MutationDescriptor;
  riskClass: RiskClass;
  approvalClass: ApprovalClass;
  previewPayload: ActionPreview | null;
  dependsOn: string[];
  status: ProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  operationContract?: OperationContract;
}

export interface RunStateTransition {
  transitionId: string;
  runId: string;
  fromState: RunState;
  toState: RunState;
  triggeredBy: string;
  reason: string | null;
  transitionedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const MutationDescriptorSchema = z.object({
  operation: z.enum(MutationOperationValues),
  targetFields: z.array(z.string()).nullable(),
  payloadSummary: z.record(z.string(), z.unknown()).nullable(),
  reversibility: z.enum(ReversibilityValues),
  estimatedImpact: z.string().nullable(),
});

export const ActionPreviewSchema = z.object({
  diff: z.record(z.string(), z.unknown()).nullable(),
  beforeState: z.record(z.string(), z.unknown()).nullable(),
  afterState: z.record(z.string(), z.unknown()).nullable(),
  createdObjects: z.array(z.string()),
  updatedFields: z.array(z.string()),
  destructiveImpact: z.string().nullable(),
  followupEffects: z.array(z.string()),
});

export const ExecutionAgentRunSchema = z.object({
  runId: z.string().uuid(),
  organizationId: z.string().min(1),
  contextSnapshotId: z.string().uuid(),
  initiatorUserId: z.string().uuid(),
  state: z.enum(RunStateValues),
  planVersion: z.number().int().min(1),
  goal: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const ActionProposalSchema = z.object({
  proposalId: z.string().uuid(),
  executionRunId: z.string().uuid(),
  contextSnapshotRef: z.string().min(1),
  proposalType: z.enum(ProposalTypeValues),
  targetRef: V8ArtifactRefSchema,
  summary: z.string().min(1),
  reason: z.string().min(1),
  mutationDescription: MutationDescriptorSchema,
  riskClass: z.enum(RiskClassValues),
  approvalClass: z.enum(ApprovalClassValues),
  previewPayload: ActionPreviewSchema.nullable(),
  dependsOn: z.array(z.string()),
  status: z.enum(ProposalStatusValues),
  createdAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
});

export const RunStateTransitionSchema = z.object({
  transitionId: z.string().uuid(),
  runId: z.string().uuid(),
  fromState: z.enum(RunStateValues),
  toState: z.enum(RunStateValues),
  triggeredBy: z.string().min(1),
  reason: z.string().nullable(),
  transitionedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateRunParams {
  organizationId: string;
  contextSnapshotId: string;
  initiatorUserId: string;
  goal: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export const CreateRunParamsSchema = z.object({
  organizationId: z.string().min(1),
  contextSnapshotId: z.string().uuid(),
  initiatorUserId: z.string().uuid(),
  goal: z.string().min(1),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface CreateProposalParams {
  executionRunId: string;
  contextSnapshotRef: string;
  proposalType: ProposalType;
  targetRef: V8ArtifactRef;
  summary: string;
  reason: string;
  mutationDescription: MutationDescriptor;
  riskClass: RiskClass;
  approvalClass: ApprovalClass;
  previewPayload?: ActionPreview | null;
  dependsOn?: string[];
}

export const CreateProposalParamsSchema = z.object({
  executionRunId: z.string().uuid(),
  contextSnapshotRef: z.string().min(1),
  proposalType: z.enum(ProposalTypeValues),
  targetRef: V8ArtifactRefSchema,
  summary: z.string().min(1),
  reason: z.string().min(1),
  mutationDescription: MutationDescriptorSchema,
  riskClass: z.enum(RiskClassValues),
  approvalClass: z.enum(ApprovalClassValues),
  previewPayload: ActionPreviewSchema.nullable().optional(),
  dependsOn: z.array(z.string()).optional().default([]),
});

// ==========================================
// STATE MACHINE
// ==========================================

/**
 * Valid state transitions for ExecutionAgentRun.
 * Key = fromState, Value = set of allowed toStates.
 * Cancellation is allowed from any non-terminal state (handled separately).
 */
export const VALID_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  drafting: ['planning', 'cancelled'],
  planning: ['proposals_ready', 'failed', 'cancelled'],
  proposals_ready: ['waiting_for_review', 'cancelled'],
  waiting_for_review: ['approved_for_apply', 'rejected', 'expired', 'cancelled'],
  approved_for_apply: ['applying', 'cancelled'],
  rejected: ['planning', 'cancelled'],
  applying: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['planning', 'cancelled'],
  cancelled: [],
  expired: [],
} as const;

export const TERMINAL_STATES: ReadonlySet<RunState> = new Set([
  'completed',
  'cancelled',
  'expired',
]);
