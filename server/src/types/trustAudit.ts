/**
 * V8 Trust, Audit and Observability — Core Type Family
 *
 * Universal trust vocabulary, provenance ledger, support traces, and health signals.
 * Builds on ContextSnapshot (WP-W1-AI-01) and ExecutionSpine (WP-W1-AI-03).
 *
 * Decision 23: trust is assigned by runtime contract, not by model self-report alone.
 * Decision 24: lightweight provenance everywhere, full ledger where business meaning matters.
 * Decision 25: brief explanation for users, full trace for operators.
 * Decision 26: voice_transcript_partial is an explicit degraded condition.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const TrustClassValues = [
  'grounded_fact',
  'synthesis',
  'uncertain_inference',
  'degraded',
] as const;
export type TrustClass = (typeof TrustClassValues)[number];

export const BindingStrengthValues = ['strong', 'moderate', 'weak', 'none'] as const;
export type BindingStrength = (typeof BindingStrengthValues)[number];

export const VerificationStateValues = ['verified', 'partially_verified', 'unverified'] as const;
export type VerificationState = (typeof VerificationStateValues)[number];

export const UncertaintyClassValues = [
  'partial_evidence',
  'stale_source',
  'conflicting_sources',
  'scope_limited',
  'model_extrapolation',
] as const;
export type UncertaintyClass = (typeof UncertaintyClassValues)[number];

export const DegradedConditionTypeValues = [
  'provider_fallback',
  'retrieval_failure',
  'acl_timeout',
  'partial_tool_failure',
  'connector_disconnected',
  'voice_transcript_partial',
] as const;
export type DegradedConditionType = (typeof DegradedConditionTypeValues)[number];

export const DegradedSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export type DegradedSeverity = (typeof DegradedSeverityValues)[number];

export const HealthSignalTypeValues = [
  'retrieval_success_rate',
  'retrieval_latency_p95',
  'model_availability',
  'fallback_rate',
  'trust_degradation_rate',
  'connector_health',
  'acl_staleness',
  'proposal_approval_latency',
  'apply_failure_rate',
  'execution_run_failure_rate',
] as const;
export type HealthSignalType = (typeof HealthSignalTypeValues)[number];

export const HealthStatusValues = ['healthy', 'warning', 'critical', 'unknown'] as const;
export type HealthStatus = (typeof HealthStatusValues)[number];

export const OutputTypeValues = [
  'chat_response',
  'execution_output',
  'report_section',
  'presentation_slide',
  'background_job_result',
] as const;
export type OutputType = (typeof OutputTypeValues)[number];

export const AudienceLevelValues = ['user', 'operator', 'admin'] as const;
export type AudienceLevel = (typeof AudienceLevelValues)[number];

export const RetrievalMethodValues = [
  'vector_search',
  'keyword_search',
  'hybrid_search',
  'direct_lookup',
  'connector_sync',
] as const;
export type RetrievalMethod = (typeof RetrievalMethodValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface EvidenceRef {
  evidenceRefId: string;
  sourceId: string;
  sourceType: string;
  confidence: number;
  retrievalMethod: RetrievalMethod;
  bindingStrength: BindingStrength;
  verificationState: VerificationState;
}

export interface CitationBinding {
  citationBindingId: string;
  claimId: string;
  evidenceRefs: EvidenceRef[];
  bindingStrength: BindingStrength;
  trustClass: TrustClass;
  claimSummary: string | null;
}

export interface TrustSummary {
  groundedFactCount: number;
  synthesisCount: number;
  uncertainInferenceCount: number;
  degradedCount: number;
  lowestTrustClass: TrustClass;
  degradedFlag: boolean;
}

export interface ProvenanceLedgerEntry {
  entryId: string;
  organizationId: string;
  outputId: string;
  outputType: OutputType;
  trustClass: TrustClass;
  citationBindings: CitationBinding[];
  contextSnapshotId: string;
  retrievalTraceId: string | null;
  executionRunId: string | null;
  routingExplanationId: string | null;
  trustSummary: TrustSummary;
  createdAt: string;
  createdBy: string;
}

export interface DegradedCondition {
  conditionId: string;
  organizationId: string;
  conditionType: DegradedConditionType;
  severity: DegradedSeverity;
  userMessage: string;
  operatorDetail: string;
  supportTraceId: string | null;
  createdAt: string;
}

export interface RoutingExplanation {
  routingExplanationId: string;
  executionRunId: string | null;
  conversationId: string | null;
  modelSelected: string;
  modelSelectionReason: string;
  fallbackOccurred: boolean;
  fallbackReason: string | null;
  fallbackFrom: string | null;
  workloadClass: string;
  purpose: string;
  costTier: string | null;
  latencyObservedMs: number | null;
  createdAt: string;
}

export interface SupportTrace {
  traceId: string;
  organizationId: string;
  contextSnapshotId: string;
  executionRunId: string | null;
  retrievalRequestId: string | null;
  routingExplanationId: string | null;
  trustClass: TrustClass;
  routingExplanation: RoutingExplanation | null;
  degradedConditions: DegradedCondition[];
  createdAt: string;
}

export interface HealthSignal {
  signalId: string;
  organizationId: string;
  signalType: HealthSignalType;
  componentId: string;
  status: HealthStatus;
  value: number | null;
  threshold: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const EvidenceRefSchema = z.object({
  evidenceRefId: z.string().uuid(),
  sourceId: z.string().min(1),
  sourceType: z.string().min(1),
  confidence: z.number().min(0).max(1),
  retrievalMethod: z.enum(RetrievalMethodValues),
  bindingStrength: z.enum(BindingStrengthValues),
  verificationState: z.enum(VerificationStateValues),
});

export const CitationBindingSchema = z.object({
  citationBindingId: z.string().uuid(),
  claimId: z.string().min(1),
  evidenceRefs: z.array(EvidenceRefSchema),
  bindingStrength: z.enum(BindingStrengthValues),
  trustClass: z.enum(TrustClassValues),
  claimSummary: z.string().nullable(),
});

export const TrustSummarySchema = z.object({
  groundedFactCount: z.number().int().min(0),
  synthesisCount: z.number().int().min(0),
  uncertainInferenceCount: z.number().int().min(0),
  degradedCount: z.number().int().min(0),
  lowestTrustClass: z.enum(TrustClassValues),
  degradedFlag: z.boolean(),
});

export const ProvenanceLedgerEntrySchema = z.object({
  entryId: z.string().uuid(),
  organizationId: z.string().uuid(),
  outputId: z.string().min(1),
  outputType: z.enum(OutputTypeValues),
  trustClass: z.enum(TrustClassValues),
  citationBindings: z.array(CitationBindingSchema),
  contextSnapshotId: z.string().uuid(),
  retrievalTraceId: z.string().uuid().nullable(),
  executionRunId: z.string().uuid().nullable(),
  routingExplanationId: z.string().uuid().nullable(),
  trustSummary: TrustSummarySchema,
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
});

export const DegradedConditionSchema = z.object({
  conditionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  conditionType: z.enum(DegradedConditionTypeValues),
  severity: z.enum(DegradedSeverityValues),
  userMessage: z.string().min(1),
  operatorDetail: z.string().min(1),
  supportTraceId: z.string().uuid().nullable(),
  createdAt: z.string().min(1),
});

export const RoutingExplanationSchema = z.object({
  routingExplanationId: z.string().uuid(),
  executionRunId: z.string().uuid().nullable(),
  conversationId: z.string().uuid().nullable(),
  modelSelected: z.string().min(1),
  modelSelectionReason: z.string().min(1),
  fallbackOccurred: z.boolean(),
  fallbackReason: z.string().nullable(),
  fallbackFrom: z.string().nullable(),
  workloadClass: z.string().min(1),
  purpose: z.string().min(1),
  costTier: z.string().nullable(),
  latencyObservedMs: z.number().int().nullable(),
  createdAt: z.string().min(1),
});

export const SupportTraceSchema = z.object({
  traceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  contextSnapshotId: z.string().uuid(),
  executionRunId: z.string().uuid().nullable(),
  retrievalRequestId: z.string().uuid().nullable(),
  routingExplanationId: z.string().uuid().nullable(),
  trustClass: z.enum(TrustClassValues),
  routingExplanation: RoutingExplanationSchema.nullable(),
  degradedConditions: z.array(DegradedConditionSchema),
  createdAt: z.string().min(1),
});

export const HealthSignalSchema = z.object({
  signalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  signalType: z.enum(HealthSignalTypeValues),
  componentId: z.string().min(1),
  status: z.enum(HealthStatusValues),
  value: z.number().nullable(),
  threshold: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  timestamp: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface AssignTrustClassParams {
  evidenceRefs: EvidenceRef[];
  modelDeclaredClass: TrustClass | null;
  degradedModeFlag: boolean;
  uncertaintyClass: UncertaintyClass | null;
}

export const AssignTrustClassParamsSchema = z.object({
  evidenceRefs: z.array(EvidenceRefSchema),
  modelDeclaredClass: z.enum(TrustClassValues).nullable(),
  degradedModeFlag: z.boolean(),
  uncertaintyClass: z.enum(UncertaintyClassValues).nullable(),
});

export interface CreateProvenanceLedgerEntryParams {
  organizationId: string;
  outputId: string;
  outputType: OutputType;
  trustClass: TrustClass;
  citationBindings: CitationBinding[];
  contextSnapshotId: string;
  retrievalTraceId?: string | null;
  executionRunId?: string | null;
  routingExplanationId?: string | null;
  trustSummary: TrustSummary;
  createdBy: string;
}

export const CreateProvenanceLedgerEntryParamsSchema = z.object({
  organizationId: z.string().uuid(),
  outputId: z.string().min(1),
  outputType: z.enum(OutputTypeValues),
  trustClass: z.enum(TrustClassValues),
  citationBindings: z.array(CitationBindingSchema),
  contextSnapshotId: z.string().uuid(),
  retrievalTraceId: z.string().uuid().nullable().optional(),
  executionRunId: z.string().uuid().nullable().optional(),
  routingExplanationId: z.string().uuid().nullable().optional(),
  trustSummary: TrustSummarySchema,
  createdBy: z.string().min(1),
});

export interface CreateSupportTraceParams {
  organizationId: string;
  contextSnapshotId: string;
  executionRunId?: string | null;
  retrievalRequestId?: string | null;
  routingExplanationId?: string | null;
  trustClass: TrustClass;
  routingExplanation?: RoutingExplanation | null;
  degradedConditions?: DegradedCondition[];
}

export const CreateSupportTraceParamsSchema = z.object({
  organizationId: z.string().uuid(),
  contextSnapshotId: z.string().uuid(),
  executionRunId: z.string().uuid().nullable().optional(),
  retrievalRequestId: z.string().uuid().nullable().optional(),
  routingExplanationId: z.string().uuid().nullable().optional(),
  trustClass: z.enum(TrustClassValues),
  routingExplanation: RoutingExplanationSchema.nullable().optional(),
  degradedConditions: z.array(DegradedConditionSchema).optional().default([]),
});

export interface RecordDegradedConditionParams {
  organizationId: string;
  conditionType: DegradedConditionType;
  severity: DegradedSeverity;
  userMessage: string;
  operatorDetail: string;
  supportTraceId?: string | null;
}

export const RecordDegradedConditionParamsSchema = z.object({
  organizationId: z.string().uuid(),
  conditionType: z.enum(DegradedConditionTypeValues),
  severity: z.enum(DegradedSeverityValues),
  userMessage: z.string().min(1),
  operatorDetail: z.string().min(1),
  supportTraceId: z.string().uuid().nullable().optional(),
});

export interface RecordHealthSignalParams {
  organizationId: string;
  signalType: HealthSignalType;
  componentId: string;
  status: HealthStatus;
  value?: number | null;
  threshold?: number | null;
  metadata?: Record<string, unknown>;
}

export const RecordHealthSignalParamsSchema = z.object({
  organizationId: z.string().uuid(),
  signalType: z.enum(HealthSignalTypeValues),
  componentId: z.string().min(1),
  status: z.enum(HealthStatusValues),
  value: z.number().nullable().optional(),
  threshold: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

// ==========================================
// TRUST CLASS RANKING (for comparison)
// ==========================================

export const TRUST_CLASS_RANK: Record<TrustClass, number> = {
  grounded_fact: 3,
  synthesis: 2,
  uncertain_inference: 1,
  degraded: 0,
} as const;
