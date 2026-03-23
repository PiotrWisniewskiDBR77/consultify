/**
 * V8 Reports & Presentations Operating Model — Core Type Family
 *
 * Unified output delivery lifecycle, template families, recurring automation,
 * and shared AI governance for reports and presentations.
 *
 * Canonical decisions:
 *   W6-1 — shared AI governance with output-specific extensions
 *   W6-2 — separate Prompt OS presets per output type
 *   W6-3 — three canonical template families
 *   W6-4 — recurring automation: full for reports, bounded for presentations
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const OutputDeliveryStateValues = [
  'draft',
  'generated',
  'editing',
  'in_review',
  'ready',
  'shared',
  'archived',
] as const;
export type OutputDeliveryState = (typeof OutputDeliveryStateValues)[number];

export const OutputTypeValues = ['report', 'presentation'] as const;
export type OutputType = (typeof OutputTypeValues)[number];

export const TemplateFamilyNameValues = [
  'executive_steering_pack',
  'transformation_status_pack',
  'diagnostic_assessment_pack',
] as const;
export type TemplateFamilyName = (typeof TemplateFamilyNameValues)[number];

export const GovernanceLevelValues = ['standard', 'strict'] as const;
export type GovernanceLevel = (typeof GovernanceLevelValues)[number];

export const CadenceValues = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
] as const;
export type Cadence = (typeof CadenceValues)[number];

// ==========================================
// STATE MACHINE
// ==========================================

export const DELIVERY_VALID_TRANSITIONS: Record<OutputDeliveryState, readonly OutputDeliveryState[]> = {
  draft: ['generated', 'archived'],
  generated: ['editing', 'in_review', 'archived'],
  editing: ['in_review', 'generated', 'archived'],
  in_review: ['ready', 'editing', 'archived'],
  ready: ['shared', 'editing', 'archived'],
  shared: ['archived', 'editing'],
  archived: [],
} as const;

export const DELIVERY_TERMINAL_STATES: ReadonlySet<OutputDeliveryState> = new Set(['archived']);

// ==========================================
// INTERFACES
// ==========================================

export interface OutputArtifact {
  artifactId: string;
  organizationId: string;
  outputType: OutputType;
  deliveryState: OutputDeliveryState;
  templateFamilyRef: string | null;
  sourceInitiativeId: string | null;
  aiGovernancePresetRef: string | null;
  createdBy: string;
  createdAt: string;
  lastTransitionAt: string;
}

export interface TemplateFamily {
  familyId: string;
  organizationId: string;
  familyName: TemplateFamilyName;
  reportFormRef: string | null;
  presentationFormRef: string | null;
  governedMappingEnabled: boolean;
  createdAt: string;
}

export interface RecurringOutputProgram {
  programId: string;
  organizationId: string;
  outputType: OutputType;
  templateFamilyRef: string | null;
  cadence: Cadence;
  sourceDataBinding: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  governanceLevel: GovernanceLevel;
  createdAt: string;
}

export interface OutputAIGovernanceConfig {
  configId: string;
  organizationId: string;
  outputType: OutputType;
  presetRef: string;
  evalGateRef: string | null;
  qualityThresholds: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const OutputArtifactSchema = z.object({
  artifactId: z.string().uuid(),
  organizationId: z.string().uuid(),
  outputType: z.enum(OutputTypeValues),
  deliveryState: z.enum(OutputDeliveryStateValues),
  templateFamilyRef: z.string().nullable(),
  sourceInitiativeId: z.string().nullable(),
  aiGovernancePresetRef: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().min(1),
  lastTransitionAt: z.string().min(1),
});

export const TemplateFamilySchema = z.object({
  familyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  familyName: z.enum(TemplateFamilyNameValues),
  reportFormRef: z.string().nullable(),
  presentationFormRef: z.string().nullable(),
  governedMappingEnabled: z.boolean(),
  createdAt: z.string().min(1),
});

export const RecurringOutputProgramSchema = z.object({
  programId: z.string().uuid(),
  organizationId: z.string().uuid(),
  outputType: z.enum(OutputTypeValues),
  templateFamilyRef: z.string().nullable(),
  cadence: z.enum(CadenceValues),
  sourceDataBinding: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  governanceLevel: z.enum(GovernanceLevelValues),
  createdAt: z.string().min(1),
});

export const OutputAIGovernanceConfigSchema = z.object({
  configId: z.string().uuid(),
  organizationId: z.string().uuid(),
  outputType: z.enum(OutputTypeValues),
  presetRef: z.string().min(1),
  evalGateRef: z.string().nullable(),
  qualityThresholds: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateOutputArtifactParams {
  organizationId: string;
  outputType: OutputType;
  templateFamilyRef?: string | null;
  sourceInitiativeId?: string | null;
  aiGovernancePresetRef?: string | null;
  createdBy: string;
}

export const CreateOutputArtifactParamsSchema = z.object({
  organizationId: z.string().uuid(),
  outputType: z.enum(OutputTypeValues),
  templateFamilyRef: z.string().nullable().optional().default(null),
  sourceInitiativeId: z.string().nullable().optional().default(null),
  aiGovernancePresetRef: z.string().nullable().optional().default(null),
  createdBy: z.string().uuid(),
});

export interface RegisterTemplateFamilyParams {
  organizationId: string;
  familyName: TemplateFamilyName;
  reportFormRef?: string | null;
  presentationFormRef?: string | null;
  governedMappingEnabled?: boolean;
}

export const RegisterTemplateFamilyParamsSchema = z.object({
  organizationId: z.string().uuid(),
  familyName: z.enum(TemplateFamilyNameValues),
  reportFormRef: z.string().nullable().optional().default(null),
  presentationFormRef: z.string().nullable().optional().default(null),
  governedMappingEnabled: z.boolean().optional().default(false),
});

export interface CreateRecurringProgramParams {
  organizationId: string;
  outputType: OutputType;
  templateFamilyRef?: string | null;
  cadence: Cadence;
  sourceDataBinding?: Record<string, unknown>;
  governanceLevel?: GovernanceLevel;
}

export const CreateRecurringProgramParamsSchema = z.object({
  organizationId: z.string().uuid(),
  outputType: z.enum(OutputTypeValues),
  templateFamilyRef: z.string().nullable().optional().default(null),
  cadence: z.enum(CadenceValues),
  sourceDataBinding: z.record(z.string(), z.unknown()).optional().default({}),
  governanceLevel: z.enum(GovernanceLevelValues).optional().default('standard'),
});

export interface SetAIGovernanceConfigParams {
  organizationId: string;
  outputType: OutputType;
  presetRef: string;
  evalGateRef?: string | null;
  qualityThresholds?: Record<string, unknown>;
}

export const SetAIGovernanceConfigParamsSchema = z.object({
  organizationId: z.string().uuid(),
  outputType: z.enum(OutputTypeValues),
  presetRef: z.string().min(1),
  evalGateRef: z.string().nullable().optional().default(null),
  qualityThresholds: z.record(z.string(), z.unknown()).optional().default({}),
});
