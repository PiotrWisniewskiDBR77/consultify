/**
 * V8 ContextSnapshot — Universal Identity Spine
 *
 * Core type family for the V8 runtime context model.
 * Separate from the legacy ai_context_snapshots / VersionedContextPack system.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ConsumerClassValues = ['chat', 'execution', 'retrieval', 'background', 'worker'] as const;
export type ConsumerClass = (typeof ConsumerClassValues)[number];

export const ScopeTypeValues = ['session', 'user_private', 'organization', 'system', 'external'] as const;
export type ScopeType = (typeof ScopeTypeValues)[number];

export const ArtifactRelationshipValues = ['target', 'source', 'reference'] as const;
export type ArtifactRelationship = (typeof ArtifactRelationshipValues)[number];

export const DriftTypeValues = [
  'project_switch',
  'workspace_switch',
  'artifact_removed',
  'role_change',
  'multi_tab_divergence',
] as const;
export type DriftType = (typeof DriftTypeValues)[number];

export const DriftResolutionValues = ['revalidated', 'paused', 'aborted', 'user_confirmed'] as const;
export type DriftResolution = (typeof DriftResolutionValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface V8ArtifactRef {
  artifactId: string;
  artifactType: string;
  artifactModule: string;
  relationship: ArtifactRelationship;
}

export interface SourceRef {
  sourceId: string;
  scopeType: ScopeType;
  sourceKind: string;
  freshnessAt: string | null;
}

export interface DriftEvent {
  driftType: DriftType;
  detectedAt: string;
  previousValue: string;
  currentValue: string;
  resolution: DriftResolution;
}

export interface ContextSnapshot {
  snapshotId: string;
  parentSnapshotId: string | null;
  snapshotVersion: number;
  capturedAt: string;
  workspaceId: string;
  organizationId: string;
  projectId: string | null;
  conversationId: string | null;
  executionRunId: string | null;
  artifactRefs: V8ArtifactRef[];
  effectiveScopeRef: string;
  resolvedRoleRef: string;
  initiatorUserId: string;
  consumerClass: ConsumerClass;
  privacyMode: boolean;
  sourceContextRefs: SourceRef[];
  driftEvents: DriftEvent[];
}

export interface RetrievalScopeToken {
  organizationId: string;
  effectiveScopeRef: string;
  consumerClass: ConsumerClass;
  privacyMode: boolean;
  sourceContextRefs: SourceRef[];
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const V8ArtifactRefSchema = z.object({
  artifactId: z.string().min(1),
  artifactType: z.string().min(1),
  artifactModule: z.string().min(1),
  relationship: z.enum(ArtifactRelationshipValues),
});

export const SourceRefSchema = z.object({
  sourceId: z.string().min(1),
  scopeType: z.enum(ScopeTypeValues),
  sourceKind: z.string().min(1),
  freshnessAt: z.string().nullable(),
});

export const DriftEventSchema = z.object({
  driftType: z.enum(DriftTypeValues),
  detectedAt: z.string().min(1),
  previousValue: z.string(),
  currentValue: z.string(),
  resolution: z.enum(DriftResolutionValues),
});

export const ContextSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  parentSnapshotId: z.string().uuid().nullable(),
  snapshotVersion: z.number().int().min(1),
  capturedAt: z.string().min(1),
  workspaceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
  executionRunId: z.string().uuid().nullable(),
  artifactRefs: z.array(V8ArtifactRefSchema),
  effectiveScopeRef: z.string().min(1),
  resolvedRoleRef: z.string().min(1),
  initiatorUserId: z.string().uuid(),
  consumerClass: z.enum(ConsumerClassValues),
  privacyMode: z.boolean(),
  sourceContextRefs: z.array(SourceRefSchema),
  driftEvents: z.array(DriftEventSchema),
});

export const RetrievalScopeTokenSchema = z.object({
  organizationId: z.string().uuid(),
  effectiveScopeRef: z.string().min(1),
  consumerClass: z.enum(ConsumerClassValues),
  privacyMode: z.boolean(),
  sourceContextRefs: z.array(SourceRefSchema),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CaptureSnapshotParams {
  parentSnapshotId?: string | null;
  workspaceId: string;
  organizationId: string;
  projectId?: string | null;
  conversationId?: string | null;
  executionRunId?: string | null;
  artifactRefs: V8ArtifactRef[];
  effectiveScopeRef: string;
  resolvedRoleRef: string;
  initiatorUserId: string;
  consumerClass: ConsumerClass;
  privacyMode?: boolean;
  sourceContextRefs?: SourceRef[];
}

export const CaptureSnapshotParamsSchema = z.object({
  parentSnapshotId: z.string().uuid().nullable().optional(),
  workspaceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  executionRunId: z.string().uuid().nullable().optional(),
  artifactRefs: z.array(V8ArtifactRefSchema),
  effectiveScopeRef: z.string().min(1),
  resolvedRoleRef: z.string().min(1),
  initiatorUserId: z.string().uuid(),
  consumerClass: z.enum(ConsumerClassValues),
  privacyMode: z.boolean().optional().default(false),
  sourceContextRefs: z.array(SourceRefSchema).optional().default([]),
});
