/**
 * V8 Source Truth Preservation — WP-W3-LIFECYCLE-01
 *
 * Types for tracking how upstream artifacts (Ideas, Interviews, Assessments,
 * Chat, Manual) become initiatives while preserving origin, evidence, and
 * context traceability.
 *
 * Decisions applied:
 *   W3-1 — invisible materialization by default, explicit when truth risk increases
 *   W3-2 — dual-gate promotion: permission AND evidence class
 *   W3-3 — synced_source_refs at initiative governance level
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const InitiativeEntrypointValues = [
  'idea',
  'interview',
  'tools_assessment',
  'chat',
  'manual',
] as const;
export type InitiativeEntrypoint = (typeof InitiativeEntrypointValues)[number];

export const EntrypointClassValues = ['native_source', 'derived_source'] as const;
export type EntrypointClass = (typeof EntrypointClassValues)[number];

export const MaterializationModeValues = ['invisible', 'explicit_confirmation'] as const;
export type MaterializationMode = (typeof MaterializationModeValues)[number];

export const EvidenceClassValues = ['strong', 'moderate', 'weak', 'mixed'] as const;
export type EvidenceClass = (typeof EvidenceClassValues)[number];

export const SyncStatusValues = ['active', 'stale', 'disconnected', 'error'] as const;
export type SyncStatus = (typeof SyncStatusValues)[number];

// ==========================================
// ENTRYPOINT → CLASS MAPPING
// ==========================================

export const ENTRYPOINT_CLASS_MAP: Record<InitiativeEntrypoint, EntrypointClass> = {
  idea: 'derived_source',
  interview: 'derived_source',
  tools_assessment: 'native_source',
  chat: 'derived_source',
  manual: 'derived_source',
};

// ==========================================
// INTERFACES
// ==========================================

/**
 * Tracks how an upstream artifact became an initiative source.
 * Core traceability record per §2 of WP-W3-LIFECYCLE-01.
 */
export interface SourceMaterializationRecord {
  recordId: string;
  initiativeId: string;
  organizationId: string;
  entrypoint: InitiativeEntrypoint;
  entrypointClass: EntrypointClass;
  sourceArtifactId: string;
  sourceArtifactType: string;
  contextSnapshotId: string | null;
  materializationMode: MaterializationMode;
  evidenceClass: EvidenceClass;
  promotedBy: string;
  promotedAt: string;
  createdAt: string;
}

/**
 * Decision W3-3: synced external source reference at initiative level.
 * Preserves lineage when work enters PM/execution lifecycle.
 */
export interface SyncedSourceRef {
  refId: string;
  initiativeId: string;
  organizationId: string;
  externalSourceId: string;
  externalSystem: string;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  createdAt: string;
}

/**
 * Decision W3-2: dual-gate promotion validation.
 * Both permission AND evidence class must pass.
 */
export interface PromotionValidation {
  isAllowed: boolean;
  evidenceSufficient: boolean;
  requiresReview: boolean;
  reasons: string[];
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const SourceMaterializationRecordSchema = z.object({
  recordId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  organizationId: z.string().uuid(),
  entrypoint: z.enum(InitiativeEntrypointValues),
  entrypointClass: z.enum(EntrypointClassValues),
  sourceArtifactId: z.string().min(1),
  sourceArtifactType: z.string().min(1),
  contextSnapshotId: z.string().uuid().nullable(),
  materializationMode: z.enum(MaterializationModeValues),
  evidenceClass: z.enum(EvidenceClassValues),
  promotedBy: z.string().uuid(),
  promotedAt: z.string().min(1),
  createdAt: z.string().min(1),
});

export const SyncedSourceRefSchema = z.object({
  refId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  organizationId: z.string().uuid(),
  externalSourceId: z.string().min(1),
  externalSystem: z.string().min(1),
  syncStatus: z.enum(SyncStatusValues),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const PromotionValidationSchema = z.object({
  isAllowed: z.boolean(),
  evidenceSufficient: z.boolean(),
  requiresReview: z.boolean(),
  reasons: z.array(z.string()),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RecordMaterializationParams {
  initiativeId: string;
  organizationId: string;
  entrypoint: InitiativeEntrypoint;
  sourceArtifactId: string;
  sourceArtifactType: string;
  contextSnapshotId?: string | null;
  materializationMode?: MaterializationMode;
  evidenceClass: EvidenceClass;
  promotedBy: string;
}

export const RecordMaterializationParamsSchema = z.object({
  initiativeId: z.string().uuid(),
  organizationId: z.string().uuid(),
  entrypoint: z.enum(InitiativeEntrypointValues),
  sourceArtifactId: z.string().min(1),
  sourceArtifactType: z.string().min(1),
  contextSnapshotId: z.string().uuid().nullable().optional(),
  materializationMode: z.enum(MaterializationModeValues).optional().default('invisible'),
  evidenceClass: z.enum(EvidenceClassValues),
  promotedBy: z.string().uuid(),
});

export interface ValidatePromotionParams {
  organizationId: string;
  promotedBy: string;
  entrypoint: InitiativeEntrypoint;
  evidenceClass: EvidenceClass;
  hasPermission: boolean;
  isHighImpact?: boolean;
}

export const ValidatePromotionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  promotedBy: z.string().uuid(),
  entrypoint: z.enum(InitiativeEntrypointValues),
  evidenceClass: z.enum(EvidenceClassValues),
  hasPermission: z.boolean(),
  isHighImpact: z.boolean().optional().default(false),
});

export interface AddSyncedSourceRefParams {
  initiativeId: string;
  organizationId: string;
  externalSourceId: string;
  externalSystem: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: string | null;
}

export const AddSyncedSourceRefParamsSchema = z.object({
  initiativeId: z.string().uuid(),
  organizationId: z.string().uuid(),
  externalSourceId: z.string().min(1),
  externalSystem: z.string().min(1),
  syncStatus: z.enum(SyncStatusValues).optional().default('active'),
  lastSyncedAt: z.string().nullable().optional(),
});
