/**
 * V8 Concurrent Editing & Notification Spine — Core Primitives
 *
 * Type family for the V8 multiplayer concurrent editing model,
 * conflict resolution, locking strategies, and notification spine.
 * Implements WP-W4-COLLAB-03 with Decisions W4-8, W4-9, W4-10.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const CollaborationModeValues = [
  'realtime_coediting',
  'controlled_coediting',
  'review_first',
  'facilitated_input',
  'role_gated',
] as const;
export type CollaborationMode = (typeof CollaborationModeValues)[number];

export const MergeStrategyValues = [
  'crdt_object_level',
  'crdt_block_level',
  'ot_block_level',
  'field_lww',
  'server_authoritative',
] as const;
export type MergeStrategy = (typeof MergeStrategyValues)[number];

export const LockStrategyValues = [
  'none',
  'advisory_object',
  'optimistic_row',
  'optimistic_section',
  'exclusive_schema',
  'exclusive_document',
] as const;
export type LockStrategy = (typeof LockStrategyValues)[number];

export const OfflinePolicyValues = [
  'queue_and_merge',
  'queue_and_review',
  'reject_on_reconnect',
  'stale_warning',
] as const;
export type OfflinePolicy = (typeof OfflinePolicyValues)[number];

export const CommentAnchorStrategyValues = [
  'block',
  'node',
  'edge',
  'cell',
  'row',
  'section',
  'slide',
  'range',
] as const;
export type CommentAnchorStrategy = (typeof CommentAnchorStrategyValues)[number];

export const ConflictClassValues = [
  'concurrent_property_edit',
  'structural_conflict',
  'schema_conflict',
  'state_transition_conflict',
  'ai_proposal_vs_human_edit',
] as const;
export type ConflictClass = (typeof ConflictClassValues)[number];

export const ResolutionStrategyValues = [
  'crdt_auto_merge',
  'ot_transform',
  'last_write_wins',
  'optimistic_lock_retry',
  'advisory_lock_warning',
  'review_first_gating',
  'ai_staleness_detection',
] as const;
export type ResolutionStrategy = (typeof ResolutionStrategyValues)[number];

export const ResolutionStatusValues = [
  'auto_resolved',
  'pending_user_action',
  'user_resolved',
  'escalated',
] as const;
export type ResolutionStatus = (typeof ResolutionStatusValues)[number];

export const LockTypeValues = [
  'advisory_object',
  'optimistic_row',
  'optimistic_section',
  'exclusive_schema',
  'exclusive_document',
  'phase_lock',
] as const;
export type LockType = (typeof LockTypeValues)[number];

export const LockReleaseReasonValues = [
  'explicit',
  'timeout',
  'disconnect',
] as const;
export type LockReleaseReason = (typeof LockReleaseReasonValues)[number];

export const NotificationPriorityValues = [
  'high',
  'medium',
  'low',
] as const;
export type NotificationPriority = (typeof NotificationPriorityValues)[number];

export const NotificationChannelValues = [
  'in_app_realtime',
  'in_app_inbox',
  'email_digest',
] as const;
export type NotificationChannel = (typeof NotificationChannelValues)[number];

export const NotificationStateValues = [
  'unread',
  'read',
  'actioned',
  'snoozed',
] as const;
export type NotificationState = (typeof NotificationStateValues)[number];

export const GovernanceConflictPolicyValues = [
  'review_required',
  'blocking',
  'explicit_authority',
] as const;
export type GovernanceConflictPolicy = (typeof GovernanceConflictPolicyValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface ConcurrencyStrategy {
  strategyId: string;
  resourceType: string;
  organizationId: string;
  collaborationMode: CollaborationMode;
  mergeStrategy: MergeStrategy;
  lockStrategy: LockStrategy;
  offlinePolicy: OfflinePolicy;
  commentAnchorStrategy: CommentAnchorStrategy;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictResolution {
  conflictId: string;
  organizationId: string;
  conflictClass: ConflictClass;
  resourceType: string;
  resourceId: string;
  roomId: string | null;
  affectedPath: string;
  actorIds: string[];
  resolutionStrategy: ResolutionStrategy;
  resolutionStatus: ResolutionStatus;
  resolvedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface LockRecord {
  lockId: string;
  organizationId: string;
  lockType: LockType;
  lockScope: string;
  holderId: string;
  holderClientId: string;
  roomId: string;
  ttl: number;
  acquiredAt: string;
  releasedAt: string | null;
  releaseReason: LockReleaseReason | null;
}

export interface NotificationTrigger {
  triggerId: string;
  organizationId: string;
  eventType: string;
  notificationType: string;
  recipientRule: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  isActive: boolean;
  createdAt: string;
}

export interface NotificationRecord {
  notificationId: string;
  organizationId: string;
  recipientId: string;
  eventRef: string;
  channel: NotificationChannel;
  state: NotificationState;
  aggregationKey: string | null;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceSensitiveField {
  fieldId: string;
  organizationId: string;
  tableId: string;
  fieldName: string;
  isGovernanceSensitive: boolean;
  conflictPolicy: GovernanceConflictPolicy;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ConcurrencyStrategySchema = z.object({
  strategyId: z.string().uuid(),
  resourceType: z.string().min(1),
  organizationId: z.string().uuid(),
  collaborationMode: z.enum(CollaborationModeValues),
  mergeStrategy: z.enum(MergeStrategyValues),
  lockStrategy: z.enum(LockStrategyValues),
  offlinePolicy: z.enum(OfflinePolicyValues),
  commentAnchorStrategy: z.enum(CommentAnchorStrategyValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ConflictResolutionSchema = z.object({
  conflictId: z.string().uuid(),
  organizationId: z.string().uuid(),
  conflictClass: z.enum(ConflictClassValues),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  roomId: z.string().nullable(),
  affectedPath: z.string().min(1),
  actorIds: z.array(z.string().min(1)).min(1),
  resolutionStrategy: z.enum(ResolutionStrategyValues),
  resolutionStatus: z.enum(ResolutionStatusValues),
  resolvedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

export const LockRecordSchema = z.object({
  lockId: z.string().uuid(),
  organizationId: z.string().uuid(),
  lockType: z.enum(LockTypeValues),
  lockScope: z.string().min(1),
  holderId: z.string().min(1),
  holderClientId: z.string().min(1),
  roomId: z.string().min(1),
  ttl: z.number().int().positive(),
  acquiredAt: z.string().min(1),
  releasedAt: z.string().nullable(),
  releaseReason: z.enum(LockReleaseReasonValues).nullable(),
});

export const NotificationTriggerSchema = z.object({
  triggerId: z.string().uuid(),
  organizationId: z.string().uuid(),
  eventType: z.string().min(1),
  notificationType: z.string().min(1),
  recipientRule: z.string().min(1),
  priority: z.enum(NotificationPriorityValues),
  channels: z.array(z.enum(NotificationChannelValues)).min(1),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
});

export const NotificationRecordSchema = z.object({
  notificationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  recipientId: z.string().min(1),
  eventRef: z.string().min(1),
  channel: z.enum(NotificationChannelValues),
  state: z.enum(NotificationStateValues),
  aggregationKey: z.string().nullable(),
  priority: z.enum(NotificationPriorityValues),
  title: z.string().min(1),
  body: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const GovernanceSensitiveFieldSchema = z.object({
  fieldId: z.string().uuid(),
  organizationId: z.string().uuid(),
  tableId: z.string().min(1),
  fieldName: z.string().min(1),
  isGovernanceSensitive: z.boolean(),
  conflictPolicy: z.enum(GovernanceConflictPolicyValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RegisterConcurrencyStrategyParams {
  resourceType: string;
  organizationId: string;
  collaborationMode: CollaborationMode;
  mergeStrategy: MergeStrategy;
  lockStrategy: LockStrategy;
  offlinePolicy: OfflinePolicy;
  commentAnchorStrategy: CommentAnchorStrategy;
}

export const RegisterConcurrencyStrategyParamsSchema = z.object({
  resourceType: z.string().min(1),
  organizationId: z.string().uuid(),
  collaborationMode: z.enum(CollaborationModeValues),
  mergeStrategy: z.enum(MergeStrategyValues),
  lockStrategy: z.enum(LockStrategyValues),
  offlinePolicy: z.enum(OfflinePolicyValues),
  commentAnchorStrategy: z.enum(CommentAnchorStrategyValues),
});

export interface RecordConflictParams {
  organizationId: string;
  conflictClass: ConflictClass;
  resourceType: string;
  resourceId: string;
  roomId?: string | null;
  affectedPath: string;
  actorIds: string[];
  resolutionStrategy: ResolutionStrategy;
  metadata?: Record<string, unknown>;
}

export const RecordConflictParamsSchema = z.object({
  organizationId: z.string().uuid(),
  conflictClass: z.enum(ConflictClassValues),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  roomId: z.string().nullable().optional(),
  affectedPath: z.string().min(1),
  actorIds: z.array(z.string().min(1)).min(1),
  resolutionStrategy: z.enum(ResolutionStrategyValues),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface ResolveConflictParams {
  resolutionStrategy: ResolutionStrategy;
  resolutionStatus: ResolutionStatus;
}

export const ResolveConflictParamsSchema = z.object({
  resolutionStrategy: z.enum(ResolutionStrategyValues),
  resolutionStatus: z.enum(ResolutionStatusValues),
});

export interface AcquireLockParams {
  organizationId: string;
  lockType: LockType;
  lockScope: string;
  holderId: string;
  holderClientId: string;
  roomId: string;
  ttl: number;
}

export const AcquireLockParamsSchema = z.object({
  organizationId: z.string().uuid(),
  lockType: z.enum(LockTypeValues),
  lockScope: z.string().min(1),
  holderId: z.string().min(1),
  holderClientId: z.string().min(1),
  roomId: z.string().min(1),
  ttl: z.number().int().positive(),
});

export interface RegisterNotificationTriggerParams {
  organizationId: string;
  eventType: string;
  notificationType: string;
  recipientRule: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
}

export const RegisterNotificationTriggerParamsSchema = z.object({
  organizationId: z.string().uuid(),
  eventType: z.string().min(1),
  notificationType: z.string().min(1),
  recipientRule: z.string().min(1),
  priority: z.enum(NotificationPriorityValues),
  channels: z.array(z.enum(NotificationChannelValues)).min(1),
});

export interface CreateNotificationParams {
  organizationId: string;
  recipientId: string;
  eventRef: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body?: string | null;
  aggregationKey?: string | null;
}

export const CreateNotificationParamsSchema = z.object({
  organizationId: z.string().uuid(),
  recipientId: z.string().min(1),
  eventRef: z.string().min(1),
  channel: z.enum(NotificationChannelValues),
  priority: z.enum(NotificationPriorityValues),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  aggregationKey: z.string().nullable().optional(),
});

export interface MarkFieldGovernanceSensitiveParams {
  organizationId: string;
  tableId: string;
  fieldName: string;
  isGovernanceSensitive: boolean;
  conflictPolicy: GovernanceConflictPolicy;
}

export const MarkFieldGovernanceSensitiveParamsSchema = z.object({
  organizationId: z.string().uuid(),
  tableId: z.string().min(1),
  fieldName: z.string().min(1),
  isGovernanceSensitive: z.boolean(),
  conflictPolicy: z.enum(GovernanceConflictPolicyValues),
});
