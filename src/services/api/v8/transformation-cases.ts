import { v8Get, v8Patch, v8Post } from './client';

export type TransformationCapabilityStatus =
  'REAL' | 'PARTIAL' | 'PROPOSAL_ONLY' | 'NOT_CONNECTED' | 'NOT_IMPLEMENTED';

export interface TransformationPlanStepDto {
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
  blockerReason: string | null;
}

export interface TransformationPlanDto {
  planId: string;
  version: number;
  status: 'draft' | 'proposed' | 'pending_review' | 'approved' | 'cancelled';
  summary: string;
  steps: TransformationPlanStepDto[];
}

export interface TransformationCaseDto {
  transformationCaseId: string;
  organizationId: string;
  projectId: string | null;
  conversationId: string | null;
  contextSnapshotId: string;
  executionRunId: string | null;
  initiatedByUserId: string;
  mandate: string;
  desiredOutcomes: string[];
  status: 'draft' | 'plan_proposed' | 'plan_approved' | 'active' | 'cancelled';
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
  assumptions: string[];
  missingInputs: string[];
  activePlanId: string | null;
  lineageId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  activePlan?: TransformationPlanDto | null;
  qualityEvaluation?: TransformationQualityEvaluationDto | null;
  idempotentReplay?: boolean;
}

export interface ProjectTeamBlueprintDto {
  blueprint_version_id: string;
  blueprint_version: number;
  status: 'needs_clarification' | 'pending_approval' | 'approved' | 'activated';
  sponsor_user_id: string | null;
  members_json: Array<{
    kind: 'human' | 'agent';
    identityId?: string | null;
    displayName: string;
    role: string;
    authority: string[];
    autonomy?: string;
    budgetLimit?: number | null;
    sourceRefs: string[];
  }>;
  raci_json: Array<{
    workItem: string;
    responsible: string[];
    accountable: string | null;
    consulted: string[];
    informed: string[];
  }>;
  work_json: Array<{
    workItem: string;
    ownerIdentityId: string | null;
    branchStatus: string;
    estimatedCost: number | null;
    conflicts: string[];
    pendingDecisions: string[];
  }>;
  missing_keys_json: string[];
  clarification_questions_json: string[];
}

export interface TransformationQualityEvaluationDto {
  status: 'passed' | 'failed';
  score: number;
  suiteVersion: 'transformation-case-live-v1';
  evaluatedCaseVersion: number;
  evaluatedAt: string;
  cases: Array<{
    caseKey: string;
    capability: string;
    dimension: string;
    criticalInvariant: string;
    passed: boolean;
    evidenceRefs: string[];
    failureReason: string | null;
  }>;
  criticalFailures: string[];
}

export interface CanonicalTransformationRunDto {
  canonicalRunId: string;
  transformationCaseId: string;
  lineageId: string;
  identityRegistered: boolean;
  actualState: string;
  projectedState: string;
  stateDrift: boolean;
  caseStatus: string;
  lifecycleStage: string;
  planVersion: number;
  aliases: Array<{ alias_type: string; external_id: string; created_at: string }>;
  proposals: Array<{ proposal_id: string; lifecycle_stage: string; status: string }>;
  timeline: Array<{ type: string; at: string; [key: string]: unknown }>;
  reconciled?: boolean;
}

export interface TransformationFinalOutputRunDto {
  runId: string;
  transformationCaseId: string;
  caseVersion: number;
  factsDigest: string;
  docxSha256: string;
  pptxSha256: string;
  generatedAt: string;
  idempotentReplay: boolean;
}

export interface FinalOutputPublicationProposalDto {
  publicationMappingId: string;
  proposalVersionId: string;
  transformationCaseId: string;
  caseVersion: number;
  factsDigest: string;
  scopeKey: 'final_outputs.publish';
  status: string;
}

export interface InitialIdeaCandidateDto {
  candidateId: string;
  title: string;
  body: string;
  tags: string[];
  hypothesis: string;
  evidenceNeeded: string[];
  sourceOutcome: string | null;
}

export type GovernedProposalStatus =
  | 'pending_review'
  | 'partially_approved'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'invalidated'
  | 'revision_requested'
  | 'superseded';

export interface GovernedProposalScopeDto {
  scopeKey: string;
  label?: string;
  decision: 'pending' | 'approved' | 'rejected';
  authority: {
    canReview: boolean;
    reviewerRole?: string | null;
    deniedReason?: string | null;
  };
}

/**
 * Optional A05 projection. Older stage endpoints do not expose this projection;
 * consumers must treat its absence as unavailable governance evidence, never as
 * implicit authority to mutate a proposal.
 */
export interface GovernedProposalProjectionDto {
  proposalVersionId: string;
  proposalVersion: number;
  planVersion?: number;
  contextDigest?: string;
  status: GovernedProposalStatus;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  scopes: GovernedProposalScopeDto[];
  expiresAt: string;
  invalidationReason?: 'expired' | 'plan_version_changed' | 'context_changed' | string | null;
  revisionReason?: string | null;
  accessState?: 'available' | 'denied' | 'error';
  accessReason?: string | null;
  approvalScopes?: string[];
  reviewerAuthorityByScope?: Record<string, string[]>;
  reviews?: Array<{
    scopeKey: string;
    decision: 'approved' | 'rejected' | 'revision_requested';
    reason: string;
    reviewedAt: string;
  }>;
}

export interface GovernedProposalMutationDto {
  proposalVersionId: string;
  proposalVersion?: number;
  status: GovernedProposalStatus;
  approvedScopes?: number;
  totalScopes?: number;
}

export interface GovernedStageProposalDto {
  governance?: GovernedProposalProjectionDto | null;
}

export interface InitialIdeasProposalDto extends GovernedStageProposalDto {
  proposalId: string;
  transformationCaseId: string;
  planId: string;
  planVersion: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  candidates: InitialIdeaCandidateDto[];
  artifactIds?: string[];
}

export interface InterviewProposalCandidateDto {
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

export interface InterviewsProposalDto extends GovernedStageProposalDto {
  proposalId: string;
  transformationCaseId: string;
  planId: string;
  planVersion: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  candidates: InterviewProposalCandidateDto[];
  artifactIds?: string[];
}

export interface AcceptedInterviewResultsDto {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'drd';
  assignmentIds: string[];
  sessionIds: string[];
  answeredQuestionIds: string[];
  insightIds: string[];
  acceptedAt: string;
}

export interface DrdAssessmentProposalDto extends GovernedStageProposalDto {
  proposalId: string;
  transformationCaseId: string;
  planId: string;
  planVersion: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  assessmentName: string;
  definitionId: string | null;
  definitionVersion: string | null;
  sourceInsightIds: string[];
  assessmentId?: string;
}

export interface AcceptedDrdResultsDto {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'opportunity_synthesis';
  assessmentId: string;
  acceptedSnapshotId: string;
  reviewId: string;
  acceptedAt: string;
}

export interface OpportunitySynthesisProposalDto extends GovernedStageProposalDto {
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

export interface AcceptedInitiativeResultsDto {
  transformationCaseId: string;
  caseVersion: number;
  lifecycleStage: 'finance_kpi';
  candidateId: string;
  initiativeId: string;
  acceptedAt: string;
}

export interface FinanceKpiPackProposalDto extends GovernedStageProposalDto {
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
}

export interface PortfolioDecisionProposalDto extends GovernedStageProposalDto {
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
}

export interface PortfolioDecisionResolutionReceiptDto {
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

export interface MobilizationBlueprintProposalDto extends GovernedStageProposalDto {
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
}
export interface ExecutionCheckpointDto {
  transformationCaseId: string;
  initiativeId: string;
  initiativeStatus: string;
  tasks: { total: number; completed: number; blocked: number };
  milestones: { total: number; completed: number; delayed: number };
  kpis: { total: number; onTarget: number };
  executionStarted: boolean;
}
export interface BenefitsCheckpointDto {
  transformationCaseId: string;
  initiativeId: string;
  benefits: { total: number; measured: number; owned: number; achieved: number; atRisk: number };
  financeActuals: { total: number; verified: number };
}
export interface SustainabilityCheckpointDto {
  transformationCaseId: string;
  initiativeId: string;
  benefits: {
    total: number;
    withTwoVerifiedMeasurements: number;
    sustainedAcrossWindow: number;
    minimumWindowDays: number | null;
  };
}

export interface CreateTransformationCaseInput {
  mandate: string;
  projectId?: string | null;
  conversationId?: string | null;
  desiredOutcomes?: string[];
  assumptions?: string[];
  missingInputs?: string[];
}
export interface TransformationPlanningIntakeDto {
  intakeId: string;
  status: 'needs_clarification' | 'ready' | 'converted';
  mandate: string;
  measurableOutcomes: string[];
  sponsor: string | null;
  scope: string | null;
  horizon: string | null;
  missingKeys: Array<'measurable_outcomes' | 'sponsor' | 'scope' | 'horizon'>;
  convertedCaseId: string | null;
  sourceTemplateId: string | null;
  sourceTemplateVersion: number | null;
  sourceTemplateDigest: string | null;
  idempotentReplay: boolean;
}

export const TransformationCasesApi = {
  startPlanningIntakeFromTemplate: (
    input: {
      templateId: string;
      projectId?: string | null;
      conversationId?: string | null;
      mandate?: string;
      measurableOutcomes?: string[];
      sponsor?: string;
      scope?: string;
      horizon?: string;
    },
    idempotencyKey: string
  ) =>
    v8Post<TransformationPlanningIntakeDto>(
      '/transformation-cases/planning-intakes/from-template',
      input,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  startPlanningIntake: (
    input: CreateTransformationCaseInput & { sponsor?: string; scope?: string; horizon?: string },
    idempotencyKey: string
  ) =>
    v8Post<TransformationPlanningIntakeDto>('/transformation-cases/planning-intakes', input, {
      extraHeaders: { 'Idempotency-Key': idempotencyKey },
    }),
  answerPlanningIntake: (
    intakeId: string,
    input: { measurableOutcomes?: string[]; sponsor?: string; scope?: string; horizon?: string }
  ) =>
    v8Patch<TransformationPlanningIntakeDto>(
      `/transformation-cases/planning-intakes/${encodeURIComponent(intakeId)}`,
      input
    ),
  convertPlanningIntake: (intakeId: string) =>
    v8Post<{ intake: TransformationPlanningIntakeDto; transformationCaseId: string }>(
      `/transformation-cases/planning-intakes/${encodeURIComponent(intakeId)}/convert`,
      {}
    ),
  convertTemplatePlanningIntake: (
    intakeId: string,
    expectedTemplateDigest: string,
    idempotencyKey: string
  ) =>
    v8Post<{
      intake: TransformationPlanningIntakeDto;
      transformationCaseId: string;
      planId: string;
      canonicalRunId: string;
      idempotentReplay: boolean;
    }>(
      `/transformation-cases/planning-intakes/${encodeURIComponent(intakeId)}/convert-template`,
      { expectedTemplateDigest },
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  getGovernedProposal: (proposalVersionId: string) =>
    v8Get<GovernedProposalProjectionDto>(
      `/agent-proposals/${encodeURIComponent(proposalVersionId)}`
    ),

  reviewGovernedProposalScope: (
    proposalVersionId: string,
    scopeKey: string,
    input: { decision: 'approved' | 'rejected' | 'revision_requested'; reason: string }
  ) =>
    v8Post<GovernedProposalMutationDto>(
      `/agent-proposals/${encodeURIComponent(proposalVersionId)}/scopes/${encodeURIComponent(scopeKey)}/review`,
      input
    ),

  rejectGovernedProposalScope: (proposalVersionId: string, scopeKey: string, reason: string) =>
    v8Post<GovernedProposalMutationDto>(
      `/agent-proposals/${encodeURIComponent(proposalVersionId)}/scopes/${encodeURIComponent(scopeKey)}/reject`,
      { reason }
    ),

  requestGovernedProposalRevision: (proposalVersionId: string, scopeKey: string, reason: string) =>
    v8Post<GovernedProposalMutationDto>(
      `/agent-proposals/${encodeURIComponent(proposalVersionId)}/scopes/${encodeURIComponent(scopeKey)}/request-revision`,
      { reason }
    ),

  reviseGovernedProposal: (
    proposalVersionId: string,
    input: { after: Record<string, unknown>; expiresAt: string; reason: string }
  ) =>
    v8Post<GovernedProposalMutationDto>(
      `/agent-proposals/${encodeURIComponent(proposalVersionId)}/revise`,
      input
    ),

  rebaselineGovernedProposal: (
    proposalVersionId: string,
    input: { planVersion: number; contextDigest: string; expiresAt: string; reason: string }
  ) =>
    v8Post<GovernedProposalMutationDto>(
      `/agent-proposals/${encodeURIComponent(proposalVersionId)}/rebaseline`,
      input
    ),

  create: (input: CreateTransformationCaseInput, idempotencyKey: string) =>
    v8Post<TransformationCaseDto>('/transformation-cases', input, {
      extraHeaders: { 'Idempotency-Key': idempotencyKey },
    }),

  list: (params?: { projectId?: string; limit?: number }) =>
    v8Get<TransformationCaseDto[]>('/transformation-cases', {
      ...(params?.projectId ? { projectId: params.projectId } : {}),
      ...(params?.limit ? { limit: String(params.limit) } : {}),
    }),

  get: (transformationCaseId: string) =>
    v8Get<TransformationCaseDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}`
    ),

  getQualityEvaluation: (transformationCaseId: string) =>
    v8Get<TransformationQualityEvaluationDto>(
      `/agent-quality/transformation-cases/${encodeURIComponent(transformationCaseId)}`
    ),

  getCanonicalRuntime: (transformationCaseId: string) =>
    v8Get<CanonicalTransformationRunDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/runtime`
    ),

  reconcileCanonicalRuntime: (transformationCaseId: string, reason: string) =>
    v8Post<CanonicalTransformationRunDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/runtime/reconcile`,
      { reason }
    ),

  revise: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      mandate?: string;
      desiredOutcomes?: string[];
      assumptions?: string[];
      missingInputs?: string[];
      steps?: Array<
        Omit<TransformationPlanStepDto, 'stepId' | 'stepIndex'> & { sourceStepId?: string }
      >;
    }
  ) =>
    v8Patch<TransformationCaseDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/plan`,
      input
    ),

  cancel: (transformationCaseId: string, expectedVersion: number, reason: string) =>
    v8Post<TransformationCaseDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/cancel`,
      { expectedVersion, reason }
    ),

  approvePlan: (transformationCaseId: string, expectedVersion: number, decisionReason: string) =>
    v8Post<TransformationCaseDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/plan/approve`,
      { expectedVersion, decisionReason }
    ),

  proposeInitialIdeas: (transformationCaseId: string, expectedVersion: number, maxIdeas = 5) =>
    v8Post<InitialIdeasProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/ideas/propose`,
      { expectedVersion, maxIdeas }
    ),

  getInitialIdeasProposal: (transformationCaseId: string) =>
    v8Get<InitialIdeasProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/ideas/proposal`
    ),

  reviewInitialIdeasProposal: (
    transformationCaseId: string,
    proposalId: string,
    input: { expectedVersion: number; decision: 'approve' | 'reject'; reason: string }
  ) =>
    v8Post<InitialIdeasProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/ideas/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),

  proposeInterviews: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      stakeholders: Array<{ assigneeUserId: string; role: string; focus: string[] }>;
    }
  ) =>
    v8Post<InterviewsProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/interviews/propose`,
      input
    ),

  getInterviewsProposal: (transformationCaseId: string) =>
    v8Get<InterviewsProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/interviews/proposal`
    ),

  reviewInterviewsProposal: (
    transformationCaseId: string,
    proposalId: string,
    input: {
      expectedVersion: number;
      decision: 'approve' | 'reject';
      reason: string;
      dueAt?: string;
    }
  ) =>
    v8Post<InterviewsProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/interviews/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),

  acceptInterviewResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; insightIds: string[]; decisionReason: string }
  ) =>
    v8Post<AcceptedInterviewResultsDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/interviews/accept-results`,
      input
    ),

  proposeDrdAssessment: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      name: string;
      definitionId?: string;
      definitionVersion?: string;
    }
  ) =>
    v8Post<DrdAssessmentProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/drd/propose`,
      input
    ),

  getDrdAssessmentProposal: (transformationCaseId: string) =>
    v8Get<DrdAssessmentProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/drd/proposal`
    ),

  reviewDrdAssessmentProposal: (
    transformationCaseId: string,
    proposalId: string,
    input: { expectedVersion: number; decision: 'approve' | 'reject'; reason: string }
  ) =>
    v8Post<DrdAssessmentProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/drd/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),

  acceptDrdResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<AcceptedDrdResultsDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/drd/accept-results`,
      input
    ),

  proposeOpportunitySynthesis: (transformationCaseId: string, expectedVersion: number) =>
    v8Post<OpportunitySynthesisProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/synthesis/propose`,
      { expectedVersion }
    ),

  getOpportunitySynthesisProposal: (transformationCaseId: string) =>
    v8Get<OpportunitySynthesisProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/synthesis/proposal`
    ),

  reviewOpportunitySynthesis: (
    transformationCaseId: string,
    proposalId: string,
    input: { expectedVersion: number; decision: 'approve' | 'reject'; reason: string }
  ) =>
    v8Post<OpportunitySynthesisProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/synthesis/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),

  acceptInitiativeResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<AcceptedInitiativeResultsDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/initiatives/accept-results`,
      input
    ),

  proposeFinanceKpiPack: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      capex: number;
      opexAnnual: number;
      benefitAnnual: number;
      horizonYears: number;
      waccPct: number;
      currency: string;
      kpi: {
        name: string;
        description?: string;
        unit: string;
        baselineValue: number;
        targetValue: number;
        measurementFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
        direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
      };
    }
  ) =>
    v8Post<FinanceKpiPackProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/finance-kpi/propose`,
      input
    ),

  getFinanceKpiPackProposal: (transformationCaseId: string) =>
    v8Get<FinanceKpiPackProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/finance-kpi/proposal`
    ),

  reviewFinanceKpiPack: (
    transformationCaseId: string,
    proposalId: string,
    input: { expectedVersion: number; decision: 'approve' | 'reject'; reason: string }
  ) =>
    v8Post<FinanceKpiPackProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/finance-kpi/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),

  acceptFinanceKpiResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<{ lifecycleStage: 'portfolio_decision'; financialAnalysisId: string; kpiId: string }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/finance-kpi/accept-results`,
      input
    ),

  proposePortfolioDecision: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      decisionMakerId: string;
      deadline?: string;
      supportingEvidence: Array<{ ref: string; snapshot: Record<string, unknown> }>;
      contradictingEvidence: Array<{ ref: string; snapshot: Record<string, unknown> }>;
    }
  ) =>
    v8Post<PortfolioDecisionProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/portfolio-decision/propose`,
      input
    ),
  getPortfolioDecisionProposal: (transformationCaseId: string) =>
    v8Get<PortfolioDecisionProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/portfolio-decision/proposal`
    ),
  reviewPortfolioDecision: (
    transformationCaseId: string,
    proposalId: string,
    input: { expectedVersion: number; decision: 'approve' | 'reject'; reason: string }
  ) =>
    v8Post<PortfolioDecisionProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/portfolio-decision/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),
  acceptPortfolioDecisionResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<{ lifecycleStage: 'mobilization'; decisionId: string; initiativeId: string }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/portfolio-decision/accept-results`,
      input
    ),
  resolvePortfolioDecision: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      evidenceDigest: string;
      selectedOption: 'go' | 'no_go';
      rationale: string;
    },
    idempotencyKey: string
  ) =>
    v8Post<PortfolioDecisionResolutionReceiptDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/portfolio-decision/resolve`,
      input,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),

  proposeMobilizationBlueprint: (
    transformationCaseId: string,
    input: { expectedVersion: number; ownerUserId: string; startDate: string; endDate: string }
  ) =>
    v8Post<MobilizationBlueprintProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/mobilization/propose`,
      input
    ),
  getMobilizationBlueprintProposal: (transformationCaseId: string) =>
    v8Get<MobilizationBlueprintProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/mobilization/proposal`
    ),
  reviewMobilizationBlueprint: (
    transformationCaseId: string,
    proposalId: string,
    input: { expectedVersion: number; decision: 'approve' | 'reject'; reason: string }
  ) =>
    v8Post<MobilizationBlueprintProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/mobilization/proposals/${encodeURIComponent(proposalId)}/review`,
      input
    ),
  acceptMobilizationResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<{ lifecycleStage: 'execution'; initiativeId: string; blueprintId: string }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/mobilization/accept-results`,
      input
    ),
  getExecutionCheckpoint: (transformationCaseId: string) =>
    v8Get<ExecutionCheckpointDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/execution/checkpoint`
    ),
  acceptExecutionStart: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<{ lifecycleStage: 'execution'; caseVersion: number }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/execution/accept-start`,
      input
    ),
  acceptExecutionResults: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<{ lifecycleStage: 'delivery'; caseVersion: number }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/execution/accept-results`,
      input
    ),
  getBenefitsCheckpoint: (transformationCaseId: string) =>
    v8Get<BenefitsCheckpointDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/delivery/benefits-checkpoint`
    ),
  acceptDeliveryHandoff: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      effectiveness: 'confirmed' | 'partial' | 'not_achieved';
      decisionReason: string;
      kpiActuals?: Array<{ kpiId: string; value: number; measuredAt: string }>;
    }
  ) =>
    v8Post<{ lifecycleStage: 'benefits'; caseVersion: number }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/delivery/accept-benefits-handoff`,
      input
    ),
  acceptBenefitsReview: (
    transformationCaseId: string,
    input: { expectedVersion: number; decisionReason: string }
  ) =>
    v8Post<{ lifecycleStage: 'sustainability'; caseVersion: number }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/benefits/accept-results`,
      input
    ),
  getSustainabilityCheckpoint: (transformationCaseId: string) =>
    v8Get<SustainabilityCheckpointDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/sustainability/checkpoint`
    ),
  acceptSustainabilityReview: (
    transformationCaseId: string,
    input: {
      expectedVersion: number;
      conclusion: 'sustained' | 'corrective_continuation' | 'active_recovery';
      decisionReason: string;
    }
  ) =>
    v8Post<{ lifecycleStage: 'final_outputs' | 'benefits'; caseVersion: number }>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/sustainability/review`,
      input
    ),
  generateFinalOutputs: (transformationCaseId: string) =>
    v8Post<TransformationFinalOutputRunDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/final-outputs/generate`,
      {}
    ),
  prepareFinalOutputPublication: (transformationCaseId: string) =>
    v8Post<FinalOutputPublicationProposalDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/final-outputs/prepare-publication`,
      {}
    ),
  getLatestFinalOutputs: (transformationCaseId: string) =>
    v8Get<TransformationFinalOutputRunDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/final-outputs/latest`
    ),
  getProjectTeam: (transformationCaseId: string) =>
    v8Get<ProjectTeamBlueprintDto>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/team-blueprints/current`
    ),
  proposeProjectTeam: (transformationCaseId: string, body: unknown, idempotencyKey: string) =>
    v8Post<unknown>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/team-blueprints`,
      body,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  approveProjectTeam: (
    transformationCaseId: string,
    blueprintVersionId: string,
    body: unknown,
    idempotencyKey: string
  ) =>
    v8Post<unknown>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/team-blueprints/${encodeURIComponent(blueprintVersionId)}/approve`,
      body,
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
  activateProjectTeam: (
    transformationCaseId: string,
    blueprintVersionId: string,
    idempotencyKey: string
  ) =>
    v8Post<unknown>(
      `/transformation-cases/${encodeURIComponent(transformationCaseId)}/team-blueprints/${encodeURIComponent(blueprintVersionId)}/activate`,
      {},
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    ),
};
