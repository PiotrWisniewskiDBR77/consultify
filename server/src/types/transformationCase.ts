import { z } from 'zod';

export const TransformationCaseStatusValues = [
  'draft',
  'plan_proposed',
  'plan_approved',
  'active',
  'cancelled',
] as const;
export type TransformationCaseStatus = (typeof TransformationCaseStatusValues)[number];

export const TransformationCapabilityStatusValues = [
  'REAL',
  'PARTIAL',
  'BLOCKED',
  'EVIDENCE_MISSING',
  'PROPOSAL_ONLY',
  'NOT_CONNECTED',
  'NOT_IMPLEMENTED',
] as const;
export type TransformationCapabilityStatus = (typeof TransformationCapabilityStatusValues)[number];

export const CreateTransformationCaseSchema = z.object({
  mandate: z.string().trim().min(3).max(4000),
  projectId: z.string().trim().min(1).max(256).nullable().optional(),
  conversationId: z.string().trim().min(1).max(256).nullable().optional(),
  desiredOutcomes: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  sourceRefs: z
    .array(
      z.object({
        artifactId: z.string().trim().min(1).max(256),
        artifactType: z.string().trim().min(1).max(128),
        module: z.string().trim().min(1).max(128),
        version: z.string().trim().max(128).nullable().optional(),
      })
    )
    .max(100)
    .default([]),
  assumptions: z.array(z.string().trim().min(1).max(1000)).max(50).default([]),
  missingInputs: z.array(z.string().trim().min(1).max(1000)).max(50).default([]),
  idempotencyKey: z.string().trim().min(8).max(256),
});

export const CreateTransformationCaseBodySchema = CreateTransformationCaseSchema.omit({
  idempotencyKey: true,
});

export const TransformationPlanStepDraftSchema = z.object({
  sourceStepId: z.string().trim().min(1).max(256).optional(),
  lifecycleStage: z.string().trim().min(1).max(100),
  businessPurpose: z.string().trim().min(3).max(1000),
  moduleTarget: z.string().trim().min(1).max(200),
  capabilityStatus: z.enum(TransformationCapabilityStatusValues),
  inputs: z.array(z.string().trim().min(1).max(500)).max(50),
  outputs: z.array(z.string().trim().min(1).max(500)).max(50),
  ownerRole: z.string().trim().min(1).max(200),
  dependsOn: z.array(z.string().trim().min(1).max(100)).max(30),
  approvalClass: z.enum(['none', 'policy_approvable', 'requires_human_approval']),
  riskClass: z.enum([
    'read_only',
    'safe_additive',
    'safe_update',
    'sensitive_update',
    'governance_transition',
  ]),
  executionMode: z.enum(['foreground', 'background', 'scheduled', 'human_activity']),
  estimatedEffort: z.string().trim().min(1).max(100),
  blockerReason: z.string().trim().max(1000).nullable(),
});

export const ReviseTransformationCaseSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    mandate: z.string().trim().min(3).max(4000).optional(),
    desiredOutcomes: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    assumptions: z.array(z.string().trim().min(1).max(1000)).max(50).optional(),
    missingInputs: z.array(z.string().trim().min(1).max(1000)).max(50).optional(),
    steps: z.array(TransformationPlanStepDraftSchema).min(1).max(100).optional(),
  })
  .refine(
    (value) =>
      value.mandate !== undefined ||
      value.desiredOutcomes !== undefined ||
      value.assumptions !== undefined ||
      value.missingInputs !== undefined ||
      value.steps !== undefined,
    { message: 'At least one plan input must change' }
  );

export const CancelTransformationCaseSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
});

export const ApproveTransformationPlanSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const ProposeInitialIdeasSchema = z.object({
  expectedVersion: z.number().int().positive(),
  maxIdeas: z.number().int().min(3).max(5).default(5),
});

export const ReviewInitialIdeasProposalSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
});

export const ProposeInterviewsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  stakeholders: z
    .array(
      z.object({
        assigneeUserId: z.string().trim().min(1).max(256),
        role: z.string().trim().min(1).max(200),
        focus: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
      })
    )
    .min(1)
    .max(20),
});

export const ReviewInterviewsProposalSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
  dueAt: z.string().datetime().optional(),
});

export const AcceptInterviewResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  insightIds: z.array(z.string().trim().min(1).max(256)).min(1).max(100),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const ProposeDrdAssessmentSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(3).max(300),
  definitionId: z.string().trim().min(1).max(256).optional(),
  definitionVersion: z.string().trim().min(1).max(100).optional(),
});

export const ReviewDrdAssessmentProposalSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
});

export const AcceptDrdResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const ProposeOpportunitySynthesisSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const ReviewOpportunitySynthesisSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
});

export const AcceptInitiativeResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const ProposeFinanceKpiPackSchema = z.object({
  expectedVersion: z.number().int().positive(),
  capex: z.number().nonnegative(),
  opexAnnual: z.number().nonnegative(),
  benefitAnnual: z.number().nonnegative(),
  horizonYears: z.number().int().min(1).max(30),
  waccPct: z.number().min(0).max(100),
  currency: z.string().trim().min(3).max(3).default('PLN'),
  kpi: z.object({
    name: z.string().trim().min(3).max(200),
    description: z.string().trim().max(1000).optional(),
    unit: z.string().trim().min(1).max(50),
    baselineValue: z.number(),
    targetValue: z.number(),
    measurementFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']).default('MONTHLY'),
    direction: z.enum(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER']).default('HIGHER_IS_BETTER'),
  }),
});

export const ReviewFinanceKpiPackSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
});

export const AcceptFinanceKpiResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const ProposePortfolioDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionMakerId: z.string().trim().min(1).max(256),
  deadline: z.string().datetime().optional(),
  supportingEvidence: z
    .array(z.object({ ref: z.string().trim().min(1).max(500), snapshot: z.record(z.string(), z.unknown()) }))
    .min(1)
    .max(50),
  contradictingEvidence: z
    .array(z.object({ ref: z.string().trim().min(1).max(500), snapshot: z.record(z.string(), z.unknown()) }))
    .min(1)
    .max(50),
});

export const ResolvePortfolioDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  selectedOption: z.enum(['go', 'no_go']),
  rationale: z.string().trim().min(3).max(2000),
});

export const ReviewPortfolioDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
});

export const AcceptPortfolioDecisionResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const ProposeMobilizationBlueprintSchema = z.object({
  expectedVersion: z.number().int().positive(),
  ownerUserId: z.string().trim().min(1).max(256),
  startDate: z.string().date(),
  endDate: z.string().date(),
  raidItems: z
    .array(
      z.object({
        type: z.enum(['risk', 'assumption', 'issue', 'dependency']),
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().min(1).max(2000),
        probability: z.enum(['low', 'medium', 'high']),
        impact: z.enum(['low', 'medium', 'high', 'critical']),
        ownerUserId: z.string().trim().min(1).max(256),
        dueDate: z.string().date(),
        response: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    .optional(),
  monitoring: z
    .object({
      cadence: z.enum(['weekly', 'daily', 'monthly']).default('weekly'),
      timezone: z.string().trim().min(1).max(100).default('UTC'),
      firstRunAt: z.string().datetime(),
      ownerUserId: z.string().trim().min(1).max(256),
    })
    .optional(),
});

export const ReviewMobilizationBlueprintSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(1000),
});

export const AcceptMobilizationResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});

export const AcceptExecutionStartSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});
export const AcceptExecutionResultsSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});
export const AcceptDeliveryHandoffSchema = z.object({
  expectedVersion: z.number().int().positive(),
  effectiveness: z.enum(['confirmed', 'partial', 'not_achieved']),
  decisionReason: z.string().trim().min(3).max(1000),
  kpiActuals: z
    .array(
      z.object({
        kpiId: z.string().trim().min(1).max(200),
        value: z.number().finite(),
        measuredAt: z.string().datetime(),
      })
    )
    .max(100)
    .default([]),
});
export const AcceptBenefitsReviewSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decisionReason: z.string().trim().min(3).max(1000),
});
export const AcceptSustainabilityReviewSchema = z.object({
  expectedVersion: z.number().int().positive(),
  conclusion: z.enum(['sustained', 'corrective_continuation', 'active_recovery']),
  decisionReason: z.string().trim().min(3).max(1000),
});

export interface TransformationPlanStep {
  stepId: string;
  stepIndex: number;
  lifecycleStage: string;
  businessPurpose: string;
  moduleTarget: string;
  capabilityStatus: TransformationCapabilityStatus;
  inputs: string[];
  outputs: string[];
  ownerRole: string;
  dependsOn: string[];
  approvalClass: 'none' | 'policy_approvable' | 'requires_human_approval';
  riskClass:
    'read_only' | 'safe_additive' | 'safe_update' | 'sensitive_update' | 'governance_transition';
  executionMode: 'foreground' | 'background' | 'scheduled' | 'human_activity';
  estimatedEffort: string;
  status: 'proposed';
  blockerReason: string | null;
}

export interface TransformationPlan {
  planId: string;
  transformationCaseId: string;
  organizationId: string;
  version: number;
  status: 'draft' | 'proposed' | 'pending_review' | 'approved' | 'cancelled';
  methodologyKey: string;
  summary: string;
  assumptions: string[];
  risks: string[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  steps: TransformationPlanStep[];
}

export interface TransformationCase {
  transformationCaseId: string;
  organizationId: string;
  projectId: string | null;
  conversationId: string | null;
  contextSnapshotId: string;
  executionRunId: string | null;
  initiatedByUserId: string;
  mandate: string;
  desiredOutcomes: string[];
  status: TransformationCaseStatus;
  lifecycleStage:
    | 'mandate'
    | 'discovery'
    | 'initial_ideas'
    | 'interviews'
    | 'drd'
    | 'opportunity_synthesis'
    | 'initiative_candidates'
    | 'finance_kpi'
    | 'portfolio_decision'
    | 'mobilization'
    | 'execution'
    | 'delivery'
    | 'benefits'
    | 'sustainability'
    | 'final_outputs';
  autonomyLevel: 'A1_prepare';
  sourceRefs: Array<Record<string, unknown>>;
  assumptions: string[];
  missingInputs: string[];
  activePlanId: string | null;
  lineageId: string;
  idempotencyKey: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  activePlan?: TransformationPlan | null;
  idempotentReplay?: boolean;
}

export type CreateTransformationCaseParams = z.infer<typeof CreateTransformationCaseSchema> & {
  organizationId: string;
  initiatedByUserId: string;
  correlationId?: string | null;
};

export type ReviseTransformationCaseParams = z.infer<typeof ReviseTransformationCaseSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type CancelTransformationCaseParams = z.infer<typeof CancelTransformationCaseSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ApproveTransformationPlanParams = z.infer<typeof ApproveTransformationPlanSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ProposeInitialIdeasParams = z.infer<typeof ProposeInitialIdeasSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ReviewInitialIdeasProposalParams = z.infer<typeof ReviewInitialIdeasProposalSchema> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ProposeInterviewsParams = z.infer<typeof ProposeInterviewsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ReviewInterviewsProposalParams = z.infer<typeof ReviewInterviewsProposalSchema> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type AcceptInterviewResultsParams = z.infer<typeof AcceptInterviewResultsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export interface AcceptedInterviewResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'drd';
  assignmentIds: string[];
  sessionIds: string[];
  answeredQuestionIds: string[];
  insightIds: string[];
  acceptedAt: string;
}

export type ProposeDrdAssessmentParams = z.infer<typeof ProposeDrdAssessmentSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ReviewDrdAssessmentProposalParams = z.infer<
  typeof ReviewDrdAssessmentProposalSchema
> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type AcceptDrdResultsParams = z.infer<typeof AcceptDrdResultsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export interface DrdAssessmentProposal {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  planId: string;
  planVersion: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  assessmentName: string;
  definitionId: string | null;
  definitionVersion: string | null;
  sourceInsightIds: string[];
  proposedByUserId: string;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assessmentId?: string;
}

export interface AcceptedDrdResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'opportunity_synthesis';
  assessmentId: string;
  acceptedSnapshotId: string;
  reviewId: string;
  acceptedAt: string;
}

export type ProposeOpportunitySynthesisParams = z.infer<
  typeof ProposeOpportunitySynthesisSchema
> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ReviewOpportunitySynthesisParams = z.infer<typeof ReviewOpportunitySynthesisSchema> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type AcceptInitiativeResultsParams = z.infer<typeof AcceptInitiativeResultsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export interface OpportunitySynthesisProposal {
  proposalId: string;
  transformationCaseId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  assessmentId: string;
  acceptedSnapshotId: string;
  sourceIdeaIds: string[];
  sourceInsightIds: string[];
  synthesisSummary: string;
  candidateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptedInitiativeResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'finance_kpi';
  candidateId: string;
  initiativeId: string;
  acceptedAt: string;
}

export type ProposeFinanceKpiPackParams = z.infer<typeof ProposeFinanceKpiPackSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ReviewFinanceKpiPackParams = z.infer<typeof ReviewFinanceKpiPackSchema> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type AcceptFinanceKpiResultsParams = z.infer<typeof AcceptFinanceKpiResultsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export interface FinanceKpiPackProposal {
  proposalId: string;
  transformationCaseId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  initiativeId: string;
  economics: {
    capex: number;
    opexAnnual: number;
    benefitAnnual: number;
    horizonYears: number;
    waccPct: number;
    currency: string;
  };
  businessCase: {
    npv: number;
    irr: number | null;
    paybackYears: number | null;
    pi: number;
    verdict: 'go' | 'conditional' | 'no-go';
    summary: string;
  };
  kpi: {
    name: string;
    description?: string;
    unit: string;
    baselineValue: number;
    targetValue: number;
    measurementFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
    direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  };
  financialAnalysisId?: string;
  kpiId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptedFinanceKpiResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'portfolio_decision';
  initiativeId: string;
  financialAnalysisId: string;
  kpiId: string;
  acceptedAt: string;
}

export type ProposePortfolioDecisionParams = z.infer<typeof ProposePortfolioDecisionSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ReviewPortfolioDecisionParams = z.infer<typeof ReviewPortfolioDecisionSchema> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export type ResolvePortfolioDecisionParams = z.infer<typeof ResolvePortfolioDecisionSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  idempotencyKey: string;
  correlationId?: string | null;
};

export interface PortfolioDecisionResolutionReceipt {
  receiptId: string;
  decisionId: string;
  packId: string;
  evidenceDigest: string;
  sourceCaseVersion: number;
  selectedOption: 'go' | 'no_go';
  decidedByUserId: string;
  authorizationType: 'decision_maker' | 'durable_delegation';
  createdAt: string;
  idempotentReplay?: boolean;
}

export type AcceptPortfolioDecisionResultsParams = z.infer<
  typeof AcceptPortfolioDecisionResultsSchema
> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export interface PortfolioDecisionProposal {
  proposalId: string;
  transformationCaseId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  initiativeId: string;
  financialAnalysisId: string;
  kpiId: string;
  decisionMakerId: string;
  title: string;
  description: string;
  criteria: string;
  deadline?: string;
  decisionId?: string;
  evidencePackId?: string;
  evidenceDigest?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptedPortfolioDecisionResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'mobilization';
  initiativeId: string;
  decisionId: string;
  acceptedAt: string;
}

export type ProposeMobilizationBlueprintParams = z.infer<
  typeof ProposeMobilizationBlueprintSchema
> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export type ReviewMobilizationBlueprintParams = z.infer<
  typeof ReviewMobilizationBlueprintSchema
> & {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export type AcceptMobilizationResultsParams = z.infer<typeof AcceptMobilizationResultsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};

export interface MobilizationBlueprintProposal {
  proposalId: string;
  transformationCaseId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  initiativeId: string;
  ownerUserId: string;
  startDate: string;
  endDate: string;
  wbs: Array<{
    key: string;
    title: string;
    description: string;
    ownerId: string;
    dueDate: string;
    acceptanceCriteria: string;
  }>;
  milestones: Array<{ name: string; description: string; targetDate: string; isGate: boolean }>;
  dependencies: Array<{ from: string; to: string; type: 'hard' }>;
  raidItems: Array<{
    type: 'risk' | 'assumption' | 'issue' | 'dependency';
    title: string;
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high' | 'critical';
    ownerUserId: string;
    dueDate: string;
    response: string;
  }>;
  monitoring: {
    cadence: 'weekly' | 'daily' | 'monthly';
    timezone: string;
    firstRunAt: string;
    ownerUserId: string;
  };
  resources: Array<{
    userId: string;
    name: string;
    role: string;
    allocationPercentage: number;
    startDate: string;
    endDate: string;
  }>;
  blueprintId?: string;
  taskIds?: string[];
  milestoneIds?: string[];
  resourceIds?: string[];
  raidItemIds?: string[];
  calendarItemIds?: string[];
  monitoringDefinitionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptedMobilizationResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'execution';
  initiativeId: string;
  blueprintId: string;
  acceptedAt: string;
}

export type AcceptExecutionStartParams = z.infer<typeof AcceptExecutionStartSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export type AcceptExecutionResultsParams = z.infer<typeof AcceptExecutionResultsSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export interface ExecutionCheckpoint {
  transformationCaseId: string;
  initiativeId: string;
  initiativeStatus: string;
  tasks: { total: number; completed: number; blocked: number };
  milestones: { total: number; completed: number; delayed: number };
  kpis: { total: number; onTarget: number };
  executionStarted: boolean;
}
export interface AcceptedExecutionStart {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'execution';
  initiativeId: string;
  acceptedAt: string;
}
export interface AcceptedExecutionResults {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'delivery';
  initiativeId: string;
  acceptedAt: string;
}
export type AcceptDeliveryHandoffParams = z.infer<typeof AcceptDeliveryHandoffSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export interface BenefitsCheckpoint {
  transformationCaseId: string;
  initiativeId: string;
  benefits: {
    total: number;
    measured: number;
    owned: number;
    achieved: number;
    atRisk: number;
  };
  financeActuals: { total: number; verified: number };
}
export interface AcceptedDeliveryHandoff {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'benefits';
  initiativeId: string;
  effectiveness: 'confirmed' | 'partial' | 'not_achieved';
  acceptedAt: string;
}
export type AcceptBenefitsReviewParams = z.infer<typeof AcceptBenefitsReviewSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export type AcceptSustainabilityReviewParams = z.infer<typeof AcceptSustainabilityReviewSchema> & {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
};
export interface SustainabilityCheckpoint {
  transformationCaseId: string;
  initiativeId: string;
  benefits: {
    total: number;
    withTwoVerifiedMeasurements: number;
    sustainedAcrossWindow: number;
    minimumWindowDays: number | null;
  };
}
export interface AcceptedBenefitsReview {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'sustainability';
  acceptedAt: string;
}
export interface AcceptedSustainabilityReview {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'final_outputs' | 'benefits';
  conclusion: 'sustained' | 'corrective_continuation' | 'active_recovery';
  acceptedAt: string;
}

export interface InterviewProposalCandidate {
  candidateId: string;
  assigneeUserId: string;
  stakeholderRole: string;
  objective: string;
  questions: Array<{
    category: 'strategy' | 'operations' | 'digital' | 'people' | 'finance';
    text: string;
  }>;
  sourceIdeaIds: string[];
}

export interface InterviewsProposal {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  planId: string;
  planVersion: number;
  lifecycleStage: 'interviews';
  proposalType: 'create_interview_assignments';
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  candidates: InterviewProposalCandidate[];
  payloadDigest: string;
  proposedByUserId: string;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifactIds?: string[];
}

export interface InitialIdeaCandidate {
  candidateId: string;
  title: string;
  body: string;
  tags: string[];
  hypothesis: string;
  evidenceNeeded: string[];
  sourceOutcome: string | null;
}

export interface InitialIdeasProposal {
  proposalId: string;
  transformationCaseId: string;
  organizationId: string;
  planId: string;
  planVersion: number;
  lifecycleStage: 'initial_ideas';
  proposalType: 'create_initial_ideas';
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  candidates: InitialIdeaCandidate[];
  payloadDigest: string;
  proposedByUserId: string;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifactIds?: string[];
}
