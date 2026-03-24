/**
 * V8 Tool Governance & HITL Core Primitives — Type Family
 *
 * Canonical tool catalog, consumer-class policy, delegation tokens,
 * invocation requests/traces, and approval results.
 *
 * Implements Decisions 19-22 from DECISION_LOG_WAVE_1.md:
 *  D19 — new tool defaults to `requires_approval` until classified
 *  D20 — project admin may tighten but never loosen relative to org policy
 *  D21 — scoped temporary tokens only; no broad credential pass-through
 *  D22 — background jobs default to deferred approval queue
 *
 * Depends on:
 *  - contextSnapshot.ts  (ConsumerClass, ContextSnapshot identity chain)
 *  - executionSpine.ts   (ApprovalClass, RiskClass for cross-reference)
 */

import { z } from 'zod';

import type { ConsumerClass } from './contextSnapshot.js';
import { ConsumerClassValues } from './contextSnapshot.js';
import type { ApprovalClass } from './executionSpine.js';
import { ApprovalClassValues } from './executionSpine.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ToolRiskClassValues = [
  'no_risk',
  'low_risk',
  'medium_risk',
  'high_risk',
  'critical',
] as const;
export type ToolRiskClass = (typeof ToolRiskClassValues)[number];

export const ClassificationStatusValues = [
  'proposed',
  'ratified',
  'under_review',
] as const;
export type ClassificationStatus = (typeof ClassificationStatusValues)[number];

export const ToolCategoryValues = [
  'retrieval',
  'artifact_read',
  'artifact_write',
  'workflow_action',
  'communication',
  'external_integration',
  'system_utility',
] as const;
export type ToolCategory = (typeof ToolCategoryValues)[number];

export const MutationTypeValues = [
  'read_only',
  'bounded_write',
  'workflow_mutation',
  'external_side_effect',
  'sensitive_data_access',
] as const;
export type MutationType = (typeof MutationTypeValues)[number];

export const ApprovalOverrideValues = [
  'inherit_from_tool',
  'force_human_approval',
  'force_policy_gate',
  'force_blocked',
] as const;
export type ApprovalOverride = (typeof ApprovalOverrideValues)[number];

export const ToolApprovalStateValues = [
  'allowed',
  'blocked',
  'requires_approval',
  'deferred_approval',
] as const;
export type ToolApprovalState = (typeof ToolApprovalStateValues)[number];

export const CredentialModeValues = [
  'no_credentials',
  'scoped_temporary_grant',
  'inherited_user_token',
] as const;
export type CredentialMode = (typeof CredentialModeValues)[number];

export const InvocationResultValues = [
  'success',
  'failed',
  'not_executed',
] as const;
export type InvocationResult = (typeof InvocationResultValues)[number];

export const TraceApprovalStateValues = [
  'human_approved',
  'policy_approved',
  'blocked',
  'expired',
  'auto_executed',
] as const;
export type TraceApprovalState = (typeof TraceApprovalStateValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface ToolCapability {
  toolId: string;
  organizationId: string;
  name: string;
  description: string;
  category: ToolCategory;
  riskClass: ToolRiskClass;
  mutationType: MutationType;
  classificationStatus: ClassificationStatus;
  defaultApprovalMode: ApprovalClass;
  classifiedBy: string | null;
  classifiedAt: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumerToolPolicy {
  policyId: string;
  organizationId: string;
  projectId: string | null;
  consumerClass: ConsumerClass;
  toolId: string;
  allowed: boolean;
  approvalOverride: ApprovalOverride;
  maxInvocationsPerRun: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolInvocationRequest {
  invocationId: string;
  organizationId: string;
  toolId: string;
  consumerClass: ConsumerClass;
  contextSnapshotId: string;
  executionRunId: string | null;
  initiatorUserId: string;
  parameters: Record<string, unknown>;
  approvalResult: ToolApprovalState;
  policyRef: string | null;
  blockReason: string | null;
  createdAt: string;
}

export interface ToolInvocationTrace {
  traceId: string;
  invocationId: string;
  toolId: string;
  consumerClass: ConsumerClass;
  executionRunId: string | null;
  delegationId: string | null;
  initiatingUserRef: string;
  effectiveRoleRef: string;
  contextSnapshotRef: string;
  toolRiskClass: ToolRiskClass;
  consumerPolicyRef: string;
  approvalState: TraceApprovalState;
  blockReason: string | null;
  blockingPolicyRef: string | null;
  approvalRef: string | null;
  invocationResult: InvocationResult;
  timestamp: string;
}

export interface ToolApprovalResult {
  state: ToolApprovalState;
  policyRef: string | null;
  blockReason: string | null;
  approvalClass: ApprovalClass;
}

export interface SubagentDelegationToken {
  delegationId: string;
  parentRunId: string;
  subagentRef: string;
  allowedToolIds: string[];
  deniedToolIds: string[];
  maxMutationType: MutationType;
  credentialMode: CredentialMode;
  expiresAt: string;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ToolCapabilitySchema = z.object({
  toolId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(ToolCategoryValues),
  riskClass: z.enum(ToolRiskClassValues),
  mutationType: z.enum(MutationTypeValues),
  classificationStatus: z.enum(ClassificationStatusValues),
  defaultApprovalMode: z.enum(ApprovalClassValues),
  classifiedBy: z.string().nullable(),
  classifiedAt: z.string().nullable(),
  version: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ConsumerToolPolicySchema = z.object({
  policyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  consumerClass: z.enum(ConsumerClassValues),
  toolId: z.string().uuid(),
  allowed: z.boolean(),
  approvalOverride: z.enum(ApprovalOverrideValues),
  maxInvocationsPerRun: z.number().int().positive().nullable(),
  effectiveFrom: z.string().min(1),
  effectiveUntil: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ToolInvocationRequestSchema = z.object({
  invocationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  toolId: z.string().uuid(),
  consumerClass: z.enum(ConsumerClassValues),
  contextSnapshotId: z.string().uuid(),
  executionRunId: z.string().uuid().nullable(),
  initiatorUserId: z.string().uuid(),
  parameters: z.record(z.string(), z.unknown()),
  approvalResult: z.enum(ToolApprovalStateValues),
  policyRef: z.string().nullable(),
  blockReason: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const ToolInvocationTraceSchema = z.object({
  traceId: z.string().uuid(),
  invocationId: z.string().uuid(),
  toolId: z.string().uuid(),
  consumerClass: z.enum(ConsumerClassValues),
  executionRunId: z.string().uuid().nullable(),
  delegationId: z.string().uuid().nullable(),
  initiatingUserRef: z.string().min(1),
  effectiveRoleRef: z.string().min(1),
  contextSnapshotRef: z.string().min(1),
  toolRiskClass: z.enum(ToolRiskClassValues),
  consumerPolicyRef: z.string().min(1),
  approvalState: z.enum(TraceApprovalStateValues),
  blockReason: z.string().nullable(),
  blockingPolicyRef: z.string().nullable(),
  approvalRef: z.string().nullable(),
  invocationResult: z.enum(InvocationResultValues),
  timestamp: z.string().min(1),
});

export const SubagentDelegationTokenSchema = z.object({
  delegationId: z.string().uuid(),
  parentRunId: z.string().uuid(),
  subagentRef: z.string().min(1),
  allowedToolIds: z.array(z.string().uuid()),
  deniedToolIds: z.array(z.string().uuid()),
  maxMutationType: z.enum(MutationTypeValues),
  credentialMode: z.enum(CredentialModeValues),
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RegisterToolParams {
  organizationId: string;
  name: string;
  description: string;
  category: ToolCategory;
  mutationType: MutationType;
  version: string;
}

export const RegisterToolParamsSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(ToolCategoryValues),
  mutationType: z.enum(MutationTypeValues),
  version: z.string().min(1),
});

export interface ClassifyToolParams {
  toolId: string;
  organizationId: string;
  riskClass: ToolRiskClass;
  classifiedBy: string;
}

export const ClassifyToolParamsSchema = z.object({
  toolId: z.string().uuid(),
  organizationId: z.string().uuid(),
  riskClass: z.enum(ToolRiskClassValues),
  classifiedBy: z.string().min(1),
});

export interface SetConsumerPolicyParams {
  organizationId: string;
  projectId?: string | null;
  consumerClass: ConsumerClass;
  toolId: string;
  allowed: boolean;
  approvalOverride?: ApprovalOverride;
  maxInvocationsPerRun?: number | null;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
}

export const SetConsumerPolicyParamsSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  consumerClass: z.enum(ConsumerClassValues),
  toolId: z.string().uuid(),
  allowed: z.boolean(),
  approvalOverride: z.enum(ApprovalOverrideValues).optional().default('inherit_from_tool'),
  maxInvocationsPerRun: z.number().int().positive().nullable().optional().default(null),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().nullable().optional().default(null),
});

export interface RequestInvocationParams {
  organizationId: string;
  toolId: string;
  consumerClass: ConsumerClass;
  contextSnapshotId: string;
  executionRunId?: string | null;
  initiatorUserId: string;
  parameters?: Record<string, unknown>;
}

export const RequestInvocationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  toolId: z.string().uuid(),
  consumerClass: z.enum(ConsumerClassValues),
  contextSnapshotId: z.string().uuid(),
  executionRunId: z.string().uuid().nullable().optional(),
  initiatorUserId: z.string().uuid(),
  parameters: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface LogInvocationTraceParams {
  invocationId: string;
  toolId: string;
  consumerClass: ConsumerClass;
  executionRunId?: string | null;
  delegationId?: string | null;
  initiatingUserRef: string;
  effectiveRoleRef: string;
  contextSnapshotRef: string;
  toolRiskClass: ToolRiskClass;
  consumerPolicyRef: string;
  approvalState: TraceApprovalState;
  blockReason?: string | null;
  blockingPolicyRef?: string | null;
  approvalRef?: string | null;
  invocationResult: InvocationResult;
}

export const LogInvocationTraceParamsSchema = z.object({
  invocationId: z.string().uuid(),
  toolId: z.string().uuid(),
  consumerClass: z.enum(ConsumerClassValues),
  executionRunId: z.string().uuid().nullable().optional(),
  delegationId: z.string().uuid().nullable().optional(),
  initiatingUserRef: z.string().min(1),
  effectiveRoleRef: z.string().min(1),
  contextSnapshotRef: z.string().min(1),
  toolRiskClass: z.enum(ToolRiskClassValues),
  consumerPolicyRef: z.string().min(1),
  approvalState: z.enum(TraceApprovalStateValues),
  blockReason: z.string().nullable().optional(),
  blockingPolicyRef: z.string().nullable().optional(),
  approvalRef: z.string().nullable().optional(),
  invocationResult: z.enum(InvocationResultValues),
});

// ==========================================
// POLICY RESOLUTION HELPERS
// ==========================================

/**
 * Risk-class → default approval mapping.
 * D19: unclassified tools get `requires_human_approval`.
 */
export const RISK_CLASS_DEFAULT_APPROVAL: Record<ToolRiskClass, ApprovalClass> = {
  no_risk: 'auto_executable',
  low_risk: 'auto_executable',
  medium_risk: 'policy_approvable',
  high_risk: 'requires_human_approval',
  critical: 'requires_human_approval',
} as const;

/**
 * Approval class strictness ordering (higher index = stricter).
 * Used by getEffectivePolicy to pick the most restrictive.
 */
export const APPROVAL_CLASS_STRICTNESS: Record<ApprovalClass, number> = {
  auto_executable: 0,
  policy_approvable: 1,
  requires_human_approval: 2,
} as const;
