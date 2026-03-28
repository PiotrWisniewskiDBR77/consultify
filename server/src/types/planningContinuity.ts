/**
 * V8 Planning/Approval Continuity — Core Type Family
 *
 * WP-W3-LIFECYCLE-02: Planning and Approval Continuity primitives.
 * Tracks initiative decomposition (WBS), material change detection,
 * cross-initiative dependencies, and decision chains.
 *
 * Decisions implemented:
 *   W3-4 — WBS depth model (4-level max)
 *   W3-5 — Material change threshold
 *   W3-6 — Cross-initiative dependency model
 *   W3-7 — Decision chain model (sequential | parallel | delegated)
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

/** Decision W3-4: 4-level canonical WBS depth */
export const WBSLevelValues = ['initiative', 'workstream_phase', 'task', 'subtask'] as const;
export type WBSLevel = (typeof WBSLevelValues)[number];

export const WBS_MAX_DEPTH = 4;

export const WBS_DEPTH_MAP: Record<WBSLevel, number> = {
  initiative: 1,
  workstream_phase: 2,
  task: 3,
  subtask: 4,
} as const;

export const DecompositionObjectTypeValues = [
  'workstream',
  'task',
  'subtask',
  'checklist_item',
] as const;
export type DecompositionObjectType = (typeof DecompositionObjectTypeValues)[number];

/** Decision W3-5: dimensions that determine materiality */
export const AffectedDimensionValues = [
  'scope',
  'timeline',
  'critical_path',
  'capacity',
  'cost',
  'external_dependency',
  'quality',
  'benefit_kpi',
] as const;
export type AffectedDimension = (typeof AffectedDimensionValues)[number];

export const CrossDependencyTypeValues = [
  'blocks',
  'blocked_by',
  'depends_on',
  'enables',
  'shares_resource',
  'shares_milestone',
] as const;
export type CrossDependencyType = (typeof CrossDependencyTypeValues)[number];

export const CrossDependencyStatusValues = ['active', 'resolved', 'broken', 'cancelled'] as const;
export type CrossDependencyStatus = (typeof CrossDependencyStatusValues)[number];

/** Decision W3-7: lightweight chain types */
export const DecisionChainTypeValues = ['sequential', 'parallel', 'delegated'] as const;
export type DecisionChainType = (typeof DecisionChainTypeValues)[number];

export const DecisionChainStatusValues = ['open', 'in_progress', 'completed', 'cancelled'] as const;
export type DecisionChainStatus = (typeof DecisionChainStatusValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface InitiativeDecomposition {
  decompositionId: string;
  organizationId: string;
  initiativeId: string;
  parentId: string | null;
  wbsLevel: WBSLevel;
  objectType: DecompositionObjectType;
  objectId: string;
  approvalInherited: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface MaterialChangeCheck {
  isMaterial: boolean;
  affectedDimensions: AffectedDimension[];
  requiresChangeManagement: boolean;
  summary: string | null;
}

export interface CrossInitiativeDependency {
  dependencyId: string;
  organizationId: string;
  sourceInitiativeId: string;
  targetInitiativeId: string;
  dependencyType: CrossDependencyType;
  status: CrossDependencyStatus;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface DecisionChainEntry {
  decisionId: string;
  order: number;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'skipped';
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface DecisionChain {
  chainId: string;
  organizationId: string;
  initiativeId: string;
  chainType: DecisionChainType;
  decisions: DecisionChainEntry[];
  status: DecisionChainStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const InitiativeDecompositionSchema = z.object({
  decompositionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  wbsLevel: z.enum(WBSLevelValues),
  objectType: z.enum(DecompositionObjectTypeValues),
  objectId: z.string().min(1),
  approvalInherited: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

export const MaterialChangeCheckSchema = z.object({
  isMaterial: z.boolean(),
  affectedDimensions: z.array(z.enum(AffectedDimensionValues)),
  requiresChangeManagement: z.boolean(),
  summary: z.string().nullable(),
});

export const DecisionChainEntrySchema = z.object({
  decisionId: z.string().min(1),
  order: z.number().int().min(0),
  status: z.enum(['pending', 'approved', 'rejected', 'delegated', 'skipped']),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
});

export const CrossInitiativeDependencySchema = z.object({
  dependencyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  sourceInitiativeId: z.string().uuid(),
  targetInitiativeId: z.string().uuid(),
  dependencyType: z.enum(CrossDependencyTypeValues),
  status: z.enum(CrossDependencyStatusValues),
  description: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

export const DecisionChainSchema = z.object({
  chainId: z.string().uuid(),
  organizationId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  chainType: z.enum(DecisionChainTypeValues),
  decisions: z.array(DecisionChainEntrySchema),
  status: z.enum(DecisionChainStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RecordDecompositionParams {
  organizationId: string;
  initiativeId: string;
  parentId?: string | null;
  wbsLevel: WBSLevel;
  objectType: DecompositionObjectType;
  objectId: string;
  approvalInherited?: boolean;
  metadata?: Record<string, unknown>;
}

export const RecordDecompositionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  wbsLevel: z.enum(WBSLevelValues),
  objectType: z.enum(DecompositionObjectTypeValues),
  objectId: z.string().min(1),
  approvalInherited: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface CheckMaterialChangeParams {
  affectedDimensions: AffectedDimension[];
  summary?: string | null;
}

export const CheckMaterialChangeParamsSchema = z.object({
  affectedDimensions: z.array(z.enum(AffectedDimensionValues)),
  summary: z.string().nullable().optional(),
});

export interface CreateCrossInitiativeDependencyParams {
  organizationId: string;
  sourceInitiativeId: string;
  targetInitiativeId: string;
  dependencyType: CrossDependencyType;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export const CreateCrossInitiativeDependencyParamsSchema = z.object({
  organizationId: z.string().uuid(),
  sourceInitiativeId: z.string().uuid(),
  targetInitiativeId: z.string().uuid(),
  dependencyType: z.enum(CrossDependencyTypeValues),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface CreateDecisionChainParams {
  organizationId: string;
  initiativeId: string;
  chainType: DecisionChainType;
  decisions: Omit<DecisionChainEntry, 'status' | 'decidedBy' | 'decidedAt'>[];
  metadata?: Record<string, unknown>;
}

export const CreateDecisionChainParamsSchema = z.object({
  organizationId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  chainType: z.enum(DecisionChainTypeValues),
  decisions: z
    .array(
      z.object({
        decisionId: z.string().min(1),
        order: z.number().int().min(0),
      })
    )
    .min(1),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

// ==========================================
// MATERIALITY THRESHOLD CONSTANTS (Decision W3-5)
// ==========================================

/**
 * Minimum number of affected dimensions to consider a change material.
 * Any single high-impact dimension (scope, timeline, critical_path, cost)
 * is also material regardless of count.
 */
export const MATERIALITY_MIN_DIMENSIONS = 1;

export const HIGH_IMPACT_DIMENSIONS: ReadonlySet<AffectedDimension> = new Set([
  'scope',
  'timeline',
  'critical_path',
  'cost',
]);
