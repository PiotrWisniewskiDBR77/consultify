/**
 * V8 Replay, Dead-Letter and Edge Reliability — Core Primitives
 *
 * Durable failure handling for PM sync: dead-letter queue, replay semantics,
 * retry policies, provider health, and schema drift detection.
 * Canonical sources: WP-W5-EXT-02, Decisions W5-4 through W5-8.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ErrorClassValues = [
  'auth_failure',
  'permission_denied',
  'provider_outage',
  'mapping_failure',
  'business_conflict',
  'rate_limited',
  'target_not_found',
] as const;
export type ErrorClass = (typeof ErrorClassValues)[number];

export const ReplayEligibilityValues = ['eligible', 'blocked', 'requires_fix'] as const;
export type ReplayEligibility = (typeof ReplayEligibilityValues)[number];

export const ResolutionStateValues = [
  'pending_review',
  'replayed',
  'dismissed',
  'escalated',
  'remapped',
] as const;
export type ResolutionState = (typeof ResolutionStateValues)[number];

export const BackoffFamilyValues = ['exponential', 'linear', 'fixed'] as const;
export type BackoffFamily = (typeof BackoffFamilyValues)[number];

export const ReplayTypeValues = ['single', 'bulk'] as const;
export type ReplayType = (typeof ReplayTypeValues)[number];

export const ReplayStatusValues = ['pending', 'in_progress', 'completed', 'failed'] as const;
export type ReplayStatus = (typeof ReplayStatusValues)[number];

export const HealthStatusValues = ['healthy', 'degraded', 'unhealthy', 'unknown'] as const;
export type HealthStatus = (typeof HealthStatusValues)[number];

export const DriftTypeValues = [
  'field_added',
  'field_removed',
  'field_type_changed',
  'enum_value_changed',
  'endpoint_deprecated',
  'breaking_response_change',
] as const;
export type DriftType = (typeof DriftTypeValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface DeadLetterRecord {
  deadLetterId: string;
  originalJobRef: string;
  originalPayloadRef: string | null;
  eventName: string;
  connectorId: string;
  organizationId: string;
  providerKey: string;
  objectType: string;
  objectRef: string;
  reason: string;
  errorClass: ErrorClass;
  replayEligibility: ReplayEligibility;
  retryCount: number;
  lastAttemptAt: string;
  deadLetteredAt: string;
  correlationId: string;
  operatorNote: string | null;
  resolutionState: ResolutionState;
  createdAt: string;
  updatedAt: string;
}

export interface RetryPolicy {
  policyId: string;
  connectorFamily: string;
  organizationId: string;
  maxAttemptClasses: Record<string, number>;
  backoffFamily: BackoffFamily;
  jitterEnabled: boolean;
  escalationHandoff: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulkReplaySafeguards {
  scopeFilter: Record<string, unknown>;
  previewCount: number;
  rateLimit: number;
  requireConfirmation: boolean;
}

export interface ReplayRequest {
  replayId: string;
  deadLetterId: string;
  organizationId: string;
  replayType: ReplayType;
  requestedBy: string;
  status: ReplayStatus;
  safeguards: BulkReplaySafeguards | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderHealthModel {
  healthId: string;
  providerKey: string;
  organizationId: string;
  authHealth: HealthStatus;
  transportHealth: HealthStatus;
  schemaHealth: HealthStatus;
  syncFreshness: HealthStatus;
  replayPressure: HealthStatus;
  deadLetterPressure: HealthStatus;
  overallHealth: HealthStatus;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaDriftEvent {
  eventId: string;
  connectorId: string;
  organizationId: string;
  driftType: DriftType;
  affectedFields: string[];
  detectedAt: string;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const DeadLetterRecordSchema = z.object({
  deadLetterId: z.string().uuid(),
  originalJobRef: z.string().min(1),
  originalPayloadRef: z.string().nullable(),
  eventName: z.string().min(1),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  providerKey: z.string().min(1),
  objectType: z.string().min(1),
  objectRef: z.string().min(1),
  reason: z.string().min(1),
  errorClass: z.enum(ErrorClassValues),
  replayEligibility: z.enum(ReplayEligibilityValues),
  retryCount: z.number().int().min(0),
  lastAttemptAt: z.string().min(1),
  deadLetteredAt: z.string().min(1),
  correlationId: z.string().min(1),
  operatorNote: z.string().nullable(),
  resolutionState: z.enum(ResolutionStateValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const RetryPolicySchema = z.object({
  policyId: z.string().uuid(),
  connectorFamily: z.string().min(1),
  organizationId: z.string().uuid(),
  maxAttemptClasses: z.record(z.string(), z.number().int().min(1)),
  backoffFamily: z.enum(BackoffFamilyValues),
  jitterEnabled: z.boolean(),
  escalationHandoff: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const BulkReplaySafeguardsSchema = z.object({
  scopeFilter: z.record(z.string(), z.unknown()),
  previewCount: z.number().int().min(0),
  rateLimit: z.number().int().min(1),
  requireConfirmation: z.boolean(),
});

export const ReplayRequestSchema = z.object({
  replayId: z.string().uuid(),
  deadLetterId: z.string().uuid(),
  organizationId: z.string().uuid(),
  replayType: z.enum(ReplayTypeValues),
  requestedBy: z.string().min(1),
  status: z.enum(ReplayStatusValues),
  safeguards: BulkReplaySafeguardsSchema.nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ProviderHealthModelSchema = z.object({
  healthId: z.string().uuid(),
  providerKey: z.string().min(1),
  organizationId: z.string().uuid(),
  authHealth: z.enum(HealthStatusValues),
  transportHealth: z.enum(HealthStatusValues),
  schemaHealth: z.enum(HealthStatusValues),
  syncFreshness: z.enum(HealthStatusValues),
  replayPressure: z.enum(HealthStatusValues),
  deadLetterPressure: z.enum(HealthStatusValues),
  overallHealth: z.enum(HealthStatusValues),
  lastCheckedAt: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const SchemaDriftEventSchema = z.object({
  eventId: z.string().uuid(),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  driftType: z.enum(DriftTypeValues),
  affectedFields: z.array(z.string()),
  detectedAt: z.string().min(1),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateDeadLetterRecordParams {
  originalJobRef: string;
  originalPayloadRef?: string | null;
  eventName: string;
  connectorId: string;
  organizationId: string;
  providerKey: string;
  objectType: string;
  objectRef: string;
  reason: string;
  errorClass: ErrorClass;
  replayEligibility: ReplayEligibility;
  retryCount: number;
  lastAttemptAt: string;
  correlationId: string;
  operatorNote?: string | null;
}

export const CreateDeadLetterRecordParamsSchema = z.object({
  originalJobRef: z.string().min(1),
  originalPayloadRef: z.string().nullable().optional(),
  eventName: z.string().min(1),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  providerKey: z.string().min(1),
  objectType: z.string().min(1),
  objectRef: z.string().min(1),
  reason: z.string().min(1),
  errorClass: z.enum(ErrorClassValues),
  replayEligibility: z.enum(ReplayEligibilityValues),
  retryCount: z.number().int().min(0),
  lastAttemptAt: z.string().min(1),
  correlationId: z.string().min(1),
  operatorNote: z.string().nullable().optional(),
});

export interface SetRetryPolicyParams {
  connectorFamily: string;
  organizationId: string;
  maxAttemptClasses: Record<string, number>;
  backoffFamily: BackoffFamily;
  jitterEnabled: boolean;
  escalationHandoff?: string | null;
}

export const SetRetryPolicyParamsSchema = z.object({
  connectorFamily: z.string().min(1),
  organizationId: z.string().uuid(),
  maxAttemptClasses: z.record(z.string(), z.number().int().min(1)),
  backoffFamily: z.enum(BackoffFamilyValues),
  jitterEnabled: z.boolean(),
  escalationHandoff: z.string().nullable().optional(),
});

export interface RequestReplayParams {
  deadLetterId: string;
  organizationId: string;
  replayType: ReplayType;
  requestedBy: string;
  safeguards?: BulkReplaySafeguards | null;
}

export const RequestReplayParamsSchema = z.object({
  deadLetterId: z.string().uuid(),
  organizationId: z.string().uuid(),
  replayType: z.enum(ReplayTypeValues),
  requestedBy: z.string().min(1),
  safeguards: BulkReplaySafeguardsSchema.nullable().optional(),
});

export interface RecordProviderHealthParams {
  providerKey: string;
  organizationId: string;
  authHealth: HealthStatus;
  transportHealth: HealthStatus;
  schemaHealth: HealthStatus;
  syncFreshness: HealthStatus;
  replayPressure: HealthStatus;
  deadLetterPressure: HealthStatus;
  overallHealth: HealthStatus;
}

export const RecordProviderHealthParamsSchema = z.object({
  providerKey: z.string().min(1),
  organizationId: z.string().uuid(),
  authHealth: z.enum(HealthStatusValues),
  transportHealth: z.enum(HealthStatusValues),
  schemaHealth: z.enum(HealthStatusValues),
  syncFreshness: z.enum(HealthStatusValues),
  replayPressure: z.enum(HealthStatusValues),
  deadLetterPressure: z.enum(HealthStatusValues),
  overallHealth: z.enum(HealthStatusValues),
});

export interface RecordSchemaDriftParams {
  connectorId: string;
  organizationId: string;
  driftType: DriftType;
  affectedFields: string[];
}

export const RecordSchemaDriftParamsSchema = z.object({
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  driftType: z.enum(DriftTypeValues),
  affectedFields: z.array(z.string().min(1)).min(1),
});

// ==========================================
// DEAD-LETTER RETENTION POLICY (Decision W5-6)
// ==========================================

export const DEAD_LETTER_RETENTION_DAYS = 90;
