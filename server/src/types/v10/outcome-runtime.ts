import { z } from 'zod';

export const OutcomeResolveRequestSchema = z.object({
  kind: z.string().trim().min(1),
  payload: z.unknown().optional(),
  now: z.string().trim().min(1).optional(),
});

export type OutcomeResolveRequest = z.infer<typeof OutcomeResolveRequestSchema>;

export interface OutcomeResolveResponse {
  readonly outcomeId: string;
  readonly now: string;
  readonly status: 'queued' | 'resolved';
}

export const OutcomeScopeSchema = z.object({
  tenantId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

export type OutcomeScope = z.infer<typeof OutcomeScopeSchema>;

export const OutcomeKpiDomainSchema = z.enum(['revenue', 'retention', 'cost', 'time']);
export type OutcomeKpiDomain = z.infer<typeof OutcomeKpiDomainSchema>;

export const OutcomeSignalKindSchema = z.enum([
  'time_saved',
  'decision_shipped',
  'revenue',
  'margin',
  'risk_avoided',
  'quality',
]);
export type OutcomeSignalKind = z.infer<typeof OutcomeSignalKindSchema>;

export const OutcomeConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type OutcomeConfidence = z.infer<typeof OutcomeConfidenceSchema>;

export const OutcomeAcceptanceStatusSchema = z.enum(['draft', 'accepted', 'rejected', 'needs_revision']);
export type OutcomeAcceptanceStatus = z.infer<typeof OutcomeAcceptanceStatusSchema>;

export const OutcomeAcceptanceDecisionSchema = z.enum(['accepted', 'rejected', 'needs_revision']);
export type OutcomeAcceptanceDecision = z.infer<typeof OutcomeAcceptanceDecisionSchema>;

export const OutcomeKpiPreviewStateSchema = z.enum(['ready', 'needs_review', 'at_risk']);
export type OutcomeKpiPreviewState = z.infer<typeof OutcomeKpiPreviewStateSchema>;

export const OutcomeMetricSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  domain: OutcomeKpiDomainSchema,
  unit: z.string().trim().min(1),
  baselineValue: z.number().finite(),
  targetValue: z.number().finite(),
  observedValue: z.number().finite().optional(),
});
export type OutcomeMetric = z.infer<typeof OutcomeMetricSchema>;

export const OutcomeEvidenceRefsSchema = z.object({
  analysisId: z.string().trim().min(1),
  artifactId: z.string().trim().min(1).optional(),
  researchMissionId: z.string().trim().min(1).optional(),
  reasoningRunId: z.string().trim().min(1).optional(),
  correlationId: z.string().trim().min(1).optional(),
});
export type OutcomeEvidenceRefs = z.infer<typeof OutcomeEvidenceRefsSchema>;

export const OutcomeAcceptancePreviewBodySchema = z.object({
  analysisSummary: z.string().trim().min(1),
  businessGoal: z.string().trim().min(1),
  metrics: z.array(OutcomeMetricSchema).min(1).max(5),
  evidence: OutcomeEvidenceRefsSchema,
  now: z.string().trim().min(1).optional(),
});
export type OutcomeAcceptancePreviewBody = z.infer<typeof OutcomeAcceptancePreviewBodySchema>;

export const OutcomeAcceptancePreviewRequestSchema = OutcomeAcceptancePreviewBodySchema.extend({
  scope: OutcomeScopeSchema,
});
export type OutcomeAcceptancePreviewRequest = z.infer<typeof OutcomeAcceptancePreviewRequestSchema>;

export const OutcomePreviewMetricSchema = OutcomeMetricSchema.extend({
  projectedDelta: z.number().finite(),
  deltaToTarget: z.number().finite(),
  previewState: OutcomeKpiPreviewStateSchema,
  suggestedSignalKind: OutcomeSignalKindSchema,
});
export type OutcomePreviewMetric = z.infer<typeof OutcomePreviewMetricSchema>;

export const OutcomeSuggestedSignalSchema = z.object({
  kind: OutcomeSignalKindSchema,
  confidence: OutcomeConfidenceSchema,
  magnitude: z.object({
    value: z.number().finite().nonnegative(),
    unit: z.string().trim().min(1),
  }),
  rationale: z.string().trim().min(1),
});
export type OutcomeSuggestedSignal = z.infer<typeof OutcomeSuggestedSignalSchema>;

export const OutcomeAcceptanceContractSchema = z.object({
  contractId: z.string().trim().min(1),
  previewId: z.string().trim().min(1),
  status: OutcomeAcceptanceStatusSchema,
  requiredActions: z.array(z.string().trim().min(1)).min(1),
  linkedMetricIds: z.array(z.string().trim().min(1)).min(1),
});
export type OutcomeAcceptanceContract = z.infer<typeof OutcomeAcceptanceContractSchema>;

export const OutcomeAcceptancePreviewResponseSchema = z.object({
  previewId: z.string().trim().min(1),
  now: z.string().trim().min(1),
  metrics: z.array(OutcomePreviewMetricSchema).min(1),
  suggestedSignals: z.array(OutcomeSuggestedSignalSchema),
  acceptanceContract: OutcomeAcceptanceContractSchema,
  businessLinkSummary: z.object({
    headline: z.string().trim().min(1),
    linkedMetricIds: z.array(z.string().trim().min(1)),
    confidence: OutcomeConfidenceSchema,
  }),
});
export type OutcomeAcceptancePreviewResponse = z.infer<typeof OutcomeAcceptancePreviewResponseSchema>;

export const OutcomeSignalIngestBodySchema = z.object({
  source: z.enum(['kpi_accept', 'analysis_link', 'user_confirmation', 'artifact_ship', 'research_mission']),
  kind: OutcomeSignalKindSchema,
  magnitude: z.object({
    value: z.number().finite().nonnegative(),
    unit: z.string().trim().min(1),
  }),
  confidence: OutcomeConfidenceSchema.default('medium'),
  evidence: OutcomeEvidenceRefsSchema.extend({
    acceptanceContractId: z.string().trim().min(1).optional(),
  }),
  note: z.string().trim().min(1).max(500).optional(),
  now: z.string().trim().min(1).optional(),
});
export type OutcomeSignalIngestBody = z.infer<typeof OutcomeSignalIngestBodySchema>;

export const OutcomeSignalIngestRequestSchema = OutcomeSignalIngestBodySchema.extend({
  scope: OutcomeScopeSchema,
});
export type OutcomeSignalIngestRequest = z.infer<typeof OutcomeSignalIngestRequestSchema>;

export const OutcomeSignalIngestResponseSchema = z.object({
  signalId: z.string().trim().min(1),
  now: z.string().trim().min(1),
  status: z.literal('captured'),
});
export type OutcomeSignalIngestResponse = z.infer<typeof OutcomeSignalIngestResponseSchema>;

export const OutcomeAcceptanceResolveBodySchema = z.object({
  contractId: z.string().trim().min(1),
  decision: OutcomeAcceptanceDecisionSchema,
  acceptedMetricIds: z.array(z.string().trim().min(1)).max(5).optional().default([]),
  note: z.string().trim().min(1).max(500).optional(),
  now: z.string().trim().min(1).optional(),
});
export type OutcomeAcceptanceResolveBody = z.infer<typeof OutcomeAcceptanceResolveBodySchema>;

export const OutcomeAcceptanceResolveRequestSchema = OutcomeAcceptanceResolveBodySchema.extend({
  scope: OutcomeScopeSchema,
});
export type OutcomeAcceptanceResolveRequest = z.infer<typeof OutcomeAcceptanceResolveRequestSchema>;

export const OutcomeAcceptanceResolveResponseSchema = z.object({
  contractId: z.string().trim().min(1),
  previewId: z.string().trim().min(1),
  status: OutcomeAcceptanceStatusSchema,
  outcomeRecordId: z.string().trim().min(1).nullable(),
  acceptedMetricIds: z.array(z.string().trim().min(1)),
  now: z.string().trim().min(1),
});
export type OutcomeAcceptanceResolveResponse = z.infer<typeof OutcomeAcceptanceResolveResponseSchema>;

export const OutcomeBusinessLinkBodySchema = z.object({
  analysisSummary: z.string().trim().min(1),
  businessGoal: z.string().trim().min(1),
  hypothesis: z.string().trim().min(1),
  metrics: z.array(OutcomeMetricSchema).min(1).max(5),
  evidence: OutcomeEvidenceRefsSchema,
  now: z.string().trim().min(1).optional(),
});
export type OutcomeBusinessLinkBody = z.infer<typeof OutcomeBusinessLinkBodySchema>;

export const OutcomeBusinessLinkRequestSchema = OutcomeBusinessLinkBodySchema.extend({
  scope: OutcomeScopeSchema,
});
export type OutcomeBusinessLinkRequest = z.infer<typeof OutcomeBusinessLinkRequestSchema>;

export const OutcomeBusinessLinkResponseSchema = z.object({
  linkId: z.string().trim().min(1),
  now: z.string().trim().min(1),
  strongestSignalKind: OutcomeSignalKindSchema,
  linkedMetricIds: z.array(z.string().trim().min(1)),
  summary: z.string().trim().min(1),
  evidenceCoverage: z.object({
    hasArtifact: z.boolean(),
    hasResearchMission: z.boolean(),
    hasReasoningRun: z.boolean(),
  }),
});
export type OutcomeBusinessLinkResponse = z.infer<typeof OutcomeBusinessLinkResponseSchema>;

