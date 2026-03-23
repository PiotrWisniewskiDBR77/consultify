/**
 * V8 PM Sync Platform Truth — Core Primitives
 *
 * Shared platform truth for PM sync: authentication states, provider depth,
 * per-object sync status, and conflict vocabulary.
 * Canonical sources: WP-W1-PMSYNC-01, WP-W1-PMSYNC-02, Decisions 7-9.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ConnectorAuthStateValues = [
  'not_connected',
  'connecting',
  'connected_pending_verification',
  'healthy',
  'degraded_reauth_needed',
  'degraded_scope_limited',
  'suspended',
  'disconnected',
] as const;
export type ConnectorAuthState = (typeof ConnectorAuthStateValues)[number];

export const ProviderTierValues = ['A', 'B', 'C', 'D'] as const;
export type ProviderTier = (typeof ProviderTierValues)[number];

export const ParityDimensionValues = [
  'auth_maturity',
  'ownership_scope_model',
  'task_object_mapping',
  'assignee_model',
  'status_workflow_model',
  'due_date_schedule_semantics',
  'comment_review_semantics',
  'conflict_handling',
  'replay_supportability',
  'ui_honesty_about_limits',
] as const;
export type ParityDimension = (typeof ParityDimensionValues)[number];

export const SyncStatusValues = [
  'synced',
  'stale',
  'pending',
  'conflict',
  'error',
  'dead_letter',
  'not_synced',
] as const;
export type SyncStatus = (typeof SyncStatusValues)[number];

export const SyncObjectTypeValues = ['Task', 'Decision', 'InboxItem'] as const;
export type SyncObjectType = (typeof SyncObjectTypeValues)[number];

export const SyncErrorClassValues = [
  'auth_failure',
  'permission_denied',
  'provider_outage',
  'mapping_failure',
  'business_conflict',
  'rate_limited',
  'target_not_found',
] as const;
export type SyncErrorClass = (typeof SyncErrorClassValues)[number];

export const ConflictClassValues = [
  'field_authority_conflict',
  'concurrent_edit_conflict',
  'status_model_conflict',
  'schema_mismatch_conflict',
  'deleted_externally_conflict',
  'stale_snapshot_conflict',
  'custom_field_conflict',
] as const;
export type ConflictClass = (typeof ConflictClassValues)[number];

export const ConflictSeverityValues = ['blocking', 'degraded', 'informational'] as const;
export type ConflictSeverity = (typeof ConflictSeverityValues)[number];

export const ConflictResolutionPathValues = [
  'auto_resolve_by_authority',
  'manual_review',
  'remap',
  'replay_after_fix',
  'dismiss',
  'escalate',
] as const;
export type ConflictResolutionPath = (typeof ConflictResolutionPathValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface ParityScore {
  dimension: ParityDimension;
  score: number;
  notes: string | null;
}

export interface ProviderDepthProfile {
  profileId: string;
  providerId: string;
  providerName: string;
  tier: ProviderTier;
  parityDimensions: ParityScore[];
  limitations: string[];
  displayContract: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorAuthRecord {
  recordId: string;
  connectorId: string;
  organizationId: string;
  authState: ConnectorAuthState;
  previousState: ConnectorAuthState | null;
  transitionedAt: string;
  transitionedBy: string;
  reason: string | null;
}

export interface BusinessObjectSyncState {
  syncStateId: string;
  objectType: SyncObjectType;
  objectId: string;
  connectorId: string;
  organizationId: string;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  staleSince: string | null;
  errorClass: SyncErrorClass | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictRecord {
  conflictId: string;
  objectSyncStateId: string;
  organizationId: string;
  conflictClass: ConflictClass;
  severity: ConflictSeverity;
  resolutionPath: ConflictResolutionPath | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ParityScoreSchema = z.object({
  dimension: z.enum(ParityDimensionValues),
  score: z.number().min(0).max(10),
  notes: z.string().nullable(),
});

export const ProviderDepthProfileSchema = z.object({
  profileId: z.string().uuid(),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  tier: z.enum(ProviderTierValues),
  parityDimensions: z.array(ParityScoreSchema),
  limitations: z.array(z.string()),
  displayContract: z.string().min(1),
  organizationId: z.string().uuid(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ConnectorAuthRecordSchema = z.object({
  recordId: z.string().uuid(),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  authState: z.enum(ConnectorAuthStateValues),
  previousState: z.enum(ConnectorAuthStateValues).nullable(),
  transitionedAt: z.string().min(1),
  transitionedBy: z.string().min(1),
  reason: z.string().nullable(),
});

export const BusinessObjectSyncStateSchema = z.object({
  syncStateId: z.string().uuid(),
  objectType: z.enum(SyncObjectTypeValues),
  objectId: z.string().min(1),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  syncStatus: z.enum(SyncStatusValues),
  lastSyncedAt: z.string().nullable(),
  staleSince: z.string().nullable(),
  errorClass: z.enum(SyncErrorClassValues).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ConflictRecordSchema = z.object({
  conflictId: z.string().uuid(),
  objectSyncStateId: z.string().uuid(),
  organizationId: z.string().uuid(),
  conflictClass: z.enum(ConflictClassValues),
  severity: z.enum(ConflictSeverityValues),
  resolutionPath: z.enum(ConflictResolutionPathValues).nullable(),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface SetConnectorAuthStateParams {
  connectorId: string;
  organizationId: string;
  targetState: ConnectorAuthState;
  transitionedBy: string;
  reason?: string | null;
}

export const SetConnectorAuthStateParamsSchema = z.object({
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  targetState: z.enum(ConnectorAuthStateValues),
  transitionedBy: z.string().min(1),
  reason: z.string().nullable().optional(),
});

export interface RegisterProviderProfileParams {
  providerId: string;
  providerName: string;
  tier: ProviderTier;
  parityDimensions: ParityScore[];
  limitations: string[];
  displayContract: string;
  organizationId: string;
}

export const RegisterProviderProfileParamsSchema = z.object({
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  tier: z.enum(ProviderTierValues),
  parityDimensions: z.array(ParityScoreSchema),
  limitations: z.array(z.string()),
  displayContract: z.string().min(1),
  organizationId: z.string().uuid(),
});

export interface UpdateObjectSyncStateParams {
  objectType: SyncObjectType;
  objectId: string;
  connectorId: string;
  organizationId: string;
  syncStatus: SyncStatus;
  errorClass?: SyncErrorClass | null;
}

export const UpdateObjectSyncStateParamsSchema = z.object({
  objectType: z.enum(SyncObjectTypeValues),
  objectId: z.string().min(1),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  syncStatus: z.enum(SyncStatusValues),
  errorClass: z.enum(SyncErrorClassValues).nullable().optional(),
});

export interface RecordConflictParams {
  objectSyncStateId: string;
  organizationId: string;
  conflictClass: ConflictClass;
  severity: ConflictSeverity;
}

export const RecordConflictParamsSchema = z.object({
  objectSyncStateId: z.string().uuid(),
  organizationId: z.string().uuid(),
  conflictClass: z.enum(ConflictClassValues),
  severity: z.enum(ConflictSeverityValues),
});

// ==========================================
// AUTH STATE MACHINE
// ==========================================

/**
 * Valid auth state transitions.
 * Key = current state, Value = set of allowed target states.
 */
export const AUTH_STATE_TRANSITIONS: Record<ConnectorAuthState, readonly ConnectorAuthState[]> = {
  not_connected: ['connecting'],
  connecting: ['connected_pending_verification', 'not_connected'],
  connected_pending_verification: ['healthy', 'not_connected'],
  healthy: ['degraded_reauth_needed', 'degraded_scope_limited', 'suspended', 'disconnected'],
  degraded_reauth_needed: ['connecting', 'healthy', 'suspended', 'disconnected'],
  degraded_scope_limited: ['healthy', 'suspended', 'disconnected'],
  suspended: ['healthy', 'disconnected'],
  disconnected: [],
} as const;
