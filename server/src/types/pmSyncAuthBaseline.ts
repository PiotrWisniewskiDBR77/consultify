/**
 * V8 PM Sync Auth Baseline — Wave 5 Auth Lifecycle Hardening Primitives
 *
 * Extends Wave 1 PM Sync Platform Truth with production-grade auth lifecycle
 * governance: token management, refresh timing, transient-failure discrimination,
 * degraded-state escalation, and admin re-binding.
 *
 * Canonical sources: WP-W5-EXT-01, Decisions W5-1, W5-2, W5-3.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const LastRefreshResultValues = [
  'success',
  'transient_failure',
  'credential_expired',
  'scope_revoked',
] as const;
export type LastRefreshResult = (typeof LastRefreshResultValues)[number];

export const TransientFailureTypeValues = [
  'network_timeout',
  'rate_limit',
  'transient_5xx',
  'temporary_outage',
  'webhook_delivery_issue',
] as const;
export type TransientFailureType = (typeof TransientFailureTypeValues)[number];

export const AuthBreakFailureTypeValues = [
  'expired_token',
  'revoked_token',
  'missing_scope',
  'invalid_refresh',
  'account_disconnected',
  'user_removed',
] as const;
export type AuthBreakFailureType = (typeof AuthBreakFailureTypeValues)[number];

export const FailureActionValues = ['retry_later', 'reauth_now'] as const;
export type FailureAction = (typeof FailureActionValues)[number];

export const EscalationLevelValues = [
  'healthy',
  'degraded',
  'critical',
  'disconnected_candidate',
] as const;
export type EscalationLevel = (typeof EscalationLevelValues)[number];

export const ProviderFamilyValues = [
  'google_workspace',
  'microsoft_365',
  'atlassian',
  'asana',
  'monday',
  'clickup',
  'linear',
] as const;
export type ProviderFamily = (typeof ProviderFamilyValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface ConnectionCredentialRef {
  credentialId: string;
  connectorId: string;
  organizationId: string;
  providerAccountId: string;
  workspaceOrTenantId: string;
  scopesGranted: string[];
  tokenExpiresAt: string | null;
  lastVerificationAt: string | null;
  lastRefreshAt: string | null;
  lastRefreshResult: LastRefreshResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefreshTimingPolicy {
  policyId: string;
  providerFamily: ProviderFamily;
  organizationId: string;
  typicalTokenLifetimeMinutes: number;
  refreshWindowMinutes: number;
  maxRetryAttempts: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Decision W5-2: Transient failure → retry_later
 */
export interface TransientFailureClassification {
  failureType: TransientFailureType;
  action: 'retry_later';
}

/**
 * Decision W5-2: Auth break → reauth_now
 */
export interface AuthBreakClassification {
  failureType: AuthBreakFailureType;
  action: 'reauth_now';
}

/**
 * Decision W5-3: Escalation ladder thresholds (hours)
 */
export interface DegradedEscalationLadder {
  degradedThresholdHours: number;
  criticalThresholdHours: number;
  disconnectedCandidateHours: number;
}

/**
 * Decision W5-1: Admin re-bind audit record
 */
export interface AdminReBindRecord {
  reBindId: string;
  connectorId: string;
  organizationId: string;
  oldCredentialRef: string;
  newCredentialRef: string;
  actorId: string;
  reason: string;
  auditTimestamp: string;
}

/** Recorded auth-break escalation for operator recovery (Wave 12). */
export interface AuthEscalationRecord {
  escalationId: string;
  organizationId: string;
  connectorId: string;
  reason: string | null;
  escalatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

/** Org-level credential health rollup (Wave 12). */
export interface CredentialHealthSummary {
  total: number;
  healthy: number;
  failing: number;
  escalated: number;
}

// ==========================================
// DEFAULT ESCALATION LADDER (Decision W5-3)
// ==========================================

export const DEFAULT_ESCALATION_LADDER: DegradedEscalationLadder = {
  degradedThresholdHours: 4,
  criticalThresholdHours: 24,
  disconnectedCandidateHours: 72,
} as const;

// ==========================================
// FAILURE CLASSIFICATION MAPS (Decision W5-2)
// ==========================================

export const TRANSIENT_FAILURE_TYPES: ReadonlySet<string> = new Set<string>(
  TransientFailureTypeValues,
);

export const AUTH_BREAK_FAILURE_TYPES: ReadonlySet<string> = new Set<string>(
  AuthBreakFailureTypeValues,
);

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ConnectionCredentialRefSchema = z.object({
  credentialId: z.string().uuid(),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  providerAccountId: z.string().min(1),
  workspaceOrTenantId: z.string().min(1),
  scopesGranted: z.array(z.string()),
  tokenExpiresAt: z.string().nullable(),
  lastVerificationAt: z.string().nullable(),
  lastRefreshAt: z.string().nullable(),
  lastRefreshResult: z.enum(LastRefreshResultValues).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const RefreshTimingPolicySchema = z.object({
  policyId: z.string().uuid(),
  providerFamily: z.enum(ProviderFamilyValues),
  organizationId: z.string().uuid(),
  typicalTokenLifetimeMinutes: z.number().int().positive(),
  refreshWindowMinutes: z.number().int().positive(),
  maxRetryAttempts: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const AdminReBindRecordSchema = z.object({
  reBindId: z.string().uuid(),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  oldCredentialRef: z.string().uuid(),
  newCredentialRef: z.string().uuid(),
  actorId: z.string().min(1),
  reason: z.string().min(1),
  auditTimestamp: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface StoreCredentialParams {
  connectorId: string;
  organizationId: string;
  providerAccountId: string;
  workspaceOrTenantId: string;
  scopesGranted: string[];
  tokenExpiresAt?: string | null;
}

export const StoreCredentialParamsSchema = z.object({
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  providerAccountId: z.string().min(1),
  workspaceOrTenantId: z.string().min(1),
  scopesGranted: z.array(z.string()).min(1),
  tokenExpiresAt: z.string().nullable().optional(),
});

export interface RecordRefreshResultParams {
  connectorId: string;
  organizationId: string;
  result: LastRefreshResult;
}

export const RecordRefreshResultParamsSchema = z.object({
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  result: z.enum(LastRefreshResultValues),
});

export interface SetRefreshTimingPolicyParams {
  providerFamily: ProviderFamily;
  organizationId: string;
  typicalTokenLifetimeMinutes: number;
  refreshWindowMinutes: number;
  maxRetryAttempts: number;
}

export const SetRefreshTimingPolicyParamsSchema = z.object({
  providerFamily: z.enum(ProviderFamilyValues),
  organizationId: z.string().uuid(),
  typicalTokenLifetimeMinutes: z.number().int().positive(),
  refreshWindowMinutes: z.number().int().positive(),
  maxRetryAttempts: z.number().int().min(1),
});

export interface RecordAdminReBindParams {
  connectorId: string;
  organizationId: string;
  oldCredentialRef: string;
  newCredentialRef: string;
  actorId: string;
  reason: string;
}

export const RecordAdminReBindParamsSchema = z.object({
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  oldCredentialRef: z.string().uuid(),
  newCredentialRef: z.string().uuid(),
  actorId: z.string().min(1),
  reason: z.string().min(1),
});
