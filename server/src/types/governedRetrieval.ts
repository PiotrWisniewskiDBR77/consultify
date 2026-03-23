/**
 * V8 Governed Retrieval — Core Primitives
 *
 * Unified, policy-driven retrieval contract for all AI consumers.
 * Builds on ContextSnapshot (WP-W1-AI-01).
 *
 * References:
 *  - WP-W1-AI-02_GOVERNED_RETRIEVAL_BASELINE.md
 *  - DECISION_LOG_WAVE_1.md  (Decisions 10-12)
 *  - DECISION_LOG_WAVE_2.md  (Decisions W2-4, W2-5, W2-6, W2-7)
 */

import { z } from 'zod';

import type { ConsumerClass, RetrievalScopeToken, ScopeType } from './contextSnapshot.js';
import { ConsumerClassValues, RetrievalScopeTokenSchema, ScopeTypeValues } from './contextSnapshot.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

/** Four canonical search presets (§4.3 of analysis packet + Decision 11). */
export const SearchPresetValues = [
  'workspace_broad',
  'project_focused',
  'artifact_deep',
  'cross_org_federated',
] as const;
export type SearchPreset = (typeof SearchPresetValues)[number];

/** Nine-value denial taxonomy (§3.3 of analysis packet). */
export const DenialReasonValues = [
  'TENANT_BOUNDARY',
  'ACL_DENIED',
  'SCOPE_MISMATCH',
  'SENSITIVITY_BLOCKED',
  'CONNECTOR_DISCONNECTED',
  'CONNECTOR_ARCHIVED',
  'FRESHNESS_EXCLUDED',
  'PRIVACY_MODE',
  'POLICY_BLOCKED',
] as const;
export type DenialReason = (typeof DenialReasonValues)[number];

/** Three-layer ACL verdict. */
export const ACLVerdictValues = ['allowed', 'denied', 'degraded'] as const;
export type ACLVerdict = (typeof ACLVerdictValues)[number];

/** Sensitivity labels (§2.2 of analysis packet). */
export const SensitivityLabelValues = ['public', 'internal', 'confidential'] as const;
export type SensitivityLabel = (typeof SensitivityLabelValues)[number];

/** Freshness states (§2.3 of analysis packet). */
export const FreshnessStateValues = ['fresh', 'stale', 'drifted', 'disconnected', 'archived'] as const;
export type FreshnessState = (typeof FreshnessStateValues)[number];

/** Trust class for retrieval results. */
export const TrustClassValues = ['verified', 'provisional', 'degraded', 'unverified'] as const;
export type TrustClass = (typeof TrustClassValues)[number];

/**
 * Seven-stage pre-filter sequence (§5.4 of analysis packet).
 * Each stage name maps to a step in the governed retrieval pipeline.
 */
export const PipelineStageValues = [
  'tenant_filter',
  'scope_type_filter',
  'acl_filter',
  'sensitivity_filter',
  'freshness_filter',
  'privacy_mode_filter',
  'connector_health_filter',
] as const;
export type PipelineStage = (typeof PipelineStageValues)[number];

/** Retrieval request status. */
export const RetrievalRequestStatusValues = ['pending', 'processing', 'completed', 'failed'] as const;
export type RetrievalRequestStatus = (typeof RetrievalRequestStatusValues)[number];

// ==========================================
// BUDGET HINT (Decision W2-7)
// ==========================================

export interface BudgetHint {
  maxLatencyMs?: number;
  maxResults?: number;
  maxTokenBudget?: number;
}

// ==========================================
// ACL CHECK RESULT
// ==========================================

export interface ACLLayerResult {
  layer: 'tenant_boundary' | 'source_acl' | 'scope_sensitivity';
  verdict: ACLVerdict;
  denialReason: DenialReason | null;
  detail: string | null;
}

export interface ACLCheckResult {
  overallVerdict: ACLVerdict;
  layers: ACLLayerResult[];
  checkedAt: string;
  aclStalenessMs: number | null;
}

// ==========================================
// RETRIEVAL REQUEST
// ==========================================

export interface RetrievalRequest {
  requestId: string;
  organizationId: string;
  contextSnapshotId: string | null;
  retrievalScopeToken: RetrievalScopeToken | null;
  consumerClass: ConsumerClass;
  query: string;
  searchPreset: SearchPreset;
  budgetHint: BudgetHint | null;
  workingMemoryContextRef: string | null;
  status: RetrievalRequestStatus;
  createdAt: string;
}

// ==========================================
// RETRIEVAL RESULT
// ==========================================

export interface RetrievalResult {
  sourceRef: string;
  connectorId: string | null;
  scopeType: ScopeType;
  relevanceScore: number;
  trustClass: TrustClass;
  sensitivityLabel: SensitivityLabel;
  freshnessState: FreshnessState;
  aclCheckResult: ACLCheckResult;
  rankPosition: number;
  citationBindingRef: string | null;
}

// ==========================================
// RETRIEVAL TRACE
// ==========================================

export interface ScopeResolutionSummary {
  tenantId: string;
  projectId: string | null;
  scopeTypes: ScopeType[];
  sensitivityCeiling: SensitivityLabel;
  privacyMode: boolean;
}

export interface PipelineStageTrace {
  stage: PipelineStage;
  candidatesBefore: number;
  candidatesAfter: number;
  deniedCount: number;
  durationMs: number;
}

export interface DeniedEntry {
  sourceRef: string;
  connectorId: string | null;
  denialReason: DenialReason;
  denialDetail: string | null;
  freshnessStateAtDenial: FreshnessState | null;
  sensitivityLabel: SensitivityLabel | null;
}

export interface RetrievalTrace {
  traceId: string;
  requestId: string;
  organizationId: string;
  snapshotId: string | null;
  conversationId: string | null;
  consumerClass: ConsumerClass;
  presetUsed: SearchPreset;
  scopeResolutionSummary: ScopeResolutionSummary;
  pipelineStages: PipelineStageTrace[];
  candidatesConsidered: number;
  resultsReturned: number;
  results: RetrievalResult[];
  deniedEntries: DeniedEntry[];
  freshnessWarnings: string[];
  totalLatencyMs: number;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const BudgetHintSchema = z.object({
  maxLatencyMs: z.number().int().positive().optional(),
  maxResults: z.number().int().positive().optional(),
  maxTokenBudget: z.number().int().positive().optional(),
});

export const ACLLayerResultSchema = z.object({
  layer: z.enum(['tenant_boundary', 'source_acl', 'scope_sensitivity']),
  verdict: z.enum(ACLVerdictValues),
  denialReason: z.enum(DenialReasonValues).nullable(),
  detail: z.string().nullable(),
});

export const ACLCheckResultSchema = z.object({
  overallVerdict: z.enum(ACLVerdictValues),
  layers: z.array(ACLLayerResultSchema),
  checkedAt: z.string().min(1),
  aclStalenessMs: z.number().nullable(),
});

export const CreateRetrievalRequestParamsSchema = z
  .object({
    organizationId: z.string().uuid(),
    contextSnapshotId: z.string().uuid().nullable().optional(),
    retrievalScopeToken: RetrievalScopeTokenSchema.nullable().optional(),
    consumerClass: z.enum(ConsumerClassValues),
    query: z.string().min(1),
    searchPreset: z.enum(SearchPresetValues),
    budgetHint: BudgetHintSchema.nullable().optional(),
    workingMemoryContextRef: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      const interactive = ['chat', 'execution', 'worker'] as const;
      if ((interactive as readonly string[]).includes(data.consumerClass)) {
        return data.contextSnapshotId != null;
      }
      return data.contextSnapshotId != null || data.retrievalScopeToken != null;
    },
    {
      message:
        'Interactive consumers (chat, execution, worker) require contextSnapshotId. ' +
        'Background consumers require either contextSnapshotId or retrievalScopeToken.',
    },
  );

export type CreateRetrievalRequestParams = z.input<typeof CreateRetrievalRequestParamsSchema>;

export const RetrievalResultSchema = z.object({
  sourceRef: z.string().min(1),
  connectorId: z.string().nullable(),
  scopeType: z.enum(ScopeTypeValues),
  relevanceScore: z.number().min(0).max(1),
  trustClass: z.enum(TrustClassValues),
  sensitivityLabel: z.enum(SensitivityLabelValues),
  freshnessState: z.enum(FreshnessStateValues),
  aclCheckResult: ACLCheckResultSchema,
  rankPosition: z.number().int().min(0),
  citationBindingRef: z.string().nullable(),
});

export const DeniedEntrySchema = z.object({
  sourceRef: z.string().min(1),
  connectorId: z.string().nullable(),
  denialReason: z.enum(DenialReasonValues),
  denialDetail: z.string().nullable(),
  freshnessStateAtDenial: z.enum(FreshnessStateValues).nullable(),
  sensitivityLabel: z.enum(SensitivityLabelValues).nullable(),
});

export const ScopeResolutionSummarySchema = z.object({
  tenantId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  scopeTypes: z.array(z.enum(ScopeTypeValues)),
  sensitivityCeiling: z.enum(SensitivityLabelValues),
  privacyMode: z.boolean(),
});

export const PipelineStageTraceSchema = z.object({
  stage: z.enum(PipelineStageValues),
  candidatesBefore: z.number().int().min(0),
  candidatesAfter: z.number().int().min(0),
  deniedCount: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});

export const LogRetrievalTraceParamsSchema = z.object({
  requestId: z.string().uuid(),
  organizationId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  consumerClass: z.enum(ConsumerClassValues),
  presetUsed: z.enum(SearchPresetValues),
  scopeResolutionSummary: ScopeResolutionSummarySchema,
  pipelineStages: z.array(PipelineStageTraceSchema),
  candidatesConsidered: z.number().int().min(0),
  resultsReturned: z.number().int().min(0),
  results: z.array(RetrievalResultSchema),
  deniedEntries: z.array(DeniedEntrySchema),
  freshnessWarnings: z.array(z.string()),
  totalLatencyMs: z.number().int().min(0),
});

export type LogRetrievalTraceParams = z.input<typeof LogRetrievalTraceParamsSchema>;
