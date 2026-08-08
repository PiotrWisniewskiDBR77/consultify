import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import type {
  AcceptBenefitsReviewParams,
  AcceptDeliveryHandoffParams,
  AcceptDrdResultsParams,
  AcceptedBenefitsReview,
  AcceptedDeliveryHandoff,
  AcceptedDrdResults,
  AcceptedExecutionResults,
  AcceptedExecutionStart,
  AcceptedFinanceKpiResults,
  AcceptedInitiativeResults,
  AcceptedInterviewResults,
  AcceptedMobilizationResults,
  AcceptedPortfolioDecisionResults,
  AcceptedSustainabilityReview,
  AcceptExecutionResultsParams,
  AcceptExecutionStartParams,
  AcceptFinanceKpiResultsParams,
  AcceptInitiativeResultsParams,
  AcceptInterviewResultsParams,
  AcceptMobilizationResultsParams,
  AcceptPortfolioDecisionResultsParams,
  AcceptSustainabilityReviewParams,
  ApproveTransformationPlanParams,
  BenefitsCheckpoint,
  CancelTransformationCaseParams,
  CreateTransformationCaseParams,
  DrdAssessmentProposal,
  ExecutionCheckpoint,
  FinanceKpiPackProposal,
  InitialIdeaCandidate,
  InitialIdeasProposal,
  InterviewProposalCandidate,
  InterviewsProposal,
  MobilizationBlueprintProposal,
  OpportunitySynthesisProposal,
  PortfolioDecisionProposal,
  PortfolioDecisionResolutionReceipt,
  ProposeDrdAssessmentParams,
  ProposeFinanceKpiPackParams,
  ProposeInitialIdeasParams,
  ProposeInterviewsParams,
  ProposeMobilizationBlueprintParams,
  ProposeOpportunitySynthesisParams,
  ProposePortfolioDecisionParams,
  ReviewDrdAssessmentProposalParams,
  ReviewFinanceKpiPackParams,
  ReviewInitialIdeasProposalParams,
  ReviewInterviewsProposalParams,
  ReviewMobilizationBlueprintParams,
  ReviewOpportunitySynthesisParams,
  ReviewPortfolioDecisionParams,
  ResolvePortfolioDecisionParams,
  ReviseTransformationCaseParams,
  SustainabilityCheckpoint,
  TransformationCase,
  TransformationPlan,
  TransformationPlanStep,
} from '../../types/transformationCase.js';
import {
  AcceptBenefitsReviewSchema,
  AcceptDeliveryHandoffSchema,
  AcceptDrdResultsSchema,
  AcceptExecutionResultsSchema,
  AcceptExecutionStartSchema,
  AcceptFinanceKpiResultsSchema,
  AcceptInitiativeResultsSchema,
  AcceptInterviewResultsSchema,
  AcceptMobilizationResultsSchema,
  AcceptPortfolioDecisionResultsSchema,
  AcceptSustainabilityReviewSchema,
  ApproveTransformationPlanSchema,
  CancelTransformationCaseSchema,
  CreateTransformationCaseSchema,
  ProposeDrdAssessmentSchema,
  ProposeFinanceKpiPackSchema,
  ProposeInitialIdeasSchema,
  ProposeInterviewsSchema,
  ProposeMobilizationBlueprintSchema,
  ProposeOpportunitySynthesisSchema,
  ProposePortfolioDecisionSchema,
  ReviewDrdAssessmentProposalSchema,
  ReviewFinanceKpiPackSchema,
  ReviewInitialIdeasProposalSchema,
  ReviewInterviewsProposalSchema,
  ReviewMobilizationBlueprintSchema,
  ReviewOpportunitySynthesisSchema,
  ReviewPortfolioDecisionSchema,
  ResolvePortfolioDecisionSchema,
  ReviseTransformationCaseSchema,
} from '../../types/transformationCase.js';
import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import { retrieveAndRevalidateTransformationContext } from './agentContextProductionRetrievalAdapter.js';
import {
  type AdapterExecutionResult,
  dispatchAgentAdapter,
} from './agentAdapterOrchestratorService.js';
import {
  assertProposalExecutable,
  registerGovernedProposal,
  reviewProposalScope,
  withProposalGovernanceClient,
} from './agentProposalGovernanceService.js';
import { loadTransformationAgentExecutionContext } from './transformationAgentExecutionContextService.js';

interface CaseRow {
  transformation_case_id: string;
  organization_id: string;
  project_id: string | null;
  conversation_id: string | null;
  context_snapshot_id: string;
  execution_run_id: string | null;
  initiated_by_user_id: string;
  mandate: string;
  desired_outcomes_json: unknown;
  status: string;
  lifecycle_stage: string;
  autonomy_level: string;
  source_refs_json: unknown;
  assumptions_json: unknown;
  missing_inputs_json: unknown;
  active_plan_id: string | null;
  lineage_id: string;
  idempotency_key: string;
  version: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

interface PlanRow {
  plan_id: string;
  transformation_case_id: string;
  organization_id: string;
  version: number;
  status: string;
  methodology_key: string;
  summary: string;
  assumptions_json: unknown;
  risks_json: unknown;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface StepRow {
  step_id: string;
  step_index: number;
  lifecycle_stage: string;
  business_purpose: string;
  module_target: string;
  capability_status: TransformationPlanStep['capabilityStatus'];
  inputs_json: unknown;
  outputs_json: unknown;
  owner_role: string;
  depends_on_json: unknown;
  approval_class: TransformationPlanStep['approvalClass'];
  risk_class: TransformationPlanStep['riskClass'];
  execution_mode: TransformationPlanStep['executionMode'];
  estimated_effort: string;
  status: 'proposed';
  blocker_reason: string | null;
}

interface StageProposalRow {
  proposal_id: string;
  transformation_case_id: string;
  organization_id: string;
  plan_id: string;
  plan_version: number;
  lifecycle_stage:
    | 'initial_ideas'
    | 'interviews'
    | 'drd'
    | 'opportunity_synthesis'
    | 'finance_kpi'
    | 'portfolio_decision'
    | 'mobilization';
  proposal_type:
    | 'create_initial_ideas'
    | 'create_interview_assignments'
    | 'create_drd_assessment'
    | 'create_initiative_candidate'
    | 'create_finance_kpi_pack'
    | 'create_portfolio_decision'
    | 'apply_mobilization_blueprint';
  status: InitialIdeasProposal['status'];
  payload_json: unknown;
  payload_digest: string;
  proposed_by_user_id: string;
  reviewed_by_user_id: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  governed_proposal_version_id: string | null;
  created_at: string;
  updated_at: string;
}

type ShadowGovernanceStage =
  | 'initial_ideas'
  | 'interviews'
  | 'drd'
  | 'opportunity_synthesis'
  | 'finance_kpi'
  | 'portfolio_decision'
  | 'mobilization';

type ResultGateKey =
  | 'initiative_results'
  | 'finance_kpi_results'
  | 'portfolio_decision_results'
  | 'mobilization_results'
  | 'execution_start'
  | 'execution_results'
  | 'delivery_handoff'
  | 'benefits_review'
  | 'sustainability_review';

interface ResultGateMappingRow {
  gate_mapping_id: string;
  transformation_case_id: string;
  organization_id: string;
  gate_key: ResultGateKey;
  source_case_version: number;
  governed_proposal_version_id: string;
  status: 'pending' | 'approved' | 'applied';
  result_json: unknown;
}

async function getStageShadowExecutionAuthority(
  client: PgTransactionClient,
  current: CaseRow
): Promise<{ planVersion: number; contextDigest: string }> {
  const plan = (
    await client.query<{ version: number }>(
      `SELECT version FROM transformation_plans
       WHERE plan_id=? AND transformation_case_id=? AND organization_id=?`,
      [current.active_plan_id, current.transformation_case_id, current.organization_id]
    )
  ).rows[0];
  if (!plan) throw new Error('shadow_governance_active_plan_not_found');
  return {
    planVersion: plan.version,
    contextDigest: createHash('sha256')
      .update(
        JSON.stringify({
          snapshotId: current.context_snapshot_id,
          transformationCaseId: current.transformation_case_id,
        })
      )
      .digest('hex'),
  };
}

async function registerStageShadowProposal(
  client: PgTransactionClient,
  input: {
    current: CaseRow;
    proposalId: string;
    stage: ShadowGovernanceStage;
    payload: Record<string, unknown>;
    reviewerUserIds: string[];
    actorUserId: string;
  }
): Promise<string> {
  const authority = await getStageShadowExecutionAuthority(client, input.current);
  const reviewerUserIds = [...new Set(input.reviewerUserIds.filter(Boolean))];
  const governed = await withProposalGovernanceClient(client, () =>
    registerGovernedProposal({
      proposalId: input.proposalId,
      organizationId: input.current.organization_id,
      canonicalRunId:
        input.current.execution_run_id ??
        `transformation-case:${input.current.transformation_case_id}`,
      planVersion: authority.planVersion,
      contextDigest: authority.contextDigest,
      before: {
        lifecycleStage: input.stage,
        caseVersion: input.current.version,
        materialized: false,
      },
      after: input.payload,
      approvalScopes: [input.stage],
      reviewerAuthorityByScope: { [input.stage]: reviewerUserIds },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      actorUserId: input.actorUserId,
      changeReason: `Shadow governance mapping for ${input.stage}`,
    })
  );
  return governed.proposalVersionId;
}

async function applyStageShadowReview(
  client: PgTransactionClient,
  input: {
    proposal: StageProposalRow;
    organizationId: string;
    actorUserId: string;
    decision: 'approve' | 'reject';
    reason: string;
  }
): Promise<{ status: string | null; blockedReason: string | null }> {
  if (!input.proposal.governed_proposal_version_id)
    return { status: null, blockedReason: 'governed_proposal_mapping_missing' };
  try {
    const reviewed = await withProposalGovernanceClient(client, () =>
      reviewProposalScope({
        proposalVersionId: input.proposal.governed_proposal_version_id!,
        organizationId: input.organizationId,
        scopeKey: input.proposal.lifecycle_stage,
        decision: input.decision === 'approve' ? 'approved' : 'rejected',
        reason: input.reason,
        actorUserId: input.actorUserId,
      })
    );
    return { status: reviewed.status, blockedReason: null };
  } catch (error) {
    if (error instanceof Error && error.message === 'governed_proposal_expired')
      return { status: 'expired', blockedReason: 'expired' };
    throw error;
  }
}

async function assertStageShadowExecutable(
  client: PgTransactionClient,
  input: { current: CaseRow; proposal: StageProposalRow }
): Promise<{ status: string | null; blockedReason: string | null }> {
  if (!input.proposal.governed_proposal_version_id)
    return { status: null, blockedReason: 'governed_proposal_mapping_missing' };
  const authority = await getStageShadowExecutionAuthority(client, input.current);
  const executable = await withProposalGovernanceClient(client, () =>
    assertProposalExecutable({
      proposalVersionId: input.proposal.governed_proposal_version_id!,
      organizationId: input.current.organization_id,
      planVersion: authority.planVersion,
      contextDigest: authority.contextDigest,
    })
  );
  return {
    status: executable.status,
    blockedReason: executable.executable ? null : executable.reason,
  };
}

async function enforceStageCommonDecision(
  client: PgTransactionClient,
  input: {
    current: CaseRow;
    proposal: StageProposalRow;
    actorUserId: string;
    decision: 'approve' | 'reject';
    reason: string;
  }
) {
  const reviewed = await applyStageShadowReview(client, {
    proposal: input.proposal,
    organizationId: input.current.organization_id,
    actorUserId: input.actorUserId,
    decision: input.decision,
    reason: input.reason,
  });
  if (reviewed.blockedReason || input.decision === 'reject') return reviewed;
  return assertStageShadowExecutable(client, {
    current: input.current,
    proposal: input.proposal,
  });
}

async function recordStageShadowParity(
  client: PgTransactionClient,
  input: {
    current: CaseRow;
    proposal: StageProposalRow;
    legacyStatus: 'approved' | 'rejected';
    governedStatus: string | null;
    actorUserId: string;
    correlationId?: string;
    now: string;
  }
) {
  if (!input.proposal.governed_proposal_version_id) return;
  const divergence = input.governedStatus !== input.legacyStatus;
  const detail = {
    mode: 'shadow',
    proposalId: input.proposal.proposal_id,
    governedProposalVersionId: input.proposal.governed_proposal_version_id,
    scopeKey: input.proposal.lifecycle_stage,
    legacyStatus: input.legacyStatus,
    governedStatus: input.governedStatus,
    divergence,
    materializationAuthority: 'common_a05',
  };
  await client.query(
    `INSERT INTO transformation_case_audit_events (
      audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,
      actor_user_id,correlation_id,payload_digest,detail_json,created_at
    ) VALUES (?,?,?,?,?,'transformation_proposal.shadow_parity',?,?,?,?::jsonb,?)`,
    [
      uuidv4(),
      input.current.transformation_case_id,
      input.current.organization_id,
      input.current.active_plan_id,
      input.proposal.plan_version,
      input.actorUserId,
      input.correlationId ?? null,
      createHash('sha256').update(JSON.stringify(detail)).digest('hex'),
      JSON.stringify(detail),
      input.now,
    ]
  );
}

async function prepareResultGateAuthority(
  client: PgTransactionClient,
  input: {
    current: CaseRow;
    gateKey: ResultGateKey;
    actorUserId: string;
    reason: string;
    after: Record<string, unknown>;
  }
): Promise<{ mapping: ResultGateMappingRow; blockedReason: string | null }> {
  const authority = await getStageShadowExecutionAuthority(client, input.current);
  let mapping = (
    await client.query<ResultGateMappingRow>(
      `SELECT * FROM transformation_result_gate_governance
       WHERE transformation_case_id=? AND organization_id=? AND gate_key=? FOR UPDATE`,
      [input.current.transformation_case_id, input.current.organization_id, input.gateKey]
    )
  ).rows[0];
  if (!mapping) {
    const proposalId = `result-gate:${input.current.transformation_case_id}:${input.gateKey}`;
    const governed = await withProposalGovernanceClient(client, () =>
      registerGovernedProposal({
        proposalId,
        organizationId: input.current.organization_id,
        canonicalRunId:
          input.current.execution_run_id ??
          `transformation-case:${input.current.transformation_case_id}`,
        planVersion: authority.planVersion,
        contextDigest: authority.contextDigest,
        before: {
          lifecycleStage: input.current.lifecycle_stage,
          caseVersion: input.current.version,
          gateKey: input.gateKey,
        },
        after: input.after,
        approvalScopes: [input.gateKey],
        reviewerAuthorityByScope: { [input.gateKey]: [input.current.initiated_by_user_id] },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        actorUserId: input.actorUserId,
        changeReason: `Transformation result gate ${input.gateKey}`,
      })
    );
    mapping = {
      gate_mapping_id: uuidv4(),
      transformation_case_id: input.current.transformation_case_id,
      organization_id: input.current.organization_id,
      gate_key: input.gateKey,
      source_case_version: input.current.version,
      governed_proposal_version_id: governed.proposalVersionId,
      status: 'pending',
      result_json: null,
    };
    await client.query(
      `INSERT INTO transformation_result_gate_governance (
        gate_mapping_id,transformation_case_id,organization_id,gate_key,source_case_version,
        governed_proposal_version_id,status
      ) VALUES (?,?,?,?,?,?,'pending')`,
      [
        mapping.gate_mapping_id,
        mapping.transformation_case_id,
        mapping.organization_id,
        mapping.gate_key,
        mapping.source_case_version,
        mapping.governed_proposal_version_id,
      ]
    );
  }
  if (Number(mapping.source_case_version) !== input.current.version)
    return { mapping, blockedReason: 'case_version_changed' };
  let executable = await withProposalGovernanceClient(client, () =>
    assertProposalExecutable({
      proposalVersionId: mapping.governed_proposal_version_id,
      organizationId: input.current.organization_id,
      planVersion: authority.planVersion,
      contextDigest: authority.contextDigest,
    })
  );
  if (executable.status === 'pending_review') {
    await withProposalGovernanceClient(client, () =>
      reviewProposalScope({
        proposalVersionId: mapping.governed_proposal_version_id,
        organizationId: input.current.organization_id,
        scopeKey: input.gateKey,
        decision: 'approved',
        reason: input.reason,
        actorUserId: input.actorUserId,
      })
    );
    executable = await withProposalGovernanceClient(client, () =>
      assertProposalExecutable({
        proposalVersionId: mapping.governed_proposal_version_id,
        organizationId: input.current.organization_id,
        planVersion: authority.planVersion,
        contextDigest: authority.contextDigest,
      })
    );
  }
  if (!executable.executable) return { mapping, blockedReason: executable.reason };
  await client.query(
    `UPDATE transformation_result_gate_governance SET status='approved',updated_at=?
     WHERE gate_mapping_id=? AND organization_id=?`,
    [new Date().toISOString(), mapping.gate_mapping_id, mapping.organization_id]
  );
  mapping.status = 'approved';
  return { mapping, blockedReason: null };
}

async function completeResultGate(
  client: PgTransactionClient,
  input: {
    current: CaseRow;
    mapping: ResultGateMappingRow;
    result: Record<string, unknown>;
    actorUserId: string;
    correlationId?: string;
    now: string;
  }
) {
  await client.query(
    `UPDATE transformation_result_gate_governance
      SET status='applied',result_json=?::jsonb,applied_at=?,updated_at=?
      WHERE gate_mapping_id=? AND organization_id=? AND status='approved'`,
    [
      JSON.stringify(input.result),
      input.now,
      input.now,
      input.mapping.gate_mapping_id,
      input.mapping.organization_id,
    ]
  );
  const detail = {
    mode: 'enforced',
    gateKey: input.mapping.gate_key,
    governedProposalVersionId: input.mapping.governed_proposal_version_id,
    sourceCaseVersion: input.mapping.source_case_version,
    legacyStatus: 'applied',
    governedStatus: 'approved',
    divergence: false,
    materializationAuthority: 'common_a05',
  };
  await client.query(
    `INSERT INTO transformation_case_audit_events (
      audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,
      actor_user_id,correlation_id,payload_digest,detail_json,created_at
    ) VALUES (?,?,?,?,?,'transformation_result_gate.a05_parity',?,?,?,?::jsonb,?)`,
    [
      uuidv4(),
      input.current.transformation_case_id,
      input.current.organization_id,
      input.current.active_plan_id,
      input.mapping.source_case_version,
      input.actorUserId,
      input.correlationId ?? null,
      createHash('sha256').update(JSON.stringify(detail)).digest('hex'),
      JSON.stringify(detail),
      input.now,
    ]
  );
}

async function loadResultGateReplay<T>(
  client: PgTransactionClient,
  input: {
    transformationCaseId: string;
    organizationId: string;
    gateKey: ResultGateKey;
    sourceCaseVersion: number;
  }
): Promise<T | null> {
  const row = (
    await client.query<{ result_json: unknown }>(
      `SELECT result_json FROM transformation_result_gate_governance
       WHERE transformation_case_id=? AND organization_id=? AND gate_key=?
         AND source_case_version=? AND status='applied'`,
      [input.transformationCaseId, input.organizationId, input.gateKey, input.sourceCaseVersion]
    )
  ).rows[0];
  return row ? jsonValue<T>(row.result_json, null as T) : null;
}

async function dispatchT01StageMaterialization(input: {
  current: CaseRow;
  proposal: StageProposalRow;
  actorUserId: string;
  toolName:
    | 'transformation.ideas.materialize'
    | 'transformation.interviews.materialize'
    | 'transformation.drd.materialize'
    | 'transformation.initiative_candidate.materialize'
    | 'transformation.finance_kpi.materialize'
    | 'transformation.portfolio_decision.materialize'
    | 'transformation.mobilization.materialize';
  execute: () => Promise<AdapterExecutionResult>;
  readback: (artifactId: string) => Promise<Record<string, unknown> | null>;
}) {
  const context = await loadTransformationAgentExecutionContext({
    transformationCaseId: input.current.transformation_case_id,
    organizationId: input.current.organization_id,
    actorUserId: input.actorUserId,
  });
  return dispatchAgentAdapter({
    canonicalRunId: context.canonicalRunId,
    organizationId: context.organizationId,
    transformationCaseId: context.transformationCaseId,
    actorUserId: context.actorUserId,
    agentId: context.agentId,
    toolName: input.toolName,
    projectId: context.projectId,
    idempotencyKey: `materialize:${input.proposal.proposal_id}:plan-v${input.proposal.plan_version}`,
    payload: {
      transformationCaseId: input.current.transformation_case_id,
      proposalId: input.proposal.proposal_id,
      governedProposalVersionId: input.proposal.governed_proposal_version_id,
      planId: input.proposal.plan_id,
      planVersion: input.proposal.plan_version,
      payloadDigest: input.proposal.payload_digest,
    },
    adapter: {
      key: input.toolName,
      compensationPolicy: 'manual_repair',
      execute: input.execute,
      readback: input.readback,
    },
  });
}

export class TransformationCaseOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string
  ) {
    super(message);
    this.name = 'TransformationCaseOperationError';
  }
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const T01_PLAN_BLUEPRINT: Array<Omit<TransformationPlanStep, 'stepId' | 'stepIndex'>> = [
  {
    lifecycleStage: 'mandate',
    businessPurpose: 'Confirm transformation mandate, scope, authority and success definition.',
    moduleTarget: 'Chat / Agent',
    capabilityStatus: 'PARTIAL',
    inputs: ['Teresa mandate', 'organization context', 'project context'],
    outputs: ['Transformation Case', 'approved mandate'],
    ownerRole: 'Transformation Sponsor',
    dependsOn: [],
    approvalClass: 'requires_human_approval',
    riskClass: 'safe_additive',
    executionMode: 'foreground',
    estimatedEffort: '30-60 min',
    status: 'proposed',
    blockerReason: 'T01-I01 adds the durable case; mandate approval follows in T01-I02.',
  },
  {
    lifecycleStage: 'discovery',
    businessPurpose: 'Inventory permitted sources and identify evidence gaps.',
    moduleTarget: 'Vault / Knowledge / Ideas',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['approved mandate', 'source references'],
    outputs: ['source inventory', 'evidence-gap register'],
    ownerRole: 'Lead Consultant',
    dependsOn: ['mandate'],
    approvalClass: 'policy_approvable',
    riskClass: 'read_only',
    executionMode: 'background',
    estimatedEffort: '2-8 h',
    status: 'proposed',
    blockerReason: 'Transformation source-inventory adapter is not connected.',
  },
  {
    lifecycleStage: 'initial_ideas',
    businessPurpose: 'Create an initial, source-linked opportunity inventory.',
    moduleTarget: 'Ideas',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['source inventory'],
    outputs: ['draft Ideas', 'idea relationships'],
    ownerRole: 'Lead Consultant',
    dependsOn: ['discovery'],
    approvalClass: 'requires_human_approval',
    riskClass: 'safe_additive',
    executionMode: 'background',
    estimatedEffort: '2-4 h',
    status: 'proposed',
    blockerReason: 'Agent-to-Ideas adapter is not connected.',
  },
  {
    lifecycleStage: 'interviews',
    businessPurpose: 'Gather and verify stakeholder knowledge through real interviews.',
    moduleTarget: 'Interview',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['stakeholder map', 'evidence gaps'],
    outputs: ['assignments', 'answers', 'reviewed insights'],
    ownerRole: 'Lead Consultant',
    dependsOn: ['discovery'],
    approvalClass: 'requires_human_approval',
    riskClass: 'sensitive_update',
    executionMode: 'human_activity',
    estimatedEffort: '3-15 days',
    status: 'proposed',
    blockerReason: 'Agent interview orchestration adapter is not connected.',
  },
  {
    lifecycleStage: 'drd',
    businessPurpose: 'Run evidence-backed DRD diagnosis and identify maturity gaps.',
    moduleTarget: 'Assessment / DRD',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['documents', 'interview insights', 'DRD evidence'],
    outputs: ['accepted DRD scores', 'gaps', 'diagnostic findings'],
    ownerRole: 'Assessment Lead',
    dependsOn: ['interviews'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'human_activity',
    estimatedEffort: '3-10 days',
    status: 'proposed',
    blockerReason: 'DRD module exists but is not connected to transformation execution.',
  },
  {
    lifecycleStage: 'opportunity_synthesis',
    businessPurpose: 'Synthesize all sources into a reviewed opportunity system.',
    moduleTarget: 'Ideas / Tools',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['Ideas', 'interview insights', 'DRD gaps', 'tool and audit findings'],
    outputs: ['clustered portfolio', 'alternatives', 'shortlist'],
    ownerRole: 'Lead Consultant',
    dependsOn: ['initial_ideas', 'interviews', 'drd'],
    approvalClass: 'requires_human_approval',
    riskClass: 'safe_update',
    executionMode: 'background',
    estimatedEffort: '4-12 h',
    status: 'proposed',
    blockerReason: 'Cross-source lineage and professional review workbench are missing.',
  },
  {
    lifecycleStage: 'initiative_candidates',
    businessPurpose: 'Prepare governed Initiative Candidates from selected opportunities.',
    moduleTarget: 'Initiatives',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['shortlist', 'accepted DRD output', 'reviewed insights'],
    outputs: ['Initiative Candidate proposals', 'Decision Briefs'],
    ownerRole: 'Initiative Owner',
    dependsOn: ['opportunity_synthesis'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'background',
    estimatedEffort: '4-12 h',
    status: 'proposed',
    blockerReason: 'No shared transformation-to-Initiative adapter is connected.',
  },
  {
    lifecycleStage: 'finance_kpi',
    businessPurpose: 'Build deterministic financial cases and measurable KPI contracts.',
    moduleTarget: 'Finance / Results',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['accepted Initiatives', 'cost and benefit assumptions', 'KPI sources'],
    outputs: ['Finance models', 'KPI cards', 'sensitivity analysis'],
    ownerRole: 'Finance Reviewer / Benefit Owner',
    dependsOn: ['initiative_candidates'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'human_activity',
    estimatedEffort: '1-5 days',
    status: 'proposed',
    blockerReason: 'Finance and KPI runtimes exist but lack transformation adapters.',
  },
  {
    lifecycleStage: 'portfolio_decision',
    businessPurpose: 'Select, sequence and approve the transformation Initiative portfolio.',
    moduleTarget: 'Initiatives / Decisions',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['Initiative Candidates', 'portfolio constraints'],
    outputs: ['approved Initiatives', 'roadmap', 'decision records'],
    ownerRole: 'Portfolio Decision Owner',
    dependsOn: ['finance_kpi'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'human_activity',
    estimatedEffort: '1-3 days',
    status: 'proposed',
    blockerReason: 'Business decisions cannot execute until the governance adapter is connected.',
  },
  {
    lifecycleStage: 'mobilization',
    businessPurpose: 'Create execution baseline, owners, tasks, milestones, RAID and cadence.',
    moduleTarget: 'Execution / My Work',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['approved Initiatives', 'capacity and schedule constraints'],
    outputs: ['Execution Cases', 'Tasks', 'milestones', 'RAID'],
    ownerRole: 'Execution Manager',
    dependsOn: ['portfolio_decision'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'background',
    estimatedEffort: '1-5 days',
    status: 'proposed',
    blockerReason: 'Initiative-to-Execution transformation handoff is not connected.',
  },
  {
    lifecycleStage: 'execution',
    businessPurpose: 'Manage delivery and propose controlled interventions.',
    moduleTarget: 'Execution / My Work',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['execution baseline', 'actual work events'],
    outputs: ['progress', 'exceptions', 'intervention proposals'],
    ownerRole: 'Execution Manager',
    dependsOn: ['mobilization'],
    approvalClass: 'policy_approvable',
    riskClass: 'safe_update',
    executionMode: 'scheduled',
    estimatedEffort: 'transformation horizon',
    status: 'proposed',
    blockerReason: 'No Transformation Case event subscription exists.',
  },
  {
    lifecycleStage: 'delivery',
    businessPurpose: 'Verify delivery acceptance and hand off to benefit owners.',
    moduleTarget: 'Execution / Results',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['deliverables', 'acceptance evidence'],
    outputs: ['delivery acceptance', 'benefits handoff'],
    ownerRole: 'Execution Manager / Benefit Owner',
    dependsOn: ['execution'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'human_activity',
    estimatedEffort: '1-3 days',
    status: 'proposed',
    blockerReason: 'Delivery-to-benefits transformation gate is not connected.',
  },
  {
    lifecycleStage: 'benefits',
    businessPurpose: 'Measure KPI and Finance actuals and determine effectiveness.',
    moduleTarget: 'Results / Finance',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['KPI actuals', 'Finance actuals', 'benefit window'],
    outputs: ['effectiveness review', 'corrective proposals'],
    ownerRole: 'Benefit Owner',
    dependsOn: ['delivery'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'scheduled',
    estimatedEffort: 'benefit window',
    status: 'proposed',
    blockerReason: 'Benefits services exist but are not linked to Transformation Case.',
  },
  {
    lifecycleStage: 'sustainability',
    businessPurpose: 'Confirm that outcomes persist and capture governed learning.',
    moduleTarget: 'Results / Knowledge',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['effectiveness review', 'adoption and sustainability evidence'],
    outputs: ['sustainability review', 'closure decision', 'lessons learned'],
    ownerRole: 'Transformation Sponsor',
    dependsOn: ['benefits'],
    approvalClass: 'requires_human_approval',
    riskClass: 'governance_transition',
    executionMode: 'scheduled',
    estimatedEffort: '30-180 days after benefits',
    status: 'proposed',
    blockerReason: 'Sustainability lifecycle and learning promotion are not connected.',
  },
  {
    lifecycleStage: 'final_outputs',
    businessPurpose: 'Produce consistent, editable Word and PowerPoint deliverables.',
    moduleTarget: 'Reports / Document Studio / Presentations',
    capabilityStatus: 'NOT_CONNECTED',
    inputs: ['approved transformation snapshot'],
    outputs: ['canonical report', 'DOCX', 'PPTX', 'final Teresa readout'],
    ownerRole: 'Lead Consultant',
    dependsOn: ['benefits', 'sustainability'],
    approvalClass: 'requires_human_approval',
    riskClass: 'safe_additive',
    executionMode: 'background',
    estimatedEffort: '2-8 h',
    status: 'proposed',
    blockerReason: 'Output runtimes exist but T01 snapshot adapters are not connected.',
  },
];

export function compileT01TransformationPlan(): TransformationPlanStep[] {
  return T01_PLAN_BLUEPRINT.map((step, stepIndex) => ({
    ...step,
    stepId: uuidv4(),
    stepIndex,
  }));
}

export function validateAndCompileTransformationPlan(
  drafts: NonNullable<ReviseTransformationCaseParams['steps']>
): TransformationPlanStep[] {
  const stages = drafts.map((step) => step.lifecycleStage);
  if (new Set(stages).size !== stages.length) {
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_PLAN_DUPLICATE_STAGE',
      400,
      'Every lifecycle stage must be unique in an executable plan'
    );
  }
  const stageSet = new Set(stages);
  for (const step of drafts) {
    const unknown = step.dependsOn.filter((dependency) => !stageSet.has(dependency));
    if (unknown.length > 0) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_UNKNOWN_DEPENDENCY',
        400,
        `Unknown dependencies for ${step.lifecycleStage}: ${unknown.join(', ')}`
      );
    }
    if (step.dependsOn.includes(step.lifecycleStage)) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_CYCLE',
        400,
        `Stage ${step.lifecycleStage} cannot depend on itself`
      );
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dependencies = new Map(drafts.map((step) => [step.lifecycleStage, step.dependsOn]));
  const visit = (stage: string): void => {
    if (visiting.has(stage)) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_CYCLE',
        400,
        `Dependency cycle detected at ${stage}`
      );
    }
    if (visited.has(stage)) return;
    visiting.add(stage);
    for (const dependency of dependencies.get(stage) ?? []) visit(dependency);
    visiting.delete(stage);
    visited.add(stage);
  };
  for (const stage of stages) visit(stage);
  return drafts.map((step, stepIndex) => ({
    ...step,
    stepId: uuidv4(),
    stepIndex,
    status: 'proposed',
    blockerReason: step.blockerReason ?? null,
  }));
}

export function enforceAuthoritativeStepTruth(
  drafts: NonNullable<ReviseTransformationCaseParams['steps']>,
  currentSteps: TransformationPlanStep[]
): void {
  const currentById = new Map(currentSteps.map((step) => [step.stepId, step]));
  const currentByStage = new Map(currentSteps.map((step) => [step.lifecycleStage, step]));
  const retainedIds = new Set(drafts.map((step) => step.sourceStepId).filter(Boolean));
  if (retainedIds.size !== drafts.filter((step) => step.sourceStepId).length) {
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_PLAN_DUPLICATE_SOURCE_STEP',
      409,
      'Every source step may appear only once'
    );
  }
  for (const draft of drafts) {
    const current = draft.sourceStepId ? currentById.get(draft.sourceStepId) : undefined;
    if (draft.sourceStepId && !current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_SOURCE_STEP_NOT_FOUND',
        409,
        'Source step is not part of the active plan'
      );
    }
    if (current) {
      if (
        draft.lifecycleStage !== current.lifecycleStage ||
        draft.capabilityStatus !== current.capabilityStatus ||
        draft.blockerReason !== current.blockerReason
      ) {
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_PLAN_CAPABILITY_TRUTH_FORBIDDEN',
          409,
          `Capability truth for ${draft.lifecycleStage} is server-owned`
        );
      }
      continue;
    }
    if (currentByStage.has(draft.lifecycleStage)) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_SOURCE_STEP_REQUIRED',
        409,
        'Existing lifecycle stages require their source step identity'
      );
    }
    if (!draft.lifecycleStage.startsWith('custom_')) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_LIFECYCLE_IDENTITY_FORBIDDEN',
        409,
        'New plan steps must use a custom_ lifecycle identity'
      );
    }
    if (draft.capabilityStatus !== 'PROPOSAL_ONLY' || !draft.blockerReason?.trim()) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_CUSTOM_CAPABILITY_INVALID',
        409,
        'New custom steps must remain PROPOSAL_ONLY with a blocker reason'
      );
    }
  }
  const retainedStages = new Set(drafts.map((step) => step.lifecycleStage));
  for (const removed of currentSteps.filter((step) => !retainedIds.has(step.stepId))) {
    const dependents = currentSteps
      .filter(
        (step) =>
          retainedStages.has(step.lifecycleStage) && step.dependsOn.includes(removed.lifecycleStage)
      )
      .map((step) => step.lifecycleStage);
    if (dependents.length > 0) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_REFERENCED_STEP_REMOVAL',
        409,
        `Cannot remove ${removed.lifecycleStage}; referenced by ${dependents.join(', ')}`
      );
    }
  }
}

function rowToStep(row: StepRow): TransformationPlanStep {
  return {
    stepId: row.step_id,
    stepIndex: row.step_index,
    lifecycleStage: row.lifecycle_stage,
    businessPurpose: row.business_purpose,
    moduleTarget: row.module_target,
    capabilityStatus: row.capability_status,
    inputs: jsonValue(row.inputs_json, []),
    outputs: jsonValue(row.outputs_json, []),
    ownerRole: row.owner_role,
    dependsOn: jsonValue(row.depends_on_json, []),
    approvalClass: row.approval_class,
    riskClass: row.risk_class,
    executionMode: row.execution_mode,
    estimatedEffort: row.estimated_effort,
    status: row.status,
    blockerReason: row.blocker_reason,
  };
}

async function loadPlan(
  planId: string,
  organizationId: string
): Promise<TransformationPlan | null> {
  const row = await queryOne<PlanRow>(
    `SELECT * FROM transformation_plans WHERE plan_id = ? AND organization_id = ?`,
    [planId, organizationId]
  );
  if (!row) return null;
  const steps = await queryAll<StepRow>(
    `SELECT * FROM transformation_plan_steps
     WHERE plan_id = ? AND organization_id = ? ORDER BY step_index`,
    [planId, organizationId]
  );
  return {
    planId: row.plan_id,
    transformationCaseId: row.transformation_case_id,
    organizationId: row.organization_id,
    version: row.version,
    status: row.status as TransformationPlan['status'],
    methodologyKey: row.methodology_key,
    summary: row.summary,
    assumptions: jsonValue(row.assumptions_json, []),
    risks: jsonValue(row.risks_json, []),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: steps.map(rowToStep),
  };
}

async function rowToCase(row: CaseRow, replay = false): Promise<TransformationCase> {
  return {
    transformationCaseId: row.transformation_case_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    contextSnapshotId: row.context_snapshot_id,
    executionRunId: row.execution_run_id,
    initiatedByUserId: row.initiated_by_user_id,
    mandate: row.mandate,
    desiredOutcomes: jsonValue(row.desired_outcomes_json, []),
    status: row.status as TransformationCase['status'],
    lifecycleStage: row.lifecycle_stage as TransformationCase['lifecycleStage'],
    autonomyLevel: 'A1_prepare',
    sourceRefs: jsonValue(row.source_refs_json, []),
    assumptions: jsonValue(row.assumptions_json, []),
    missingInputs: jsonValue(row.missing_inputs_json, []),
    activePlanId: row.active_plan_id,
    lineageId: row.lineage_id,
    idempotencyKey: row.idempotency_key,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
    activePlan: row.active_plan_id ? await loadPlan(row.active_plan_id, row.organization_id) : null,
    idempotentReplay: replay,
  };
}

async function recordIdempotentReplay(
  row: CaseRow,
  actorUserId: string,
  correlationId?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        transformationCaseId: row.transformation_case_id,
        idempotencyKey: row.idempotency_key,
        correlationId: correlationId ?? null,
      })
    )
    .digest('hex');
  await withPgTransaction(async (client) => {
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, 1, 'transformation_case.idempotent_replay', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        row.transformation_case_id,
        row.organization_id,
        row.active_plan_id,
        actorUserId,
        correlationId ?? null,
        digest,
        JSON.stringify({ duplicateBusinessEventsCreated: false }),
        now,
      ]
    );
  });
}

export async function createTransformationCase(
  params: CreateTransformationCaseParams
): Promise<TransformationCase> {
  const body = CreateTransformationCaseSchema.parse(params);
  const existing = await queryOne<CaseRow>(
    `SELECT * FROM transformation_cases WHERE organization_id = ? AND idempotency_key = ?`,
    [params.organizationId, body.idempotencyKey]
  );
  if (existing) {
    await recordIdempotentReplay(existing, params.initiatedByUserId, params.correlationId);
    return rowToCase(existing, true);
  }

  const transformationCaseId = uuidv4();
  const planId = uuidv4();
  const contextSnapshotId = uuidv4();
  const executionRunId = uuidv4();
  const lineageId = uuidv4();
  const steps = compileT01TransformationPlan();
  const now = new Date().toISOString();
  const summary = `Kompletny plan transformacji: ${body.mandate}`;
  const risks = [
    'Downstream adapters remain blocked until separately accepted increments connect them.',
    'Business gates require authorized human decisions.',
  ];
  const digest = createHash('sha256')
    .update(
      JSON.stringify({ mandate: body.mandate, desiredOutcomes: body.desiredOutcomes, planId })
    )
    .digest('hex');

  try {
    await withPgTransaction(async (client) => {
      const raced = await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE organization_id = ? AND idempotency_key = ? FOR UPDATE`,
        [params.organizationId, body.idempotencyKey]
      );
      if (raced.rows[0]) return;

      await client.query(
        `INSERT INTO transformation_cases (
        transformation_case_id, organization_id, project_id, conversation_id,
        context_snapshot_id, execution_run_id,
        initiated_by_user_id, mandate, desired_outcomes_json, status, lifecycle_stage,
        autonomy_level, source_refs_json, assumptions_json, missing_inputs_json,
        active_plan_id, lineage_id, idempotency_key, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'plan_proposed', 'mandate', 'A1_prepare',
        ?::jsonb, ?::jsonb, ?::jsonb, NULL, ?, ?, 1, ?, ?)`,
        [
          transformationCaseId,
          params.organizationId,
          body.projectId ?? null,
          body.conversationId ?? null,
          contextSnapshotId,
          executionRunId,
          params.initiatedByUserId,
          body.mandate,
          JSON.stringify(body.desiredOutcomes),
          JSON.stringify(body.sourceRefs),
          JSON.stringify(body.assumptions),
          JSON.stringify(body.missingInputs),
          lineageId,
          body.idempotencyKey,
          now,
          now,
        ]
      );
      await client.query(
        `INSERT INTO v8_context_snapshots (
        snapshot_id, parent_snapshot_id, snapshot_version, captured_at, workspace_id,
        organization_id, project_id, conversation_id, execution_run_id, artifact_refs,
        effective_scope_ref, resolved_role_ref, initiator_user_id, consumer_class,
        privacy_mode, source_context_refs, drift_events
      ) VALUES (?, NULL, 1, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, 'execution', 0, ?::jsonb, '[]'::jsonb)`,
        [
          contextSnapshotId,
          now,
          params.organizationId,
          params.organizationId,
          body.projectId ?? null,
          body.conversationId ?? null,
          executionRunId,
          JSON.stringify(body.sourceRefs),
          `transformation-case:${transformationCaseId}`,
          'transformation_agent',
          params.initiatedByUserId,
          JSON.stringify(body.sourceRefs),
        ]
      );
      await client.query(
        `INSERT INTO v8_execution_runs (
        run_id, organization_id, context_snapshot_id, initiator_user_id, state,
        plan_version, goal, created_at, updated_at, resolved_at, expires_at, metadata
      ) VALUES (?, ?, ?, ?, 'drafting', 1, ?, ?, ?, NULL, NULL, ?::jsonb)`,
        [
          executionRunId,
          params.organizationId,
          contextSnapshotId,
          params.initiatedByUserId,
          body.mandate,
          now,
          now,
          JSON.stringify({ transformationCaseId, lineageId, capabilityTruth: true }),
        ]
      );
      await client.query(
        `INSERT INTO v8_agent_run_identities
          (canonical_run_id, organization_id, transformation_case_id, conversation_id, lineage_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          executionRunId,
          params.organizationId,
          transformationCaseId,
          body.conversationId ?? null,
          lineageId,
        ]
      );
      await client.query(
        `INSERT INTO v8_run_state_transitions (
        transition_id, run_id, from_state, to_state, triggered_by, reason, transitioned_at
      ) VALUES (?, ?, 'drafting', 'drafting', ?, 'Transformation Case run created', ?)`,
        [uuidv4(), executionRunId, params.initiatedByUserId, now]
      );
      await client.query(
        `INSERT INTO transformation_plans (
        plan_id, transformation_case_id, organization_id, version, status,
        methodology_key, summary, assumptions_json, risks_json, created_by_user_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, 1, 'pending_review', 'consultify-transformation-v1', ?, ?::jsonb,
        ?::jsonb, ?, ?, ?)`,
        [
          planId,
          transformationCaseId,
          params.organizationId,
          summary,
          JSON.stringify(body.assumptions),
          JSON.stringify(risks),
          params.initiatedByUserId,
          now,
          now,
        ]
      );
      for (const step of steps) {
        await client.query(
          `INSERT INTO transformation_plan_steps (
          step_id, plan_id, transformation_case_id, organization_id, step_index,
          lifecycle_stage, business_purpose, module_target, capability_status,
          inputs_json, outputs_json, owner_role, depends_on_json, approval_class,
          risk_class, execution_mode, estimated_effort, status, blocker_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, ?, ?, ?, ?,
          'proposed', ?, ?)`,
          [
            step.stepId,
            planId,
            transformationCaseId,
            params.organizationId,
            step.stepIndex,
            step.lifecycleStage,
            step.businessPurpose,
            step.moduleTarget,
            step.capabilityStatus,
            JSON.stringify(step.inputs),
            JSON.stringify(step.outputs),
            step.ownerRole,
            JSON.stringify(step.dependsOn),
            step.approvalClass,
            step.riskClass,
            step.executionMode,
            step.estimatedEffort,
            step.blockerReason,
            now,
          ]
        );
      }
      const persistedPlan = await client.query<{ step_count: number }>(
        `SELECT COUNT(*)::int step_count FROM transformation_plan_steps
          WHERE plan_id=? AND transformation_case_id=? AND organization_id=?`,
        [planId, transformationCaseId, params.organizationId]
      );
      if (Number(persistedPlan.rows[0]?.step_count) !== steps.length) {
        throw new Error('transformation_plan_steps_persistence_failed');
      }
      await client.query(
        `UPDATE transformation_cases SET active_plan_id = ? WHERE transformation_case_id = ?`,
        [planId, transformationCaseId]
      );
      for (const eventType of [
        'transformation_case.created',
        'transformation_case.execution_bound',
        'transformation_plan.drafted',
        'transformation_plan.proposed',
      ]) {
        await client.query(
          `INSERT INTO transformation_case_audit_events (
          audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
          event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?::jsonb, ?)`,
          [
            uuidv4(),
            transformationCaseId,
            params.organizationId,
            planId,
            eventType,
            params.initiatedByUserId,
            params.correlationId ?? null,
            digest,
            JSON.stringify({ mandate: body.mandate, capabilityTruth: true }),
            now,
          ]
        );
      }
    });
  } catch (error) {
    const pgCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    if (pgCode !== '23505') throw error;

    const replay = await queryOne<CaseRow>(
      `SELECT * FROM transformation_cases WHERE organization_id = ? AND idempotency_key = ?`,
      [params.organizationId, body.idempotencyKey]
    );
    if (replay) {
      await recordIdempotentReplay(replay, params.initiatedByUserId, params.correlationId);
      return rowToCase(replay, true);
    }
    throw error;
  }

  const persisted = await getTransformationCase(transformationCaseId, params.organizationId);
  if (!persisted) {
    const replay = await queryOne<CaseRow>(
      `SELECT * FROM transformation_cases WHERE organization_id = ? AND idempotency_key = ?`,
      [params.organizationId, body.idempotencyKey]
    );
    if (replay) {
      await recordIdempotentReplay(replay, params.initiatedByUserId, params.correlationId);
      return rowToCase(replay, true);
    }
    throw new Error('Transformation Case transaction committed without readable case');
  }
  return persisted;
}

export async function getTransformationCase(
  transformationCaseId: string,
  organizationId: string
): Promise<TransformationCase | null> {
  const row = await queryOne<CaseRow>(
    `SELECT * FROM transformation_cases
     WHERE transformation_case_id = ? AND organization_id = ?`,
    [transformationCaseId, organizationId]
  );
  return row ? rowToCase(row) : null;
}

export async function bindTransformationCaseProject(params: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  projectId: string;
}): Promise<TransformationCase> {
  const projectId = params.projectId.trim();
  if (!projectId) {
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_CASE_PROJECT_REQUIRED',
      400,
      'Project ID is required'
    );
  }

  await withPgTransaction(async (client) => {
    const result = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = result.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.project_id && current.project_id !== projectId) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_PROJECT_ALREADY_BOUND',
        409,
        'Transformation Case is already bound to another project'
      );
    }
    if (current.project_id === projectId) return;

    const project = await client.query<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ? FOR SHARE`,
      [projectId, params.organizationId]
    );
    if (!project.rows[0]) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_PROJECT_NOT_FOUND',
        404,
        'Project not found'
      );
    }

    await client.query(
      `UPDATE transformation_cases SET project_id = ?, updated_at = NOW()
       WHERE transformation_case_id = ? AND organization_id = ?`,
      [projectId, params.transformationCaseId, params.organizationId]
    );
    await client.query(
      `UPDATE v8_context_snapshots SET project_id = ?
       WHERE snapshot_id = ? AND organization_id = ?`,
      [projectId, current.context_snapshot_id, params.organizationId]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (
         audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
         event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
       ) VALUES (?, ?, ?, ?, ?, 'transformation_case.project_bound', ?, NULL, ?, ?::jsonb, NOW())`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        createHash('sha256').update(JSON.stringify({ projectId })).digest('hex'),
        JSON.stringify({ projectId, contextSnapshotId: current.context_snapshot_id }),
      ]
    );
  });

  const bound = await getTransformationCase(params.transformationCaseId, params.organizationId);
  if (!bound) throw new Error('Bound Transformation Case is not readable');
  return bound;
}

export async function listTransformationCases(
  organizationId: string,
  options: {
    projectId?: string | null;
    limit?: number;
    userId: string;
    privileged?: boolean;
  }
): Promise<TransformationCase[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
  const accessSql = options.privileged
    ? ''
    : `AND (
         tc.initiated_by_user_id = ?
         OR (
           tc.project_id IS NOT NULL AND EXISTS (
             SELECT 1
               FROM projects p
              WHERE p.id = tc.project_id
                AND p.organization_id = tc.organization_id
                AND (
                  p.owner_id = ?
                  OR EXISTS (
                    SELECT 1 FROM project_members pm
                     WHERE pm.project_id = p.id AND pm.user_id = ?
                  )
                )
           )
         )
       )`;
  const accessParams = options.privileged ? [] : [options.userId, options.userId, options.userId];
  const rows = options.projectId
    ? await queryAll<CaseRow>(
        `SELECT tc.* FROM transformation_cases tc
         WHERE tc.organization_id = ? AND tc.project_id = ? ${accessSql}
         ORDER BY tc.updated_at DESC LIMIT ?`,
        [organizationId, options.projectId, ...accessParams, safeLimit]
      )
    : await queryAll<CaseRow>(
        `SELECT tc.* FROM transformation_cases tc
         WHERE tc.organization_id = ? ${accessSql}
         ORDER BY tc.updated_at DESC LIMIT ?`,
        [organizationId, ...accessParams, safeLimit]
      );
  return Promise.all(rows.map((row) => rowToCase(row)));
}

export async function getTransformationCaseAudit(
  transformationCaseId: string,
  organizationId: string
): Promise<Array<Record<string, unknown>>> {
  return queryAll(
    `SELECT audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
            event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
     FROM transformation_case_audit_events
     WHERE transformation_case_id = ? AND organization_id = ? ORDER BY created_at`,
    [transformationCaseId, organizationId]
  );
}

export async function reviseTransformationCase(
  params: ReviseTransformationCaseParams
): Promise<TransformationCase> {
  const input = ReviseTransformationCaseSchema.parse(params);
  if (!params.organizationId.trim() || !params.actorUserId.trim()) {
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_CASE_ACTOR_REQUIRED',
      403,
      'Authenticated tenant and actor are required'
    );
  }
  const planId = uuidv4();
  const now = new Date().toISOString();

  await withPgTransaction(async (client) => {
    const currentResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.status === 'cancelled') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_CANCELLED',
        409,
        'Cancelled Transformation Case cannot be revised'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    const currentStepRows = current.active_plan_id
      ? (
          await client.query<StepRow>(
            `SELECT * FROM transformation_plan_steps
             WHERE plan_id=? AND transformation_case_id=? AND organization_id=?
             ORDER BY step_index FOR UPDATE`,
            [current.active_plan_id, current.transformation_case_id, current.organization_id]
          )
        ).rows
      : [];
    const currentSteps = currentStepRows.map(rowToStep);
    if (input.steps) enforceAuthoritativeStepTruth(input.steps, currentSteps);
    const steps = input.steps
      ? validateAndCompileTransformationPlan(input.steps)
      : compileT01TransformationPlan();

    const nextVersion = current.version + 1;
    const nextMandate = input.mandate ?? current.mandate;
    const nextOutcomes =
      input.desiredOutcomes ?? jsonValue<string[]>(current.desired_outcomes_json, []);
    const nextAssumptions = input.assumptions ?? jsonValue<string[]>(current.assumptions_json, []);
    const nextMissingInputs =
      input.missingInputs ?? jsonValue<string[]>(current.missing_inputs_json, []);
    const risks = [
      'Downstream adapters remain blocked until separately accepted increments connect them.',
      'Business gates require authorized human decisions.',
    ];

    await client.query(
      `INSERT INTO transformation_plans (
        plan_id, transformation_case_id, organization_id, version, status,
        methodology_key, summary, assumptions_json, risks_json, created_by_user_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending_review', 'consultify-transformation-v1', ?, ?::jsonb,
        ?::jsonb, ?, ?, ?)`,
      [
        planId,
        current.transformation_case_id,
        current.organization_id,
        nextVersion,
        `Kompletny plan transformacji: ${nextMandate}`,
        JSON.stringify(nextAssumptions),
        JSON.stringify(risks),
        params.actorUserId,
        now,
        now,
      ]
    );
    for (const step of steps) {
      await client.query(
        `INSERT INTO transformation_plan_steps (
          step_id, plan_id, transformation_case_id, organization_id, step_index,
          lifecycle_stage, business_purpose, module_target, capability_status,
          inputs_json, outputs_json, owner_role, depends_on_json, approval_class,
          risk_class, execution_mode, estimated_effort, status, blocker_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?::jsonb, ?, ?, ?, ?,
          'proposed', ?, ?)`,
        [
          step.stepId,
          planId,
          current.transformation_case_id,
          current.organization_id,
          step.stepIndex,
          step.lifecycleStage,
          step.businessPurpose,
          step.moduleTarget,
          step.capabilityStatus,
          JSON.stringify(step.inputs),
          JSON.stringify(step.outputs),
          step.ownerRole,
          JSON.stringify(step.dependsOn),
          step.approvalClass,
          step.riskClass,
          step.executionMode,
          step.estimatedEffort,
          step.blockerReason,
          now,
        ]
      );
    }
    const updated = await client.query(
      `UPDATE transformation_cases
          SET mandate = ?, desired_outcomes_json = ?::jsonb, assumptions_json = ?::jsonb,
              missing_inputs_json = ?::jsonb, active_plan_id = ?, version = ?, updated_at = ?
        WHERE transformation_case_id = ? AND organization_id = ? AND version = ?`,
      [
        nextMandate,
        JSON.stringify(nextOutcomes),
        JSON.stringify(nextAssumptions),
        JSON.stringify(nextMissingInputs),
        planId,
        nextVersion,
        now,
        current.transformation_case_id,
        current.organization_id,
        input.expectedVersion,
      ]
    );
    if (updated.rowCount !== 1) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        'Transformation Case changed during revision'
      );
    }
    await client.query(
      `UPDATE v8_execution_runs SET plan_version = ?, updated_at = ?
       WHERE run_id = ? AND organization_id = ?`,
      [nextVersion, now, current.execution_run_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(JSON.stringify({ nextMandate, nextOutcomes, nextVersion }))
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_plan.revised', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        planId,
        nextVersion,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          previousPlanId: current.active_plan_id,
          expectedVersion: input.expectedVersion,
        }),
        now,
      ]
    );
  });

  const revised = await getTransformationCase(params.transformationCaseId, params.organizationId);
  if (!revised) throw new Error('Revised Transformation Case not readable after commit');
  return revised;
}

export async function cancelTransformationCase(
  params: CancelTransformationCaseParams
): Promise<TransformationCase> {
  const input = CancelTransformationCaseSchema.parse(params);
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const result = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = result.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    if (current.status === 'cancelled') return;
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases
          SET status = 'cancelled', version = ?, updated_at = ?, cancelled_at = ?
        WHERE transformation_case_id = ? AND organization_id = ?`,
      [nextVersion, now, now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `UPDATE transformation_plans SET status = 'cancelled', updated_at = ?
       WHERE plan_id = ? AND organization_id = ?`,
      [now, current.active_plan_id, current.organization_id]
    );
    await client.query(
      `UPDATE v8_execution_runs
          SET state = 'cancelled', updated_at = ?, resolved_at = ?
        WHERE run_id = ? AND organization_id = ? AND state = 'drafting'`,
      [now, now, current.execution_run_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO v8_run_state_transitions (
        transition_id, run_id, from_state, to_state, triggered_by, reason, transitioned_at
      ) VALUES (?, ?, 'drafting', 'cancelled', ?, ?, ?)`,
      [uuidv4(), current.execution_run_id, params.actorUserId, input.reason, now]
    );
    const digest = createHash('sha256').update(input.reason).digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_case.cancelled', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ reason: input.reason, priorStatus: current.status }),
        now,
      ]
    );
  });
  const cancelled = await getTransformationCase(params.transformationCaseId, params.organizationId);
  if (!cancelled) throw new Error('Cancelled Transformation Case not readable after commit');
  return cancelled;
}

function buildInitialIdeaCandidates(row: CaseRow, maxIdeas: number): InitialIdeaCandidate[] {
  const outcomes = jsonValue<string[]>(row.desired_outcomes_json, [])
    .map((value) => value.trim())
    .filter(Boolean);
  const seeds = [
    ...outcomes.map((outcome) => ({
      title: `Transformacja wyniku: ${outcome}`,
      outcome,
      hypothesis: `Ukierunkowany strumień zmian może mierzalnie poprawić wynik „${outcome}”.`,
    })),
    {
      title: 'Uproszczenie modelu operacyjnego i kluczowych procesów',
      outcome: null,
      hypothesis: 'Redukcja zbędnych przekazań i standaryzacja pracy skrócą czas realizacji.',
    },
    {
      title: 'Cyfrowy przepływ pracy i spójna warstwa danych',
      outcome: null,
      hypothesis: 'Wspólny przepływ danych ograniczy ręczne operacje i zwiększy jakość decyzji.',
    },
    {
      title: 'Wsparcie decyzji i pracy wiedzy przez AI',
      outcome: null,
      hypothesis: 'Kontrolowane zastosowanie AI zwiększy produktywność bez utraty governance.',
    },
  ];
  const unique = seeds.filter(
    (seed, index, all) => all.findIndex((candidate) => candidate.title === seed.title) === index
  );
  return unique.slice(0, Math.max(3, maxIdeas)).map((seed) => ({
    candidateId: uuidv4(),
    title: seed.title,
    body: `${seed.hypothesis}\n\nMandat źródłowy: ${row.mandate}\n\nStatus: hipoteza do weryfikacji w Interview i DRD.`,
    tags: ['transformation', 'agent-proposed', 'hypothesis'],
    hypothesis: seed.hypothesis,
    evidenceNeeded: [
      'Potwierdzenie właściciela biznesowego',
      'Dowód z wywiadu lub dokumentu',
      'Baseline KPI i ocena wykonalności',
    ],
    sourceOutcome: seed.outcome,
  }));
}

function rowToInitialIdeasProposal(
  row: StageProposalRow,
  artifactIds: string[] = []
): InitialIdeasProposal {
  const payload = jsonValue<{ candidates?: InitialIdeaCandidate[] }>(row.payload_json, {});
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    planVersion: row.plan_version,
    lifecycleStage: 'initial_ideas',
    proposalType: 'create_initial_ideas',
    status: row.status,
    candidates: payload.candidates ?? [],
    payloadDigest: row.payload_digest,
    proposedByUserId: row.proposed_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewReason: row.review_reason,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    artifactIds,
  };
}

function rowToInterviewsProposal(
  row: StageProposalRow,
  artifactIds: string[] = []
): InterviewsProposal {
  const payload = jsonValue<{ candidates?: InterviewProposalCandidate[] }>(row.payload_json, {});
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    planVersion: row.plan_version,
    lifecycleStage: 'interviews',
    proposalType: 'create_interview_assignments',
    status: row.status,
    candidates: payload.candidates ?? [],
    payloadDigest: row.payload_digest,
    proposedByUserId: row.proposed_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewReason: row.review_reason,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    artifactIds,
  };
}

export async function approveTransformationPlan(
  params: ApproveTransformationPlanParams
): Promise<TransformationCase> {
  const input = ApproveTransformationPlanSchema.parse(params);
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const result = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = result.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    if (current.status !== 'plan_proposed') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_NOT_REVIEWABLE',
        409,
        `Plan cannot be approved from status ${current.status}`
      );
    }
    const planReadback = await client.query<{ status: string; step_count: number }>(
      `SELECT p.status,(SELECT COUNT(*)::int FROM transformation_plan_steps s
         WHERE s.plan_id=p.plan_id AND s.organization_id=p.organization_id) step_count
         FROM transformation_plans p
        WHERE p.plan_id=? AND p.transformation_case_id=? AND p.organization_id=? FOR UPDATE`,
      [current.active_plan_id, current.transformation_case_id, current.organization_id]
    );
    if (!planReadback.rows[0] || Number(planReadback.rows[0].step_count) < 1) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_STEPS_MISSING',
        409,
        'Transformation plan cannot be approved without canonical persisted steps'
      );
    }
    const nextVersion = current.version + 1;
    const approvedPlan = await client.query(
      `UPDATE transformation_plans SET status = 'approved', updated_at = ?
       WHERE plan_id = ? AND transformation_case_id = ? AND organization_id = ?`,
      [now, current.active_plan_id, current.transformation_case_id, current.organization_id]
    );
    if (approvedPlan.rowCount !== 1) throw new Error('transformation_plan_approval_write_failed');
    await client.query(
      `UPDATE transformation_cases
          SET status = 'plan_approved', version = ?, updated_at = ?
        WHERE transformation_case_id = ? AND organization_id = ? AND version = ?`,
      [
        nextVersion,
        now,
        current.transformation_case_id,
        current.organization_id,
        input.expectedVersion,
      ]
    );
    await client.query(
      `UPDATE v8_execution_runs SET state = 'planning', updated_at = ?
       WHERE run_id = ? AND organization_id = ? AND state = 'drafting'`,
      [now, current.execution_run_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO v8_run_state_transitions (
        transition_id, run_id, from_state, to_state, triggered_by, reason, transitioned_at
      ) VALUES (?, ?, 'drafting', 'planning', ?, ?, ?)`,
      [uuidv4(), current.execution_run_id, params.actorUserId, input.decisionReason, now]
    );
    const digest = createHash('sha256').update(input.decisionReason).digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_plan.approved', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ decisionReason: input.decisionReason, nextCaseVersion: nextVersion }),
        now,
      ]
    );
  });
  const approved = await getTransformationCase(params.transformationCaseId, params.organizationId);
  if (!approved) throw new Error('Approved Transformation Case not readable after commit');
  return approved;
}

export async function proposeInitialIdeas(
  params: ProposeInitialIdeasParams
): Promise<InitialIdeasProposal> {
  const input = ProposeInitialIdeasSchema.parse(params);
  const existing = await queryOne<StageProposalRow>(
    `SELECT p.* FROM transformation_stage_proposals p
     JOIN transformation_cases tc
       ON tc.transformation_case_id = p.transformation_case_id
      AND tc.organization_id = p.organization_id
     WHERE p.transformation_case_id = ? AND p.organization_id = ?
       AND p.plan_id = tc.active_plan_id
       AND p.lifecycle_stage = 'initial_ideas' AND p.proposal_type = 'create_initial_ideas'
     ORDER BY p.created_at DESC LIMIT 1`,
    [params.transformationCaseId, params.organizationId]
  );
  if (existing) return rowToInitialIdeasProposal(existing);

  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const result = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = result.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    if (current.status !== 'plan_approved') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_APPROVAL_REQUIRED',
        409,
        'The transformation plan must be approved before Ideas are proposed'
      );
    }
    const candidates = buildInitialIdeaCandidates(current, input.maxIdeas);
    const planResult = await client.query<{ version: number }>(
      `SELECT version FROM transformation_plans
       WHERE plan_id = ? AND transformation_case_id = ? AND organization_id = ?`,
      [current.active_plan_id, current.transformation_case_id, current.organization_id]
    );
    const activePlanVersion = planResult.rows[0]?.version;
    if (!activePlanVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PLAN_NOT_FOUND',
        409,
        'Active transformation plan is missing'
      );
    }
    const payload = { candidates, generatedFrom: ['mandate', 'desired_outcomes'] };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'initial_ideas',
      payload,
      reviewerUserIds: [current.initiated_by_user_id],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (
        proposal_id, transformation_case_id, organization_id, plan_id, plan_version,
        lifecycle_stage, proposal_type, status, payload_json, payload_digest,
        proposed_by_user_id, governed_proposal_version_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'initial_ideas', 'create_initial_ideas', 'pending_review',
        ?::jsonb, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        activePlanVersion,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases
          SET lifecycle_stage = 'initial_ideas', version = version + 1, updated_at = ?
        WHERE transformation_case_id = ? AND organization_id = ? AND version = ?`,
      [now, current.transformation_case_id, current.organization_id, input.expectedVersion]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_ideas.proposed', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        activePlanVersion,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId, candidateCount: candidates.length }),
        now,
      ]
    );
  });
  const created = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals
     WHERE proposal_id = ? AND organization_id = ?`,
    [proposalId, params.organizationId]
  );
  if (!created) throw new Error('Ideas proposal not readable after commit');
  return rowToInitialIdeasProposal(created);
}

export async function reviewInitialIdeasProposal(
  params: ReviewInitialIdeasProposalParams
): Promise<InitialIdeasProposal> {
  const input = ReviewInitialIdeasProposalSchema.parse(params);
  const now = new Date().toISOString();
  const prepared = await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    const proposalResult = await client.query<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals
       WHERE proposal_id = ? AND transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.proposalId, current.transformation_case_id, current.organization_id]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_IDEAS_PROPOSAL_NOT_FOUND',
        404,
        'Initial Ideas proposal not found'
      );
    }
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (proposal.status === 'applied' || proposal.status === 'rejected') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_IDEAS_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    }
    const nextVersion = current.version + 1;
    const digest = createHash('sha256')
      .update(
        JSON.stringify({
          proposalId: proposal.proposal_id,
          decision: input.decision,
          reason: input.reason,
        })
      )
      .digest('hex');
    let governedStatus: string | null = null;
    if (proposal.status === 'pending_review') {
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
      governedStatus = governed.status;
    } else {
      if (input.decision !== 'approve')
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_IDEAS_DECISION_INVALID',
          409,
          'Approved Ideas proposal can only be resumed with approve'
        );
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
    }

    if (input.decision === 'reject') {
      await client.query(
        `UPDATE transformation_stage_proposals
            SET status = 'rejected', reviewed_by_user_id = ?, review_reason = ?,
                reviewed_at = ?, updated_at = ?
          WHERE proposal_id = ?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version = ?, updated_at = ?
         WHERE transformation_case_id = ? AND organization_id = ?`,
        [nextVersion, now, current.transformation_case_id, current.organization_id]
      );
    } else if (proposal.status === 'pending_review') {
      await client.query(
        `UPDATE transformation_stage_proposals
            SET status = 'approved', reviewed_by_user_id = ?, review_reason = ?, reviewed_at = ?, updated_at = ?
          WHERE proposal_id = ?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases
            SET status = 'active', lifecycle_stage = 'initial_ideas', version = ?, updated_at = ?
          WHERE transformation_case_id = ? AND organization_id = ?`,
        [nextVersion, now, current.transformation_case_id, current.organization_id]
      );
    }
    if (proposal.status === 'pending_review')
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: input.decision === 'approve' ? 'approved' : 'rejected',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        proposal.plan_version,
        input.decision === 'approve'
          ? 'transformation_ideas.approved'
          : 'transformation_ideas.rejected',
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId: proposal.proposal_id, reason: input.reason }),
        now,
      ]
    );
    return { current, proposal, rejected: input.decision === 'reject', governanceBlocked: null };
  });
  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked Initial Ideas materialization: ${prepared.governanceBlocked}`
    );
  if (!prepared.rejected) {
    const payload = jsonValue<{ candidates?: InitialIdeaCandidate[] }>(
      prepared.proposal.payload_json,
      {}
    );
    const candidates = payload.candidates ?? [];
    await dispatchT01StageMaterialization({
      current: prepared.current,
      proposal: prepared.proposal,
      actorUserId: params.actorUserId,
      toolName: 'transformation.ideas.materialize',
      execute: async () => {
        await withPgTransaction(async (client) => {
          const columnsResult = await client.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='my_ideas'`
          );
          const columns = new Set(columnsResult.rows.map((row) => row.column_name));
          if (!columns.has('id'))
            throw new TransformationCaseOperationError(
              'TRANSFORMATION_IDEAS_RUNTIME_NOT_READY',
              503,
              'My Ideas storage is not available'
            );
          for (const candidate of candidates) {
            const exists = await client.query(
              `SELECT id FROM my_ideas WHERE id=? AND organization_id=?`,
              [candidate.candidateId, params.organizationId]
            );
            if (!exists.rows[0]) {
              const insertColumns = [
                'id',
                'user_id',
                'organization_id',
                'title',
                'body',
                'tags',
                'source_type',
                'source_conversation_id',
                'source_message_id',
              ];
              const values: unknown[] = [
                candidate.candidateId,
                prepared.current.initiated_by_user_id,
                params.organizationId,
                candidate.title,
                candidate.body,
                JSON.stringify(candidate.tags),
                'transformation_agent',
                prepared.current.conversation_id,
                params.proposalId,
              ];
              if (columns.has('stage')) {
                insertColumns.push('stage');
                values.push('spark');
              }
              if (columns.has('action_contract_json')) {
                insertColumns.push('action_contract_json');
                values.push(
                  JSON.stringify({ proposalId: params.proposalId, approvalRequired: true })
                );
              }
              if (columns.has('source_pack_json')) {
                insertColumns.push('source_pack_json');
                values.push(
                  JSON.stringify({
                    transformationCaseId: params.transformationCaseId,
                    lineageId: prepared.current.lineage_id,
                    planId: prepared.current.active_plan_id,
                    planVersion: prepared.proposal.plan_version,
                  })
                );
              }
              if (columns.has('evidence_refs_json')) {
                insertColumns.push('evidence_refs_json');
                values.push(JSON.stringify(candidate.evidenceNeeded));
              }
              await client.query(
                `INSERT INTO my_ideas (${insertColumns.join(',')}) VALUES (${insertColumns.map(() => '?').join(',')})`,
                values
              );
            }
            await client.query(
              `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,
                artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at)
               VALUES (?,?,?,'initial_ideas','my_idea',?,?,'output',?,?) ON CONFLICT DO NOTHING`,
              [
                uuidv4(),
                params.transformationCaseId,
                params.organizationId,
                candidate.candidateId,
                params.proposalId,
                params.actorUserId,
                new Date().toISOString(),
              ]
            );
          }
        });
        return {
          artifactType: 'ideas_materialization_receipt',
          artifactId: params.proposalId,
          module: 'Ideas',
          operation: 'create',
          data: { ideaIds: candidates.map((item) => item.candidateId) },
        };
      },
      readback: async () => {
        const rows = await queryAll<Record<string, unknown>>(
          `SELECT i.id,i.organization_id,i.title,l.source_proposal_id FROM my_ideas i
            JOIN transformation_case_artifact_links l ON l.artifact_id=i.id AND l.organization_id=i.organization_id
           WHERE l.transformation_case_id=? AND l.organization_id=? AND l.source_proposal_id=?
             AND l.artifact_type='my_idea' ORDER BY i.id`,
          [params.transformationCaseId, params.organizationId, params.proposalId]
        );
        return rows.length === candidates.length
          ? { proposalId: params.proposalId, ideas: rows }
          : null;
      },
    });
    await withPgTransaction(async (client) => {
      const appliedAt = new Date().toISOString();
      await client.query(
        `UPDATE transformation_stage_proposals SET status='applied',applied_at=?,updated_at=?
        WHERE proposal_id=? AND organization_id=? AND status='approved'`,
        [appliedAt, appliedAt, params.proposalId, params.organizationId]
      );
      const existingAudit = await client.query(
        `SELECT audit_event_id FROM transformation_case_audit_events WHERE transformation_case_id=?
          AND organization_id=? AND event_type='transformation_ideas.approved_and_applied'
          AND detail_json->>'proposalId'=? LIMIT 1`,
        [params.transformationCaseId, params.organizationId, params.proposalId]
      );
      if (!existingAudit.rows[0])
        await client.query(
          `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,
          plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at)
         VALUES (?,?,?,?,?,'transformation_ideas.approved_and_applied',?,?,?,?::jsonb,?)`,
          [
            uuidv4(),
            params.transformationCaseId,
            params.organizationId,
            prepared.proposal.plan_id,
            prepared.proposal.plan_version,
            params.actorUserId,
            params.correlationId ?? null,
            prepared.proposal.payload_digest,
            JSON.stringify({ proposalId: params.proposalId }),
            appliedAt,
          ]
        );
    });
  }
  const reviewed = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals
     WHERE proposal_id = ? AND organization_id = ?`,
    [params.proposalId, params.organizationId]
  );
  if (!reviewed) throw new Error('Reviewed Ideas proposal not readable after commit');
  const links = await queryAll<{ artifact_id: string }>(
    `SELECT artifact_id FROM transformation_case_artifact_links
     WHERE source_proposal_id = ? AND organization_id = ? ORDER BY created_at`,
    [params.proposalId, params.organizationId]
  );
  return rowToInitialIdeasProposal(
    reviewed,
    links.map((link) => link.artifact_id)
  );
}

export async function getInitialIdeasProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<InitialIdeasProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals
     WHERE transformation_case_id = ? AND organization_id = ?
       AND lifecycle_stage = 'initial_ideas' AND proposal_type = 'create_initial_ideas'
     ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  if (!row) return null;
  const links = await queryAll<{ artifact_id: string }>(
    `SELECT artifact_id FROM transformation_case_artifact_links
     WHERE source_proposal_id = ? AND organization_id = ? ORDER BY created_at`,
    [row.proposal_id, organizationId]
  );
  return rowToInitialIdeasProposal(
    row,
    links.map((link) => link.artifact_id)
  );
}

export async function proposeInterviews(
  params: ProposeInterviewsParams
): Promise<InterviewsProposal> {
  const input = ProposeInterviewsSchema.parse(params);
  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    if (current.status !== 'active' || current.lifecycle_stage !== 'initial_ideas') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEWS_PREREQUISITES_NOT_MET',
        409,
        'Approved initial Ideas are required before interviews can be proposed'
      );
    }
    if (!current.project_id) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_PROJECT_REQUIRED',
        409,
        'A project-bound Transformation Case is required for interview assignments'
      );
    }
    const memberResult = await client.query<{ user_id: string }>(
      `SELECT user_id FROM organization_members
       WHERE organization_id = ? AND user_id = ANY(?::text[])`,
      [current.organization_id, input.stakeholders.map((item) => item.assigneeUserId)]
    );
    const memberIds = new Set(memberResult.rows.map((row) => String(row.user_id)));
    const foreign = input.stakeholders.filter((item) => !memberIds.has(item.assigneeUserId));
    if (foreign.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_ASSIGNEE_NOT_IN_ORG',
        403,
        'Every proposed interview assignee must belong to the organization'
      );
    }
    const ideasResult = await client.query<{ artifact_id: string; title: string }>(
      `SELECT l.artifact_id, i.title
       FROM transformation_case_artifact_links l
       JOIN my_ideas i ON i.id = l.artifact_id AND i.organization_id = l.organization_id
       WHERE l.transformation_case_id = ? AND l.organization_id = ?
         AND l.lifecycle_stage = 'initial_ideas' AND l.artifact_type = 'my_idea'
       ORDER BY l.created_at`,
      [current.transformation_case_id, current.organization_id]
    );
    if (!ideasResult.rows.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_SOURCE_IDEAS_MISSING',
        409,
        'No approved source Ideas are linked to this Transformation Case'
      );
    }
    const ideaIds = ideasResult.rows.map((row) => row.artifact_id);
    const ideaTitles = ideasResult.rows.map((row) => row.title);
    const categories = ['strategy', 'operations', 'digital', 'people', 'finance'] as const;
    const candidates: InterviewProposalCandidate[] = input.stakeholders.map((stakeholder) => ({
      candidateId: uuidv4(),
      assigneeUserId: stakeholder.assigneeUserId,
      stakeholderRole: stakeholder.role,
      objective: `Zweryfikować hipotezy transformacyjne z perspektywy roli ${stakeholder.role}.`,
      sourceIdeaIds: ideaIds,
      questions: stakeholder.focus.slice(0, 8).map((focus, index) => ({
        category: categories[index % categories.length],
        text: `Jak obecny stan w obszarze „${focus}” potwierdza lub podważa hipotezy: ${ideaTitles.join('; ')}? Podaj fakt, przykład i mierzalny skutek.`,
      })),
    }));
    const payload = { candidates, generatedFrom: ['approved_initial_ideas', 'stakeholder_focus'] };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const planResult = await client.query<{ version: number }>(
      `SELECT version FROM transformation_plans WHERE plan_id = ?`,
      [current.active_plan_id]
    );
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'interviews',
      payload,
      reviewerUserIds: [current.initiated_by_user_id],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (
        proposal_id, transformation_case_id, organization_id, plan_id, plan_version,
        lifecycle_stage, proposal_type, status, payload_json, payload_digest,
        proposed_by_user_id, governed_proposal_version_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'interviews', 'create_interview_assignments',
        'pending_review', ?::jsonb, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        planResult.rows[0]?.version ?? 1,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage = 'interviews', version = version + 1, updated_at = ?
       WHERE transformation_case_id = ? AND organization_id = ?`,
      [now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_interviews.proposed', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        planResult.rows[0]?.version ?? 1,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          proposalId,
          candidateCount: candidates.length,
          businessArtifactsCreated: false,
        }),
        now,
      ]
    );
  });
  const created = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id = ? AND organization_id = ?`,
    [proposalId, params.organizationId]
  );
  if (!created) throw new Error('Interview proposal not readable after commit');
  return rowToInterviewsProposal(created);
}

export async function getInterviewsProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<InterviewsProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals
     WHERE transformation_case_id = ? AND organization_id = ?
       AND lifecycle_stage = 'interviews' AND proposal_type = 'create_interview_assignments'
     ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  if (!row) return null;
  const links = await queryAll<{ artifact_id: string }>(
    `SELECT artifact_id FROM transformation_case_artifact_links
     WHERE source_proposal_id = ? AND organization_id = ? AND artifact_type = 'interview_assignment'
     ORDER BY created_at`,
    [row.proposal_id, organizationId]
  );
  return rowToInterviewsProposal(
    row,
    links.map((link) => link.artifact_id)
  );
}

export async function reviewInterviewsProposal(
  params: ReviewInterviewsProposalParams
): Promise<InterviewsProposal> {
  const input = ReviewInterviewsProposalSchema.parse(params);
  const now = new Date().toISOString();

  const prepared = await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    const proposalResult = await client.query<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals
       WHERE proposal_id = ? AND transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.proposalId, current.transformation_case_id, current.organization_id]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal || proposal.proposal_type !== 'create_interview_assignments') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEWS_PROPOSAL_NOT_FOUND',
        404,
        'Interview proposal not found'
      );
    }
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (proposal.status === 'applied' || proposal.status === 'rejected') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEWS_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    }
    const payload = jsonValue<{ candidates?: InterviewProposalCandidate[] }>(
      proposal.payload_json,
      {}
    );
    const candidates = payload.candidates ?? [];
    let governedStatus: string | null = null;
    if (proposal.status === 'pending_review') {
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return {
          current,
          proposal,
          candidates,
          rejected: false,
          governanceBlocked: governed.blockedReason,
        };
      governedStatus = governed.status;
    }
    if (proposal.status === 'pending_review' && input.decision === 'reject') {
      await client.query(
        `UPDATE transformation_stage_proposals SET status = 'rejected', reviewed_by_user_id = ?,
          review_reason = ?, reviewed_at = ?, updated_at = ? WHERE proposal_id = ?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version = version + 1, updated_at = ?
         WHERE transformation_case_id = ? AND organization_id = ?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: 'rejected',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
      await client.query(
        `INSERT INTO transformation_case_audit_events (
          audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
          event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
        ) VALUES (?, ?, ?, ?, ?, 'transformation_interviews.rejected', ?, ?, ?, ?::jsonb, ?)`,
        [
          uuidv4(),
          current.transformation_case_id,
          current.organization_id,
          current.active_plan_id,
          proposal.plan_version,
          params.actorUserId,
          params.correlationId ?? null,
          proposal.payload_digest,
          JSON.stringify({ proposalId: proposal.proposal_id, reason: input.reason }),
          now,
        ]
      );
      return { current, proposal, candidates, rejected: true, governanceBlocked: null };
    }
    if (input.decision !== 'approve') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEWS_DECISION_INVALID',
        409,
        'An approved proposal can only be resumed with decision approve'
      );
    }
    if (proposal.status === 'pending_review') {
      await client.query(
        `UPDATE transformation_stage_proposals SET status = 'approved', reviewed_by_user_id = ?,
          review_reason = ?, reviewed_at = ?, updated_at = ? WHERE proposal_id = ?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version = version + 1, updated_at = ?
         WHERE transformation_case_id = ? AND organization_id = ?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: 'approved',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
    } else {
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return {
          current,
          proposal,
          candidates,
          rejected: false,
          governanceBlocked: governed.blockedReason,
        };
    }
    return { current, proposal, candidates, rejected: false, governanceBlocked: null };
  });

  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked Interview materialization: ${prepared.governanceBlocked}`
    );

  if (prepared.rejected) {
    const rejected = await queryOne<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals WHERE proposal_id = ? AND organization_id = ?`,
      [params.proposalId, params.organizationId]
    );
    if (!rejected) throw new Error('Rejected Interview proposal not readable after commit');
    return rowToInterviewsProposal(rejected);
  }

  const dispatched = await dispatchT01StageMaterialization({
    current: prepared.current,
    proposal: prepared.proposal,
    actorUserId: params.actorUserId,
    toolName: 'transformation.interviews.materialize',
    execute: async () => {
      const assignmentIds: string[] = [];
      const { default: assignmentService } = await import('../InterviewAssignmentService.js');
      for (const candidate of prepared.candidates) {
        const templateId = `itpl_tc_${candidate.candidateId}`;
        await withPgTransaction(async (client) => {
          await client.query(
            `INSERT INTO interview_library_templates (id,organization_id,name,description,category,status,
              visibility,is_default,version,created_by,created_at,updated_at)
             VALUES (?,?,?,?,'STANDARD','approved','org',0,1,?,?,?) ON CONFLICT (id) DO NOTHING`,
            [
              templateId,
              params.organizationId,
              `Transformation interview — ${candidate.stakeholderRole}`,
              `${candidate.objective} Source proposal: ${params.proposalId}`,
              params.actorUserId,
              now,
              now,
            ]
          );
          for (const [index, question] of candidate.questions.entries())
            await client.query(
              `INSERT INTO interview_library_template_questions
                (id,template_id,category,question_text,sort_order,answer_type,is_required,created_at)
               VALUES (?,?,?,?,?,'open',1,?) ON CONFLICT (id) DO NOTHING`,
              [
                `itq_tc_${candidate.candidateId}_${index}`,
                templateId,
                question.category,
                question.text,
                index,
                now,
              ]
            );
        });
        const processRef = `transformation:${prepared.current.transformation_case_id}:${params.proposalId}:${candidate.candidateId}`;
        const existing = await queryOne<{ id: string }>(
          `SELECT id FROM interview_assignments WHERE organization_id=? AND process_ref=? LIMIT 1`,
          [params.organizationId, processRef]
        );
        if (existing) assignmentIds.push(existing.id);
        else {
          const assignment = await assignmentService.create({
            organizationId: params.organizationId,
            projectId: prepared.current.project_id ?? undefined,
            templateId,
            templateVersion: 1,
            assigneeUserIds: [candidate.assigneeUserId],
            dueAt: input.dueAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            priority: 'high',
            escalateTo: params.actorUserId,
            notes: `${candidate.objective} Transformation Case: ${prepared.current.transformation_case_id}`,
            processRef,
            createdBy: params.actorUserId,
          });
          assignmentIds.push(assignment.id);
        }
      }
      await withPgTransaction(async (client) => {
        for (const assignmentId of assignmentIds)
          await client.query(
            `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,
              lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at)
             VALUES (?,?,?,'interviews','interview_assignment',?,?,'output',?,?)
             ON CONFLICT (transformation_case_id,artifact_type,artifact_id,lineage_role) DO NOTHING`,
            [
              uuidv4(),
              params.transformationCaseId,
              params.organizationId,
              assignmentId,
              params.proposalId,
              params.actorUserId,
              new Date().toISOString(),
            ]
          );
      });
      return {
        artifactType: 'interview_materialization_receipt',
        artifactId: params.proposalId,
        module: 'Interview',
        operation: 'create_assignments',
        data: { assignmentIds },
      };
    },
    readback: async () => {
      const rows = await queryAll<Record<string, unknown>>(
        `SELECT a.id,a.organization_id,a.process_ref,a.status FROM interview_assignments a
          JOIN transformation_case_artifact_links l ON l.artifact_id=a.id AND l.organization_id=a.organization_id
         WHERE l.transformation_case_id=? AND l.organization_id=? AND l.source_proposal_id=?
           AND l.artifact_type='interview_assignment' ORDER BY a.id`,
        [params.transformationCaseId, params.organizationId, params.proposalId]
      );
      return rows.length === prepared.candidates.length
        ? { proposalId: params.proposalId, assignments: rows }
        : null;
    },
  });
  const assignmentIds = (dispatched.normalizedResult.data.assignmentIds as string[]) ?? [];

  const appliedAt = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const proposalResult = await client.query<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals
       WHERE proposal_id = ? AND transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.proposalId, params.transformationCaseId, params.organizationId]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal) throw new Error('Approved Interview proposal disappeared before apply');
    await client.query(
      `UPDATE transformation_stage_proposals SET status = 'applied', applied_at = ?, updated_at = ?
       WHERE proposal_id = ?`,
      [appliedAt, appliedAt, params.proposalId]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_interviews.approved_and_applied', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        params.transformationCaseId,
        params.organizationId,
        proposal.plan_id,
        proposal.plan_version,
        params.actorUserId,
        params.correlationId ?? null,
        proposal.payload_digest,
        JSON.stringify({ proposalId: params.proposalId, assignmentIds }),
        appliedAt,
      ]
    );
  });
  const applied = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id = ? AND organization_id = ?`,
    [params.proposalId, params.organizationId]
  );
  if (!applied) throw new Error('Applied Interview proposal not readable after commit');
  return rowToInterviewsProposal(applied, assignmentIds);
}

export async function acceptInterviewResults(
  params: AcceptInterviewResultsParams
): Promise<AcceptedInterviewResults> {
  const input = AcceptInterviewResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  const result = await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    if (current.status !== 'active' || current.lifecycle_stage !== 'interviews') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case must be active at the Interview stage'
      );
    }
    const assignmentResult = await client.query<{
      id: string;
      status: string;
      session_id: string | null;
    }>(
      `SELECT a.id, a.status, a.session_id
       FROM transformation_case_artifact_links l
       JOIN interview_assignments a
         ON a.id = l.artifact_id AND a.organization_id = l.organization_id
       WHERE l.transformation_case_id = ? AND l.organization_id = ?
         AND l.artifact_type = 'interview_assignment'
       ORDER BY l.created_at`,
      [current.transformation_case_id, current.organization_id]
    );
    if (!assignmentResult.rows.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_ASSIGNMENTS_MISSING',
        409,
        'No canonical Interview assignments are linked to this Transformation Case'
      );
    }
    const incompleteAssignments = assignmentResult.rows.filter(
      (row) =>
        !['approved', 'completed'].includes(String(row.status).toLowerCase()) || !row.session_id
    );
    if (incompleteAssignments.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_APPROVALS_INCOMPLETE',
        409,
        'Every linked Interview assignment must be completed and manager-approved'
      );
    }
    const assignmentIds = assignmentResult.rows.map((row) => row.id);
    const sessionIds = assignmentResult.rows.map((row) => String(row.session_id));
    const sessionResult = await client.query<{
      id: string;
      status: string;
      total_questions: number;
      answered_questions: number;
    }>(
      `SELECT id, status, total_questions, answered_questions
       FROM interview_sessions
       WHERE organization_id = ? AND id = ANY(?::text[])`,
      [current.organization_id, sessionIds]
    );
    const completedSessions = new Map(sessionResult.rows.map((row) => [String(row.id), row]));
    const invalidSessions = sessionIds.filter((sessionId) => {
      const session = completedSessions.get(sessionId);
      return (
        !session ||
        String(session.status).toLowerCase() !== 'completed' ||
        Number(session.total_questions) <= 0 ||
        Number(session.answered_questions) !== Number(session.total_questions)
      );
    });
    if (invalidSessions.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_SESSIONS_INCOMPLETE',
        409,
        'Every linked Interview session must be completed with all questions answered'
      );
    }
    const questionResult = await client.query<{
      id: string;
      session_id: string;
      answer_text: string | null;
    }>(
      `SELECT id, session_id, answer_text
       FROM interview_questions
       WHERE organization_id = ? AND session_id = ANY(?::text[])
       ORDER BY session_id, sort_order`,
      [current.organization_id, sessionIds]
    );
    const unanswered = questionResult.rows.filter((row) => !String(row.answer_text || '').trim());
    if (!questionResult.rows.length || unanswered.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_ANSWERS_INCOMPLETE',
        409,
        'Every Interview question must contain a durable respondent answer'
      );
    }
    const insightResult = await client.query<{
      id: string;
      status: string;
      source_session_ids: unknown;
    }>(
      `SELECT id, status, source_session_ids
       FROM interview_insights
       WHERE organization_id = ? AND id = ANY(?::text[])`,
      [current.organization_id, input.insightIds]
    );
    if (insightResult.rows.length !== input.insightIds.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_INSIGHTS_NOT_FOUND',
        404,
        'One or more selected Interview Insights are not visible in this organization'
      );
    }
    const invalidInsights = insightResult.rows.filter(
      (row) => !['approved', 'published'].includes(String(row.status).toLowerCase())
    );
    if (invalidInsights.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_INSIGHTS_NOT_APPROVED',
        409,
        'Every selected Interview Insight must pass the governance approval workflow'
      );
    }
    const coveredSessionIds = new Set(
      insightResult.rows.flatMap((row) =>
        jsonValue<string[]>(row.source_session_ids, []).map((value) => String(value))
      )
    );
    if (sessionIds.some((sessionId) => !coveredSessionIds.has(sessionId))) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INTERVIEW_INSIGHT_COVERAGE_INCOMPLETE',
        409,
        'Approved Interview Insights must cover every linked Interview session'
      );
    }
    const linkArtifact = async (
      artifactType: string,
      artifactId: string,
      lineageRole: 'evidence' | 'output' | 'decision'
    ) => {
      await client.query(
        `INSERT INTO transformation_case_artifact_links (
          link_id, transformation_case_id, organization_id, lifecycle_stage,
          artifact_type, artifact_id, lineage_role, created_by_user_id, created_at
        ) VALUES (?, ?, ?, 'interviews', ?, ?, ?, ?, ?)
        ON CONFLICT (transformation_case_id, artifact_type, artifact_id, lineage_role) DO NOTHING`,
        [
          uuidv4(),
          current.transformation_case_id,
          current.organization_id,
          artifactType,
          artifactId,
          lineageRole,
          params.actorUserId,
          acceptedAt,
        ]
      );
    };
    for (const sessionId of sessionIds)
      await linkArtifact('interview_session', sessionId, 'evidence');
    for (const question of questionResult.rows)
      await linkArtifact('interview_answer', question.id, 'evidence');
    for (const insightId of input.insightIds)
      await linkArtifact('interview_insight', insightId, 'output');
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases
       SET lifecycle_stage = 'drd', version = ?, updated_at = ?
       WHERE transformation_case_id = ? AND organization_id = ?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(JSON.stringify({ assignmentIds, sessionIds, insightIds: input.insightIds }))
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_interviews.results_accepted', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          assignmentIds,
          sessionIds,
          answeredQuestionIds: questionResult.rows.map((row) => row.id),
          insightIds: input.insightIds,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    return {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'drd' as const,
      assignmentIds,
      sessionIds,
      answeredQuestionIds: questionResult.rows.map((row) => row.id),
      insightIds: input.insightIds,
      acceptedAt,
    };
  });
  return result;
}

function rowToDrdAssessmentProposal(
  row: StageProposalRow,
  assessmentId?: string
): DrdAssessmentProposal {
  const payload = jsonValue<{
    assessmentName?: string;
    definitionId?: string | null;
    definitionVersion?: string | null;
    sourceInsightIds?: string[];
  }>(row.payload_json, {});
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    organizationId: row.organization_id,
    planId: row.plan_id,
    planVersion: row.plan_version,
    status: row.status,
    assessmentName: payload.assessmentName ?? 'DRD Transformation Assessment',
    definitionId: payload.definitionId ?? null,
    definitionVersion: payload.definitionVersion ?? null,
    sourceInsightIds: payload.sourceInsightIds ?? [],
    proposedByUserId: row.proposed_by_user_id,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewReason: row.review_reason,
    reviewedAt: row.reviewed_at,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(assessmentId ? { assessmentId } : {}),
  };
}

export async function proposeDrdAssessment(
  params: ProposeDrdAssessmentParams
): Promise<DrdAssessmentProposal> {
  const input = ProposeDrdAssessmentSchema.parse(params);
  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    if (current.version !== input.expectedVersion) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    }
    if (current.status !== 'active' || current.lifecycle_stage !== 'drd') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_STAGE_NOT_ACTIVE',
        409,
        'Accepted Interview results are required before a DRD assessment can be proposed'
      );
    }
    const insightResult = await client.query<{ artifact_id: string }>(
      `SELECT artifact_id FROM transformation_case_artifact_links
       WHERE transformation_case_id = ? AND organization_id = ?
         AND artifact_type = 'interview_insight' AND lineage_role = 'output'
       ORDER BY created_at`,
      [current.transformation_case_id, current.organization_id]
    );
    const sourceInsightIds = insightResult.rows.map((row) => row.artifact_id);
    if (!sourceInsightIds.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_SOURCE_INSIGHTS_MISSING',
        409,
        'No accepted Interview Insights are linked to this Transformation Case'
      );
    }
    const planResult = await client.query<{ version: number }>(
      `SELECT version FROM transformation_plans WHERE plan_id = ?`,
      [current.active_plan_id]
    );
    const payload = {
      assessmentName: input.name,
      definitionId: input.definitionId ?? null,
      definitionVersion: input.definitionVersion ?? null,
      sourceInsightIds,
      assessmentType: 'DRD',
    };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'drd',
      payload,
      reviewerUserIds: [current.initiated_by_user_id],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (
        proposal_id, transformation_case_id, organization_id, plan_id, plan_version,
        lifecycle_stage, proposal_type, status, payload_json, payload_digest,
        proposed_by_user_id, governed_proposal_version_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'drd', 'create_drd_assessment', 'pending_review',
        ?::jsonb, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        planResult.rows[0]?.version ?? 1,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases SET version = version + 1, updated_at = ?
       WHERE transformation_case_id = ? AND organization_id = ?`,
      [now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_drd.proposed', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        planResult.rows[0]?.version ?? 1,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId, sourceInsightIds, businessArtifactsCreated: false }),
        now,
      ]
    );
  });
  const created = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id = ? AND organization_id = ?`,
    [proposalId, params.organizationId]
  );
  if (!created) throw new Error('DRD proposal not readable after commit');
  return rowToDrdAssessmentProposal(created);
}

export async function getDrdAssessmentProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<DrdAssessmentProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals
     WHERE transformation_case_id = ? AND organization_id = ?
       AND lifecycle_stage = 'drd' AND proposal_type = 'create_drd_assessment'
     ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  if (!row) return null;
  const link = await queryOne<{ artifact_id: string }>(
    `SELECT artifact_id FROM transformation_case_artifact_links
     WHERE source_proposal_id = ? AND organization_id = ? AND artifact_type = 'drd_assessment'
     LIMIT 1`,
    [row.proposal_id, organizationId]
  );
  return rowToDrdAssessmentProposal(row, link?.artifact_id);
}

export async function reviewDrdAssessmentProposal(
  params: ReviewDrdAssessmentProposalParams
): Promise<DrdAssessmentProposal> {
  const input = ReviewDrdAssessmentProposalSchema.parse(params);
  const now = new Date().toISOString();
  const prepared = await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    }
    const proposalResult = await client.query<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals
       WHERE proposal_id = ? AND transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.proposalId, current.transformation_case_id, current.organization_id]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal || proposal.proposal_type !== 'create_drd_assessment') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_PROPOSAL_NOT_FOUND',
        404,
        'DRD assessment proposal not found'
      );
    }
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (proposal.status === 'applied' || proposal.status === 'rejected') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    }
    const payload = jsonValue<{
      assessmentName: string;
      definitionId: string | null;
      definitionVersion: string | null;
      sourceInsightIds: string[];
    }>(proposal.payload_json, {
      assessmentName: 'DRD Transformation Assessment',
      definitionId: null,
      definitionVersion: null,
      sourceInsightIds: [],
    });
    let governedStatus: string | null = null;
    if (proposal.status === 'pending_review') {
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return {
          current,
          proposal,
          payload,
          rejected: false,
          governanceBlocked: governed.blockedReason,
        };
      governedStatus = governed.status;
    } else {
      if (input.decision !== 'approve')
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_DRD_DECISION_INVALID',
          409,
          'Approved DRD proposal can only be resumed with approve'
        );
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return {
          current,
          proposal,
          payload,
          rejected: false,
          governanceBlocked: governed.blockedReason,
        };
    }
    if (proposal.status === 'pending_review' && input.decision === 'approve') {
      if (payload.definitionId) {
        const definition = await client.query<{ id: string; version: string; status: string }>(
          `SELECT id, version, status FROM assessment_definitions WHERE id = ?`,
          [payload.definitionId]
        );
        const row = definition.rows[0];
        if (
          !row ||
          row.status !== 'published' ||
          (payload.definitionVersion && String(row.version) !== payload.definitionVersion)
        ) {
          throw new TransformationCaseOperationError(
            'TRANSFORMATION_DRD_DEFINITION_NOT_PUBLISHED',
            409,
            'The selected DRD definition is missing, unpublished or has a different version'
          );
        }
      }
      await client.query(
        `UPDATE transformation_stage_proposals SET status='approved',reviewed_by_user_id=?,
          review_reason=?,reviewed_at=?,updated_at=? WHERE proposal_id=?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version=version+1,updated_at=?
          WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: 'approved',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
    } else if (proposal.status === 'pending_review') {
      await client.query(
        `UPDATE transformation_stage_proposals SET status='rejected',reviewed_by_user_id=?,
          review_reason=?,reviewed_at=?,updated_at=? WHERE proposal_id=?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version=version+1,updated_at=?
          WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: 'rejected',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
      return { current, proposal, payload, rejected: true, governanceBlocked: null };
    }
    return { current, proposal, payload, rejected: false, governanceBlocked: null };
  });
  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked DRD materialization: ${prepared.governanceBlocked}`
    );
  if (prepared.rejected) {
    const rejected = await queryOne<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND organization_id=?`,
      [params.proposalId, params.organizationId]
    );
    if (!rejected) throw new Error('Rejected DRD proposal not readable after commit');
    return rowToDrdAssessmentProposal(rejected);
  }
  const dispatched = await dispatchT01StageMaterialization({
    current: prepared.current,
    proposal: prepared.proposal,
    actorUserId: params.actorUserId,
    toolName: 'transformation.drd.materialize',
    execute: async () => {
      const existing = await queryOne<{ artifact_id: string }>(
        `SELECT artifact_id FROM transformation_case_artifact_links
          WHERE source_proposal_id=? AND organization_id=? AND artifact_type='drd_assessment' LIMIT 1`,
        [params.proposalId, params.organizationId]
      );
      if (existing)
        return {
          artifactType: 'drd_assessment',
          artifactId: existing.artifact_id,
          module: 'Assessments',
          operation: 'create',
          data: { proposalId: params.proposalId },
        };
      const assessmentId = uuidv4();
      const materializedAt = new Date().toISOString();
      await withPgTransaction(async (client) => {
        await client.query(
          `INSERT INTO assessments (id,organization_id,project_id,assessment_type,name,status,
            completion_percent,confidence_avg,answers_json,context_snapshot,assessment_definition_id,
            assessment_definition_version,created_by,updated_by,created_at,updated_at)
           VALUES (?,?,?,'DRD',?,'DRAFT',0,0,'{}',?,?,?,?,?,?,?)`,
          [
            assessmentId,
            prepared.current.organization_id,
            prepared.current.project_id,
            prepared.payload.assessmentName,
            JSON.stringify({
              transformationCaseId: prepared.current.transformation_case_id,
              lineageId: prepared.current.lineage_id,
              sourceInterviewInsightIds: prepared.payload.sourceInsightIds,
            }),
            prepared.payload.definitionId,
            prepared.payload.definitionVersion,
            params.actorUserId,
            params.actorUserId,
            materializedAt,
            materializedAt,
          ]
        );
        await client.query(
          `INSERT INTO assessment_sessions (id,assessment_id,user_id,opened_at) VALUES (?,?,?,?)`,
          [uuidv4(), assessmentId, params.actorUserId, materializedAt]
        );
        await client.query(
          `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,
            lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at)
           VALUES (?,?,?,'drd','drd_assessment',?,?,'output',?,?)`,
          [
            uuidv4(),
            params.transformationCaseId,
            params.organizationId,
            assessmentId,
            params.proposalId,
            params.actorUserId,
            materializedAt,
          ]
        );
      });
      return {
        artifactType: 'drd_assessment',
        artifactId: assessmentId,
        module: 'Assessments',
        operation: 'create',
        data: { proposalId: params.proposalId },
      };
    },
    readback: async (artifactId) =>
      queryOne<Record<string, unknown>>(
        `SELECT a.id,a.organization_id,a.assessment_type,a.name,a.status,l.source_proposal_id
           FROM assessments a JOIN transformation_case_artifact_links l
             ON l.artifact_id=a.id AND l.organization_id=a.organization_id
          WHERE a.id=? AND a.organization_id=? AND l.transformation_case_id=?
            AND l.source_proposal_id=? AND l.artifact_type='drd_assessment'`,
        [artifactId, params.organizationId, params.transformationCaseId, params.proposalId]
      ),
  });
  const assessmentId = dispatched.normalizedResult.artifactId;
  const appliedAt = new Date().toISOString();
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE transformation_stage_proposals SET status='applied',applied_at=?,updated_at=?
        WHERE proposal_id=? AND organization_id=? AND status='approved'`,
      [appliedAt, appliedAt, params.proposalId, params.organizationId]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,
        plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at)
       SELECT ?,?,?,?,?, 'transformation_drd.approved_and_created',?,?,?,?::jsonb,? WHERE NOT EXISTS (
         SELECT 1 FROM transformation_case_audit_events WHERE transformation_case_id=? AND organization_id=?
           AND event_type='transformation_drd.approved_and_created' AND detail_json->>'proposalId'=?)`,
      [
        uuidv4(),
        params.transformationCaseId,
        params.organizationId,
        prepared.proposal.plan_id,
        prepared.proposal.plan_version,
        params.actorUserId,
        params.correlationId ?? null,
        prepared.proposal.payload_digest,
        JSON.stringify({ proposalId: params.proposalId, assessmentId }),
        appliedAt,
        params.transformationCaseId,
        params.organizationId,
        params.proposalId,
      ]
    );
  });
  const reviewed = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id = ? AND organization_id = ?`,
    [params.proposalId, params.organizationId]
  );
  if (!reviewed) throw new Error('Reviewed DRD proposal not readable after commit');
  return rowToDrdAssessmentProposal(reviewed, assessmentId);
}

export async function acceptDrdResults(
  params: AcceptDrdResultsParams
): Promise<AcceptedDrdResults> {
  const input = AcceptDrdResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'drd')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not at DRD stage'
      );
    const assessmentResult = await client.query<{ id: string; status: string }>(
      `SELECT a.id, a.status FROM transformation_case_artifact_links l
       JOIN assessments a ON a.id = l.artifact_id AND a.organization_id = l.organization_id
       WHERE l.transformation_case_id = ? AND l.organization_id = ?
         AND l.artifact_type = 'drd_assessment' LIMIT 1`,
      [current.transformation_case_id, current.organization_id]
    );
    const assessment = assessmentResult.rows[0];
    if (!assessment || String(assessment.status).toUpperCase() !== 'APPROVED') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_OUTPUT_NOT_ACCEPTED',
        409,
        'The linked DRD assessment must pass its quality review first'
      );
    }
    const snapshotResult = await client.query<{ id: string; review_id: string }>(
      `SELECT id, review_id FROM assessment_accepted_snapshots
       WHERE organization_id = ? AND assessment_id = ? AND is_current = true LIMIT 1`,
      [current.organization_id, assessment.id]
    );
    const snapshot = snapshotResult.rows[0];
    if (!snapshot)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DRD_ACCEPTED_SNAPSHOT_MISSING',
        409,
        'The linked DRD assessment has no immutable accepted snapshot'
      );
    await client.query(
      `INSERT INTO transformation_case_artifact_links (
        link_id, transformation_case_id, organization_id, lifecycle_stage,
        artifact_type, artifact_id, lineage_role, created_by_user_id, created_at
      ) VALUES (?, ?, ?, 'drd', 'drd_accepted_snapshot', ?, 'evidence', ?, ?)
      ON CONFLICT (transformation_case_id, artifact_type, artifact_id, lineage_role) DO NOTHING`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        snapshot.id,
        params.actorUserId,
        acceptedAt,
      ]
    );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage = 'opportunity_synthesis',
        version = ?, updated_at = ? WHERE transformation_case_id = ? AND organization_id = ?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(JSON.stringify({ assessmentId: assessment.id, snapshotId: snapshot.id }))
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_drd.results_accepted', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          assessmentId: assessment.id,
          acceptedSnapshotId: snapshot.id,
          reviewId: snapshot.review_id,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    return {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'opportunity_synthesis' as const,
      assessmentId: assessment.id,
      acceptedSnapshotId: snapshot.id,
      reviewId: snapshot.review_id,
      acceptedAt,
    };
  });
}

function rowToOpportunitySynthesisProposal(
  row: StageProposalRow,
  candidateId?: string
): OpportunitySynthesisProposal {
  const payload = jsonValue<{
    assessmentId?: string;
    acceptedSnapshotId?: string;
    sourceIdeaIds?: string[];
    sourceInsightIds?: string[];
    synthesisSummary?: string;
  }>(row.payload_json, {});
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    status: row.status,
    assessmentId: payload.assessmentId ?? '',
    acceptedSnapshotId: payload.acceptedSnapshotId ?? '',
    sourceIdeaIds: payload.sourceIdeaIds ?? [],
    sourceInsightIds: payload.sourceInsightIds ?? [],
    synthesisSummary: payload.synthesisSummary ?? '',
    ...(candidateId ? { candidateId } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function proposeOpportunitySynthesis(
  params: ProposeOpportunitySynthesisParams
): Promise<OpportunitySynthesisProposal> {
  const input = ProposeOpportunitySynthesisSchema.parse(params);
  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'opportunity_synthesis') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SYNTHESIS_STAGE_NOT_ACTIVE',
        409,
        'An accepted DRD output is required before opportunity synthesis'
      );
    }
    const links = await client.query<{
      artifact_type: string;
      artifact_id: string;
    }>(
      `SELECT artifact_type, artifact_id FROM transformation_case_artifact_links
       WHERE transformation_case_id = ? AND organization_id = ?
         AND artifact_type IN ('my_idea', 'interview_insight', 'drd_assessment', 'drd_accepted_snapshot')
       ORDER BY created_at`,
      [current.transformation_case_id, current.organization_id]
    );
    const idsByType = (type: string) =>
      links.rows.filter((row) => row.artifact_type === type).map((row) => row.artifact_id);
    const assessmentId = idsByType('drd_assessment')[0];
    const acceptedSnapshotId = idsByType('drd_accepted_snapshot')[0];
    const sourceIdeaIds = idsByType('my_idea');
    const sourceInsightIds = idsByType('interview_insight');
    if (!assessmentId || !acceptedSnapshotId || !sourceIdeaIds.length || !sourceInsightIds.length) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SYNTHESIS_SOURCES_INCOMPLETE',
        409,
        'Opportunity synthesis requires Ideas, accepted Interview Insights and an accepted DRD snapshot'
      );
    }
    const planResult = await client.query<{ version: number }>(
      `SELECT version FROM transformation_plans WHERE plan_id = ?`,
      [current.active_plan_id]
    );
    const payload = {
      assessmentId,
      acceptedSnapshotId,
      sourceIdeaIds,
      sourceInsightIds,
      synthesisSummary:
        `Synthesis of ${sourceIdeaIds.length} Ideas, ${sourceInsightIds.length} approved Interview Insights ` +
        `and immutable DRD output ${acceptedSnapshotId}. Candidate materialization remains human-approved.`,
    };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'opportunity_synthesis',
      payload,
      reviewerUserIds: [current.initiated_by_user_id],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (
        proposal_id, transformation_case_id, organization_id, plan_id, plan_version,
        lifecycle_stage, proposal_type, status, payload_json, payload_digest,
        proposed_by_user_id, governed_proposal_version_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'opportunity_synthesis', 'create_initiative_candidate',
        'pending_review', ?::jsonb, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        planResult.rows[0]?.version ?? 1,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases SET version = version + 1, updated_at = ?
       WHERE transformation_case_id = ? AND organization_id = ?`,
      [now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_synthesis.proposed', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        planResult.rows[0]?.version ?? 1,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId, ...payload, businessArtifactsCreated: false }),
        now,
      ]
    );
  });
  const created = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id = ? AND organization_id = ?`,
    [proposalId, params.organizationId]
  );
  if (!created) throw new Error('Opportunity synthesis proposal not readable after commit');
  return rowToOpportunitySynthesisProposal(created);
}

export async function getOpportunitySynthesisProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<OpportunitySynthesisProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals
     WHERE transformation_case_id = ? AND organization_id = ?
       AND lifecycle_stage = 'opportunity_synthesis'
       AND proposal_type = 'create_initiative_candidate'
     ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  if (!row) return null;
  const link = await queryOne<{ artifact_id: string }>(
    `SELECT artifact_id FROM transformation_case_artifact_links
     WHERE source_proposal_id = ? AND artifact_type = 'initiative_candidate' LIMIT 1`,
    [row.proposal_id]
  );
  return rowToOpportunitySynthesisProposal(row, link?.artifact_id);
}

export async function reviewOpportunitySynthesis(
  params: ReviewOpportunitySynthesisParams
): Promise<OpportunitySynthesisProposal> {
  const input = ReviewOpportunitySynthesisSchema.parse(params);
  const now = new Date().toISOString();
  const prepared = await withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const proposalResult = await client.query<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals
       WHERE proposal_id = ? AND transformation_case_id = ? AND organization_id = ? FOR UPDATE`,
      [params.proposalId, current.transformation_case_id, current.organization_id]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal || proposal.proposal_type !== 'create_initiative_candidate') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SYNTHESIS_PROPOSAL_NOT_FOUND',
        404,
        'Opportunity synthesis proposal not found'
      );
    }
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (proposal.status === 'applied' || proposal.status === 'rejected') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SYNTHESIS_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    }
    let governedStatus: string | null = null;
    if (proposal.status === 'pending_review') {
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
      governedStatus = governed.status;
    }
    if (proposal.status === 'pending_review' && input.decision === 'reject') {
      await client.query(
        `UPDATE transformation_stage_proposals SET status='rejected', reviewed_by_user_id=?,
          review_reason=?, reviewed_at=?, updated_at=? WHERE proposal_id=?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version=version+1, updated_at=?
         WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: 'rejected',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
      return { current, proposal, rejected: true, governanceBlocked: null };
    }
    if (input.decision !== 'approve')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SYNTHESIS_DECISION_INVALID',
        409,
        'An approved synthesis can only be resumed with decision approve'
      );
    if (proposal.status === 'pending_review') {
      await client.query(
        `UPDATE transformation_stage_proposals SET status='approved', reviewed_by_user_id=?,
          review_reason=?, reviewed_at=?, updated_at=? WHERE proposal_id=?`,
        [params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET lifecycle_stage='initiative_candidates',
          version=version+1, updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: 'approved',
        governedStatus,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
    } else {
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
    }
    return { current, proposal, rejected: false, governanceBlocked: null };
  });
  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked Synthesis materialization: ${prepared.governanceBlocked}`
    );
  if (prepared.rejected) {
    const rejected = await queryOne<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND organization_id=?`,
      [params.proposalId, params.organizationId]
    );
    if (!rejected) throw new Error('Rejected synthesis proposal not readable');
    return rowToOpportunitySynthesisProposal(rejected);
  }
  const payload = jsonValue<{ assessmentId?: string }>(prepared.proposal.payload_json, {});
  if (!payload.assessmentId) throw new Error('Synthesis proposal has no DRD assessment');
  const dispatched = await dispatchT01StageMaterialization({
    current: prepared.current,
    proposal: prepared.proposal,
    actorUserId: params.actorUserId,
    toolName: 'transformation.initiative_candidate.materialize',
    execute: async () => {
      const existing = await queryOne<{ artifact_id: string }>(
        `SELECT artifact_id FROM transformation_case_artifact_links
          WHERE transformation_case_id=? AND organization_id=? AND source_proposal_id=?
            AND artifact_type='initiative_candidate' LIMIT 1`,
        [params.transformationCaseId, params.organizationId, params.proposalId]
      );
      if (existing)
        return {
          artifactType: 'initiative_candidate',
          artifactId: existing.artifact_id,
          module: 'Initiatives',
          operation: 'create_candidate',
          data: { proposalId: params.proposalId },
        };
      const { handoffAssessmentToCandidate } = await import('../assessment/drdCandidateHandoff.js');
      const handoff = await handoffAssessmentToCandidate({
        organizationId: params.organizationId,
        assessmentId: payload.assessmentId!,
        actorId: params.actorUserId,
      });
      await withPgTransaction((client) =>
        client.query(
          `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,
            lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at)
           VALUES (?,?,?,'initiative_candidates','initiative_candidate',?,?,'output',?,?)
           ON CONFLICT (transformation_case_id,artifact_type,artifact_id,lineage_role) DO NOTHING`,
          [
            uuidv4(),
            params.transformationCaseId,
            params.organizationId,
            handoff.candidate.id,
            params.proposalId,
            params.actorUserId,
            new Date().toISOString(),
          ]
        )
      );
      return {
        artifactType: 'initiative_candidate',
        artifactId: handoff.candidate.id,
        module: 'Initiatives',
        operation: 'create_candidate',
        data: {
          proposalId: params.proposalId,
          handoffId: handoff.handoff.id,
          created: handoff.created,
        },
      };
    },
    readback: async (artifactId) =>
      queryOne<Record<string, unknown>>(
        `SELECT c.id,c.organization_id,c.status,c.source_type,c.source_id,l.source_proposal_id
           FROM initiative_candidates c JOIN transformation_case_artifact_links l
             ON l.artifact_id=c.id AND l.organization_id=c.organization_id
          WHERE c.id=? AND c.organization_id=? AND l.transformation_case_id=?
            AND l.source_proposal_id=? AND l.artifact_type='initiative_candidate'`,
        [artifactId, params.organizationId, params.transformationCaseId, params.proposalId]
      ),
  });
  const candidateId = dispatched.normalizedResult.artifactId;
  const appliedAt = new Date().toISOString();
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE transformation_stage_proposals SET status='applied', applied_at=?, updated_at=?
       WHERE proposal_id=? AND organization_id=? AND status='approved'`,
      [appliedAt, appliedAt, params.proposalId, params.organizationId]
    );
    const existingAudit = await client.query<{ audit_event_id: string }>(
      `SELECT audit_event_id FROM transformation_case_audit_events
        WHERE transformation_case_id=? AND organization_id=?
          AND event_type='transformation_synthesis.candidate_created'
          AND detail_json->>'proposalId'=? LIMIT 1`,
      [params.transformationCaseId, params.organizationId, params.proposalId]
    );
    if (!existingAudit.rows[0])
      await client.query(
        `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_synthesis.candidate_created', ?, ?, ?, ?::jsonb, ?)`,
        [
          uuidv4(),
          params.transformationCaseId,
          params.organizationId,
          prepared.proposal.plan_id,
          prepared.proposal.plan_version,
          params.actorUserId,
          params.correlationId ?? null,
          prepared.proposal.payload_digest,
          JSON.stringify({
            proposalId: params.proposalId,
            candidateId,
            adapterInvocationId: dispatched.invocationId,
            idempotentReplay: dispatched.idempotentReplay,
          }),
          appliedAt,
        ]
      );
  });
  const applied = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND organization_id=?`,
    [params.proposalId, params.organizationId]
  );
  if (!applied) throw new Error('Applied synthesis proposal not readable');
  return rowToOpportunitySynthesisProposal(applied, candidateId);
}

async function acceptInitiativeResultsInner(
  params: AcceptInitiativeResultsParams
): Promise<AcceptedInitiativeResults> {
  const input = AcceptInitiativeResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM transformation_cases
       WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
      [params.transformationCaseId, params.organizationId]
    );
    const current = caseResult.rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedInitiativeResults>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'initiative_results',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'initiative_candidates') {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not waiting for an accepted Initiative Candidate'
      );
    }
    const result = await client.query<{
      candidate_id: string;
      candidate_status: string;
      initiative_id: string | null;
      initiative_status: string | null;
    }>(
      `SELECT c.id candidate_id, c.status candidate_status, c.initiative_id,
              i.status initiative_status
       FROM transformation_case_artifact_links l
       JOIN initiative_candidates c ON c.id=l.artifact_id AND c.organization_id=l.organization_id
       LEFT JOIN initiatives i ON i.id=c.initiative_id AND i.organization_id=c.organization_id
       WHERE l.transformation_case_id=? AND l.organization_id=?
         AND l.artifact_type='initiative_candidate' LIMIT 1`,
      [current.transformation_case_id, current.organization_id]
    );
    const row = result.rows[0];
    if (
      !row ||
      row.candidate_status !== 'accepted' ||
      !row.initiative_id ||
      !row.initiative_status
    ) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_ACCEPTED',
        409,
        'The canonical Candidate must be accepted with a durable Initiative receipt first'
      );
    }
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'initiative_results',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: {
        candidateId: row.candidate_id,
        initiativeId: row.initiative_id,
        initiativeStatus: row.initiative_status,
      },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Initiative result acceptance: ${gate.blockedReason}`
      );
    await client.query(
      `INSERT INTO transformation_case_artifact_links (
        link_id, transformation_case_id, organization_id, lifecycle_stage,
        artifact_type, artifact_id, lineage_role, created_by_user_id, created_at
      ) VALUES (?, ?, ?, 'initiative_candidates', 'initiative', ?, 'output', ?, ?)
      ON CONFLICT (transformation_case_id, artifact_type, artifact_id, lineage_role) DO NOTHING`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        row.initiative_id,
        params.actorUserId,
        acceptedAt,
      ]
    );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='finance_kpi', version=?, updated_at=?
       WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(JSON.stringify({ candidateId: row.candidate_id, initiativeId: row.initiative_id }))
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (
        audit_event_id, transformation_case_id, organization_id, plan_id, plan_version,
        event_type, actor_user_id, correlation_id, payload_digest, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 'transformation_initiative.results_accepted', ?, ?, ?, ?::jsonb, ?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          candidateId: row.candidate_id,
          initiativeId: row.initiative_id,
          initiativeStatus: row.initiative_status,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'finance_kpi' as const,
      candidateId: row.candidate_id,
      initiativeId: row.initiative_id,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

type FinancePackPayload = Omit<
  FinanceKpiPackProposal,
  | 'proposalId'
  | 'transformationCaseId'
  | 'status'
  | 'financialAnalysisId'
  | 'kpiId'
  | 'createdAt'
  | 'updatedAt'
>;

async function financePackFromRow(row: StageProposalRow): Promise<FinanceKpiPackProposal> {
  const payload = jsonValue<FinancePackPayload>(row.payload_json, {} as FinancePackPayload);
  const links = await queryAll<{ artifact_type: string; artifact_id: string }>(
    `SELECT artifact_type, artifact_id FROM transformation_case_artifact_links
     WHERE source_proposal_id=? AND artifact_type IN ('financial_analysis','initiative_kpi')`,
    [row.proposal_id]
  );
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    status: row.status,
    ...payload,
    financialAnalysisId: links.find((link) => link.artifact_type === 'financial_analysis')
      ?.artifact_id,
    kpiId: links.find((link) => link.artifact_type === 'initiative_kpi')?.artifact_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function proposeFinanceKpiPack(
  params: ProposeFinanceKpiPackParams
): Promise<FinanceKpiPackProposal> {
  const input = ProposeFinanceKpiPackSchema.parse(params);
  const { generateOnePager } = await import('../businessCaseGeneratorService.js');
  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'finance_kpi')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_STAGE_NOT_ACTIVE',
        409,
        'An accepted Initiative is required before Finance and KPI preparation'
      );
    const initiative = (
      await client.query<{ id: string; name: string }>(
        `SELECT i.id,i.name FROM transformation_case_artifact_links l JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative' LIMIT 1`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!initiative)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_FOUND',
        409,
        'Case-linked canonical Initiative not found'
      );
    const onePager = generateOnePager(
      {
        id: initiative.id,
        name: initiative.name,
        capex: input.capex,
        opexAnnual: input.opexAnnual,
        benefitAnnual: input.benefitAnnual,
        horizonYears: input.horizonYears,
      },
      input.waccPct
    );
    const payload: FinancePackPayload = {
      initiativeId: initiative.id,
      economics: {
        capex: input.capex,
        opexAnnual: input.opexAnnual,
        benefitAnnual: input.benefitAnnual,
        horizonYears: input.horizonYears,
        waccPct: input.waccPct,
        currency: input.currency,
      },
      businessCase: {
        npv: onePager.npv,
        irr: onePager.irr,
        paybackYears: onePager.paybackYears,
        pi: onePager.pi,
        verdict: onePager.verdict,
        summary: onePager.summary,
      },
      kpi: input.kpi,
    };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'finance_kpi',
      payload: payload as unknown as Record<string, unknown>,
      reviewerUserIds: [current.initiated_by_user_id],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (proposal_id,transformation_case_id,organization_id,plan_id,plan_version,lifecycle_stage,proposal_type,status,payload_json,payload_digest,proposed_by_user_id,governed_proposal_version_id,created_at,updated_at) VALUES (?,?,?,?,?,'finance_kpi','create_finance_kpi_pack','pending_review',?::jsonb,?,?,?,?,?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases SET version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_finance_kpi.proposed',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId, businessArtifactsCreated: false }),
        now,
      ]
    );
  });
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND organization_id=?`,
    [proposalId, params.organizationId]
  );
  if (!row) throw new Error('Finance/KPI proposal not readable after commit');
  return financePackFromRow(row);
}

export async function getFinanceKpiPackProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<FinanceKpiPackProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE transformation_case_id=? AND organization_id=? AND proposal_type='create_finance_kpi_pack' ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  return row ? financePackFromRow(row) : null;
}

export async function reviewFinanceKpiPack(
  params: ReviewFinanceKpiPackParams
): Promise<FinanceKpiPackProposal> {
  const input = ReviewFinanceKpiPackSchema.parse(params);
  const now = new Date().toISOString();
  const prepared = await withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const proposal = (
      await client.query<StageProposalRow>(
        `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.proposalId, current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!proposal || proposal.proposal_type !== 'create_finance_kpi_pack')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_KPI_PROPOSAL_NOT_FOUND',
        404,
        'Finance/KPI proposal not found'
      );
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (proposal.status === 'applied' || proposal.status === 'rejected')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_KPI_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    if (proposal.status === 'pending_review') {
      const status = input.decision === 'approve' ? 'approved' : 'rejected';
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
      await client.query(
        `UPDATE transformation_stage_proposals SET status=?,reviewed_by_user_id=?,review_reason=?,reviewed_at=?,updated_at=? WHERE proposal_id=?`,
        [status, params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: status,
        governedStatus: governed.status,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
      if (input.decision === 'reject')
        return { current, proposal, rejected: true, governanceBlocked: null };
    } else if (input.decision !== 'approve')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_KPI_DECISION_INVALID',
        409,
        'Approved proposal can only be resumed with approve'
      );
    else {
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
    }
    return { current, proposal, rejected: false, governanceBlocked: null };
  });
  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked Finance/KPI materialization: ${prepared.governanceBlocked}`
    );
  if (prepared.rejected) {
    const rejected = await queryOne<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
      [params.proposalId]
    );
    if (!rejected) throw new Error('Rejected Finance/KPI proposal not readable');
    return financePackFromRow(rejected);
  }
  const payload = jsonValue<FinancePackPayload>(
    prepared.proposal.payload_json,
    {} as FinancePackPayload
  );
  const dispatched = await dispatchT01StageMaterialization({
    current: prepared.current,
    proposal: prepared.proposal,
    actorUserId: params.actorUserId,
    toolName: 'transformation.finance_kpi.materialize',
    execute: async () => {
      let existing = await getFinanceKpiPackProposal(
        params.transformationCaseId,
        params.organizationId
      );
      let analysisId = existing?.financialAnalysisId;
      if (!analysisId) {
        const { createAnalysis } = await import('../financialAnalysisService.js');
        const analysis = await createAnalysis(
          params.organizationId,
          {
            title: `Investment case — ${payload.businessCase.verdict.toUpperCase()}`,
            description: payload.businessCase.summary,
            projectId: undefined,
            analysisType: 'initiative_investment_case',
            currency: payload.economics.currency,
          },
          params.actorUserId
        );
        analysisId = analysis.id;
        await withPgTransaction((client) =>
          client.query(
            `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'finance_kpi','financial_analysis',?,?,'output',?,?) ON CONFLICT DO NOTHING`,
            [
              uuidv4(),
              params.transformationCaseId,
              params.organizationId,
              analysisId,
              params.proposalId,
              params.actorUserId,
              new Date().toISOString(),
            ]
          )
        );
      }
      existing = await getFinanceKpiPackProposal(
        params.transformationCaseId,
        params.organizationId
      );
      let kpiId = existing?.kpiId;
      if (!kpiId) {
        const { createDefinition } = await import('../results/kpiDefinitionService.js');
        const kpi = await createDefinition({
          organizationId: params.organizationId,
          initiativeId: payload.initiativeId,
          actorUserId: params.actorUserId,
          ...payload.kpi,
          source: 'transformation_agent',
          reason: 'Approved Transformation Finance/KPI pack',
        });
        kpiId = kpi.id;
        await withPgTransaction((client) =>
          client.query(
            `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'finance_kpi','initiative_kpi',?,?,'output',?,?) ON CONFLICT DO NOTHING`,
            [
              uuidv4(),
              params.transformationCaseId,
              params.organizationId,
              kpiId,
              params.proposalId,
              params.actorUserId,
              new Date().toISOString(),
            ]
          )
        );
      }
      return {
        artifactType: 'finance_kpi_materialization_receipt',
        artifactId: params.proposalId,
        module: 'Finance/KPI',
        operation: 'create_pack',
        data: { analysisId, kpiId },
      };
    },
    readback: async () => {
      const rows = await queryAll<Record<string, unknown>>(
        `SELECT l.artifact_type,l.artifact_id,
          CASE WHEN l.artifact_type='financial_analysis' THEN f.status ELSE k.name END owner_state
         FROM transformation_case_artifact_links l
         LEFT JOIN financial_analyses f ON l.artifact_type='financial_analysis' AND f.id=l.artifact_id AND f.organization_id=l.organization_id
         LEFT JOIN initiative_kpis k ON l.artifact_type='initiative_kpi' AND k.id=l.artifact_id AND k.organization_id=l.organization_id
         WHERE l.transformation_case_id=? AND l.organization_id=? AND l.source_proposal_id=?
           AND l.artifact_type IN ('financial_analysis','initiative_kpi') ORDER BY l.artifact_type`,
        [params.transformationCaseId, params.organizationId, params.proposalId]
      );
      return rows.length === 2 && rows.every((row) => row.owner_state)
        ? { proposalId: params.proposalId, artifacts: rows }
        : null;
    },
  });
  const analysisId = String(dispatched.normalizedResult.data.analysisId);
  const kpiId = String(dispatched.normalizedResult.data.kpiId);
  const appliedAt = new Date().toISOString();
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE transformation_stage_proposals SET status='applied',applied_at=?,updated_at=? WHERE proposal_id=?`,
      [appliedAt, appliedAt, params.proposalId]
    );
    const auditExists = await client.query<{ audit_event_id: string }>(
      `SELECT audit_event_id FROM transformation_case_audit_events WHERE transformation_case_id=?
        AND organization_id=? AND event_type='transformation_finance_kpi.materialized'
        AND detail_json->>'proposalId'=? LIMIT 1`,
      [params.transformationCaseId, params.organizationId, params.proposalId]
    );
    if (!auditExists.rows[0])
      await client.query(
        `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_finance_kpi.materialized',?,?,?,?::jsonb,?)`,
        [
          uuidv4(),
          params.transformationCaseId,
          params.organizationId,
          prepared.proposal.plan_id,
          prepared.proposal.plan_version,
          params.actorUserId,
          params.correlationId ?? null,
          prepared.proposal.payload_digest,
          JSON.stringify({ proposalId: params.proposalId, analysisId, kpiId }),
          appliedAt,
        ]
      );
  });
  const applied = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
    [params.proposalId]
  );
  if (!applied) throw new Error('Applied Finance/KPI proposal not readable');
  return financePackFromRow(applied);
}

async function acceptFinanceKpiResultsInner(
  params: AcceptFinanceKpiResultsParams
): Promise<AcceptedFinanceKpiResults> {
  const input = AcceptFinanceKpiResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedFinanceKpiResults>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'finance_kpi_results',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    const artifacts = await client.query<{ artifact_type: string; artifact_id: string }>(
      `SELECT artifact_type,artifact_id FROM transformation_case_artifact_links WHERE transformation_case_id=? AND organization_id=? AND artifact_type IN ('initiative','financial_analysis','initiative_kpi')`,
      [current.transformation_case_id, current.organization_id]
    );
    const id = (type: string) =>
      artifacts.rows.find((row) => row.artifact_type === type)?.artifact_id;
    const initiativeId = id('initiative'),
      analysisId = id('financial_analysis'),
      kpiId = id('initiative_kpi');
    if (!initiativeId || !analysisId || !kpiId)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_KPI_PACK_INCOMPLETE',
        409,
        'Finance analysis and KPI must both be materialized'
      );
    const approved = (
      await client.query<{ id: string }>(
        `SELECT id FROM financial_analyses WHERE id=? AND organization_id=? AND status='APPROVED'`,
        [analysisId, current.organization_id]
      )
    ).rows[0];
    const kpi = (
      await client.query<{ id: string }>(
        `SELECT id FROM initiative_kpis WHERE id=? AND organization_id=? AND initiative_id=?`,
        [kpiId, current.organization_id, initiativeId]
      )
    ).rows[0];
    if (!approved || !kpi)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_KPI_NOT_APPROVED',
        409,
        'Financial Analysis must be APPROVED and KPI must remain linked to the Initiative'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'finance_kpi_results',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: { initiativeId, financialAnalysisId: analysisId, kpiId },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Finance/KPI result acceptance: ${gate.blockedReason}`
      );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='portfolio_decision',version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256').update(JSON.stringify({ analysisId, kpiId })).digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_finance_kpi.results_accepted',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          analysisId,
          kpiId,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'portfolio_decision' as const,
      initiativeId,
      financialAnalysisId: analysisId,
      kpiId,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

type PortfolioDecisionPayload = Omit<
  PortfolioDecisionProposal,
  'proposalId' | 'transformationCaseId' | 'status' | 'decisionId' | 'createdAt' | 'updatedAt'
>;

async function portfolioDecisionFromRow(row: StageProposalRow): Promise<PortfolioDecisionProposal> {
  const payload = jsonValue<PortfolioDecisionPayload>(
    row.payload_json,
    {} as PortfolioDecisionPayload
  );
  const link = await queryOne<{ artifact_id: string }>(
    `SELECT artifact_id FROM transformation_case_artifact_links WHERE source_proposal_id=? AND artifact_type='decision' LIMIT 1`,
    [row.proposal_id]
  );
  const pack = await queryOne<{ pack_id: string; evidence_digest: string }>(
    `SELECT pack_id,evidence_digest FROM transformation_portfolio_decision_packs WHERE proposal_id=? AND organization_id=?`,
    [row.proposal_id, row.organization_id]
  );
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    status: row.status,
    ...payload,
    ...(link ? { decisionId: link.artifact_id } : {}),
    ...(pack ? { evidencePackId: pack.pack_id, evidenceDigest: pack.evidence_digest } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function proposePortfolioDecision(
  params: ProposePortfolioDecisionParams
): Promise<PortfolioDecisionProposal> {
  const input = ProposePortfolioDecisionSchema.parse(params);
  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'portfolio_decision')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_STAGE_NOT_ACTIVE',
        409,
        'Approved Finance and KPI results are required before portfolio decision'
      );
    const links = await client.query<{ artifact_type: string; artifact_id: string }>(
      `SELECT artifact_type,artifact_id FROM transformation_case_artifact_links WHERE transformation_case_id=? AND organization_id=? AND artifact_type IN ('initiative','financial_analysis','initiative_kpi')`,
      [current.transformation_case_id, current.organization_id]
    );
    const id = (type: string) => links.rows.find((row) => row.artifact_type === type)?.artifact_id;
    const initiativeId = id('initiative'),
      financialAnalysisId = id('financial_analysis'),
      kpiId = id('initiative_kpi');
    if (!initiativeId || !financialAnalysisId || !kpiId)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_EVIDENCE_INCOMPLETE',
        409,
        'Initiative, approved Financial Analysis and KPI are required'
      );
    const initiative = (
      await client.query<{ name: string }>(
        `SELECT name FROM initiatives WHERE id=? AND organization_id=?`,
        [initiativeId, current.organization_id]
      )
    ).rows[0];
    const analysis = (
      await client.query<{ description: string | null }>(
        `SELECT description FROM financial_analyses WHERE id=? AND organization_id=? AND status='APPROVED'`,
        [financialAnalysisId, current.organization_id]
      )
    ).rows[0];
    if (!initiative || !analysis)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_EVIDENCE_NOT_APPROVED',
        409,
        'Portfolio packet requires an approved Financial Analysis'
      );
    const payload: PortfolioDecisionPayload = {
      initiativeId,
      financialAnalysisId,
      kpiId,
      decisionMakerId: input.decisionMakerId,
      title: `GO/NO-GO — ${initiative.name}`,
      description:
        `Decide whether to fund and mobilize the Initiative. ${analysis.description ?? ''}`.trim(),
      criteria:
        'Approved financial analysis; versioned KPI with baseline and target; accepted discovery and DRD lineage.',
      ...(input.deadline ? { deadline: input.deadline } : {}),
    };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const evidenceDigest = createHash('sha256')
      .update(
        JSON.stringify({
          caseVersion: current.version,
          supportingEvidence: input.supportingEvidence,
          contradictingEvidence: input.contradictingEvidence,
        })
      )
      .digest('hex');
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'portfolio_decision',
      payload: payload as unknown as Record<string, unknown>,
      reviewerUserIds: [current.initiated_by_user_id, input.decisionMakerId],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (proposal_id,transformation_case_id,organization_id,plan_id,plan_version,lifecycle_stage,proposal_type,status,payload_json,payload_digest,proposed_by_user_id,governed_proposal_version_id,created_at,updated_at) VALUES (?,?,?,?,?,'portfolio_decision','create_portfolio_decision','pending_review',?::jsonb,?,?,?,?,?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `INSERT INTO transformation_portfolio_decision_packs
       (pack_id,transformation_case_id,organization_id,proposal_id,case_version,supporting_evidence_json,contradicting_evidence_json,evidence_digest,created_by_user_id,created_at)
       VALUES (?,?,?,?,?,?::jsonb,?::jsonb,?,?,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        proposalId,
        current.version,
        JSON.stringify(input.supportingEvidence),
        JSON.stringify(input.contradictingEvidence),
        evidenceDigest,
        params.actorUserId,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases SET version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_portfolio.proposed',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId, businessArtifactsCreated: false }),
        now,
      ]
    );
  });
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND organization_id=?`,
    [proposalId, params.organizationId]
  );
  if (!row) throw new Error('Portfolio decision proposal not readable');
  return portfolioDecisionFromRow(row);
}

export async function getPortfolioDecisionProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<PortfolioDecisionProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE transformation_case_id=? AND organization_id=? AND proposal_type='create_portfolio_decision' ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  return row ? portfolioDecisionFromRow(row) : null;
}

export async function reviewPortfolioDecision(
  params: ReviewPortfolioDecisionParams
): Promise<PortfolioDecisionProposal> {
  const input = ReviewPortfolioDecisionSchema.parse(params);
  const now = new Date().toISOString();
  const prepared = await withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const proposal = (
      await client.query<StageProposalRow>(
        `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.proposalId, current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!proposal || proposal.proposal_type !== 'create_portfolio_decision')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_PROPOSAL_NOT_FOUND',
        404,
        'Portfolio decision proposal not found'
      );
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (['applied', 'rejected'].includes(proposal.status))
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    if (proposal.status === 'pending_review') {
      const status = input.decision === 'approve' ? 'approved' : 'rejected';
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return { proposal, rejected: false, current, governanceBlocked: governed.blockedReason };
      await client.query(
        `UPDATE transformation_stage_proposals SET status=?,reviewed_by_user_id=?,review_reason=?,reviewed_at=?,updated_at=? WHERE proposal_id=?`,
        [status, params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: status,
        governedStatus: governed.status,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
      if (input.decision === 'reject')
        return { proposal, rejected: true, current, governanceBlocked: null };
    } else if (input.decision !== 'approve')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_DECISION_INVALID',
        409,
        'Approved proposal can only be resumed with approve'
      );
    else {
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return { proposal, rejected: false, current, governanceBlocked: governed.blockedReason };
    }
    return { proposal, rejected: false, current, governanceBlocked: null };
  });
  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked Portfolio materialization: ${prepared.governanceBlocked}`
    );
  if (prepared.rejected) {
    const row = await queryOne<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
      [params.proposalId]
    );
    if (!row) throw new Error('Rejected portfolio proposal not readable');
    return portfolioDecisionFromRow(row);
  }
  const payload = jsonValue<PortfolioDecisionPayload>(
    prepared.proposal.payload_json,
    {} as PortfolioDecisionPayload
  );
  const dispatched = await dispatchT01StageMaterialization({
    current: prepared.current,
    proposal: prepared.proposal,
    actorUserId: params.actorUserId,
    toolName: 'transformation.portfolio_decision.materialize',
    execute: async () => {
      const existing = await queryOne<{ artifact_id: string }>(
        `SELECT artifact_id FROM transformation_case_artifact_links
          WHERE transformation_case_id=? AND organization_id=? AND source_proposal_id=?
            AND artifact_type='decision' LIMIT 1`,
        [params.transformationCaseId, params.organizationId, params.proposalId]
      );
      if (existing)
        return {
          artifactType: 'decision',
          artifactId: existing.artifact_id,
          module: 'Decisions',
          operation: 'create',
          data: { proposalId: params.proposalId },
        };
      const { createDecision } = await import('../decisionService.js');
      const decision = await createDecision({
        organizationId: params.organizationId,
        ...(prepared.current.project_id ? { projectId: prepared.current.project_id } : {}),
        initiativeId: payload.initiativeId,
        title: payload.title,
        description: payload.description,
        type: 'GO_NO_GO',
        decisionMakerId: payload.decisionMakerId,
        criteria: payload.criteria,
        ...(payload.deadline ? { deadline: payload.deadline } : {}),
        createdBy: params.actorUserId,
      });
      await withPgTransaction(async (client) => {
        const cols = await client.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name='decisions' AND column_name IN ('pmo_domain','trigger_status')`
        );
        const names = new Set(cols.rows.map((row) => row.column_name));
        if (names.has('pmo_domain'))
          await client.query(
            `UPDATE decisions SET pmo_domain='GOVERNANCE_DECISION_MAKING'${names.has('trigger_status') ? ",trigger_status='PORTFOLIO_DECISION'" : ''} WHERE id=? AND organization_id=?`,
            [decision.id, params.organizationId]
          );
        await client.query(
          `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,
            lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at)
           VALUES (?,?,?,'portfolio_decision','decision',?,?,'decision',?,?) ON CONFLICT DO NOTHING`,
          [
            uuidv4(),
            params.transformationCaseId,
            params.organizationId,
            decision.id,
            params.proposalId,
            params.actorUserId,
            new Date().toISOString(),
          ]
        );
        await client.query(
          `UPDATE transformation_portfolio_decision_packs SET decision_id=? WHERE proposal_id=? AND organization_id=? AND decision_id IS NULL`,
          [decision.id, params.proposalId, params.organizationId]
        );
      });
      return {
        artifactType: 'decision',
        artifactId: decision.id,
        module: 'Decisions',
        operation: 'create',
        data: { proposalId: params.proposalId },
      };
    },
    readback: async (artifactId) =>
      queryOne<Record<string, unknown>>(
        `SELECT d.id,d.organization_id,d.status,d.type,d.initiative_id,l.source_proposal_id
           FROM decisions d JOIN transformation_case_artifact_links l
             ON l.artifact_id=d.id AND l.organization_id=d.organization_id
          WHERE d.id=? AND d.organization_id=? AND l.transformation_case_id=?
            AND l.source_proposal_id=? AND l.artifact_type='decision'`,
        [artifactId, params.organizationId, params.transformationCaseId, params.proposalId]
      ),
  });
  const decisionId = dispatched.normalizedResult.artifactId;
  const appliedAt = new Date().toISOString();
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE transformation_stage_proposals SET status='applied',applied_at=?,updated_at=?
        WHERE proposal_id=? AND organization_id=? AND status='approved'`,
      [appliedAt, appliedAt, params.proposalId, params.organizationId]
    );
    const existingAudit = await client.query<{ audit_event_id: string }>(
      `SELECT audit_event_id FROM transformation_case_audit_events
        WHERE transformation_case_id=? AND organization_id=?
          AND event_type='transformation_portfolio.decision_created'
          AND detail_json->>'proposalId'=? LIMIT 1`,
      [params.transformationCaseId, params.organizationId, params.proposalId]
    );
    if (!existingAudit.rows[0])
      await client.query(
        `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_portfolio.decision_created',?,?,?,?::jsonb,?)`,
        [
          uuidv4(),
          params.transformationCaseId,
          params.organizationId,
          prepared.proposal.plan_id,
          prepared.proposal.plan_version,
          params.actorUserId,
          params.correlationId ?? null,
          prepared.proposal.payload_digest,
          JSON.stringify({
            proposalId: params.proposalId,
            decisionId,
            adapterInvocationId: dispatched.invocationId,
            idempotentReplay: dispatched.idempotentReplay,
          }),
          appliedAt,
        ]
      );
  });
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
    [params.proposalId]
  );
  if (!row) throw new Error('Applied portfolio proposal not readable');
  return portfolioDecisionFromRow(row);
}

export async function resolvePortfolioDecision(
  params: ResolvePortfolioDecisionParams
): Promise<PortfolioDecisionResolutionReceipt> {
  const input = ResolvePortfolioDecisionSchema.parse(params);
  const idempotencyKey = String(params.idempotencyKey || '').trim();
  if (!idempotencyKey)
    throw new TransformationCaseOperationError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  const requestDigest = createHash('sha256')
    .update(
      JSON.stringify({
        transformationCaseId: params.transformationCaseId,
        expectedVersion: input.expectedVersion,
        evidenceDigest: input.evidenceDigest,
        selectedOption: input.selectedOption,
        rationale: input.rationale,
      })
    )
    .digest('hex');
  return withPgTransaction(async (client) => {
    // Serialize the whole idempotency decision before the first receipt read.
    // Under READ COMMITTED a contender that queried before the winner committed
    // would otherwise keep executing after the Case lock and reject the now
    // terminal Decision instead of replaying the just-committed receipt.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?),hashtext(?))`, [
      params.organizationId,
      idempotencyKey,
    ]);
    const replay = (
      await client.query<any>(
        `SELECT * FROM transformation_portfolio_decision_receipts WHERE organization_id=? AND idempotency_key=? FOR UPDATE`,
        [params.organizationId, idempotencyKey]
      )
    ).rows[0];
    if (replay) {
      if (replay.request_digest !== requestDigest)
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_DECISION_IDEMPOTENCY_CONFLICT',
          409,
          'Idempotency-Key payload conflict'
        );
      return {
        receiptId: replay.receipt_id,
        decisionId: replay.decision_id,
        packId: replay.pack_id,
        evidenceDigest: replay.evidence_digest,
        sourceCaseVersion: Number(replay.source_case_version),
        selectedOption: replay.selected_option,
        decidedByUserId: replay.decided_by_user_id,
        authorizationType: replay.authorization_type,
        createdAt: replay.created_at,
        idempotentReplay: true,
      };
    }
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    const record = (
      await client.query<any>(
        `SELECT d.*,p.pack_id,p.evidence_digest,p.case_version
         FROM transformation_portfolio_decision_packs p
         JOIN decisions d ON d.id=p.decision_id AND d.organization_id=p.organization_id
        WHERE p.transformation_case_id=? AND p.organization_id=? FOR UPDATE OF p,d`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!record)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DECISION_PACK_NOT_FOUND',
        404,
        'Decision evidence pack not found'
      );
    if (
      record.evidence_digest !== input.evidenceDigest ||
      Number(record.case_version) > current.version
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DECISION_PACK_DRIFT',
        409,
        'Decision evidence pack digest/version mismatch'
      );
    if (!['pending', 'escalated'].includes(String(record.status).toLowerCase()))
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DECISION_ALREADY_RESOLVED',
        409,
        'Decision is already resolved'
      );
    let authorizationType: 'decision_maker' | 'durable_delegation' = 'decision_maker';
    if (record.decision_maker_id !== params.actorUserId) {
      const delegated = (
        await client.query<{ id: string }>(
          `SELECT id FROM decision_delegations WHERE decision_id=? AND organization_id=? AND from_user_id=? AND to_user_id=?
          AND status='accepted' AND delegation_type IN ('full','co_decide')
          AND (expires_at IS NULL OR expires_at::timestamptz>NOW()) LIMIT 1 FOR SHARE`,
          [record.id, params.organizationId, record.decision_maker_id, params.actorUserId]
        )
      ).rows[0];
      if (!delegated)
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_DECISION_ACTOR_UNAUTHORIZED',
          403,
          'Only decision maker or durable delegate may resolve'
        );
      authorizationType = 'durable_delegation';
    }
    const now = new Date().toISOString();
    const status = input.selectedOption === 'go' ? 'approved' : 'rejected';
    await client.query(
      `UPDATE decisions SET status=?,selected_option=?,decision_rationale=?,decided_at=?,updated_at=? WHERE id=? AND organization_id=?`,
      [status, input.selectedOption, input.rationale, now, now, record.id, params.organizationId]
    );
    await client.query(
      `INSERT INTO decision_history (id,decision_id,action,old_status,new_status,changed_by,details,changed_at) VALUES (?,?,'decided',?,?,?,?,?::timestamptz)`,
      [
        uuidv4(),
        record.id,
        record.status,
        status,
        params.actorUserId,
        JSON.stringify({
          evidenceDigest: input.evidenceDigest,
          selectedOption: input.selectedOption,
        }),
        now,
      ]
    );
    const receiptId = uuidv4();
    await client.query(
      `INSERT INTO transformation_portfolio_decision_receipts
      (receipt_id,transformation_case_id,organization_id,decision_id,pack_id,evidence_digest,source_case_version,idempotency_key,request_digest,selected_option,rationale,decided_by_user_id,authorization_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        receiptId,
        current.transformation_case_id,
        current.organization_id,
        record.id,
        record.pack_id,
        record.evidence_digest,
        current.version,
        idempotencyKey,
        requestDigest,
        input.selectedOption,
        input.rationale,
        params.actorUserId,
        authorizationType,
        now,
      ]
    );
    return {
      receiptId,
      decisionId: record.id,
      packId: record.pack_id,
      evidenceDigest: record.evidence_digest,
      sourceCaseVersion: current.version,
      selectedOption: input.selectedOption,
      decidedByUserId: params.actorUserId,
      authorizationType,
      createdAt: now,
    };
  });
}

async function acceptPortfolioDecisionResultsInner(
  params: AcceptPortfolioDecisionResultsParams
): Promise<AcceptedPortfolioDecisionResults> {
  const input = AcceptPortfolioDecisionResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedPortfolioDecisionResults>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'portfolio_decision_results',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    const result = (
      await client.query<{
        decision_id: string;
        decision_status: string;
        selected_option: string | null;
        receipt_id: string | null;
        receipt_digest: string | null;
        pack_digest: string | null;
        receipt_case_version: number | null;
        initiative_id: string;
        initiative_status: string;
      }>(
        `SELECT d.id decision_id,d.status decision_status,d.selected_option,
                r.receipt_id,r.evidence_digest receipt_digest,p.evidence_digest pack_digest,
                r.source_case_version receipt_case_version,
                i.id initiative_id,i.status initiative_status
           FROM transformation_case_artifact_links ld
           JOIN decisions d ON d.id=ld.artifact_id AND d.organization_id=ld.organization_id
           JOIN transformation_portfolio_decision_packs p ON p.decision_id=d.id AND p.organization_id=d.organization_id
           LEFT JOIN transformation_portfolio_decision_receipts r ON r.decision_id=d.id AND r.pack_id=p.pack_id AND r.organization_id=d.organization_id
           JOIN transformation_case_artifact_links li ON li.transformation_case_id=ld.transformation_case_id AND li.artifact_type='initiative'
           JOIN initiatives i ON i.id=li.artifact_id AND i.organization_id=li.organization_id
          WHERE ld.transformation_case_id=? AND ld.organization_id=? AND ld.artifact_type='decision' LIMIT 1`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (
      !result ||
      !result.receipt_id ||
      result.receipt_digest !== result.pack_digest ||
      Number(result.receipt_case_version) !== input.expectedVersion ||
      result.decision_status !== 'approved' ||
      String(result.selected_option || '').toLowerCase() !== 'go'
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_PORTFOLIO_GO_NOT_APPROVED',
        409,
        'Current GO/NO-GO decision requires an exact authorized evidence receipt with GO'
      );
    if (result.initiative_status !== 'APPROVED')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_PORTFOLIO_APPROVED',
        409,
        'Canonical Initiative lifecycle must reach APPROVED before mobilization'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'portfolio_decision_results',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: {
        decisionId: result.decision_id,
        initiativeId: result.initiative_id,
        receiptId: result.receipt_id,
        evidenceDigest: result.receipt_digest,
      },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Portfolio result acceptance: ${gate.blockedReason}`
      );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='mobilization',version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(
        JSON.stringify({ decisionId: result.decision_id, initiativeId: result.initiative_id })
      )
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_portfolio.results_accepted',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          decisionId: result.decision_id,
          initiativeId: result.initiative_id,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'mobilization' as const,
      initiativeId: result.initiative_id,
      decisionId: result.decision_id,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

type MobilizationPayload = Omit<
  MobilizationBlueprintProposal,
  | 'proposalId'
  | 'transformationCaseId'
  | 'status'
  | 'blueprintId'
  | 'taskIds'
  | 'milestoneIds'
  | 'resourceIds'
  | 'createdAt'
  | 'updatedAt'
>;
async function mobilizationFromRow(row: StageProposalRow): Promise<MobilizationBlueprintProposal> {
  const payload = jsonValue<MobilizationPayload>(row.payload_json, {} as MobilizationPayload);
  const links = await queryAll<{ artifact_type: string; artifact_id: string }>(
    `SELECT artifact_type,artifact_id FROM transformation_case_artifact_links WHERE source_proposal_id=? AND artifact_type IN ('initiative_blueprint','initiative_task','initiative_milestone','initiative_resource')`,
    [row.proposal_id]
  );
  const ids = (type: string) =>
    links.filter((link) => link.artifact_type === type).map((link) => link.artifact_id);
  const blueprintId = ids('initiative_blueprint')[0];
  const ownerReceipt = await queryOne<any>(
    `SELECT raid_item_ids_json,calendar_item_ids_json,monitoring_definition_id FROM transformation_mobilization_owner_receipts WHERE organization_id=? AND proposal_id=?`,
    [row.organization_id, row.proposal_id]
  ).catch(() => null);
  return {
    proposalId: row.proposal_id,
    transformationCaseId: row.transformation_case_id,
    status: row.status,
    ...payload,
    ...(blueprintId ? { blueprintId } : {}),
    taskIds: ids('initiative_task'),
    milestoneIds: ids('initiative_milestone'),
    resourceIds: ids('initiative_resource'),
    raidItemIds: jsonValue<string[]>(ownerReceipt?.raid_item_ids_json, []),
    calendarItemIds: jsonValue<string[]>(ownerReceipt?.calendar_item_ids_json, []),
    ...(ownerReceipt?.monitoring_definition_id
      ? { monitoringDefinitionId: ownerReceipt.monitoring_definition_id }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function proposeMobilizationBlueprint(
  params: ProposeMobilizationBlueprintParams
): Promise<MobilizationBlueprintProposal> {
  const input = ProposeMobilizationBlueprintSchema.parse(params);
  const proposalId = uuidv4();
  const now = new Date().toISOString();
  await withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'mobilization')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_MOBILIZATION_STAGE_NOT_ACTIVE',
        409,
        'Approved portfolio GO is required before mobilization'
      );
    const initiative = (
      await client.query<{ id: string; name: string }>(
        `SELECT i.id,i.name FROM transformation_case_artifact_links l JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative' LIMIT 1`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!initiative)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_FOUND',
        409,
        'Case-linked Initiative not found'
      );
    const midpoint = new Date(
      (new Date(`${input.startDate}T00:00:00Z`).getTime() +
        new Date(`${input.endDate}T00:00:00Z`).getTime()) /
        2
    )
      .toISOString()
      .slice(0, 10);
    const wbs = [
      {
        key: 'kickoff',
        title: 'Mobilize team and freeze scope',
        description: 'Confirm owners, scope, governance cadence and delivery baseline.',
        ownerId: input.ownerUserId,
        dueDate: input.startDate,
        acceptanceCriteria: 'Named owners, approved scope and baseline published.',
      },
      {
        key: 'pilot',
        title: 'Execute and validate pilot',
        description: 'Deliver the priority operational change and collect KPI evidence.',
        ownerId: input.ownerUserId,
        dueDate: midpoint,
        acceptanceCriteria: 'Pilot accepted with measured KPI evidence.',
      },
      {
        key: 'rollout',
        title: 'Roll out and hand over',
        description: 'Scale the validated change, close delivery and transfer operating ownership.',
        ownerId: input.ownerUserId,
        dueDate: input.endDate,
        acceptanceCriteria: 'Rollout accepted, owners trained and benefits tracking active.',
      },
    ];
    const payload: MobilizationPayload = {
      initiativeId: initiative.id,
      ownerUserId: input.ownerUserId,
      startDate: input.startDate,
      endDate: input.endDate,
      wbs,
      milestones: [
        {
          name: 'Mobilization complete',
          description: 'Team, scope and baseline ready.',
          targetDate: input.startDate,
          isGate: true,
        },
        {
          name: 'Pilot accepted',
          description: 'Pilot result and KPI evidence reviewed.',
          targetDate: midpoint,
          isGate: true,
        },
        {
          name: 'Rollout complete',
          description: 'Delivery handed over to operations.',
          targetDate: input.endDate,
          isGate: true,
        },
      ],
      dependencies: [
        { from: 'kickoff', to: 'pilot', type: 'hard' },
        { from: 'pilot', to: 'rollout', type: 'hard' },
      ],
      raidItems: input.raidItems ?? [
        {
          type: 'risk',
          title: 'Delivery capacity risk',
          description: 'Capacity may be insufficient for the committed rollout.',
          probability: 'medium',
          impact: 'high',
          ownerUserId: input.ownerUserId,
          dueDate: midpoint,
          response: 'Review capacity weekly and escalate variance before the pilot gate.',
        },
        {
          type: 'assumption',
          title: 'Owner availability assumption',
          description: 'The named owner remains available through handover.',
          probability: 'medium',
          impact: 'high',
          ownerUserId: input.ownerUserId,
          dueDate: input.startDate,
          response: 'Confirm allocation at kickoff and nominate a delegate.',
        },
        {
          type: 'issue',
          title: 'Baseline evidence readiness',
          description: 'Baseline evidence must be complete before pilot comparison.',
          probability: 'low',
          impact: 'high',
          ownerUserId: input.ownerUserId,
          dueDate: input.startDate,
          response: 'Close missing baseline evidence during mobilization.',
        },
        {
          type: 'dependency',
          title: 'Governance decision dependency',
          description: 'Stage gates depend on timely owner review.',
          probability: 'medium',
          impact: 'critical',
          ownerUserId: input.ownerUserId,
          dueDate: midpoint,
          response: 'Reserve weekly decision windows and escalate overdue reviews.',
        },
      ],
      monitoring: input.monitoring ?? {
        cadence: 'weekly',
        timezone: 'UTC',
        firstRunAt: `${input.startDate}T09:00:00.000Z`,
        ownerUserId: input.ownerUserId,
      },
      resources: [
        {
          userId: input.ownerUserId,
          name: 'Initiative Owner',
          role: 'lead',
          allocationPercentage: 100,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      ],
    };
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const governedProposalVersionId = await registerStageShadowProposal(client, {
      current,
      proposalId,
      stage: 'mobilization',
      payload: payload as unknown as Record<string, unknown>,
      reviewerUserIds: [current.initiated_by_user_id, input.ownerUserId],
      actorUserId: params.actorUserId,
    });
    await client.query(
      `INSERT INTO transformation_stage_proposals (proposal_id,transformation_case_id,organization_id,plan_id,plan_version,lifecycle_stage,proposal_type,status,payload_json,payload_digest,proposed_by_user_id,governed_proposal_version_id,created_at,updated_at) VALUES (?,?,?,?,?,'mobilization','apply_mobilization_blueprint','pending_review',?::jsonb,?,?,?,?,?)`,
      [
        proposalId,
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        JSON.stringify(payload),
        digest,
        params.actorUserId,
        governedProposalVersionId,
        now,
        now,
      ]
    );
    await client.query(
      `UPDATE transformation_cases SET version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [now, current.transformation_case_id, current.organization_id]
    );
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_mobilization.proposed',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ proposalId, businessArtifactsCreated: false }),
        now,
      ]
    );
  });
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
    [proposalId]
  );
  if (!row) throw new Error('Mobilization proposal not readable');
  return mobilizationFromRow(row);
}

export async function getMobilizationBlueprintProposal(
  transformationCaseId: string,
  organizationId: string
): Promise<MobilizationBlueprintProposal | null> {
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE transformation_case_id=? AND organization_id=? AND proposal_type='apply_mobilization_blueprint' ORDER BY created_at DESC LIMIT 1`,
    [transformationCaseId, organizationId]
  );
  return row ? mobilizationFromRow(row) : null;
}

export async function reviewMobilizationBlueprint(
  params: ReviewMobilizationBlueprintParams
): Promise<MobilizationBlueprintProposal> {
  const input = ReviewMobilizationBlueprintSchema.parse(params);
  const now = new Date().toISOString();
  const prepared = await withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const proposal = (
      await client.query<StageProposalRow>(
        `SELECT * FROM transformation_stage_proposals WHERE proposal_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.proposalId, current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!proposal || proposal.proposal_type !== 'apply_mobilization_blueprint')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_MOBILIZATION_PROPOSAL_NOT_FOUND',
        404,
        'Mobilization proposal not found'
      );
    const resumableApproval =
      proposal.status === 'approved' && current.version === input.expectedVersion + 1;
    if (current.version !== input.expectedVersion && !resumableApproval)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (['applied', 'rejected'].includes(proposal.status))
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_MOBILIZATION_PROPOSAL_ALREADY_REVIEWED',
        409,
        `Proposal is already ${proposal.status}`
      );
    if (proposal.status === 'pending_review') {
      const status = input.decision === 'approve' ? 'approved' : 'rejected';
      const governed = await enforceStageCommonDecision(client, {
        current,
        proposal,
        actorUserId: params.actorUserId,
        decision: input.decision,
        reason: input.reason,
      });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
      await client.query(
        `UPDATE transformation_stage_proposals SET status=?,reviewed_by_user_id=?,review_reason=?,reviewed_at=?,updated_at=? WHERE proposal_id=?`,
        [status, params.actorUserId, input.reason, now, now, proposal.proposal_id]
      );
      await client.query(
        `UPDATE transformation_cases SET version=version+1,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
        [now, current.transformation_case_id, current.organization_id]
      );
      await recordStageShadowParity(client, {
        current,
        proposal,
        legacyStatus: status,
        governedStatus: governed.status,
        actorUserId: params.actorUserId,
        correlationId: params.correlationId,
        now,
      });
      if (input.decision === 'reject')
        return { current, proposal, rejected: true, governanceBlocked: null };
    } else if (input.decision !== 'approve')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_MOBILIZATION_DECISION_INVALID',
        409,
        'Approved proposal can only be resumed with approve'
      );
    else {
      const governed = await assertStageShadowExecutable(client, { current, proposal });
      if (governed.blockedReason)
        return { current, proposal, rejected: false, governanceBlocked: governed.blockedReason };
    }
    return { current, proposal, rejected: false, governanceBlocked: null };
  });
  if (prepared.governanceBlocked)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_A05_GOVERNANCE_BLOCKED',
      409,
      `Common proposal governance blocked Mobilization materialization: ${prepared.governanceBlocked}`
    );
  if (prepared.rejected) {
    const row = await queryOne<StageProposalRow>(
      `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
      [params.proposalId]
    );
    if (!row) throw new Error('Rejected mobilization proposal not readable');
    return mobilizationFromRow(row);
  }
  const payload = jsonValue<MobilizationPayload>(
    prepared.proposal.payload_json,
    {} as MobilizationPayload
  );
  const dispatched = await dispatchT01StageMaterialization({
    current: prepared.current,
    proposal: prepared.proposal,
    actorUserId: params.actorUserId,
    toolName: 'transformation.mobilization.materialize',
    execute: async () => {
      let existing = await getMobilizationBlueprintProposal(
        params.transformationCaseId,
        params.organizationId
      );
      let blueprintId = existing?.blueprintId;
      if (!blueprintId) {
        const { initiativeGovernanceService } = await import('../initiativeGovernanceService.js');
        const created = await initiativeGovernanceService.createBlueprint(params.organizationId, {
          initiativeId: payload.initiativeId,
          promptText: 'Transformation Case mobilization blueprint',
          generatedWbs: payload.wbs,
          generatedMilestones: payload.milestones,
          generatedDeps: payload.dependencies,
          generatedResources: payload.resources,
          citations: [
            `transformation-case:${params.transformationCaseId}`,
            `proposal:${params.proposalId}`,
          ],
          aiModelUsed: 'consultify-transformation-v1',
          confidence: 1,
          createdBy: params.actorUserId,
        });
        blueprintId = created.id;
        await withPgTransaction((client) =>
          client.query(
            `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'mobilization','initiative_blueprint',?,?,'output',?,?) ON CONFLICT DO NOTHING`,
            [
              uuidv4(),
              params.transformationCaseId,
              params.organizationId,
              blueprintId,
              params.proposalId,
              params.actorUserId,
              new Date().toISOString(),
            ]
          )
        );
      }
      existing = await getMobilizationBlueprintProposal(
        params.transformationCaseId,
        params.organizationId
      );
      if (!existing?.taskIds?.length) {
        const { initiativeGovernanceService } = await import('../initiativeGovernanceService.js');
        const applied = await initiativeGovernanceService.applyBlueprint(
          params.organizationId,
          blueprintId,
          params.actorUserId
        );
        if (!applied.ok)
          throw new TransformationCaseOperationError(
            'TRANSFORMATION_MOBILIZATION_APPLY_FAILED',
            409,
            `Blueprint apply failed: ${applied.reason ?? 'unknown'}`
          );
        const groups: [string, string[]][] = [
          ['initiative_task', applied.createdTaskIds ?? []],
          ['initiative_milestone', applied.createdMilestoneIds ?? []],
          ['initiative_resource', applied.createdResourceIds ?? []],
        ];
        await withPgTransaction(async (client) => {
          for (const [type, ids] of groups)
            for (const id of ids)
              await client.query(
                `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'mobilization',?,?,?,'output',?,?) ON CONFLICT DO NOTHING`,
                [
                  uuidv4(),
                  params.transformationCaseId,
                  params.organizationId,
                  type,
                  id,
                  params.proposalId,
                  params.actorUserId,
                  new Date().toISOString(),
                ]
              );
        });
      }
      const receipt = await getMobilizationBlueprintProposal(
        params.transformationCaseId,
        params.organizationId
      );
      const { materializeMobilizationOwners } =
        await import('./transformationMobilizationOwnerAdapterService.js');
      const ownerReceipt = await materializeMobilizationOwners({
        organizationId: params.organizationId,
        transformationCaseId: params.transformationCaseId,
        initiativeId: payload.initiativeId,
        proposalId: params.proposalId,
        payloadDigest: prepared.proposal.payload_digest,
        actorUserId: params.actorUserId,
        raidItems: payload.raidItems,
        monitoring: payload.monitoring,
      });
      return {
        artifactType: 'mobilization_materialization_receipt',
        artifactId: params.proposalId,
        module: 'Initiatives',
        operation: 'apply_blueprint',
        data: {
          blueprintId,
          taskIds: receipt?.taskIds ?? [],
          milestoneIds: receipt?.milestoneIds ?? [],
          resourceIds: receipt?.resourceIds ?? [],
          raidItemIds: [...ownerReceipt.raidItemIds].sort(),
          calendarItemIds: [...ownerReceipt.calendarItemIds].sort(),
          monitoringDefinitionId: ownerReceipt.monitoringDefinitionId,
        },
      };
    },
    readback: async () => {
      const receipt = await getMobilizationBlueprintProposal(
        params.transformationCaseId,
        params.organizationId
      );
      const ownerReceipt = await queryOne<any>(
        `SELECT raid_item_ids_json,calendar_item_ids_json,monitoring_definition_id FROM transformation_mobilization_owner_receipts WHERE organization_id=? AND proposal_id=?`,
        [params.organizationId, params.proposalId]
      );
      if (
        !receipt?.blueprintId ||
        !receipt.taskIds.length ||
        !receipt.milestoneIds.length ||
        !receipt.resourceIds.length ||
        !ownerReceipt
      )
        return null;
      return {
        proposalId: params.proposalId,
        blueprintId: receipt.blueprintId,
        taskIds: [...receipt.taskIds].sort(),
        milestoneIds: [...receipt.milestoneIds].sort(),
        resourceIds: [...receipt.resourceIds].sort(),
        raidItemIds: jsonValue<string[]>(ownerReceipt.raid_item_ids_json, []).sort(),
        calendarItemIds: jsonValue<string[]>(ownerReceipt.calendar_item_ids_json, []).sort(),
        monitoringDefinitionId: ownerReceipt.monitoring_definition_id,
      };
    },
  });
  const blueprintId = String(dispatched.normalizedResult.data.blueprintId);
  const appliedAt = new Date().toISOString();
  await withPgTransaction(async (client) => {
    await client.query(
      `UPDATE transformation_stage_proposals SET status='applied',applied_at=?,updated_at=? WHERE proposal_id=?`,
      [appliedAt, appliedAt, params.proposalId]
    );
    const auditExists = await client.query<{ audit_event_id: string }>(
      `SELECT audit_event_id FROM transformation_case_audit_events WHERE transformation_case_id=?
        AND organization_id=? AND event_type='transformation_mobilization.blueprint_applied'
        AND detail_json->>'proposalId'=? LIMIT 1`,
      [params.transformationCaseId, params.organizationId, params.proposalId]
    );
    if (!auditExists.rows[0])
      await client.query(
        `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_mobilization.blueprint_applied',?,?,?,?::jsonb,?)`,
        [
          uuidv4(),
          params.transformationCaseId,
          params.organizationId,
          prepared.proposal.plan_id,
          prepared.proposal.plan_version,
          params.actorUserId,
          params.correlationId ?? null,
          prepared.proposal.payload_digest,
          JSON.stringify({ proposalId: params.proposalId, blueprintId }),
          appliedAt,
        ]
      );
  });
  const row = await queryOne<StageProposalRow>(
    `SELECT * FROM transformation_stage_proposals WHERE proposal_id=?`,
    [params.proposalId]
  );
  if (!row) throw new Error('Applied mobilization proposal not readable');
  return mobilizationFromRow(row);
}

async function acceptMobilizationResultsInner(
  params: AcceptMobilizationResultsParams
): Promise<AcceptedMobilizationResults> {
  const input = AcceptMobilizationResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedMobilizationResults>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'mobilization_results',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    const result = (
      await client.query<{
        initiative_id: string;
        initiative_status: string;
        blueprint_id: string;
        blueprint_status: string;
        task_count: number;
        milestone_count: number;
        resource_count: number;
      }>(
        `SELECT i.id initiative_id,i.status initiative_status,b.id blueprint_id,b.status blueprint_status,(SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=i.id) task_count,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=i.id) milestone_count,(SELECT COUNT(*)::int FROM initiative_resources r WHERE r.initiative_id=i.id) resource_count FROM transformation_case_artifact_links li JOIN initiatives i ON i.id=li.artifact_id AND i.organization_id=li.organization_id JOIN transformation_case_artifact_links lb ON lb.transformation_case_id=li.transformation_case_id AND lb.artifact_type='initiative_blueprint' JOIN initiative_ai_blueprints b ON b.id=lb.artifact_id AND b.organization_id=lb.organization_id WHERE li.transformation_case_id=? AND li.organization_id=? AND li.artifact_type='initiative' LIMIT 1`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (
      !result ||
      result.blueprint_status !== 'applied' ||
      result.task_count < 1 ||
      result.milestone_count < 1 ||
      result.resource_count < 1
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_MOBILIZATION_INCOMPLETE',
        409,
        'Applied blueprint with tasks, milestones and resources is required'
      );
    if (result.initiative_status !== 'SCHEDULED')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_SCHEDULED',
        409,
        'Canonical Initiative lifecycle must reach SCHEDULED before execution'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'mobilization_results',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: {
        initiativeId: result.initiative_id,
        blueprintId: result.blueprint_id,
        taskCount: result.task_count,
        milestoneCount: result.milestone_count,
        resourceCount: result.resource_count,
      },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Mobilization result acceptance: ${gate.blockedReason}`
      );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='execution',version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(JSON.stringify({ blueprintId: result.blueprint_id }))
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_mobilization.results_accepted',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          blueprintId: result.blueprint_id,
          taskCount: result.task_count,
          milestoneCount: result.milestone_count,
          resourceCount: result.resource_count,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'execution' as const,
      initiativeId: result.initiative_id,
      blueprintId: result.blueprint_id,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

export async function getExecutionCheckpoint(
  transformationCaseId: string,
  organizationId: string
): Promise<ExecutionCheckpoint> {
  const row = await queryOne<{
    initiative_id: string;
    initiative_status: string;
    task_total: number;
    task_completed: number;
    task_blocked: number;
    milestone_total: number;
    milestone_completed: number;
    milestone_delayed: number;
    kpi_total: number;
    kpi_on_target: number;
    execution_started: number;
  }>(
    `SELECT i.id initiative_id,i.status initiative_status,(SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=i.id) task_total,(SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=i.id AND UPPER(t.status) IN ('DONE','COMPLETED')) task_completed,(SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=i.id AND UPPER(t.status)='BLOCKED') task_blocked,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=i.id) milestone_total,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=i.id AND UPPER(m.status)='COMPLETED') milestone_completed,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=i.id AND UPPER(m.status)='DELAYED') milestone_delayed,(SELECT COUNT(*)::int FROM initiative_kpis k WHERE k.initiative_id=i.id AND k.organization_id=?) kpi_total,(SELECT COUNT(*)::int FROM initiative_kpis k WHERE k.initiative_id=i.id AND k.organization_id=? AND k.current_value IS NOT NULL AND k.target_value IS NOT NULL AND ((k.direction='LOWER_IS_BETTER' AND k.current_value<=k.target_value) OR (COALESCE(k.direction,'HIGHER_IS_BETTER')='HIGHER_IS_BETTER' AND k.current_value>=k.target_value))) kpi_on_target,(SELECT COUNT(*)::int FROM transformation_case_artifact_links s WHERE s.transformation_case_id=? AND s.organization_id=? AND s.artifact_type='execution_start_receipt') execution_started FROM transformation_case_artifact_links l JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative' LIMIT 1`,
    [
      organizationId,
      organizationId,
      transformationCaseId,
      organizationId,
      transformationCaseId,
      organizationId,
    ]
  );
  if (!row)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_INITIATIVE_NOT_FOUND',
      404,
      'Case-linked Initiative not found'
    );
  return {
    transformationCaseId,
    initiativeId: row.initiative_id,
    initiativeStatus: row.initiative_status,
    tasks: {
      total: Number(row.task_total),
      completed: Number(row.task_completed),
      blocked: Number(row.task_blocked),
    },
    milestones: {
      total: Number(row.milestone_total),
      completed: Number(row.milestone_completed),
      delayed: Number(row.milestone_delayed),
    },
    kpis: { total: Number(row.kpi_total), onTarget: Number(row.kpi_on_target) },
    executionStarted: Number(row.execution_started) > 0,
  };
}

async function acceptExecutionStartInner(
  params: AcceptExecutionStartParams
): Promise<AcceptedExecutionStart> {
  const input = AcceptExecutionStartSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedExecutionStart>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'execution_start',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    await assertExecutionContext(current, params.actorUserId, client);
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'execution')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_EXECUTION_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not ready for execution'
      );
    const initiative = (
      await client.query<{ id: string; status: string }>(
        `SELECT i.id,i.status FROM transformation_case_artifact_links l JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative' LIMIT 1`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!initiative || initiative.status !== 'EXECUTING')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_EXECUTING',
        409,
        'Canonical Initiative lifecycle must reach EXECUTING'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'execution_start',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: { initiativeId: initiative.id, initiativeStatus: initiative.status },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Execution start: ${gate.blockedReason}`
      );
    await client.query(
      `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'execution','execution_start_receipt',?,'decision',?,?) ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        initiative.id,
        params.actorUserId,
        acceptedAt,
      ]
    );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256')
      .update(JSON.stringify({ initiativeId: initiative.id, status: initiative.status }))
      .digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_execution.started',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({ decisionReason: input.decisionReason, nextCaseVersion: nextVersion }),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'execution' as const,
      initiativeId: initiative.id,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

async function assertExecutionContext(
  current: CaseRow,
  actorUserId: string,
  client: import('../../utils/queryHelpers.js').PgTransactionClient
): Promise<void> {
  const contextDecision = await retrieveAndRevalidateTransformationContext({
    transformationCaseId: current.transformation_case_id,
    organizationId: current.organization_id,
    actorUserId,
    policy: {
      allowedModules: [
        'Vault',
        'Knowledge',
        'Ideas',
        'Interview',
        'Assessments',
        'Initiatives',
        'Finance',
        'KPI',
      ],
      allowedArtifactIds: [],
      projectId: current.project_id,
      maxResults: 50,
      maxWorkingMemoryChars: 50_000,
    },
    client,
  });
  if (contextDecision.decision !== 'allowed')
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_CONTEXT_REVALIDATION_BLOCKED',
      409,
      contextDecision.reason
    );
}

async function acceptExecutionResultsInner(
  params: AcceptExecutionResultsParams
): Promise<AcceptedExecutionResults> {
  const input = AcceptExecutionResultsSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedExecutionResults>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'execution_results',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    await assertExecutionContext(current, params.actorUserId, client);
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'execution')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_EXECUTION_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not ready to accept execution results'
      );
    const initiative = (
      await client.query<{ id: string; status: string }>(
        `SELECT i.id,i.status FROM transformation_case_artifact_links l JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative' LIMIT 1 FOR UPDATE OF i`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!initiative)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_FOUND',
        404,
        'Case-linked Initiative not found'
      );
    await client.query(`SELECT id FROM tasks WHERE initiative_id=? FOR SHARE`, [initiative.id]);
    await client.query(`SELECT id FROM initiative_milestones WHERE initiative_id=? FOR SHARE`, [
      initiative.id,
    ]);
    await client.query(
      `SELECT link_id FROM transformation_case_artifact_links WHERE transformation_case_id=? AND organization_id=? AND artifact_type='execution_start_receipt' FOR SHARE`,
      [current.transformation_case_id, current.organization_id]
    );
    const counts = (
      await client.query<{
        task_total: number;
        task_completed: number;
        task_blocked: number;
        milestone_total: number;
        milestone_completed: number;
        milestone_delayed: number;
        kpi_total: number;
        kpi_on_target: number;
        execution_started: number;
      }>(
        `SELECT (SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=?) task_total,(SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=? AND UPPER(t.status) IN ('DONE','COMPLETED')) task_completed,(SELECT COUNT(*)::int FROM tasks t WHERE t.initiative_id=? AND UPPER(t.status)='BLOCKED') task_blocked,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=?) milestone_total,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=? AND UPPER(m.status)='COMPLETED') milestone_completed,(SELECT COUNT(*)::int FROM initiative_milestones m WHERE m.initiative_id=? AND UPPER(m.status)='DELAYED') milestone_delayed,(SELECT COUNT(*)::int FROM initiative_kpis k WHERE k.initiative_id=? AND k.organization_id=?) kpi_total,(SELECT COUNT(*)::int FROM initiative_kpis k WHERE k.initiative_id=? AND k.organization_id=? AND k.current_value IS NOT NULL AND k.target_value IS NOT NULL AND ((k.direction='LOWER_IS_BETTER' AND k.current_value<=k.target_value) OR (COALESCE(k.direction,'HIGHER_IS_BETTER')='HIGHER_IS_BETTER' AND k.current_value>=k.target_value))) kpi_on_target,(SELECT COUNT(*)::int FROM transformation_case_artifact_links s WHERE s.transformation_case_id=? AND s.organization_id=? AND s.artifact_type='execution_start_receipt') execution_started`,
        [
          initiative.id,
          initiative.id,
          initiative.id,
          initiative.id,
          initiative.id,
          initiative.id,
          initiative.id,
          current.organization_id,
          initiative.id,
          current.organization_id,
          current.transformation_case_id,
          current.organization_id,
        ]
      )
    ).rows[0];
    const checkpoint: ExecutionCheckpoint = {
      transformationCaseId: current.transformation_case_id,
      initiativeId: initiative.id,
      initiativeStatus: initiative.status,
      tasks: {
        total: Number(counts.task_total),
        completed: Number(counts.task_completed),
        blocked: Number(counts.task_blocked),
      },
      milestones: {
        total: Number(counts.milestone_total),
        completed: Number(counts.milestone_completed),
        delayed: Number(counts.milestone_delayed),
      },
      kpis: { total: Number(counts.kpi_total), onTarget: Number(counts.kpi_on_target) },
      executionStarted: Number(counts.execution_started) > 0,
    };
    if (!checkpoint.executionStarted)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_EXECUTION_NOT_STARTED',
        409,
        'Execution start must be accepted first'
      );
    if (checkpoint.initiativeStatus !== 'DONE')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_DONE',
        409,
        'Canonical Initiative lifecycle must reach DONE through closure approval'
      );
    if (
      checkpoint.tasks.total < 1 ||
      checkpoint.tasks.completed !== checkpoint.tasks.total ||
      checkpoint.milestones.total < 1 ||
      checkpoint.milestones.completed !== checkpoint.milestones.total
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_EXECUTION_WORK_INCOMPLETE',
        409,
        'All Case-linked Initiative tasks and milestones must be completed'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'execution_results',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: { checkpoint },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Execution results: ${gate.blockedReason}`
      );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='delivery',version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const digest = createHash('sha256').update(JSON.stringify(checkpoint)).digest('hex');
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_execution.results_accepted',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        digest,
        JSON.stringify({
          decisionReason: input.decisionReason,
          checkpoint,
          nextCaseVersion: nextVersion,
        }),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'delivery' as const,
      initiativeId: checkpoint.initiativeId,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

export async function getBenefitsCheckpoint(
  transformationCaseId: string,
  organizationId: string
): Promise<BenefitsCheckpoint> {
  const row = await queryOne<{
    initiative_id: string;
    benefit_total: number;
    benefit_measured: number;
    benefit_owned: number;
    benefit_achieved: number;
    benefit_at_risk: number;
    finance_total: number;
    finance_verified: number;
  }>(
    `SELECT i.id initiative_id,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=?) benefit_total,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=? AND b.current_value IS NOT NULL AND b.last_measured_at IS NOT NULL) benefit_measured,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=? AND b.owner_id IS NOT NULL) benefit_owned,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=? AND LOWER(b.status) IN ('achieved','exceeded')) benefit_achieved,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=? AND LOWER(b.status) IN ('at_risk','failed','missed')) benefit_at_risk,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=? AND b.estimated_annual_value IS NOT NULL) finance_total,
      (SELECT COUNT(*)::int FROM initiative_benefits b WHERE b.initiative_id=i.id AND b.organization_id=? AND b.estimated_annual_value IS NOT NULL AND b.actual_annual_value IS NOT NULL) finance_verified
     FROM transformation_case_artifact_links l
     JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id
     WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative'
     LIMIT 1`,
    [
      organizationId,
      organizationId,
      organizationId,
      organizationId,
      organizationId,
      organizationId,
      organizationId,
      transformationCaseId,
      organizationId,
    ]
  );
  if (!row)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_INITIATIVE_NOT_FOUND',
      404,
      'Case-linked Initiative not found'
    );
  return {
    transformationCaseId,
    initiativeId: row.initiative_id,
    benefits: {
      total: Number(row.benefit_total),
      measured: Number(row.benefit_measured),
      owned: Number(row.benefit_owned),
      achieved: Number(row.benefit_achieved),
      atRisk: Number(row.benefit_at_risk),
    },
    financeActuals: {
      total: Number(row.finance_total),
      verified: Number(row.finance_verified),
    },
  };
}

async function acceptDeliveryHandoffInner(
  params: AcceptDeliveryHandoffParams
): Promise<AcceptedDeliveryHandoff> {
  const input = AcceptDeliveryHandoffSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedDeliveryHandoff>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'delivery_handoff',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    await assertExecutionContext(current, params.actorUserId, client);
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'delivery')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_DELIVERY_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not ready for benefits handoff'
      );
    const initiative = (
      await client.query<{ id: string }>(
        `SELECT i.id FROM transformation_case_artifact_links l JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative' LIMIT 1 FOR UPDATE OF i`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (!initiative)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_INITIATIVE_NOT_FOUND',
        404,
        'Case-linked Initiative not found'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'delivery_handoff',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: {
        initiativeId: initiative.id,
        effectiveness: input.effectiveness,
        kpiActuals: input.kpiActuals,
      },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Delivery handoff: ${gate.blockedReason}`
      );
    const suppliedKpiIds = new Set<string>();
    for (const actual of input.kpiActuals) {
      if (suppliedKpiIds.has(actual.kpiId)) {
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_KPI_ACTUAL_DUPLICATE',
          400,
          `KPI actual supplied more than once: ${actual.kpiId}`
        );
      }
      suppliedKpiIds.add(actual.kpiId);
      const updated = await client.query(
        `UPDATE initiative_kpis k
            SET current_value=?,updated_at=?
          WHERE k.id=? AND k.initiative_id=? AND k.organization_id=?
            AND EXISTS (
              SELECT 1 FROM transformation_case_artifact_links l
               WHERE l.transformation_case_id=? AND l.organization_id=k.organization_id
                 AND l.artifact_type='initiative_kpi' AND l.artifact_id=k.id
            )`,
        [
          actual.value,
          acceptedAt,
          actual.kpiId,
          initiative.id,
          current.organization_id,
          current.transformation_case_id,
        ]
      );
      if (updated.rowCount !== 1) {
        throw new TransformationCaseOperationError(
          'TRANSFORMATION_KPI_ACTUAL_NOT_LINKED',
          404,
          `Case-linked KPI not found: ${actual.kpiId}`
        );
      }
      await client.query(
        `INSERT INTO kpi_measurements
          (id,kpi_id,value,measured_at,notes,created_by,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [
          uuidv4(),
          actual.kpiId,
          actual.value,
          actual.measuredAt,
          'Transformation delivery handoff actual',
          params.actorUserId,
          acceptedAt,
        ]
      );
    }
    const kpiActuals = await client.query<{
      id: string;
      current_value: number | null;
      last_measured_at: string | null;
    }>(
      `SELECT k.id,k.current_value,
              (SELECT MAX(m.measured_at) FROM kpi_measurements m WHERE m.kpi_id=k.id) last_measured_at
         FROM transformation_case_artifact_links l
         JOIN initiative_kpis k ON k.id=l.artifact_id AND k.organization_id=l.organization_id
        WHERE l.transformation_case_id=? AND l.organization_id=?
          AND l.artifact_type='initiative_kpi' FOR UPDATE OF k`,
      [current.transformation_case_id, current.organization_id]
    );
    if (
      !kpiActuals.rows.length ||
      kpiActuals.rows.some((kpi) => kpi.current_value === null || !kpi.last_measured_at)
    ) {
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_KPI_ACTUALS_INCOMPLETE',
        409,
        'Every case-linked KPI requires a canonical actual value and measurement timestamp'
      );
    }
    // U04 recovery cards. This block was nested inside the guard above, i.e.
    // after its `throw`: it could never run, and `openRecoveryCardIds` was
    // block-scoped there while the audit detail below reads it — a hard
    // ReferenceError on every accepted delivery handoff.
    const openRecoveryCardIds: string[] = [];
    {
      if (input.effectiveness === 'partial' || input.effectiveness === 'not_achieved') {
        for (const actual of kpiActuals.rows) {
          // node-postgres returns timestamptz columns as Date objects at
          // runtime even though the row type declares `string`, so
          // `String(...).slice(0,10)` yielded "Tue Sep 01" and Postgres
          // rejected it as a DATE (22007). Widen to unknown before narrowing.
          const measuredAt: unknown = actual.last_measured_at;
          const periodStart =
            measuredAt instanceof Date
              ? measuredAt.toISOString().slice(0, 10)
              : String(measuredAt).slice(0, 10);
          const deviationCaseId = uuidv4();
          const deviation = (
            await client.query<{ id: string }>(
              `INSERT INTO kpi_deviation_cases
               (id,kpi_id,organization_id,period_start,severity,status,owner_user_id,deviation_summary,detected_by)
             VALUES (?,?,?,?,'RED','OPEN',?,?,'transformation_delivery')
             ON CONFLICT (organization_id,kpi_id,period_start) DO UPDATE SET
               status='OPEN',updated_at=now(),deviation_summary=excluded.deviation_summary
             RETURNING id`,
              [
                deviationCaseId,
                actual.id,
                current.organization_id,
                periodStart,
                params.actorUserId,
                `Transformation result classified ${input.effectiveness}; recovery remains unresolved`,
              ]
            )
          ).rows[0];
          const recovery = (
            await client.query<{ id: string }>(
              `INSERT INTO kpi_recovery_cards
               (id,organization_id,deviation_case_id,kpi_id,hypothesis,impact_description,priority,lifecycle_status,created_by,updated_by)
             VALUES (?,?,?,?,?,?,'HIGH','ACTIVE',?,?)
             ON CONFLICT (deviation_case_id) DO UPDATE SET
               lifecycle_status='ACTIVE',decision=NULL,closed_at=NULL,closed_by=NULL,
               active_since=CASE WHEN kpi_recovery_cards.lifecycle_status='CLOSED' THEN now() ELSE kpi_recovery_cards.active_since END,
               version=kpi_recovery_cards.version+1,updated_by=excluded.updated_by,updated_at=now()
             RETURNING id`,
              [
                uuidv4(),
                current.organization_id,
                deviation.id,
                actual.id,
                `Result requires recovery validation (${input.effectiveness})`,
                'The delivery handoff did not confirm the intended result.',
                params.actorUserId,
                params.actorUserId,
              ]
            )
          ).rows[0];
          openRecoveryCardIds.push(recovery.id);
        }
      }
    }
    const benefits = await client.query<{
      id: string;
      current_value: number | null;
      last_measured_at: string | null;
      owner_id: string | null;
      estimated_annual_value: number | null;
      actual_annual_value: number | null;
    }>(
      `SELECT id,current_value,last_measured_at,owner_id,estimated_annual_value,actual_annual_value FROM initiative_benefits WHERE initiative_id=? AND organization_id=? FOR SHARE`,
      [initiative.id, current.organization_id]
    );
    if (!benefits.rows.length)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_BENEFITS_MISSING',
        409,
        'Closure handoff must create at least one canonical benefit'
      );
    if (
      benefits.rows.some(
        (benefit) =>
          benefit.current_value === null || !benefit.last_measured_at || !benefit.owner_id
      )
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_BENEFITS_MEASUREMENT_INCOMPLETE',
        409,
        'Every benefit requires an owner, actual measurement and measurement timestamp'
      );
    if (
      benefits.rows.some(
        (benefit) => benefit.estimated_annual_value !== null && benefit.actual_annual_value === null
      )
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINANCE_ACTUALS_INCOMPLETE',
        409,
        'Every forecast financial benefit requires a verified actual annual value'
      );
    for (const benefit of benefits.rows) {
      await client.query(
        `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'delivery','initiative_benefit',?,'output',?,?) ON CONFLICT DO NOTHING`,
        [
          uuidv4(),
          current.transformation_case_id,
          current.organization_id,
          benefit.id,
          params.actorUserId,
          acceptedAt,
        ]
      );
    }
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='benefits',version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const detail = {
      decisionReason: input.decisionReason,
      effectiveness: input.effectiveness,
      initiativeId: initiative.id,
      benefitIds: benefits.rows.map((benefit) => benefit.id),
      kpiActuals: kpiActuals.rows.map((kpi) => ({
        kpiId: kpi.id,
        value: kpi.current_value,
        measuredAt: kpi.last_measured_at,
      })),
      openRecoveryCardIds,
      nextCaseVersion: nextVersion,
    };
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_delivery.benefits_handoff_accepted',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        createHash('sha256').update(JSON.stringify(detail)).digest('hex'),
        JSON.stringify(detail),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'benefits' as const,
      initiativeId: initiative.id,
      effectiveness: input.effectiveness,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

async function acceptBenefitsReviewInner(
  params: AcceptBenefitsReviewParams
): Promise<AcceptedBenefitsReview> {
  const input = AcceptBenefitsReviewSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedBenefitsReview>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'benefits_review',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    await assertExecutionContext(current, params.actorUserId, client);
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'benefits')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_BENEFITS_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not in benefits realization'
      );
    const benefitRows = await client.query<{ id: string; status: string; verified_count: number }>(
      `SELECT b.id,b.status,(SELECT COUNT(*)::int FROM benefit_measurements m WHERE m.benefit_id=b.id AND m.is_verified=TRUE) verified_count
       FROM transformation_case_artifact_links l
       JOIN initiative_benefits b ON b.id=l.artifact_id AND b.organization_id=l.organization_id
       WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative_benefit'
       FOR SHARE OF b`,
      [current.transformation_case_id, current.organization_id]
    );
    const activeRecovery = (
      await client.query<{ count: number }>(
        `SELECT COUNT(DISTINCT rc.id)::int count
           FROM transformation_case_artifact_links lk
           JOIN kpi_recovery_cards rc ON rc.kpi_id=lk.artifact_id AND rc.organization_id=lk.organization_id
          WHERE lk.transformation_case_id=? AND lk.organization_id=?
            AND lk.artifact_type='initiative_kpi' AND rc.lifecycle_status<>'CLOSED'`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (
      (!benefitRows.rows.length ||
        benefitRows.rows.some(
          (benefit) =>
            !['achieved', 'exceeded'].includes(String(benefit.status).toLowerCase()) ||
            Number(benefit.verified_count) < 1
        )) &&
      Number(activeRecovery?.count ?? 0) < 1
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_BENEFITS_NOT_VERIFIED',
        409,
        'Every linked benefit must be achieved or exceeded and have a verified measurement'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'benefits_review',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: {
        benefitIds: benefitRows.rows.map((row) => row.id),
        openRecoveryCount: Number(activeRecovery?.count ?? 0),
      },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Benefits review: ${gate.blockedReason}`
      );
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage='sustainability',version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const detail = {
      decisionReason: input.decisionReason,
      benefitIds: benefitRows.rows.map((row) => row.id),
      openRecoveryCount: Number(activeRecovery?.count ?? 0),
      nextCaseVersion: nextVersion,
    };
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_benefits.results_verified',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        createHash('sha256').update(JSON.stringify(detail)).digest('hex'),
        JSON.stringify(detail),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: 'sustainability' as const,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

export async function getSustainabilityCheckpoint(
  transformationCaseId: string,
  organizationId: string
): Promise<SustainabilityCheckpoint> {
  const row = await queryOne<{
    initiative_id: string;
    benefit_total: number;
    with_two_verified: number;
    sustained_across_window: number;
    minimum_window_days: number | null;
  }>(
    `WITH linked AS (
       SELECT b.id,b.status
       FROM transformation_case_artifact_links l
       JOIN initiative_benefits b ON b.id=l.artifact_id AND b.organization_id=l.organization_id
       WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative_benefit'
     ), measurement_windows AS (
       SELECT l.id,l.status,COUNT(m.id)::int verified_count,
              (MAX(m.measured_at)-MIN(m.measured_at))::int window_days
       FROM linked l LEFT JOIN benefit_measurements m ON m.benefit_id=l.id AND m.is_verified=TRUE
       GROUP BY l.id,l.status
     )
     SELECT i.id initiative_id,
       (SELECT COUNT(*)::int FROM measurement_windows) benefit_total,
       (SELECT COUNT(*)::int FROM measurement_windows WHERE verified_count>=2) with_two_verified,
       (SELECT COUNT(*)::int FROM measurement_windows WHERE verified_count>=2 AND window_days>=30 AND LOWER(status) IN ('achieved','exceeded')) sustained_across_window,
       (SELECT MIN(window_days)::int FROM measurement_windows WHERE verified_count>=2) minimum_window_days
     FROM transformation_case_artifact_links l
     JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=l.organization_id
     WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative'
     LIMIT 1`,
    [transformationCaseId, organizationId, transformationCaseId, organizationId]
  );
  if (!row)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_INITIATIVE_NOT_FOUND',
      404,
      'Case-linked Initiative not found'
    );
  return {
    transformationCaseId,
    initiativeId: row.initiative_id,
    benefits: {
      total: Number(row.benefit_total),
      withTwoVerifiedMeasurements: Number(row.with_two_verified),
      sustainedAcrossWindow: Number(row.sustained_across_window),
      minimumWindowDays: row.minimum_window_days === null ? null : Number(row.minimum_window_days),
    },
  };
}

async function acceptSustainabilityReviewInner(
  params: AcceptSustainabilityReviewParams
): Promise<AcceptedSustainabilityReview> {
  const input = AcceptSustainabilityReviewSchema.parse(params);
  const acceptedAt = new Date().toISOString();
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<CaseRow>(
        `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    const replay = await loadResultGateReplay<AcceptedSustainabilityReview>(client, {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      gateKey: 'sustainability_review',
      sourceCaseVersion: input.expectedVersion,
    });
    if (replay) return replay;
    await assertExecutionContext(current, params.actorUserId, client);
    if (current.version !== input.expectedVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        `Expected version ${input.expectedVersion}, current version is ${current.version}`
      );
    if (current.lifecycle_stage !== 'sustainability')
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SUSTAINABILITY_STAGE_NOT_ACTIVE',
        409,
        'Transformation Case is not ready for sustainability review'
      );
    await client.query(
      `SELECT b.id FROM transformation_case_artifact_links l JOIN initiative_benefits b ON b.id=l.artifact_id AND b.organization_id=l.organization_id WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative_benefit' FOR SHARE OF b`,
      [current.transformation_case_id, current.organization_id]
    );
    const measurementRows = await client.query<{
      benefit_id: string;
      status: string;
      verified_count: number;
      window_days: number | null;
    }>(
      `SELECT b.id benefit_id,b.status,COUNT(m.id)::int verified_count,(MAX(m.measured_at)-MIN(m.measured_at))::int window_days
       FROM transformation_case_artifact_links l
       JOIN initiative_benefits b ON b.id=l.artifact_id AND b.organization_id=l.organization_id
       LEFT JOIN benefit_measurements m ON m.benefit_id=b.id AND m.is_verified=TRUE
       WHERE l.transformation_case_id=? AND l.organization_id=? AND l.artifact_type='initiative_benefit'
       GROUP BY b.id,b.status`,
      [current.transformation_case_id, current.organization_id]
    );
    const openRecovery = (
      await client.query<{ count: number }>(
        `SELECT COUNT(DISTINCT rc.id)::int count
           FROM transformation_case_artifact_links lk
           JOIN kpi_recovery_cards rc ON rc.kpi_id=lk.artifact_id AND rc.organization_id=lk.organization_id
          WHERE lk.transformation_case_id=? AND lk.organization_id=?
            AND lk.artifact_type='initiative_kpi' AND rc.lifecycle_status<>'CLOSED'`,
        [current.transformation_case_id, current.organization_id]
      )
    ).rows[0];
    if (
      input.conclusion === 'sustained' &&
      (!measurementRows.rows.length ||
        measurementRows.rows.some(
          (row) =>
            Number(row.verified_count) < 2 ||
            Number(row.window_days ?? 0) < 30 ||
            !['achieved', 'exceeded'].includes(String(row.status).toLowerCase())
        ))
    )
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_SUSTAINABILITY_WINDOW_INCOMPLETE',
        409,
        'Sustained closure requires two verified measurements spanning at least 30 days for every benefit'
      );
    if (input.conclusion === 'active_recovery' && Number(openRecovery?.count ?? 0) < 1)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_ACTIVE_RECOVERY_NOT_FOUND',
        409,
        'Active-recovery closure requires a truthful open Recovery Card'
      );
    const gate = await prepareResultGateAuthority(client, {
      current,
      gateKey: 'sustainability_review',
      actorUserId: params.actorUserId,
      reason: input.decisionReason,
      after: {
        conclusion: input.conclusion,
        measurementWindows: measurementRows.rows,
        openRecoveryCount: Number(openRecovery?.count ?? 0),
      },
    });
    if (gate.blockedReason)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_A05_RESULT_GATE_BLOCKED',
        409,
        `Common A05 blocked Sustainability review: ${gate.blockedReason}`
      );
    const nextStage: 'final_outputs' | 'benefits' =
      input.conclusion === 'sustained' || input.conclusion === 'active_recovery'
        ? 'final_outputs'
        : 'benefits';
    const nextVersion = current.version + 1;
    await client.query(
      `UPDATE transformation_cases SET lifecycle_stage=?,version=?,updated_at=? WHERE transformation_case_id=? AND organization_id=?`,
      [nextStage, nextVersion, acceptedAt, current.transformation_case_id, current.organization_id]
    );
    const detail = {
      conclusion: input.conclusion,
      decisionReason: input.decisionReason,
      measurementWindows: measurementRows.rows,
      openRecoveryCount: Number(openRecovery?.count ?? 0),
      nextCaseVersion: nextVersion,
    };
    await client.query(
      `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_sustainability.reviewed',?,?,?,?::jsonb,?)`,
      [
        uuidv4(),
        current.transformation_case_id,
        current.organization_id,
        current.active_plan_id,
        current.version,
        params.actorUserId,
        params.correlationId ?? null,
        createHash('sha256').update(JSON.stringify(detail)).digest('hex'),
        JSON.stringify(detail),
        acceptedAt,
      ]
    );
    const accepted = {
      transformationCaseId: current.transformation_case_id,
      caseVersion: nextVersion,
      lifecycleStage: nextStage,
      conclusion: input.conclusion,
      acceptedAt,
    };
    await completeResultGate(client, {
      current,
      mapping: gate.mapping,
      result: accepted,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
      now: acceptedAt,
    });
    return accepted;
  });
}

type AcceptedResultGate =
  | AcceptedInitiativeResults
  | AcceptedFinanceKpiResults
  | AcceptedPortfolioDecisionResults
  | AcceptedMobilizationResults
  | AcceptedExecutionStart
  | AcceptedExecutionResults
  | AcceptedDeliveryHandoff
  | AcceptedBenefitsReview
  | AcceptedSustainabilityReview;

type ResultGateToolName = `transformation.gate.${ResultGateKey}.accept`;

async function resultGateOwnerInvariant(input: {
  transformationCaseId: string;
  organizationId: string;
  gateKey: ResultGateKey;
}): Promise<boolean> {
  const requiredTypes: Record<ResultGateKey, string[]> = {
    initiative_results: ['initiative_candidate', 'initiative'],
    finance_kpi_results: ['initiative', 'financial_analysis', 'initiative_kpi'],
    portfolio_decision_results: ['initiative', 'decision'],
    mobilization_results: [
      'initiative',
      'initiative_blueprint',
      'initiative_task',
      'initiative_milestone',
      'initiative_resource',
    ],
    execution_start: ['initiative', 'execution_start_receipt'],
    execution_results: ['initiative', 'execution_start_receipt'],
    delivery_handoff: ['initiative', 'initiative_benefit'],
    benefits_review: ['initiative', 'initiative_benefit'],
    sustainability_review: ['initiative', 'initiative_benefit'],
  };
  const rows = await queryAll<{ artifact_type: string; owner_count: number }>(
    `SELECT l.artifact_type,COUNT(*)::int owner_count
       FROM transformation_case_artifact_links l
      WHERE l.transformation_case_id=? AND l.organization_id=?
        AND l.artifact_type = ANY(?::text[])
      GROUP BY l.artifact_type`,
    [input.transformationCaseId, input.organizationId, requiredTypes[input.gateKey]]
  );
  const present = new Set(
    rows.filter((row) => Number(row.owner_count) > 0).map((row) => row.artifact_type)
  );
  return requiredTypes[input.gateKey].every((type) => present.has(type));
}

async function dispatchT01ResultGate<T extends AcceptedResultGate>(input: {
  params: {
    transformationCaseId: string;
    organizationId: string;
    actorUserId: string;
    expectedVersion: number;
  } & Record<string, unknown>;
  gateKey: ResultGateKey;
  toolName: ResultGateToolName;
  execute: () => Promise<T>;
}): Promise<T> {
  const current = await queryOne<CaseRow>(
    `SELECT * FROM transformation_cases WHERE transformation_case_id=? AND organization_id=?`,
    [input.params.transformationCaseId, input.params.organizationId]
  );
  if (!current)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_CASE_NOT_FOUND',
      404,
      'Transformation Case not found'
    );
  const context = await loadTransformationAgentExecutionContext({
    transformationCaseId: current.transformation_case_id,
    organizationId: current.organization_id,
    actorUserId: input.params.actorUserId,
  });
  const artifactId = `${current.transformation_case_id}:${input.gateKey}:v${input.params.expectedVersion}`;
  const dispatched = await dispatchAgentAdapter({
    canonicalRunId: context.canonicalRunId,
    organizationId: context.organizationId,
    transformationCaseId: context.transformationCaseId,
    actorUserId: context.actorUserId,
    agentId: context.agentId,
    toolName: input.toolName,
    projectId: context.projectId,
    idempotencyKey: `gate:${input.gateKey}:case-v${input.params.expectedVersion}`,
    payload: {
      transformationCaseId: input.params.transformationCaseId,
      organizationId: input.params.organizationId,
      gateKey: input.gateKey,
      sourceVersion: input.params.expectedVersion,
    },
    adapter: {
      key: input.toolName,
      compensationPolicy: 'manual_repair',
      execute: async () => ({
        artifactType: 'transformation_result_gate_receipt',
        artifactId,
        module: 'transformation',
        operation: 'accept_result_gate',
        data: { result: await input.execute() },
      }),
      readback: async () => {
        const mapping = await queryOne<{
          source_case_version: number;
          status: string;
          result_json: unknown;
        }>(
          `SELECT source_case_version,status,result_json
             FROM transformation_result_gate_governance
            WHERE transformation_case_id=? AND organization_id=? AND gate_key=?
              AND source_case_version=?`,
          [
            current.transformation_case_id,
            current.organization_id,
            input.gateKey,
            input.params.expectedVersion,
          ]
        );
        if (!mapping || mapping.status !== 'applied' || !mapping.result_json) return null;
        const result = jsonValue<T>(mapping.result_json, null as T);
        const caseReadback = await queryOne<{ lifecycle_stage: string; version: number }>(
          `SELECT lifecycle_stage,version FROM transformation_cases
            WHERE transformation_case_id=? AND organization_id=?`,
          [current.transformation_case_id, current.organization_id]
        );
        if (
          !result ||
          !caseReadback ||
          Number(caseReadback.version) < Number(result.caseVersion) ||
          (Number(caseReadback.version) === Number(result.caseVersion) &&
            caseReadback.lifecycle_stage !== result.lifecycleStage) ||
          !(await resultGateOwnerInvariant({
            transformationCaseId: current.transformation_case_id,
            organizationId: current.organization_id,
            gateKey: input.gateKey,
          }))
        )
          return null;
        return {
          gateKey: input.gateKey,
          sourceCaseVersion: Number(mapping.source_case_version),
          status: mapping.status,
          result,
          appliedLifecycleStage: result.lifecycleStage,
          appliedCaseVersion: Number(result.caseVersion),
          ownerInvariant: true,
        };
      },
    },
  });
  return dispatched.normalizedResult.data.result as T;
}

export async function acceptInitiativeResults(
  params: AcceptInitiativeResultsParams
): Promise<AcceptedInitiativeResults> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'initiative_results',
    toolName: 'transformation.gate.initiative_results.accept',
    execute: () => acceptInitiativeResultsInner(params),
  });
}

export async function acceptFinanceKpiResults(
  params: AcceptFinanceKpiResultsParams
): Promise<AcceptedFinanceKpiResults> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'finance_kpi_results',
    toolName: 'transformation.gate.finance_kpi_results.accept',
    execute: () => acceptFinanceKpiResultsInner(params),
  });
}

export async function acceptPortfolioDecisionResults(
  params: AcceptPortfolioDecisionResultsParams
): Promise<AcceptedPortfolioDecisionResults> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'portfolio_decision_results',
    toolName: 'transformation.gate.portfolio_decision_results.accept',
    execute: () => acceptPortfolioDecisionResultsInner(params),
  });
}

export async function acceptMobilizationResults(
  params: AcceptMobilizationResultsParams
): Promise<AcceptedMobilizationResults> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'mobilization_results',
    toolName: 'transformation.gate.mobilization_results.accept',
    execute: () => acceptMobilizationResultsInner(params),
  });
}

export async function acceptExecutionStart(
  params: AcceptExecutionStartParams
): Promise<AcceptedExecutionStart> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'execution_start',
    toolName: 'transformation.gate.execution_start.accept',
    execute: () => acceptExecutionStartInner(params),
  });
}

export async function acceptExecutionResults(
  params: AcceptExecutionResultsParams
): Promise<AcceptedExecutionResults> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'execution_results',
    toolName: 'transformation.gate.execution_results.accept',
    execute: () => acceptExecutionResultsInner(params),
  });
}

export async function acceptDeliveryHandoff(
  params: AcceptDeliveryHandoffParams
): Promise<AcceptedDeliveryHandoff> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'delivery_handoff',
    toolName: 'transformation.gate.delivery_handoff.accept',
    execute: () => acceptDeliveryHandoffInner(params),
  });
}

export async function acceptBenefitsReview(
  params: AcceptBenefitsReviewParams
): Promise<AcceptedBenefitsReview> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'benefits_review',
    toolName: 'transformation.gate.benefits_review.accept',
    execute: () => acceptBenefitsReviewInner(params),
  });
}

export async function acceptSustainabilityReview(
  params: AcceptSustainabilityReviewParams
): Promise<AcceptedSustainabilityReview> {
  return dispatchT01ResultGate({
    params,
    gateKey: 'sustainability_review',
    toolName: 'transformation.gate.sustainability_review.accept',
    execute: () => acceptSustainabilityReviewInner(params),
  });
}
