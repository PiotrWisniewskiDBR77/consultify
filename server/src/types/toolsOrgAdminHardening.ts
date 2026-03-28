/**
 * V8 Tools / Org / Admin Hardening — Type Family
 *
 * Shared tools registry, consulting-tool AI governance (session + action),
 * unified admin surface ownership, and V3→V8 bridging contracts.
 *
 * Decisions implemented:
 *  W7-5 — one shared registry, typed families (classic templates inside Known Tools)
 *  W7-6 — session sets the sandbox, action decides the gate
 *  W7-7 — shared IA at top, module settings underneath
 *  W7-8 — bridging Tools V8 SSOT connecting V3 contracts with V8 platform
 *
 * Depends on:
 *  - toolGovernance.ts (ToolRiskClass, ApprovalClass cross-refs)
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const ToolFamilyValues = [
  'consulting_framework',
  'assessment',
  'diagnostic',
  'workshop',
  'custom',
] as const;
export type ToolFamily = (typeof ToolFamilyValues)[number];

export const CatalogVisibilityValues = ['published', 'draft', 'internal_only'] as const;
export type CatalogVisibility = (typeof CatalogVisibilityValues)[number];

export const SessionModeValues = ['guided', 'expert', 'ai_assisted'] as const;
export type SessionMode = (typeof SessionModeValues)[number];

export const GateDecisionValues = ['execute', 'propose', 'requires_approval', 'blocked'] as const;
export type GateDecision = (typeof GateDecisionValues)[number];

export const OwnerLayerValues = ['organization_settings', 'superadmin', 'module_embedded'] as const;
export type OwnerLayer = (typeof OwnerLayerValues)[number];

export const BridgingStatusValues = ['draft', 'active', 'superseded'] as const;
export type BridgingStatus = (typeof BridgingStatusValues)[number];

// ==========================================
// INTERFACES — Decision W7-5: Shared Tools Registry
// ==========================================

export interface SharedToolsRegistryEntry {
  toolId: string;
  organizationId: string;
  toolName: string;
  toolFamily: ToolFamily;
  toolSubtype: string | null;
  isClassicFrameworkTemplate: boolean;
  knowledgeBankRef: string | null;
  catalogVisibility: CatalogVisibility;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// INTERFACES — Decision W7-6: Session + Action Governance
// ==========================================

export interface ToolSessionGovernance {
  sessionId: string;
  toolId: string;
  userId: string;
  organizationId: string;
  sessionMode: SessionMode;
  permissionScope: string;
  contextBoundary: string;
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ToolActionGovernance {
  actionId: string;
  sessionId: string;
  organizationId: string;
  actionType: string;
  gateDecision: GateDecision;
  gateReason: string | null;
  createdAt: string;
}

// ==========================================
// INTERFACES — Decision W7-7: Admin Surface Ownership
// ==========================================

export interface AdminSurfaceOwnership {
  surfaceId: string;
  surfaceName: string;
  organizationId: string;
  ownerLayer: OwnerLayer;
  moduleName: string | null;
  horizontalLayerRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// INTERFACES — Decision W7-8: V3→V8 Bridging
// ==========================================

export interface ToolsV8BridgingContract {
  contractId: string;
  toolId: string;
  organizationId: string;
  v3ToolContractRef: string;
  v8PlatformRequirements: string[];
  v8AIGovernanceRef: string | null;
  v8SessionKnowledgeRules: string | null;
  bridgingStatus: BridgingStatus;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const SharedToolsRegistryEntrySchema = z.object({
  toolId: z.string().uuid(),
  organizationId: z.string().uuid(),
  toolName: z.string().min(1),
  toolFamily: z.enum(ToolFamilyValues),
  toolSubtype: z.string().nullable(),
  isClassicFrameworkTemplate: z.boolean(),
  knowledgeBankRef: z.string().nullable(),
  catalogVisibility: z.enum(CatalogVisibilityValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ToolSessionGovernanceSchema = z.object({
  sessionId: z.string().uuid(),
  toolId: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  sessionMode: z.enum(SessionModeValues),
  permissionScope: z.string().min(1),
  contextBoundary: z.string().min(1),
  aiEnabled: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ToolActionGovernanceSchema = z.object({
  actionId: z.string().uuid(),
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actionType: z.string().min(1),
  gateDecision: z.enum(GateDecisionValues),
  gateReason: z.string().nullable(),
  createdAt: z.string().min(1),
});

export const AdminSurfaceOwnershipSchema = z.object({
  surfaceId: z.string().uuid(),
  surfaceName: z.string().min(1),
  organizationId: z.string().uuid(),
  ownerLayer: z.enum(OwnerLayerValues),
  moduleName: z.string().nullable(),
  horizontalLayerRef: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ToolsV8BridgingContractSchema = z.object({
  contractId: z.string().uuid(),
  toolId: z.string().uuid(),
  organizationId: z.string().uuid(),
  v3ToolContractRef: z.string().min(1),
  v8PlatformRequirements: z.array(z.string().min(1)),
  v8AIGovernanceRef: z.string().nullable(),
  v8SessionKnowledgeRules: z.string().nullable(),
  bridgingStatus: z.enum(BridgingStatusValues),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RegisterToolParams {
  organizationId: string;
  toolName: string;
  toolFamily: ToolFamily;
  toolSubtype?: string | null;
  isClassicFrameworkTemplate?: boolean;
  knowledgeBankRef?: string | null;
  catalogVisibility?: CatalogVisibility;
}

export const RegisterToolParamsSchema = z.object({
  organizationId: z.string().uuid(),
  toolName: z.string().min(1),
  toolFamily: z.enum(ToolFamilyValues),
  toolSubtype: z.string().nullable().optional().default(null),
  isClassicFrameworkTemplate: z.boolean().optional().default(false),
  knowledgeBankRef: z.string().nullable().optional().default(null),
  catalogVisibility: z.enum(CatalogVisibilityValues).optional().default('draft'),
});

export interface CreateSessionGovernanceParams {
  toolId: string;
  userId: string;
  organizationId: string;
  sessionMode: SessionMode;
  permissionScope: string;
  contextBoundary: string;
  aiEnabled?: boolean;
}

export const CreateSessionGovernanceParamsSchema = z.object({
  toolId: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  sessionMode: z.enum(SessionModeValues),
  permissionScope: z.string().min(1),
  contextBoundary: z.string().min(1),
  aiEnabled: z.boolean().optional().default(true),
});

export interface CreateActionGovernanceParams {
  sessionId: string;
  organizationId: string;
  actionType: string;
  gateDecision: GateDecision;
  gateReason?: string | null;
}

export const CreateActionGovernanceParamsSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actionType: z.string().min(1),
  gateDecision: z.enum(GateDecisionValues),
  gateReason: z.string().nullable().optional().default(null),
});

export interface RegisterAdminSurfaceParams {
  surfaceName: string;
  organizationId: string;
  ownerLayer: OwnerLayer;
  moduleName?: string | null;
  horizontalLayerRef?: string | null;
}

export const RegisterAdminSurfaceParamsSchema = z.object({
  surfaceName: z.string().min(1),
  organizationId: z.string().uuid(),
  ownerLayer: z.enum(OwnerLayerValues),
  moduleName: z.string().nullable().optional().default(null),
  horizontalLayerRef: z.string().nullable().optional().default(null),
});

export interface CreateBridgingContractParams {
  toolId: string;
  organizationId: string;
  v3ToolContractRef: string;
  v8PlatformRequirements: string[];
  v8AIGovernanceRef?: string | null;
  v8SessionKnowledgeRules?: string | null;
  bridgingStatus?: BridgingStatus;
}

export const CreateBridgingContractParamsSchema = z.object({
  toolId: z.string().uuid(),
  organizationId: z.string().uuid(),
  v3ToolContractRef: z.string().min(1),
  v8PlatformRequirements: z.array(z.string().min(1)).min(1),
  v8AIGovernanceRef: z.string().nullable().optional().default(null),
  v8SessionKnowledgeRules: z.string().nullable().optional().default(null),
  bridgingStatus: z.enum(BridgingStatusValues).optional().default('draft'),
});
