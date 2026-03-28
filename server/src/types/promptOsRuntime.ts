/**
 * V8 Prompt OS Runtime Discipline — Type Family
 *
 * Governance layer for prompt releases, eval gates, canary configs,
 * and coordinated rollback.
 *
 * Implements Decisions W2-8 through W2-12 from DECISION_LOG_WAVE_2.md:
 *  W2-8  — eval thresholds per purpose family
 *  W2-9  — hard/soft gate per preset
 *  W2-10 — eval depth tiering by change type
 *  W2-11 — canary architecture (org/purpose/preset targeting)
 *  W2-12 — coordinated rollback at bundle level
 *
 * Depends on:
 *  - WP-W2-AI-03_PROMPT_OS_RUNTIME_DISCIPLINE.md (analysis packet)
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const PurposeFamilyValues = [
  'conversational',
  'governed_proposal',
  'retrieval_grounded',
  'artifact_generation',
  'background_automation',
] as const;
export type PurposeFamily = (typeof PurposeFamilyValues)[number];

export const GateTypeValues = ['hard', 'soft'] as const;
export type GateType = (typeof GateTypeValues)[number];

export const BundleStatusValues = ['draft', 'staging', 'canary', 'active', 'rolled_back'] as const;
export type BundleStatus = (typeof BundleStatusValues)[number];

/** W2-10: eval depth tiering by change type */
export const ChangeTypeValues = [
  'minor_wording',
  'block_edit',
  'routing_policy_change',
  'base_rewrite',
] as const;
export type ChangeType = (typeof ChangeTypeValues)[number];

export const EvalResultValues = ['passed', 'failed', 'warning'] as const;
export type EvalResult = (typeof EvalResultValues)[number];

export const DegradedStateTypeValues = [
  'voice_transcript_partial',
  'prompt_registry_unavailable',
  'schema_enforcement_unavailable',
  'retrieval_unavailable',
  'memory_unavailable',
  'web_search_unavailable',
  'selected_model_unavailable',
  'fallback_chain_exhausted',
] as const;
export type DegradedStateType = (typeof DegradedStateTypeValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface EvalThresholds {
  qualityMin: number;
  latencyP95MaxMs: number;
  costMaxPerInteraction: number;
  trustDegradationMaxPct: number;
  failureRateMaxPct: number;
}

export interface PromptPreset {
  presetId: string;
  organizationId: string;
  name: string;
  purposeFamily: PurposeFamily;
  modelRef: string;
  promptBlockRefs: string[];
  policyRef: string | null;
  gateType: GateType;
  evalThresholds: EvalThresholds;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseBundle {
  bundleId: string;
  organizationId: string;
  version: string;
  presetId: string;
  promptVersion: string;
  modelVersion: string;
  policyVersion: string;
  runtimeConfigVersion: string;
  status: BundleStatus;
  createdAt: string;
  activatedAt: string | null;
  rolledBackAt: string | null;
}

export interface EvalGate {
  gateId: string;
  bundleId: string;
  gateType: GateType;
  purposeFamily: PurposeFamily;
  changeType: ChangeType;
  thresholds: EvalThresholds;
  result: EvalResult;
  evaluatedAt: string;
}

export interface CanaryConfig {
  configId: string;
  bundleId: string;
  orgScoped: boolean;
  purposeFamilyScoped: boolean;
  presetScoped: boolean;
  rollbackEnabled: boolean;
  createdAt: string;
}

export interface RollbackRecord {
  rollbackId: string;
  bundleId: string;
  reason: string;
  rolledBackBy: string;
  rolledBackAt: string;
  previousBundleId: string | null;
}

export interface DegradedPromptState {
  stateType: DegradedStateType;
  fallbackPresetId: string | null;
  userMessage: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const EvalThresholdsSchema = z.object({
  qualityMin: z.number().min(0).max(1),
  latencyP95MaxMs: z.number().positive(),
  costMaxPerInteraction: z.number().nonnegative(),
  trustDegradationMaxPct: z.number().min(0).max(100),
  failureRateMaxPct: z.number().min(0).max(100),
});

export const PromptPresetSchema = z.object({
  presetId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  purposeFamily: z.enum(PurposeFamilyValues),
  modelRef: z.string().min(1),
  promptBlockRefs: z.array(z.string().min(1)),
  policyRef: z.string().nullable(),
  gateType: z.enum(GateTypeValues),
  evalThresholds: EvalThresholdsSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const ReleaseBundleSchema = z.object({
  bundleId: z.string().uuid(),
  organizationId: z.string().uuid(),
  version: z.string().min(1),
  presetId: z.string().uuid(),
  promptVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  runtimeConfigVersion: z.string().min(1),
  status: z.enum(BundleStatusValues),
  createdAt: z.string().min(1),
  activatedAt: z.string().nullable(),
  rolledBackAt: z.string().nullable(),
});

export const EvalGateSchema = z.object({
  gateId: z.string().uuid(),
  bundleId: z.string().uuid(),
  gateType: z.enum(GateTypeValues),
  purposeFamily: z.enum(PurposeFamilyValues),
  changeType: z.enum(ChangeTypeValues),
  thresholds: EvalThresholdsSchema,
  result: z.enum(EvalResultValues),
  evaluatedAt: z.string().min(1),
});

export const CanaryConfigSchema = z.object({
  configId: z.string().uuid(),
  bundleId: z.string().uuid(),
  orgScoped: z.boolean(),
  purposeFamilyScoped: z.boolean(),
  presetScoped: z.boolean(),
  rollbackEnabled: z.boolean(),
  createdAt: z.string().min(1),
});

export const RollbackRecordSchema = z.object({
  rollbackId: z.string().uuid(),
  bundleId: z.string().uuid(),
  reason: z.string().min(1),
  rolledBackBy: z.string().min(1),
  rolledBackAt: z.string().min(1),
  previousBundleId: z.string().uuid().nullable(),
});

export const DegradedPromptStateSchema = z.object({
  stateType: z.enum(DegradedStateTypeValues),
  fallbackPresetId: z.string().uuid().nullable(),
  userMessage: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreatePresetParams {
  organizationId: string;
  name: string;
  purposeFamily: PurposeFamily;
  modelRef: string;
  promptBlockRefs: string[];
  policyRef?: string | null;
  gateType: GateType;
  evalThresholds: EvalThresholds;
}

export const CreatePresetParamsSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  purposeFamily: z.enum(PurposeFamilyValues),
  modelRef: z.string().min(1),
  promptBlockRefs: z.array(z.string().min(1)),
  policyRef: z.string().nullable().optional().default(null),
  gateType: z.enum(GateTypeValues),
  evalThresholds: EvalThresholdsSchema,
});

export interface CreateReleaseBundleParams {
  organizationId: string;
  version: string;
  presetId: string;
  promptVersion: string;
  modelVersion: string;
  policyVersion: string;
  runtimeConfigVersion: string;
}

export const CreateReleaseBundleParamsSchema = z.object({
  organizationId: z.string().uuid(),
  version: z.string().min(1),
  presetId: z.string().uuid(),
  promptVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  runtimeConfigVersion: z.string().min(1),
});

export interface EvaluateGateParams {
  bundleId: string;
  gateType: GateType;
  purposeFamily: PurposeFamily;
  changeType: ChangeType;
  thresholds: EvalThresholds;
  result: EvalResult;
}

export const EvaluateGateParamsSchema = z.object({
  bundleId: z.string().uuid(),
  gateType: z.enum(GateTypeValues),
  purposeFamily: z.enum(PurposeFamilyValues),
  changeType: z.enum(ChangeTypeValues),
  thresholds: EvalThresholdsSchema,
  result: z.enum(EvalResultValues),
});

export interface SetCanaryConfigParams {
  bundleId: string;
  orgScoped: boolean;
  purposeFamilyScoped: boolean;
  presetScoped: boolean;
  rollbackEnabled?: boolean;
}

export const SetCanaryConfigParamsSchema = z.object({
  bundleId: z.string().uuid(),
  orgScoped: z.boolean(),
  purposeFamilyScoped: z.boolean(),
  presetScoped: z.boolean(),
  rollbackEnabled: z.boolean().optional().default(true),
});

// ==========================================
// DEFAULT EVAL THRESHOLDS PER PURPOSE FAMILY (W2-8)
// ==========================================

export const DEFAULT_EVAL_THRESHOLDS: Record<PurposeFamily, EvalThresholds> = {
  conversational: {
    qualityMin: 0.75,
    latencyP95MaxMs: 3000,
    costMaxPerInteraction: 0.05,
    trustDegradationMaxPct: 10,
    failureRateMaxPct: 5,
  },
  governed_proposal: {
    qualityMin: 0.85,
    latencyP95MaxMs: 5000,
    costMaxPerInteraction: 0.1,
    trustDegradationMaxPct: 3,
    failureRateMaxPct: 2,
  },
  retrieval_grounded: {
    qualityMin: 0.8,
    latencyP95MaxMs: 4000,
    costMaxPerInteraction: 0.08,
    trustDegradationMaxPct: 5,
    failureRateMaxPct: 3,
  },
  artifact_generation: {
    qualityMin: 0.8,
    latencyP95MaxMs: 10000,
    costMaxPerInteraction: 0.15,
    trustDegradationMaxPct: 5,
    failureRateMaxPct: 3,
  },
  background_automation: {
    qualityMin: 0.85,
    latencyP95MaxMs: 30000,
    costMaxPerInteraction: 0.2,
    trustDegradationMaxPct: 2,
    failureRateMaxPct: 1,
  },
} as const;
