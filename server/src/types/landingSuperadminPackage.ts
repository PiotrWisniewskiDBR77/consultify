/**
 * V8 Landing / Onboarding / Superadmin Package — Type Family
 *
 * Content model for landing pages, ANNA LP assistant contract,
 * demo/trial V8 alignment, and horizontal superadmin IA.
 *
 * Implements Decisions from DECISION_LOG_WAVE_7.md:
 *  W7-9  — ANNA LP assistant contract: recreate canonical contract
 *  W7-10 — Superadmin V8 SSOT: horizontal IA across all domains
 *  W7-11 — Demo/trial V8 refresh: converge commercial narrative surfaces
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const LandingSectionTypeValues = [
  'hero',
  'value_proposition',
  'expert_showcase',
  'use_case_mapping',
  'cta',
  'social_proof',
] as const;
export type LandingSectionType = (typeof LandingSectionTypeValues)[number];

export const AnnaIdentityRoleValues = [
  'landing_guide',
  'onboarding_assistant',
] as const;
export type AnnaIdentityRole = (typeof AnnaIdentityRoleValues)[number];

export const NarrativeVersionValues = ['v3', 'v8'] as const;
export type NarrativeVersion = (typeof NarrativeVersionValues)[number];

export const OwnershipTypeValues = [
  'platform_operator',
  'tenant_admin',
] as const;
export type OwnershipType = (typeof OwnershipTypeValues)[number];

export const SurfaceAccessLevelValues = [
  'platform',
  'tenant',
  'module',
] as const;
export type SurfaceAccessLevel = (typeof SurfaceAccessLevelValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface LandingPageSection {
  sectionId: string;
  organizationId: string;
  sectionType: LandingSectionType;
  content: Record<string, unknown>;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnaLPAssistantConfig {
  configId: string;
  organizationId: string;
  identityRole: AnnaIdentityRole;
  conversationContract: Record<string, unknown>;
  platformIntegrationRef: string | null;
  aiGovernanceRef: string | null;
  degradedStateBehavior: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoTrialConfig {
  configId: string;
  organizationId: string;
  narrativeVersion: NarrativeVersion;
  trialDuration: number;
  demoScenarios: string[];
  onboardingFlowRef: string | null;
  isRefreshed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuperadminDomain {
  domainId: string;
  organizationId: string;
  domainName: string;
  ownershipType: OwnershipType;
  verticalPackages: string[];
  crossDomainCapabilities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SuperadminSurface {
  surfaceId: string;
  domainId: string;
  organizationId: string;
  surfaceName: string;
  accessLevel: SurfaceAccessLevel;
  moduleRef: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS — full entity validation
// ==========================================

export const LandingPageSectionSchema = z.object({
  sectionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  sectionType: z.enum(LandingSectionTypeValues),
  content: z.record(z.string(), z.unknown()),
  displayOrder: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const AnnaLPAssistantConfigSchema = z.object({
  configId: z.string().uuid(),
  organizationId: z.string().uuid(),
  identityRole: z.enum(AnnaIdentityRoleValues),
  conversationContract: z.record(z.string(), z.unknown()),
  platformIntegrationRef: z.string().nullable(),
  aiGovernanceRef: z.string().nullable(),
  degradedStateBehavior: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const DemoTrialConfigSchema = z.object({
  configId: z.string().uuid(),
  organizationId: z.string().uuid(),
  narrativeVersion: z.enum(NarrativeVersionValues),
  trialDuration: z.number().int().positive(),
  demoScenarios: z.array(z.string()),
  onboardingFlowRef: z.string().nullable(),
  isRefreshed: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const SuperadminDomainSchema = z.object({
  domainId: z.string().uuid(),
  organizationId: z.string().uuid(),
  domainName: z.string().min(1),
  ownershipType: z.enum(OwnershipTypeValues),
  verticalPackages: z.array(z.string()),
  crossDomainCapabilities: z.array(z.string()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const SuperadminSurfaceSchema = z.object({
  surfaceId: z.string().uuid(),
  domainId: z.string().uuid(),
  organizationId: z.string().uuid(),
  surfaceName: z.string().min(1),
  accessLevel: z.enum(SurfaceAccessLevelValues),
  moduleRef: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateLandingSectionParams {
  organizationId: string;
  sectionType: LandingSectionType;
  content: Record<string, unknown>;
  displayOrder: number;
  isActive?: boolean;
}

export const CreateLandingSectionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  sectionType: z.enum(LandingSectionTypeValues),
  content: z.record(z.string(), z.unknown()),
  displayOrder: z.number().int().min(0),
  isActive: z.boolean().optional().default(true),
});

export interface SetAnnaLPConfigParams {
  organizationId: string;
  identityRole: AnnaIdentityRole;
  conversationContract: Record<string, unknown>;
  platformIntegrationRef?: string | null;
  aiGovernanceRef?: string | null;
  degradedStateBehavior: string;
}

export const SetAnnaLPConfigParamsSchema = z.object({
  organizationId: z.string().uuid(),
  identityRole: z.enum(AnnaIdentityRoleValues),
  conversationContract: z.record(z.string(), z.unknown()),
  platformIntegrationRef: z.string().nullable().optional().default(null),
  aiGovernanceRef: z.string().nullable().optional().default(null),
  degradedStateBehavior: z.string().min(1),
});

export interface SetDemoTrialConfigParams {
  organizationId: string;
  narrativeVersion: NarrativeVersion;
  trialDuration: number;
  demoScenarios: string[];
  onboardingFlowRef?: string | null;
  isRefreshed?: boolean;
}

export const SetDemoTrialConfigParamsSchema = z.object({
  organizationId: z.string().uuid(),
  narrativeVersion: z.enum(NarrativeVersionValues),
  trialDuration: z.number().int().positive(),
  demoScenarios: z.array(z.string().min(1)).min(1),
  onboardingFlowRef: z.string().nullable().optional().default(null),
  isRefreshed: z.boolean().optional().default(false),
});

export interface RegisterSuperadminDomainParams {
  organizationId: string;
  domainName: string;
  ownershipType: OwnershipType;
  verticalPackages?: string[];
  crossDomainCapabilities?: string[];
}

export const RegisterSuperadminDomainParamsSchema = z.object({
  organizationId: z.string().uuid(),
  domainName: z.string().min(1),
  ownershipType: z.enum(OwnershipTypeValues),
  verticalPackages: z.array(z.string()).optional().default([]),
  crossDomainCapabilities: z.array(z.string()).optional().default([]),
});

export interface RegisterSuperadminSurfaceParams {
  domainId: string;
  organizationId: string;
  surfaceName: string;
  accessLevel: SurfaceAccessLevel;
  moduleRef?: string | null;
}

export const RegisterSuperadminSurfaceParamsSchema = z.object({
  domainId: z.string().uuid(),
  organizationId: z.string().uuid(),
  surfaceName: z.string().min(1),
  accessLevel: z.enum(SurfaceAccessLevelValues),
  moduleRef: z.string().nullable().optional().default(null),
});
