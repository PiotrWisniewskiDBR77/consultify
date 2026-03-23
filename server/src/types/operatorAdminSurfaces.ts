/**
 * V8 Operator/Admin Surfaces — Core Primitives
 *
 * Connector fleet health, connector packages (Decision W5-9),
 * support notes (Decision W5-10), emergency pause (Decision W5-11),
 * and fleet health signals.
 * Canonical sources: WP-W5-EXT-03, Decisions W5-9/10/11.
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

export const DriftStateValues = ['none', 'schema', 'mapping', 'auth', 'policy'] as const;
export type DriftState = (typeof DriftStateValues)[number];

export const PackageLifecycleStateValues = [
  'draft',
  'published',
  'deprecated',
  'retired',
] as const;
export type PackageLifecycleState = (typeof PackageLifecycleStateValues)[number];

export const SupportNoteAuthorRoleValues = ['support', 'operator'] as const;
export type SupportNoteAuthorRole = (typeof SupportNoteAuthorRoleValues)[number];

export const EmergencyPauseScopeValues = ['all_connectors', 'provider_type'] as const;
export type EmergencyPauseScope = (typeof EmergencyPauseScopeValues)[number];

export const FleetHealthSignalTypeValues = [
  'degraded_auth_count',
  'sync_failure_rate',
  'dead_letter_depth',
  'conflict_depth',
  'provider_error_rate',
  'staleness_breach_rate',
  'reauth_pending_duration',
] as const;
export type FleetHealthSignalType = (typeof FleetHealthSignalTypeValues)[number];

export const PackageCapabilityValues = [
  'import',
  'publish',
  'bidirectional',
  'mirror_local_authority',
  'webhook_inbound',
  'webhook_outbound',
  'field_mapping',
  'custom_fields',
] as const;
export type PackageCapability = (typeof PackageCapabilityValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface ConnectorFleetHealthEntry {
  entryId: string;
  connectorId: string;
  organizationId: string;
  providerKey: string;
  authState: ConnectorAuthState;
  providerTier: ProviderTier;
  lastSyncSuccess: string | null;
  lastSyncFailure: string | null;
  stalenessIndicator: number;
  driftState: DriftState;
  deadLetterCount: number;
  conflictCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorPackage {
  packageId: string;
  providerKey: string;
  packageVersion: string;
  capabilities: PackageCapability[];
  lifecycleState: PackageLifecycleState;
  tenantInstallable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantConnectorInstallation {
  installationId: string;
  packageId: string;
  organizationId: string;
  enabledBy: string;
  configurationScope: string;
  installedAt: string;
}

export interface SupportNote {
  noteId: string;
  incidentRef: string;
  connectorId: string;
  organizationId: string;
  authorId: string;
  authorRole: SupportNoteAuthorRole;
  content: string;
  createdAt: string;
}

export interface EmergencyPause {
  pauseId: string;
  organizationId: string;
  pauseScope: EmergencyPauseScope;
  providerKey: string | null;
  pausedBy: string;
  reason: string;
  blastRadius: number;
  pausedAt: string;
  resumedAt: string | null;
  resumedBy: string | null;
}

export interface FleetHealthSignal {
  signalType: FleetHealthSignalType;
  threshold: number;
  currentValue: number;
  breached: boolean;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ConnectorFleetHealthEntrySchema = z.object({
  entryId: z.string().uuid(),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  providerKey: z.string().min(1),
  authState: z.enum(ConnectorAuthStateValues),
  providerTier: z.enum(ProviderTierValues),
  lastSyncSuccess: z.string().nullable(),
  lastSyncFailure: z.string().nullable(),
  stalenessIndicator: z.number().min(0),
  driftState: z.enum(DriftStateValues),
  deadLetterCount: z.number().int().min(0),
  conflictCount: z.number().int().min(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ConnectorPackageSchema = z.object({
  packageId: z.string().uuid(),
  providerKey: z.string().min(1),
  packageVersion: z.string().min(1),
  capabilities: z.array(z.enum(PackageCapabilityValues)),
  lifecycleState: z.enum(PackageLifecycleStateValues),
  tenantInstallable: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const TenantConnectorInstallationSchema = z.object({
  installationId: z.string().uuid(),
  packageId: z.string().uuid(),
  organizationId: z.string().uuid(),
  enabledBy: z.string().min(1),
  configurationScope: z.string().min(1),
  installedAt: z.string().min(1),
});

export const SupportNoteSchema = z.object({
  noteId: z.string().uuid(),
  incidentRef: z.string().min(1),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  authorId: z.string().min(1),
  authorRole: z.enum(SupportNoteAuthorRoleValues),
  content: z.string().min(1),
  createdAt: z.string().min(1),
});

export const EmergencyPauseSchema = z.object({
  pauseId: z.string().uuid(),
  organizationId: z.string().uuid(),
  pauseScope: z.enum(EmergencyPauseScopeValues),
  providerKey: z.string().nullable(),
  pausedBy: z.string().min(1),
  reason: z.string().min(1),
  blastRadius: z.number().int().min(0),
  pausedAt: z.string().min(1),
  resumedAt: z.string().nullable(),
  resumedBy: z.string().nullable(),
});

export const FleetHealthSignalSchema = z.object({
  signalType: z.enum(FleetHealthSignalTypeValues),
  threshold: z.number(),
  currentValue: z.number(),
  breached: z.boolean(),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RecordFleetHealthParams {
  connectorId: string;
  organizationId: string;
  providerKey: string;
  authState: ConnectorAuthState;
  providerTier: ProviderTier;
  lastSyncSuccess?: string | null;
  lastSyncFailure?: string | null;
  stalenessIndicator: number;
  driftState: DriftState;
  deadLetterCount: number;
  conflictCount: number;
}

export const RecordFleetHealthParamsSchema = z.object({
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  providerKey: z.string().min(1),
  authState: z.enum(ConnectorAuthStateValues),
  providerTier: z.enum(ProviderTierValues),
  lastSyncSuccess: z.string().nullable().optional(),
  lastSyncFailure: z.string().nullable().optional(),
  stalenessIndicator: z.number().min(0),
  driftState: z.enum(DriftStateValues),
  deadLetterCount: z.number().int().min(0),
  conflictCount: z.number().int().min(0),
});

export interface RegisterPackageParams {
  providerKey: string;
  packageVersion: string;
  capabilities: PackageCapability[];
  lifecycleState: PackageLifecycleState;
  tenantInstallable: boolean;
}

export const RegisterPackageParamsSchema = z.object({
  providerKey: z.string().min(1),
  packageVersion: z.string().min(1),
  capabilities: z.array(z.enum(PackageCapabilityValues)).min(1),
  lifecycleState: z.enum(PackageLifecycleStateValues),
  tenantInstallable: z.boolean(),
});

export interface InstallPackageForTenantParams {
  packageId: string;
  organizationId: string;
  enabledBy: string;
  configurationScope: string;
}

export const InstallPackageForTenantParamsSchema = z.object({
  packageId: z.string().uuid(),
  organizationId: z.string().uuid(),
  enabledBy: z.string().min(1),
  configurationScope: z.string().min(1),
});

export interface AddSupportNoteParams {
  incidentRef: string;
  connectorId: string;
  organizationId: string;
  authorId: string;
  authorRole: SupportNoteAuthorRole;
  content: string;
}

export const AddSupportNoteParamsSchema = z.object({
  incidentRef: z.string().min(1),
  connectorId: z.string().min(1),
  organizationId: z.string().uuid(),
  authorId: z.string().min(1),
  authorRole: z.enum(SupportNoteAuthorRoleValues),
  content: z.string().min(1),
});

export interface InitiateEmergencyPauseParams {
  organizationId: string;
  pauseScope: EmergencyPauseScope;
  providerKey?: string | null;
  pausedBy: string;
  reason: string;
  blastRadius: number;
}

export const InitiateEmergencyPauseParamsSchema = z.object({
  organizationId: z.string().uuid(),
  pauseScope: z.enum(EmergencyPauseScopeValues),
  providerKey: z.string().nullable().optional(),
  pausedBy: z.string().min(1),
  reason: z.string().min(1),
  blastRadius: z.number().int().min(0),
});

// ==========================================
// FLEET HEALTH SIGNAL THRESHOLDS
// ==========================================

export const FLEET_HEALTH_SIGNAL_THRESHOLDS: Record<FleetHealthSignalType, number> = {
  degraded_auth_count: 1,
  sync_failure_rate: 10,
  dead_letter_depth: 1,
  conflict_depth: 10,
  provider_error_rate: 5,
  staleness_breach_rate: 15,
  reauth_pending_duration: 4,
} as const;
