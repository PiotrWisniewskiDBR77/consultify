/**
 * V8 Tool Collaboration Adapter — Per-tool collaboration readiness contracts
 *
 * Defines how each workspace tool (Idea Workspace, Whiteboard, Mind Map / Process Flow,
 * Table, Notebook) declares its collaboration capabilities and requirements through
 * the platform adapter registry.
 *
 * Decisions applied:
 *   W4-3: Notebook versioning — operational versioning required
 *   W4-4: Block-locking first for Notebook
 *   W4-5: Unified presence at workspace level, surface-aware detail
 *   W4-6: Table room = per-table (view is sub-context)
 *   W4-7: AI proposals start as personal draft
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const CollaborationReadinessLevelValues = [
  'missing',
  'scaffold',
  'partial',
  'platform_integrated',
  'complete',
] as const;
export type CollaborationReadinessLevel = (typeof CollaborationReadinessLevelValues)[number];

export const CollaborationModeValues = [
  'realtime_coediting',
  'controlled_coediting',
  'review_first',
  'facilitated_input',
  'role_gated',
] as const;
export type CollaborationMode = (typeof CollaborationModeValues)[number];

export const LockTypeValues = [
  'none',
  'advisory_object',
  'optimistic_row',
  'optimistic_section',
  'exclusive_schema',
  'exclusive_document',
  'phase_lock',
] as const;
export type LockType = (typeof LockTypeValues)[number];

export const OfflinePolicyValues = [
  'queue_and_merge',
  'queue_and_review',
  'reject_on_reconnect',
  'stale_warning',
] as const;
export type OfflinePolicy = (typeof OfflinePolicyValues)[number];

export const AIProposalVisibilityStateValues = [
  'personal_draft',
  'shared_proposal',
  'team_review',
  'accepted',
  'rejected',
] as const;
export type AIProposalVisibilityState = (typeof AIProposalVisibilityStateValues)[number];

export const ToolNameValues = [
  'idea_workspace',
  'whiteboard',
  'mind_map',
  'process_flow',
  'table',
  'notebook',
] as const;
export type ToolName = (typeof ToolNameValues)[number];

export const SnapshotGranularityValues = [
  'full_document',
  'section',
  'block',
  'cell',
  'node',
] as const;
export type SnapshotGranularity = (typeof SnapshotGranularityValues)[number];

export const RetentionTierValues = ['hot', 'warm', 'cold', 'archive'] as const;
export type RetentionTier = (typeof RetentionTierValues)[number];

export const RoomGranularityValues = [
  'workspace',
  'table',
  'notebook',
  'canvas',
  'document',
] as const;
export type RoomGranularity = (typeof RoomGranularityValues)[number];

export const PrimitiveCheckStateValues = [
  'missing',
  'scaffold',
  'partial',
  'platform_integrated',
  'complete',
] as const;
export type PrimitiveCheckState = (typeof PrimitiveCheckStateValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface VersioningPolicy {
  autoSnapshotCadence: string;
  snapshotGranularity: SnapshotGranularity;
  retentionTier: RetentionTier;
  compareDiffSupport: boolean;
  restoreSupport: boolean;
}

export interface PrimitiveCheck {
  primitive: string;
  currentState: PrimitiveCheckState;
  targetState: PrimitiveCheckState;
  gap: string;
}

export interface ToolCollaborationAdapter {
  adapterId: string;
  toolName: ToolName;
  resourceType: string;
  organizationId: string;
  readinessLevel: CollaborationReadinessLevel;
  roomGranularity: RoomGranularity;
  presenceTypes: string[];
  cursorStateSchema: Record<string, unknown>;
  supportedLockTypes: LockType[];
  versioningPolicy: VersioningPolicy;
  offlinePolicy: OfflinePolicy;
  collaborationMode: CollaborationMode;
  registeredAt: string;
  updatedAt: string;
}

export interface ToolReadinessAudit {
  auditId: string;
  toolName: ToolName;
  organizationId: string;
  primitiveChecks: PrimitiveCheck[];
  overallReadiness: CollaborationReadinessLevel;
  auditedAt: string;
  auditedBy: string;
}

export interface AIProposalVisibility {
  proposalId: string;
  organizationId: string;
  toolName: ToolName;
  resourceId: string;
  authorId: string;
  visibility: AIProposalVisibilityState;
  proposalPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const VersioningPolicySchema = z.object({
  autoSnapshotCadence: z.string().min(1),
  snapshotGranularity: z.enum(SnapshotGranularityValues),
  retentionTier: z.enum(RetentionTierValues),
  compareDiffSupport: z.boolean(),
  restoreSupport: z.boolean(),
});

export const PrimitiveCheckSchema = z.object({
  primitive: z.string().min(1),
  currentState: z.enum(PrimitiveCheckStateValues),
  targetState: z.enum(PrimitiveCheckStateValues),
  gap: z.string(),
});

export const ToolCollaborationAdapterSchema = z.object({
  adapterId: z.string().uuid(),
  toolName: z.enum(ToolNameValues),
  resourceType: z.string().min(1),
  organizationId: z.string().uuid(),
  readinessLevel: z.enum(CollaborationReadinessLevelValues),
  roomGranularity: z.enum(RoomGranularityValues),
  presenceTypes: z.array(z.string().min(1)).min(1),
  cursorStateSchema: z.record(z.string(), z.unknown()),
  supportedLockTypes: z.array(z.enum(LockTypeValues)).min(1),
  versioningPolicy: VersioningPolicySchema,
  offlinePolicy: z.enum(OfflinePolicyValues),
  collaborationMode: z.enum(CollaborationModeValues),
  registeredAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ToolReadinessAuditSchema = z.object({
  auditId: z.string().uuid(),
  toolName: z.enum(ToolNameValues),
  organizationId: z.string().uuid(),
  primitiveChecks: z.array(PrimitiveCheckSchema).min(1),
  overallReadiness: z.enum(CollaborationReadinessLevelValues),
  auditedAt: z.string().min(1),
  auditedBy: z.string().min(1),
});

export const AIProposalVisibilitySchema = z.object({
  proposalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  toolName: z.enum(ToolNameValues),
  resourceId: z.string().min(1),
  authorId: z.string().min(1),
  visibility: z.enum(AIProposalVisibilityStateValues),
  proposalPayload: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RegisterAdapterParams {
  toolName: ToolName;
  resourceType: string;
  organizationId: string;
  readinessLevel: CollaborationReadinessLevel;
  roomGranularity: RoomGranularity;
  presenceTypes: string[];
  cursorStateSchema: Record<string, unknown>;
  supportedLockTypes: LockType[];
  versioningPolicy: VersioningPolicy;
  offlinePolicy: OfflinePolicy;
  collaborationMode: CollaborationMode;
}

export const RegisterAdapterParamsSchema = z.object({
  toolName: z.enum(ToolNameValues),
  resourceType: z.string().min(1),
  organizationId: z.string().uuid(),
  readinessLevel: z.enum(CollaborationReadinessLevelValues),
  roomGranularity: z.enum(RoomGranularityValues),
  presenceTypes: z.array(z.string().min(1)).min(1),
  cursorStateSchema: z.record(z.string(), z.unknown()),
  supportedLockTypes: z.array(z.enum(LockTypeValues)).min(1),
  versioningPolicy: VersioningPolicySchema,
  offlinePolicy: z.enum(OfflinePolicyValues),
  collaborationMode: z.enum(CollaborationModeValues),
});

export interface RecordReadinessAuditParams {
  toolName: ToolName;
  organizationId: string;
  primitiveChecks: PrimitiveCheck[];
  overallReadiness: CollaborationReadinessLevel;
  auditedBy: string;
}

export const RecordReadinessAuditParamsSchema = z.object({
  toolName: z.enum(ToolNameValues),
  organizationId: z.string().uuid(),
  primitiveChecks: z.array(PrimitiveCheckSchema).min(1),
  overallReadiness: z.enum(CollaborationReadinessLevelValues),
  auditedBy: z.string().min(1),
});

export interface SetAIProposalVisibilityParams {
  proposalId?: string;
  organizationId: string;
  toolName: ToolName;
  resourceId: string;
  authorId: string;
  visibility: AIProposalVisibilityState;
  proposalPayload?: Record<string, unknown>;
}

export const SetAIProposalVisibilityParamsSchema = z.object({
  proposalId: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  toolName: z.enum(ToolNameValues),
  resourceId: z.string().min(1),
  authorId: z.string().min(1),
  visibility: z.enum(AIProposalVisibilityStateValues),
  proposalPayload: z.record(z.string(), z.unknown()).optional().default({}),
});

// ==========================================
// STATE MACHINE — AI Proposal Visibility (Decision W4-7)
// ==========================================

/**
 * Valid transitions for AI proposal visibility.
 * personal_draft → shared_proposal → team_review → accepted | rejected
 */
export const VALID_PROPOSAL_TRANSITIONS: Record<
  AIProposalVisibilityState,
  readonly AIProposalVisibilityState[]
> = {
  personal_draft: ['shared_proposal', 'rejected'],
  shared_proposal: ['team_review', 'rejected'],
  team_review: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
} as const;

export const TERMINAL_PROPOSAL_STATES: ReadonlySet<AIProposalVisibilityState> = new Set([
  'accepted',
  'rejected',
]);
