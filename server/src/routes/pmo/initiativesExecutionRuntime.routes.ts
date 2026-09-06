import { type NextFunction, type Request, type Response, Router } from 'express';
import { Pool, type PoolConfig } from 'pg';
import { z } from 'zod';

import databaseConfig from '../../config/DatabaseConfig.js';
import { adoptAcceptedClassicInitiative } from '../../domain/initiatives-execution/adoptAcceptedClassicInitiative.js';
import { adoptChatDraftInitiative } from '../../domain/initiatives-execution/adoptChatDraftInitiative.js';
import {
  createAIAnalysisProposal,
  reviewAIAnalysisProposal,
} from '../../domain/initiatives-execution/aiEvidenceGovernance.js';
import { amendInitiativeMetadata } from '../../domain/initiatives-execution/amendInitiativeMetadata.js';
import {
  decideAnalysis,
  requestAnalysisDecision,
  startAnalysis,
} from '../../domain/initiatives-execution/analysisDecision.js';
import { evaluateAnalysisReadiness } from '../../domain/initiatives-execution/analysisReadiness.js';
import { cancelInitiative } from '../../domain/initiatives-execution/cancelInitiative.js';
import {
  createCapacityOptions,
  selectCapacityOption,
} from '../../domain/initiatives-execution/capacityOptions.js';
import { mutateCapacityScenario } from '../../domain/initiatives-execution/capacityScenario.js';
import {
  decideClosureCase,
  requestClosureCase,
} from '../../domain/initiatives-execution/closureDecision.js';
import { configureInitiativeCards } from '../../domain/initiatives-execution/configureInitiativeCards.js';
import { createDefinitionRemediationWork } from '../../domain/initiatives-execution/createDefinitionRemediationWork.js';
import { decideSourceProposal } from '../../domain/initiatives-execution/decideSourceProposal.js';
import {
  decideDefinition,
  requestDefinitionDecision,
} from '../../domain/initiatives-execution/definitionDecision.js';
import { evaluateDefinitionReadiness } from '../../domain/initiatives-execution/definitionReadiness.js';
import {
  decideDeliveryAcceptance,
  decideResultsAcceptance,
  requestDeliveryAcceptance,
  requestResultsAcceptance,
} from '../../domain/initiatives-execution/deliveryAcceptance.js';
import {
  archiveClosedInitiative,
  closeEffectiveInitiative,
  createEffectivenessCase,
  transitionEffectiveness,
} from '../../domain/initiatives-execution/effectivenessClosure.js';
import { createExecutionMilestone } from '../../domain/initiatives-execution/executionMilestone.js';
import {
  completeExecutionTask,
  createExecutionDecision,
  createExecutionTask,
  decideExecutionDecision,
  requestExecutionDecision,
  updateExecutionTask,
} from '../../domain/initiatives-execution/executionWork.js';
import {
  transitionCanonicalDecision,
  transitionCanonicalTask,
} from '../../domain/initiatives-execution/executionWorkHardening.js';
import {
  createExecutionBudgetEntry,
  executeCanonicalManagerAction,
  recordRaidMitigation,
  recordExecutionRealization,
  reviewManagerSuggestion,
  voidExecutionBudgetEntry,
} from '../../domain/initiatives-execution/executionControlWrites.js';
import { authorExecutionControlKpiPolicy } from '../../domain/initiatives-execution/executionControlKpiPolicyAuthoring.js';
import {
  assignGoalPerspective,
  GOAL_PERSPECTIVES,
} from '../../domain/initiatives-execution/assignGoalPerspective.js';
import {
  gateSignoffId,
  submitGateSignoff,
} from '../../domain/initiatives-execution/gateSignoff.js';
import {
  decideHandoffAcceptance,
  requestHandoffAcceptance,
} from '../../domain/initiatives-execution/handoffAcceptance.js';
import {
  draftInterventionCase,
  ingestManagementSignal,
  managementSignalFingerprint,
  transitionInterventionCase,
} from '../../domain/initiatives-execution/managementIntervention.js';
import {
  createMaterialChange,
  transitionMaterialChange,
} from '../../domain/initiatives-execution/materialChange.js';
import {
  MaterialCommandConflictError,
  MaterialCommandValidationError,
} from '../../domain/initiatives-execution/materialCommand.js';
import {
  proposeOperationalAllocation,
  simulateOperationalAllocation,
  transitionOperationalAllocation,
} from '../../domain/initiatives-execution/operationalAllocation.js';
import {
  createPlanAnalysisProposal,
  reviewPlanAnalysisProposal,
} from '../../domain/initiatives-execution/planAnalysisProposal.js';
import {
  diffPlanScenarios,
  mutatePlanScenario,
} from '../../domain/initiatives-execution/planScenario.js';
import {
  decidePortfolio,
  requestPortfolioDecision,
} from '../../domain/initiatives-execution/portfolioDecision.js';
import {
  diffPortfolioScenarios,
  mutatePortfolioScenario,
  type PortfolioScenario,
} from '../../domain/initiatives-execution/portfolioScenario.js';
import {
  type EffectiveGovernancePolicy,
  PostgresGovernancePolicyResolver,
} from '../../domain/initiatives-execution/postgresGovernancePolicyResolver.js';
import { PostgresInitiativeReader } from '../../domain/initiatives-execution/postgresInitiativeReader.js';
import { PostgresAsOfVersionReader } from '../../domain/initiatives-execution/postgresAsOfVersionReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { publishInitiativeCard } from '../../domain/initiatives-execution/publishInitiativeCard.js';
import { createRaidItem, deleteRaidItem } from '../../domain/initiatives-execution/raidItem.js';
import { refreshInitiativeSource } from '../../domain/initiatives-execution/refreshInitiativeSource.js';
import { registerInitiative } from '../../domain/initiatives-execution/registerInitiative.js';
import {
  createReportDefinition,
  transitionReportDefinition,
} from '../../domain/initiatives-execution/reportDefinition.js';
import {
  createReportRun,
  transitionReportRun,
} from '../../domain/initiatives-execution/reportRun.js';
import { reconstructReportRun } from '../../domain/initiatives-execution/reportReconstruction.js';
import { resolveDefinitionRemediationWork } from '../../domain/initiatives-execution/resolveDefinitionRemediationWork.js';
import {
  acceptResourceCommitment,
  decideResourceCommitment,
  requestResourceCommitment,
} from '../../domain/initiatives-execution/resourceCommitment.js';
import {
  createFinanceReconciliation,
  createResultsKpiObservation,
} from '../../domain/initiatives-execution/resultsMeasurement.js';
import { reviewInitiativeCard } from '../../domain/initiatives-execution/reviewInitiativeCard.js';
import { reviseSourceProposal } from '../../domain/initiatives-execution/reviseSourceProposal.js';
import {
  decideSchedule,
  requestScheduleDecision,
} from '../../domain/initiatives-execution/scheduleDecision.js';
import { submitSourceProposal } from '../../domain/initiatives-execution/submitSourceProposal.js';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../../services/effectiveAccessService.js';
import { ControlKpiReadModel } from '../../services/executionControl/controlKpiReadModel.js';

const RegisterSchema = z.object({
  initiativeId: z.string().min(1).max(255),
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1).max(255),
  proposalId: z.string().min(1).max(255),
  proposalVersion: z.number().int().min(1),
  sourceType: z.string().min(1).max(100),
  sourceId: z.string().min(1).max(255),
  sourceVersion: z.number().int().min(1),
  title: z.string().min(1).max(500),
  problem: z.string().min(1).max(20000),
  proposedOutcome: z.string().max(20000).nullable(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  projectId: z.string().min(1).max(255),
  visibility: z.enum(['PROJECT', 'ORGANIZATION_RESTRICTED']),
  initiativeOwnerId: z.string().min(1).max(255),
});
const AdoptAcceptedClassicSchema = z.object({
  candidateId: z.string().min(1).max(255),
  initiativeId: z.string().min(1).max(255),
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1).max(255),
  projectId: z.string().min(1).max(255),
  visibility: z.enum(['PROJECT', 'ORGANIZATION_RESTRICTED']),
  initiativeOwnerId: z.string().min(1).max(255),
});
const AdoptChatDraftSchema = z.object({
  chatInitiativeId: z.string().min(1).max(255),
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1).max(255),
  projectId: z.string().min(1).max(255),
  visibility: z.enum(['PROJECT', 'ORGANIZATION_RESTRICTED']),
  initiativeOwnerId: z.string().min(1).max(255),
});

const SubmitSourceProposalSchema = z.object({
  proposalId: z.string().min(1).max(255),
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1).max(255),
  sourceType: z.string().min(1).max(100),
  sourceId: z.string().min(1).max(255),
  sourceVersion: z.number().int().min(1),
  provenance: z.object({
    system: z.string().min(1).max(255),
    recordType: z.string().min(1).max(255),
    capturedAt: z.string().datetime(),
    evidenceRefs: z.array(z.string().min(1).max(1000)).default([]),
  }),
  title: z.string().min(1).max(500),
  problem: z.string().min(1).max(20_000),
  proposedOutcome: z.string().max(20_000).nullable(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  projectId: z.string().min(1).max(255),
  initiativeOwnerId: z.string().min(1).max(255),
  visibility: z.enum(['PROJECT', 'ORGANIZATION_RESTRICTED']),
});
const AmendInitiativeMetadataSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1).max(255),
    title: z.string().min(1).max(500).optional(),
    problem: z.string().min(1).max(20_000).optional(),
    proposedOutcome: z.string().max(20_000).nullable().optional(),
    initiativeOwnerId: z.string().min(1).max(255).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.problem !== undefined ||
      value.proposedOutcome !== undefined ||
      value.initiativeOwnerId !== undefined,
    'At least one metadata field is required'
  );
const CancelInitiativeSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  reason: z.string().min(1).max(2000),
});
const ReviseSourceProposalSchema = z.object({
  expectedVersion: z.number().int().min(1),
  expectedProposalVersion: z.number().int().min(1),
  expectedSourceVersion: z.number().int().min(1),
  sourceVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  projectId: z.string().min(1),
  provenance: z.object({
    system: z.string().min(1),
    recordType: z.string().min(1),
    capturedAt: z.string().datetime(),
    evidenceRefs: z.array(z.string().min(1)).min(1),
  }),
});

const SourceProposalDecisionSchema = z.object({
  decisionId: z.string().min(1).max(255),
  expectedProposalVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  disposition: z.enum(['MERGE', 'EXTEND', 'RETURN', 'DEFER', 'DISMISS']),
  targetInitiativeId: z.string().min(1).max(255).nullable().default(null),
  reasonCode: z.string().min(1).max(100),
  rationale: z.string().min(1).max(20_000),
  evidenceSnapshot: z.record(z.string(), z.unknown()).default({}),
  resolverId: z.string().min(1).max(255).nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
  reviewTrigger: z.string().min(1).max(2_000).nullable().default(null),
});

const PublishCardSchema = z.object({
  expectedVersion: z.number().int().min(1),
  expectedCardVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1).max(255),
  applicability: z.enum(['REQUIRED', 'OPTIONAL', 'NOT_APPLICABLE']),
  completion: z.enum(['EMPTY', 'IN_PROGRESS', 'COMPLETE']),
  quality: z.enum(['UNKNOWN', 'SUFFICIENT', 'WARNING', 'BLOCKER']),
  freshness: z.enum(['CURRENT', 'STALE', 'SOURCE_UNAVAILABLE']),
  reviewState: z.enum(['NOT_REQUESTED', 'REQUESTED']),
  content: z.record(z.string(), z.unknown()),
  evidenceRefs: z.array(z.string().min(1).max(2_000)).max(500),
  waiverDecisionId: z.string().min(1).max(255).nullable(),
});

const ReviewCardSchema = z.object({
  expectedVersion: z.number().int().min(1),
  expectedCardVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  outcome: z.enum(['CHANGES_REQUESTED', 'ACCEPTED']),
  rationale: z.string().min(1).max(20_000),
});

const ConfigureCardsSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  registryVersion: z.literal(1),
  cards: z
    .array(
      z.object({
        cardKey: z.string().min(1).max(100),
        included: z.boolean(),
        position: z.number().int().min(0),
        requiredness: z.enum(['REQUIRED', 'OPTIONAL']),
        waiverDecisionId: z.string().min(1).max(255).nullable(),
      })
    )
    .length(26),
});

const RequestDefinitionSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  decisionId: z.string().min(1).max(255),
  authorityId: z.string().min(1).max(255),
  dueAt: z.string().datetime(),
});

const GovernanceQuorumRefSchema = z.object({
  quorumId: z.string().min(1),
  version: z.number().int().min(1),
  receiptId: z.string().min(1),
});
const DecideDefinitionSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  decisionId: z.string().min(1).max(255),
  outcome: z.enum(['APPROVED', 'RETURNED']),
  rationale: z.string().min(1).max(20_000),
  governanceQuorumRef: GovernanceQuorumRefSchema.optional(),
});

const StartAnalysisSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
});
const RequestAnalysisSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  decisionId: z.string().min(1).max(255),
  authorityId: z.string().min(1).max(255),
  dueAt: z.string().datetime(),
});
const DecideAnalysisSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  decisionId: z.string().min(1).max(255),
  outcome: z.enum(['APPROVED', 'RETURNED']),
  rationale: z.string().min(1).max(20_000),
  governanceQuorumRef: GovernanceQuorumRefSchema.optional(),
});
const TriNumber = z.discriminatedUnion('state', [
  z.object({ state: z.enum(['KNOWN', 'ESTIMATED']), value: z.number(), basis: z.string().min(1) }),
  z.object({ state: z.literal('UNKNOWN'), value: z.null(), reason: z.string().min(1) }),
]);
const TriStrings = z.discriminatedUnion('state', [
  z.object({
    state: z.enum(['KNOWN', 'ESTIMATED']),
    value: z.array(z.string()),
    basis: z.string().min(1),
  }),
  z.object({ state: z.literal('UNKNOWN'), value: z.null(), reason: z.string().min(1) }),
]);
const TriDemand = z.discriminatedUnion('state', [
  z.object({
    state: z.enum(['KNOWN', 'ESTIMATED']),
    value: z.object({
      unit: z.string().min(1),
      low: z.number(),
      base: z.number(),
      high: z.number(),
    }),
    basis: z.string().min(1),
  }),
  z.object({ state: z.literal('UNKNOWN'), value: z.null(), reason: z.string().min(1) }),
]);
const MembershipSchema = z.object({
  initiativeId: z.string().min(1),
  initiativeVersion: z.number().int().min(1),
  disposition: z.enum(['INCLUDED', 'CONDITIONAL', 'DEFERRED', 'EXCLUDED']),
  scoreDecomposition: z.record(z.string(), z.number().nullable()),
  rank: z.number().int().positive().nullable(),
  rankOverride: z
    .object({
      actorId: z.string().min(1),
      reason: z.string().min(1),
      previousRank: z.number().int().positive().nullable(),
      newRank: z.number().int().positive(),
    })
    .nullable(),
  coverage: TriNumber,
  overlap: TriStrings,
  roughDemand: TriDemand,
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
  rationale: z.string().min(1),
});
const ScenarioSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  operation: z.enum(['CREATE', 'UPDATE', 'PUBLISH']),
  scenario: z.object({
    scenarioId: z.string().min(1),
    scenarioVersion: z.number().int().min(0),
    status: z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']),
    scope: z.object({
      portfolioId: z.string().min(1),
      goalIds: z.array(z.string()),
      asOf: z.string().datetime(),
    }),
    model: z.object({ modelId: z.string().min(1), version: z.number().int().min(1) }),
    memberships: z.array(MembershipSchema),
    decompositionKeys: z.array(z.string()),
    createdBy: z.string(),
    updatedBy: z.string(),
    publishedBy: z.string().nullable(),
    publishedAt: z.string().nullable(),
    previousPublishedVersion: z.number().int().positive().nullable(),
  }),
});
const PortfolioRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  decisionId: z.string().min(1),
  authorityId: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioVersion: z.number().int().min(1),
  dueAt: z.string().datetime(),
});
const PortfolioDecideSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  decisionId: z.string().min(1),
  outcome: z.enum([
    'APPROVED',
    'CONDITIONALLY_APPROVED',
    'RETURNED',
    'DEFERRED',
    'REJECTED',
    'MERGED',
  ]),
  rationale: z.string().min(1),
  conditions: z.array(z.string().min(1)).default([]),
  mergeTargetInitiativeId: z.string().min(1).nullable().default(null),
  governanceQuorumRef: GovernanceQuorumRefSchema.optional(),
});
const PlanScenarioSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  operation: z.enum(['CREATE', 'UPDATE', 'PUBLISH']),
  publishConfirmation: z
    .object({
      conflictCount: z.number().int().positive(),
      statement: z.string().min(1),
    })
    .optional(),
  scenario: z.object({
    scenarioId: z.string().min(1),
    name: z.string().trim().min(1).nullable().optional(),
    scenarioVersion: z.number().int().min(0),
    status: z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']),
    portfolioScenarioId: z.string().min(1),
    portfolioScenarioVersion: z.number().int().min(1),
    windowUnit: z.string().min(1),
    timezone: z.string().min(1),
    periods: z
      .array(
        z.object({
          periodId: z.string().min(1),
          start: z.string().datetime(),
          end: z.string().datetime(),
        })
      )
      .min(1),
    windows: z.array(
      z.object({
        initiativeId: z.string().min(1),
        initiativeVersion: z.number().int().min(1),
        earliest: z.string().datetime().nullable(),
        target: z.string().datetime().nullable(),
        latest: z.string().datetime().nullable(),
        confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
        rationale: z.string().min(1),
        dependencySnapshot: z.array(z.string()),
        constraintSnapshot: z.array(
          z.object({
            constraintId: z.string().min(1),
            state: z.enum(['KNOWN', 'UNKNOWN']),
            detail: z.string().min(1),
          })
        ),
      })
    ),
    assumptions: z.array(z.string().min(1)),
    createdBy: z.string(),
    updatedBy: z.string(),
    publishedBy: z.string().nullable(),
    publishedAt: z.string().nullable(),
  }),
});
const PlanAnalysisCreateSchema = z.object({
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1),
  scenarioId: z.string().min(1),
  inputAggregateVersion: z.number().int().min(1),
  useCapacity: z.boolean().optional().default(true),
});
const PlanAnalysisReviewSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  outcome: z.enum(['ACCEPT', 'REJECT']),
  rationale: z.string().min(1),
});
const CapacityRangeSchema = z.object({
  knowledgeState: z.enum(['KNOWN', 'ESTIMATED', 'UNKNOWN', 'UNCONFIRMED']),
  low: z.number().nullable(),
  base: z.number().nullable(),
  high: z.number().nullable(),
  sourceRef: z.string().nullable(),
  sourceVersion: z.number().int().positive().nullable(),
  asOf: z.string().datetime(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
  ownerId: z.string().min(1),
  reason: z.string().nullable(),
});
const CapacityScenarioSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  operation: z.enum(['CREATE', 'UPDATE', 'PUBLISH']),
  scenario: z.object({
    scenarioId: z.string().min(1),
    name: z.string().trim().min(1).nullable().optional(),
    scenarioVersion: z.number().int().min(0),
    status: z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']),
    planScenarioId: z.string().min(1),
    planScenarioVersion: z.number().int().min(1),
    windowUnit: z.string().min(1),
    timezone: z.string().min(1),
    periods: z.array(
      z.object({
        periodId: z.string().min(1),
        start: z.string().datetime(),
        end: z.string().datetime(),
        demand: CapacityRangeSchema,
        supply: CapacityRangeSchema,
      })
    ),
    constraints: z.array(
      z.object({
        constraintId: z.string().min(1),
        state: z.enum(['KNOWN', 'ESTIMATED', 'UNKNOWN', 'UNCONFIRMED']),
        detail: z.string(),
        ownerId: z.string().min(1),
      })
    ),
    proposedAssignments: z.array(
      z.object({
        assignmentId: z.string().min(1),
        initiativeId: z.string().min(1),
        resourceOrRoleId: z.string().min(1),
        periodIds: z.array(z.string()),
        demand: CapacityRangeSchema,
        rationale: z.string().min(1),
      })
    ),
    createdBy: z.string(),
    updatedBy: z.string(),
    publishedBy: z.string().nullable(),
    publishedAt: z.string().nullable(),
  }),
});
const RequestCommitmentSchema = z.object({
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1),
  capacityScenarioId: z.string().min(1),
  capacityScenarioVersion: z.number().int().min(1),
  assignmentId: z.string().min(1),
  initiativeId: z.string().min(1),
  resourceManagerId: z.string().min(1),
  assigneeId: z.string().min(1),
  expiresAt: z.string().datetime(),
});
const AcceptCommitmentSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
});
const DecideCommitmentSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  outcome: z.enum(['CONFIRMED', 'CONDITIONALLY_CONFIRMED', 'DECLINED', 'EXPIRED', 'SUPERSEDED']),
  conditions: z.array(z.string().min(1)).default([]),
  rationale: z.string().min(1),
  policyOverrideDecisionId: z.string().min(1).nullable().default(null),
});
const ScheduleRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  decisionId: z.string().min(1),
  authorityId: z.string().min(1),
  executionManagerId: z.string().min(1),
  dueAt: z.string().datetime(),
  portfolioScenarioId: z.string().min(1),
  portfolioScenarioVersion: z.number().int().min(1),
  planScenarioId: z.string().min(1),
  planScenarioVersion: z.number().int().min(1),
  capacityScenarioId: z.string().min(1),
  capacityScenarioVersion: z.number().int().min(1),
  commitmentIds: z.array(z.string().min(1)),
  criticalPeriodIds: z.array(z.string().min(1)),
  criticalDependencies: z.array(
    z.object({
      dependencyId: z.string().min(1),
      state: z.enum(['RESOLVED', 'UNRESOLVED']),
      critical: z.boolean(),
    })
  ),
  handoff: z.object({
    scope: z.record(z.string(), z.unknown()),
    selectedOptions: z.record(z.string(), z.unknown()),
    success: z.record(z.string(), z.unknown()),
    baseline: z.record(z.string(), z.unknown()),
    openWork: z.array(z.record(z.string(), z.unknown())),
    raid: z.array(z.record(z.string(), z.unknown())),
    outcomeRefs: z.array(z.string()),
    sourceVersions: z.record(z.string(), z.number().int().min(1)),
  }),
});
const ScheduleDecideSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  decisionId: z.string().min(1),
  outcome: z.enum(['APPROVED', 'CONDITIONALLY_APPROVED', 'RETURNED', 'HELD']),
  rationale: z.string().min(1),
  conditions: z.array(z.string().min(1)).default([]),
  governanceQuorumRef: GovernanceQuorumRefSchema.optional(),
});
const AccountableItemSchema = z.object({
  itemId: z.string().min(1),
  description: z.string().min(1),
  ownerId: z.string().min(1),
  dueAt: z.string().datetime(),
});
const HandoffRequestSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  decisionId: z.string().min(1),
  handoffPackageId: z.string().min(1),
  handoffPackageVersion: z.number().int().min(1),
  executionCaseId: z.string().min(1),
  authorityId: z.string().min(1),
  dueAt: z.string().datetime(),
  rolloutChildren: z.object({
    pilot: z.array(z.record(z.string(), z.unknown())),
    waves: z.array(z.record(z.string(), z.unknown())),
  }),
});
const HandoffDecideSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
  decisionId: z.string().min(1),
  outcome: z.enum(['ACCEPT', 'ACCEPT_WITH_EXPLICIT_GAPS', 'RETURN_WITH_BLOCKERS']),
  gaps: z.array(AccountableItemSchema),
  blockers: z.array(AccountableItemSchema),
  rationale: z.string().min(1),
  governanceQuorumRef: GovernanceQuorumRefSchema.optional(),
});
const WorkBase = z.object({
  expectedVersion: z.number().int().min(0),
  expectedCaseVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
});
const TaskCreateSchema = WorkBase.extend({
  executionCaseId: z.string().min(1),
  initiativeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  assigneeId: z.string().min(1),
  ownerId: z.string().min(1),
  dueAt: z.string().datetime(),
  slaAt: z.string().datetime(),
  evidenceRefs: z.array(z.string()),
  blockerDecisionIds: z.array(z.string()),
  dependencyTaskIds: z.array(z.string()),
  milestoneIds: z.array(z.string()).default([]),
});
const TaskUpdateSchema = WorkBase.extend({ patch: z.record(z.string(), z.unknown()) });
const TaskCompleteSchema = WorkBase.extend({ evidenceRefs: z.array(z.string().min(1)).min(1) });
const MilestoneCreateSchema = WorkBase.extend({
  executionCaseId: z.string().min(1),
  initiativeId: z.string().min(1),
  baselineRef: z.object({ ref: z.string().min(1), version: z.number().int().min(1) }),
  title: z.string().min(1),
  ownerId: z.string().min(1),
  targetAt: z.string().datetime().nullable(),
  forecastAt: z.string().datetime().nullable(),
  evidenceRefs: z.array(z.string()),
  sourceVersions: z.object({
    executionCaseVersion: z.number().int().min(1),
    baselineVersion: z.number().int().min(1),
  }),
});
const DecisionCreateSchema = WorkBase.extend({
  executionCaseId: z.string().min(1),
  initiativeId: z.string().min(1),
  title: z.string().min(1),
  options: z.array(z.object({ optionId: z.string().min(1), label: z.string().min(1) })).min(2),
  authorityId: z.string().min(1),
  dueAt: z.string().datetime(),
});
const DecisionRequestSchema = WorkBase;
const DecisionDecideSchema = WorkBase.extend({
  outcome: z.enum(['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'RETURNED']),
  rationale: z.string().min(1),
  conditions: z.array(z.string()),
  followUpTask: z
    .object({
      taskId: z.string().min(1),
      title: z.string().min(1),
      description: z.string(),
      assigneeId: z.string().min(1),
      ownerId: z.string().min(1),
      dueAt: z.string().datetime(),
      slaAt: z.string().datetime(),
      evidenceRefs: z.array(z.string()),
      dependencyTaskIds: z.array(z.string()),
    })
    .nullable(),
});
const WorkHardeningSchema = WorkBase.extend({
  action: z.enum([
    'OFFER_ASSIGNMENT',
    'ACCEPT_ASSIGNMENT',
    'DECLINE_ASSIGNMENT',
    'ESCALATE',
    'REOPEN',
    'CANCEL',
  ]),
  reason: z.string(),
  level: z.enum(['WARNING', 'CRITICAL']).optional(),
});
const DecisionHardeningSchema = WorkBase.extend({
  action: z.enum(['ESCALATE', 'REOPEN', 'CANCEL']),
  reason: z.string(),
  level: z.enum(['WARNING', 'CRITICAL']).optional(),
});
const AllocationRefSchema = z.object({
  ref: z.string().min(1).nullable(),
  version: z.number().int().min(1).nullable(),
  knowledgeState: z.enum(['KNOWN', 'ESTIMATED', 'UNKNOWN', 'UNCONFIRMED']),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
  asOf: z.string().datetime(),
  reason: z.string().nullable(),
});
const AllocationTimeBasisSchema = z.object({
  windowUnit: z.string().min(1),
  timezone: z.string().min(1),
  periods: z
    .array(
      z.object({
        periodId: z.string().min(1),
        start: z.string().datetime(),
        end: z.string().datetime(),
      })
    )
    .min(1),
});
const AllocationProposeSchema = WorkBase.extend({
  expectedTaskVersion: z.number().int().min(1),
  executionCaseId: z.string().min(1),
  initiativeId: z.string().min(1),
  taskId: z.string().min(1),
  assigneeId: z.string().min(1),
  resourceManagerId: z.string().min(1),
  timeBasis: AllocationTimeBasisSchema,
  demand: z.object({
    unit: z.string().min(1),
    low: z.number().nonnegative().nullable(),
    base: z.number().nonnegative().nullable(),
    high: z.number().nonnegative().nullable(),
    knowledgeState: z.enum(['KNOWN', 'ESTIMATED', 'UNKNOWN', 'UNCONFIRMED']),
  }),
  availabilityRef: AllocationRefSchema,
  calendarRef: AllocationRefSchema,
  remainingEstimateRef: AllocationRefSchema,
  skillRequirements: z.array(z.string().min(1)),
  costRef: z.object({ ref: z.string().min(1), version: z.number().int().min(1) }).nullable(),
});
const AllocationTransitionSchema = WorkBase.extend({
  expectedTaskVersion: z.number().int().min(1),
  action: z.enum([
    'REQUEST',
    'ASSIGNEE_ACCEPT',
    'ASSIGNEE_DECLINE',
    'RM_CONFIRM',
    'RM_CONDITIONAL',
    'RM_DECLINE',
  ]),
  rationale: z.string().min(1),
  conditions: z.array(z.string().min(1)),
  expectedTimeBasis: AllocationTimeBasisSchema,
});
const AllocationSimulationSchema = z.object({
  allocation: AllocationProposeSchema.omit({
    expectedVersion: true,
    expectedCaseVersion: true,
    expectedTaskVersion: true,
    clientRequestId: true,
  }),
  expectedTimeBasis: AllocationTimeBasisSchema,
});
const SignalIngestSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  ruleId: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  sourceVersions: z.record(z.string(), z.number().int().min(1)),
  severity: z.enum(['WARNING', 'CRITICAL']),
  occurredAt: z.string().datetime(),
  evidenceRef: z.string().min(1),
});
const ExecutionBudgetEntrySchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  entryType: z.string().min(1),
  costType: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().finite(),
  currency: z.string().min(3).max(3),
  description: z.string().nullable().default(null),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000),
  source: z.string().min(1),
});
const ExecutionBudgetVoidSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
});
const ExecutionRealizationSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  realizedRevenueDelta: z.number().finite().nullable().default(null),
  realizedCostDelta: z.number().finite().nullable().default(null),
  realizedSavings: z.number().finite().nullable().default(null),
  varianceNotes: z.string().nullable().default(null),
});
const RaidMitigationSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  mitigationPlan: z.string().min(1),
  responseStrategy: z.string().min(1),
  mitigationOwnerId: z.string().min(1),
  mitigationDueDate: z.string().datetime().nullable().default(null),
  mitigationStatus: z.string().min(1),
});
const RaidItemCreateSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  type: z.enum(['RISK', 'ASSUMPTION', 'ISSUE', 'DEPENDENCY']),
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  status: z.enum(['OPEN', 'MITIGATED', 'REALIZED', 'CLOSED']).default('OPEN'),
  probability: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable().default(null),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).nullable().default(null),
  ownerId: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  mitigationPlan: z.string().nullable().default(null),
  linkedItems: z.array(z.string()).default([]),
});
const RaidItemDeleteSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
});
const ManagerExecutionActionSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  laneId: z.string().min(1),
  problemId: z.string().min(1),
  actionId: z.string().min(1),
  rationale: z.string().nullable().default(null),
});
const ManagerSuggestionReviewSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  laneId: z.string().min(1),
  outcome: z.enum(['APPROVE', 'DEFER']),
  notes: z.string().nullable().default(null),
});
const ExecutionControlKpiPolicySchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  name: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});
const GoalPerspectiveAssignmentSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  perspective: z.enum(GOAL_PERSPECTIVES).nullable(),
});
const InterventionDraftSchema = z.object({
  expectedVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  signalRefs: z
    .array(
      z.object({
        signalId: z.string().min(1),
        signalVersion: z.number().int().min(1),
        fingerprint: z.string().min(1),
      })
    )
    .min(1),
  ownerId: z.string().min(1),
  authorityId: z.string().min(1),
  slaAt: z.string().datetime(),
  hypotheses: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  counterEvidenceRefs: z.array(z.string()),
  unknowns: z.array(z.string()),
  blastRadiusRefs: z.array(z.object({ ref: z.string().min(1), version: z.number().int().min(1) })),
  options: z
    .array(
      z.object({
        optionId: z.string().min(1),
        kind: z.enum(['DO_NOTHING', 'ACTION']),
        label: z.string().min(1),
        impacts: z.array(z.object({ targetRef: z.string().min(1), effect: z.string().min(1) })),
        confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
        reversibility: z.enum(['REVERSIBLE', 'PARTIALLY_REVERSIBLE', 'IRREVERSIBLE', 'UNKNOWN']),
      })
    )
    .min(1),
});
const InterventionCommandBase = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
});
const InterventionTransitionSchema = z.discriminatedUnion('action', [
  InterventionCommandBase.extend({ action: z.literal('REQUEST') }),
  InterventionCommandBase.extend({
    action: z.literal('DECIDE'),
    outcome: z.enum(['APPROVED', 'REJECTED']),
    selectedOptionId: z.string().min(1),
    rationale: z.string().min(1),
  }),
  InterventionCommandBase.extend({
    action: z.literal('APPLY'),
    targetReceiptClientRequestId: z.string().min(1),
    targetAggregateType: z.enum(['operational_allocation', 'execution_task', 'material_change']),
    targetAggregateId: z.string().min(1),
    expectedTargetVersion: z.number().int().min(1),
    expectedTargetState: z.string().min(1),
    verifyBy: z.string().datetime(),
    expectedEffect: z.string().min(1),
    measurementSource: z.object({ ref: z.string().min(1), version: z.number().int().min(1) }),
    planChange: z
      .object({
        planScenarioId: z.string().min(1),
        oldVersion: z.number().int().min(1),
        newVersion: z.number().int().min(1),
        oldHash: z.string().min(1),
        newHash: z.string().min(1),
        selectedCapacityOptionRef: z
          .object({
            comparisonId: z.string().min(1),
            comparisonVersion: z.number().int().min(1),
            optionId: z.string().min(1),
          })
          .nullable(),
        affected: z.object({
          initiatives: z.array(
            z.object({ id: z.string().min(1), version: z.number().int().min(1) })
          ),
          executionCases: z.array(
            z.object({ id: z.string().min(1), version: z.number().int().min(1) })
          ),
          tasks: z.array(z.object({ id: z.string().min(1), version: z.number().int().min(1) })),
        }),
      })
      .optional(),
  }),
  InterventionCommandBase.extend({
    action: z.literal('VERIFY'),
    outcome: z.enum(['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE', 'NOT_VERIFIED']),
    evidenceRefs: z.array(z.string().min(1)),
  }),
]);
const ReportSourceSchema = z.object({
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  version: z.number().int().min(1),
  capturedAt: z.string().datetime(),
  freshness: z.enum(['CURRENT', 'STALE', 'UNKNOWN']),
  formula: z.string().nullable(),
  unit: z.string().nullable(),
  currency: z.string().nullable(),
  window: z.object({ start: z.string().datetime(), end: z.string().datetime() }).nullable(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
  accessState: z.enum(['FULL', 'REDACTED', 'DENIED']),
  redactions: z.array(z.string()),
});
const ReportDraftSchema = z.object({
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1),
  definitionRef: z.object({ definitionId: z.string().min(1), version: z.number().int().min(1) }),
  parentRunRef: z
    .object({ reportRunId: z.string().min(1), version: z.number().int().min(1) })
    .nullable(),
  audience: z.array(z.string().min(1)).min(1),
  scopeRefs: z.array(z.string().min(1)).min(1),
  period: z.object({ start: z.string().datetime(), end: z.string().datetime() }),
  asOf: z.string().datetime(),
  sources: z.array(ReportSourceSchema).min(1),
  ownerId: z.string().min(1),
  approverId: z.string().min(1),
});
const ReportDefinitionContentSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  audience: z.array(z.string().min(1)).min(1),
  cadence: z.string().min(1),
  scope: z.object({
    type: z.string().min(1),
    refs: z.array(z.string().min(1)),
    projectIds: z.array(z.string().min(1)),
    generalBacklogAllowed: z.boolean(),
  }),
  outputSchema: z.record(z.string(), z.unknown()),
  sections: z
    .array(
      z.object({ sectionId: z.string().min(1), title: z.string().min(1), mandatory: z.boolean() })
    )
    .min(1),
  sourceBindings: z
    .array(
      z.object({
        bindingId: z.string().min(1),
        sourceType: z.string().min(1),
        required: z.boolean(),
        scope: z.string().min(1),
      })
    )
    .min(1),
  formulas: z.array(
    z.object({
      formulaId: z.string().min(1),
      expression: z.string().min(1),
      unit: z.string().nullable(),
      currency: z.string().nullable(),
      windowId: z.string().nullable(),
    })
  ),
  units: z.array(z.string().min(1)),
  currencies: z.array(z.string().min(1)),
  windows: z.array(
    z.object({
      windowId: z.string().min(1),
      duration: z.string().min(1),
      timezone: z.string().min(1),
    })
  ),
  access: z.object({
    audienceRoles: z.array(z.string().min(1)).min(1),
    classification: z.string().min(1),
  }),
  redaction: z.object({
    rules: z.array(z.string()),
    defaultState: z.enum(['FULL', 'REDACTED', 'DENIED']),
  }),
  freshnessThresholdMinutes: z.number().int().positive(),
  confidenceThreshold: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  ownerId: z.string().min(1),
  approverId: z.string().min(1),
});
const ReportDefinitionCreateSchema = ReportDefinitionContentSchema.extend({
  expectedVersion: z.literal(0),
  clientRequestId: z.string().min(1),
});
const ReportDefinitionTransitionSchema = z.discriminatedUnion('action', [
  z.object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1),
    action: z.literal('UPDATE_DRAFT'),
    patch: ReportDefinitionContentSchema.partial(),
  }),
  z.object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1),
    action: z.literal('VALIDATE'),
  }),
  z.object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1),
    action: z.literal('PUBLISH'),
    rationale: z.string().min(1),
  }),
  z.object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1),
    action: z.literal('CREATE_VERSION'),
    patch: ReportDefinitionContentSchema.partial(),
  }),
]);
const ReportTransitionBase = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1),
});
const ReportTransitionSchema = z.discriminatedUnion('action', [
  ReportTransitionBase.extend({ action: z.literal('VALIDATE') }),
  ReportTransitionBase.extend({ action: z.literal('FREEZE') }),
  ReportTransitionBase.extend({
    action: z.literal('DECIDE'),
    outcome: z.enum(['APPROVED', 'RETURNED']),
    rationale: z.string().min(1),
  }),
  ReportTransitionBase.extend({
    action: z.literal('PUBLISH'),
    distribution: z.object({
      receiptId: z.string().min(1),
      audience: z.string().min(1),
      distributedAt: z.string().datetime(),
    }),
  }),
  ReportTransitionBase.extend({ action: z.literal('FAIL'), reason: z.string().min(1) }),
  ReportTransitionBase.extend({ action: z.literal('SUPERSEDE') }),
  ReportTransitionBase.extend({
    action: z.literal('LINK_FOLLOW_UP'),
    taskReceiptClientRequestId: z.string().min(1),
    taskId: z.string().min(1),
    taskVersion: z.number().int().min(1),
  }),
]);
const ReportReconstructionSchema = z.object({ asOf: z.string().datetime() });
const AcceptanceCommandSchema = z
  .object({ expectedVersion: z.number().int().min(0), clientRequestId: z.string().min(1) })
  .passthrough();
const EffectivenessCommandSchema = AcceptanceCommandSchema;
const MaterialChangeCommandSchema = AcceptanceCommandSchema;
const AIAnalysisCommandSchema = AcceptanceCommandSchema;
const CapacityOptionsCommandSchema = AcceptanceCommandSchema;
const GateSignoffSchema = z.object({
  expectedVersion: z.literal(0),
  expectedQuorumVersion: z.number().int().min(0),
  clientRequestId: z.string().min(1),
  gate: z.enum(['DEFINITION', 'ANALYSIS', 'PORTFOLIO', 'SCHEDULE', 'HANDOFF', 'CLOSURE']),
  decisionId: z.string().min(1),
  requesterId: z.string().min(1),
  roleKey: z.string().min(1),
  outcome: z.enum(['APPROVE', 'REJECT', 'ABSTAIN']),
  delegationProof: z
    .object({
      delegatedFrom: z.string().min(1),
      delegationRef: z.string().min(1),
      version: z.number().int().min(1),
    })
    .nullable(),
  rationale: z.string().min(1),
});

const CreateDefinitionRemediationSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  findingId: z.string().min(1).max(500),
  financeTask: z.object({
    taskId: z.string().min(1).max(255),
    title: z.string().min(1).max(500),
    assigneeId: z.string().min(1).max(255),
    dueAt: z.string().datetime(),
  }),
  technicalDecision: z.object({
    decisionId: z.string().min(1).max(255),
    title: z.string().min(1).max(500),
    authorityId: z.string().min(1).max(255),
    dueAt: z.string().datetime(),
    options: z.array(z.string().min(1).max(2_000)).min(2).max(20),
  }),
});

const ResolveDefinitionRemediationSchema = z.discriminatedUnion('workType', [
  z.object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1).max(255),
    workType: z.literal('FINANCE_EVIDENCE'),
    evidenceRefs: z.array(z.string().min(1).max(2_000)).min(1).max(500),
  }),
  z.object({
    expectedVersion: z.number().int().min(1),
    clientRequestId: z.string().min(1).max(255),
    workType: z.literal('TECHNICAL_OPTION'),
    selectedOption: z.string().min(1).max(2_000),
    rationale: z.string().min(1).max(20_000),
  }),
]);

const RefreshInitiativeSourceSchema = z.object({
  expectedVersion: z.number().int().min(1),
  clientRequestId: z.string().min(1).max(255),
  expectedProposalVersion: z.number().int().min(1),
  expectedSourceVersion: z.number().int().min(1),
});

export interface RuntimeActor {
  userId: string;
  organizationId: string;
  applicationRole: string | null;
  isImpersonating: boolean;
}

interface RuntimeRequest extends Request {
  user?: {
    id?: string;
    organizationId?: string;
    organization_id?: string;
    role?: string;
    isImpersonating?: boolean;
  };
  userId?: string;
  isImpersonating?: boolean;
  correlationId?: string;
}

export type RuntimeAuthorize = (
  actor: RuntimeActor,
  projectId: string,
  capability: 'initiative.create' | 'initiative.view' | 'initiative.update' | 'initiative.review'
) => Promise<boolean>;

export interface InitiativesExecutionRuntimeDependencies {
  unitOfWork: PostgresMaterialCommandUnitOfWork;
  reader: PostgresInitiativeReader;
  authorize: RuntimeAuthorize;
  resolvePolicy: (
    organizationId: string,
    projectId: string,
    initiativeId?: string | null
  ) => Promise<EffectiveGovernancePolicy>;
  controlKpis?: ControlKpiReadModel;
  asOfVersions?: PostgresAsOfVersionReader;
}

function actorFromRequest(req: Request): RuntimeActor | null {
  const runtimeRequest = req as RuntimeRequest;
  const user = runtimeRequest.user;
  const userId = String(user?.id || runtimeRequest.userId || '').trim();
  const organizationId = String(user?.organizationId || user?.organization_id || '').trim();
  if (!userId || !organizationId) return null;
  return {
    userId,
    organizationId,
    applicationRole: user?.role ? String(user.role) : null,
    isImpersonating: Boolean(user?.isImpersonating || runtimeRequest.isImpersonating),
  };
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

// Express 5 types req.params/req.query values as `string | string[]` (repeated query/param keys
// produce an array). Route params in this file are single path segments, so take the first
// occurrence deterministically instead of casting past the possibility of an array.
function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function decodeInitiativeCursor(value: unknown): { updatedAt: string; aggregateId: string } | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      typeof decoded.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(decoded.updatedAt)) ||
      typeof decoded.aggregateId !== 'string' ||
      !decoded.aggregateId.trim()
    )
      return null;
    return { updatedAt: decoded.updatedAt, aggregateId: decoded.aggregateId };
  } catch {
    return null;
  }
}

const encodeInitiativeCursor = (cursor: { updatedAt: string; aggregateId: string } | null) =>
  cursor === null ? null : Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

export function createInitiativesExecutionRuntimeRouter(
  deps: InitiativesExecutionRuntimeDependencies
): Router {
  const router = Router();

  const authorizeProjects = async (
    actor: RuntimeActor,
    projectIds: string[],
    capability: 'initiative.view' | 'initiative.update' | 'initiative.review'
  ) =>
    projectIds.length > 0 &&
    (
      await Promise.all(
        [...new Set(projectIds)].map((projectId) => deps.authorize(actor, projectId, capability))
      )
    ).every(Boolean);
  const authorizeProjectsMap = async (
    actor: RuntimeActor,
    projectIds: string[],
    capability: 'initiative.view' | 'initiative.update' | 'initiative.review'
  ) =>
    new Map(
      await Promise.all(
        [...new Set(projectIds)].map(
          async (projectId) =>
            [projectId, await deps.authorize(actor, projectId, capability)] as const
        )
      )
    );
  const projectsForInitiative = async (actor: RuntimeActor, initiativeId: unknown) =>
    typeof initiativeId === 'string'
      ? deps.reader.resolveProjectIdsForAggregate(actor.organizationId, 'initiative', initiativeId)
      : [];
  const canViewAggregate = async (
    actor: RuntimeActor,
    aggregateType: string,
    aggregateId: unknown
  ) =>
    typeof aggregateId === 'string' &&
    authorizeProjects(
      actor,
      await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        aggregateType,
        aggregateId
      ),
      'initiative.view'
    );
  const filterVisibleAggregates = async <T>(
    actor: RuntimeActor,
    items: T[],
    aggregateType: string,
    idOf: (item: T) => unknown
  ) => {
    const visible = await Promise.all(
      items.map(async (item) => ({
        item,
        visible: await canViewAggregate(actor, aggregateType, idOf(item)),
      }))
    );
    return visible.filter((entry) => entry.visible).map((entry) => entry.item);
  };

  // Canonical aggregates below historically relied on tenant authentication only. Resolve exact
  // project lineage before material writes; UNKNOWN legacy scope is deliberately read-only.
  router.use(
    asyncHandler(async (req, res, next) => {
      if (req.method === 'GET') {
        next();
        return;
      }
      const actor = actorFromRequest(req);
      if (!actor) {
        next();
        return;
      }
      const path = req.path,
        body = (req.body ?? {}) as Record<string, any>;
      let projectIds: string[] | null = null;
      let existing = false;
      const capability: 'initiative.update' | 'initiative.review' =
        path.includes('/decide') || path.includes('/decisions')
          ? 'initiative.review'
          : 'initiative.update';
      const idAfter = (prefix: string) =>
        decodeURIComponent(path.slice(prefix.length).split('/')[0] ?? '');
      if (path.startsWith('/material-changes/')) {
        const id = idAfter('/material-changes/');
        existing = !path.endsWith(`/${id}`);
        if (existing)
          projectIds = await deps.reader.resolveProjectIdsForAggregate(
            actor.organizationId,
            'material_change',
            id
          );
        else if (body.target?.initiativeId)
          projectIds = await projectsForInitiative(actor, body.target.initiativeId);
        else if (body.target?.aggregateType && body.target?.aggregateId)
          projectIds = await deps.reader.resolveProjectIdsForAggregate(
            actor.organizationId,
            body.target.aggregateType,
            body.target.aggregateId
          );
      } else if (path === '/management-signals/ingest') {
        projectIds = await deps.reader.resolveProjectIdsForAggregate(
          actor.organizationId,
          body.sourceType,
          body.sourceId
        );
      } else if (path.startsWith('/interventions/')) {
        const id = idAfter('/interventions/');
        existing = path.includes('/transitions');
        if (existing)
          projectIds = await deps.reader.resolveProjectIdsForAggregate(
            actor.organizationId,
            'intervention_case',
            id
          );
        else {
          const projects = await Promise.all(
            (body.signalRefs ?? []).map((ref: any) =>
              deps.reader.resolveProjectIdsForAggregate(
                actor.organizationId,
                'management_signal',
                ref.signalId
              )
            )
          );
          projectIds = projects.flat();
        }
      } else if (path.startsWith('/report-definitions/')) {
        const id = idAfter('/report-definitions/');
        existing = path.includes('/transitions');
        projectIds = existing
          ? await deps.reader.resolveProjectIdsForAggregate(
              actor.organizationId,
              'report_definition',
              id
            )
          : [
              ...(body.scope?.projectIds ?? []),
              ...(body.scope?.generalBacklogAllowed ? ['GENERAL_BACKLOG'] : []),
            ];
      } else if (path.startsWith('/report-runs/')) {
        const id = idAfter('/report-runs/');
        existing = path.includes('/transitions') || path.includes('/reconstruct');
        projectIds = existing
          ? await deps.reader.resolveProjectIdsForAggregate(actor.organizationId, 'report_run', id)
          : await deps.reader.resolveProjectIdsForAggregate(
              actor.organizationId,
              'report_definition',
              body.definitionRef?.definitionId
            );
      } else if (path.startsWith('/delivery-acceptances/')) {
        const id = idAfter('/delivery-acceptances/');
        existing = path.includes('/decide');
        projectIds = existing
          ? await deps.reader.resolveProjectIdsForAggregate(
              actor.organizationId,
              'delivery_acceptance',
              id
            )
          : await projectsForInitiative(actor, body.initiativeId);
      } else if (path.startsWith('/results-acceptances/')) {
        const id = idAfter('/results-acceptances/');
        existing = path.includes('/decide');
        projectIds = existing
          ? await deps.reader.resolveProjectIdsForAggregate(
              actor.organizationId,
              'results_acceptance',
              id
            )
          : await projectsForInitiative(actor, body.initiativeId);
      } else if (path.startsWith('/effectiveness/')) {
        const id = idAfter('/effectiveness/');
        existing = path.includes('/transitions') || path.includes('/close');
        projectIds = existing
          ? await deps.reader.resolveProjectIdsForAggregate(
              actor.organizationId,
              'effectiveness_case',
              id
            )
          : await projectsForInitiative(actor, body.initiativeId);
      } else if (path.startsWith('/archives/')) {
        projectIds = await projectsForInitiative(actor, body.initiativeId);
      } else if (path.startsWith('/finance-reconciliations/')) {
        projectIds = typeof body.projectId === 'string' ? [body.projectId] : [];
      } else if (path.startsWith('/results-observations/')) {
        projectIds = await deps.reader.resolveProjectIdsForAggregate(
          actor.organizationId,
          'results_acceptance',
          body.resultsCaseRef?.resultsCaseId
        );
      } else if (path.startsWith('/operational-allocations/')) {
        const id = idAfter('/operational-allocations/');
        existing = path.includes('/transitions');
        projectIds = existing
          ? await deps.reader.resolveProjectIdsForAggregate(
              actor.organizationId,
              'operational_allocation',
              id
            )
          : await projectsForInitiative(actor, body.initiativeId ?? body.allocation?.initiativeId);
      } else if (path.startsWith('/execution-cases/')) {
        const executionCaseId = idAfter('/execution-cases/');
        existing = true;
        projectIds = await deps.reader.resolveProjectIdsForAggregate(
          actor.organizationId,
          'execution_case',
          executionCaseId
        );
      }
      if (projectIds === null) {
        next();
        return;
      }
      if (!(await authorizeProjects(actor, projectIds, capability))) {
        res.status(existing ? 404 : 403).json({
          error: { code: existing ? 'NOT_FOUND' : 'CAPABILITY_REQUIRED' },
        });
        return;
      }
      next();
    })
  );

  router.post(
    '/source-proposals',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = SubmitSourceProposalSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.create'))) {
        res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
        return;
      }
      if (
        !(await deps.reader.isEligibleInitiativeOwner(
          actor.organizationId,
          parsed.data.projectId,
          parsed.data.initiativeOwnerId
        ))
      ) {
        res.status(422).json({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
        return;
      }
      const policy = await deps.resolvePolicy(actor.organizationId, parsed.data.projectId);
      const result = await submitSourceProposal(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'source_proposal',
        aggregateId: parsed.data.proposalId,
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          req.header('X-Correlation-ID') || `source-submit-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'source-proposal.submit',
        createIfMissing: true,
        payload: {
          sourceType: parsed.data.sourceType,
          sourceId: parsed.data.sourceId,
          sourceVersion: parsed.data.sourceVersion,
          provenance: parsed.data.provenance,
          title: parsed.data.title,
          problem: parsed.data.problem,
          proposedOutcome: parsed.data.proposedOutcome,
          priority: parsed.data.priority,
          projectId: parsed.data.projectId,
          initiativeOwnerId: parsed.data.initiativeOwnerId,
          visibility: parsed.data.visibility,
        },
      });
      const readBack = await deps.reader.listSourceProposals(
        actor.organizationId,
        parsed.data.proposalId
      );
      res
        .status(result.status === 'APPLIED' ? 201 : 200)
        .json({ ...result, proposal: readBack[0] ?? null });
    })
  );

  router.get(
    '/source-proposals',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const proposals = await deps.reader.listSourceProposals(actor.organizationId);
      const visible: Array<
        (typeof proposals)[number] & {
          policy: EffectiveGovernancePolicy;
          capabilities: {
            canRegister: boolean;
            canMerge: boolean;
            canExtend: boolean;
            canReturn: boolean;
            canDefer: boolean;
            canDismiss: boolean;
          };
        }
      > = [];
      for (const proposal of proposals) {
        if (!proposal.projectId) {
          // Governed handoffs may legitimately arrive before project triage.
          // Keep them visible, but fail closed until assignment; never infer a project.
          visible.push({
            ...proposal,
            // Empty lookup resolves product/organization policy only and is never persisted.
            policy: await deps.resolvePolicy(actor.organizationId, ''),
            capabilities: {
              canRegister: false,
              canMerge: false,
              canExtend: false,
              canReturn: false,
              canDefer: false,
              canDismiss: false,
            },
          });
        } else if (await deps.authorize(actor, proposal.projectId, 'initiative.create')) {
          const policy = await deps.resolvePolicy(actor.organizationId, proposal.projectId);
          visible.push({
            ...proposal,
            policy,
            capabilities: {
              canRegister: true,
              canMerge: true,
              canExtend: true,
              canReturn: true,
              canDefer: true,
              canDismiss: true,
            },
          });
        }
      }
      res.json({ proposals: visible });
    })
  );
  router.post(
    '/source-proposals/:proposalId/revisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ReviseSourceProposalSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.update'))) {
        res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
        return;
      }
      const policy = await deps.resolvePolicy(actor.organizationId, parsed.data.projectId);
      const { expectedVersion, clientRequestId, projectId: _projectId, ...payload } = parsed.data;
      const result = await reviseSourceProposal(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'source_proposal',
        aggregateId: firstParam(req.params.proposalId),
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'source-proposal.revise',
        payload,
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/source-proposals/:proposalId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const proposal = await deps.reader.findSourceProposal(
        actor.organizationId,
        firstParam(req.params.proposalId)
      );
      if (
        !proposal?.projectId ||
        !(await deps.authorize(actor, proposal.projectId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(actor.organizationId, proposal.projectId);
      res.json({
        proposal: {
          ...proposal,
          policy,
          capabilities: {
            canRegister: false,
            canMerge: false,
            canExtend: false,
            canReturn: false,
            canDefer: false,
            canDismiss: false,
          },
        },
      });
    })
  );

  router.post(
    '/registrations',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.create'))) {
        res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
        return;
      }
      if (
        !(await deps.reader.isEligibleInitiativeOwner(
          actor.organizationId,
          parsed.data.projectId,
          parsed.data.initiativeOwnerId
        ))
      ) {
        res.status(422).json({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        parsed.data.projectId,
        parsed.data.initiativeId
      );
      const correlationId =
        String(
          (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
        ).trim() || `register-${parsed.data.clientRequestId}`;
      const result = await registerInitiative(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: parsed.data.initiativeId,
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.register',
        createIfMissing: true,
        payload: {
          ...parsed.data,
          proposedOutcome: parsed.data.proposedOutcome ?? null,
          validatorCapability: 'INITIATIVE_REGISTER',
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/adoptions/accepted-classic',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = AdoptAcceptedClassicSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.create'))) {
        res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
        return;
      }
      if (
        !(await deps.reader.isEligibleInitiativeOwner(
          actor.organizationId,
          parsed.data.projectId,
          parsed.data.initiativeOwnerId
        ))
      ) {
        res.status(422).json({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        parsed.data.projectId,
        parsed.data.initiativeId
      );
      const result = await adoptAcceptedClassicInitiative(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: parsed.data.initiativeId,
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `adopt-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.adopt-accepted-classic',
        createIfMissing: true,
        payload: {
          candidateId: parsed.data.candidateId,
          projectId: parsed.data.projectId,
          initiativeOwnerId: parsed.data.initiativeOwnerId,
          visibility: parsed.data.visibility,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/adoptions/chat-draft',
    asyncHandler(async (req, res) => {
      if (process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT !== 'true') {
        res.status(404).json({ error: { code: 'FEATURE_DISABLED' } });
        return;
      }
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = AdoptChatDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.create'))) {
        res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
        return;
      }
      if (
        !(await deps.reader.isEligibleInitiativeOwner(
          actor.organizationId,
          parsed.data.projectId,
          parsed.data.initiativeOwnerId
        ))
      ) {
        res.status(422).json({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        parsed.data.projectId,
        parsed.data.chatInitiativeId
      );
      const result = await adoptChatDraftInitiative(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: parsed.data.chatInitiativeId,
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `adopt-chat-draft-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.adopt-chat-draft',
        createIfMissing: true,
        payload: {
          chatInitiativeId: parsed.data.chatInitiativeId,
          projectId: parsed.data.projectId,
          initiativeOwnerId: parsed.data.initiativeOwnerId,
          visibility: parsed.data.visibility,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/source-proposals/:proposalId/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = SourceProposalDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const proposal = await deps.reader.findSourceProposal(
        actor.organizationId,
        firstParam(req.params.proposalId)
      );
      if (!proposal?.projectId) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (!(await deps.authorize(actor, proposal.projectId, 'initiative.create'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const targetInitiativeId = parsed.data.targetInitiativeId;
      if (targetInitiativeId) {
        const target = await deps.reader.findById(actor.organizationId, targetInitiativeId);
        if (
          !target ||
          !(await deps.authorize(actor, target.initiative.projectId, 'initiative.view'))
        ) {
          res.status(404).json({ error: { code: 'TARGET_NOT_FOUND' } });
          return;
        }
      }
      const policy = await deps.resolvePolicy(actor.organizationId, proposal.projectId);
      const correlationId =
        String(
          (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
        ).trim() || `source-decision-${parsed.data.clientRequestId}`;
      const result = await decideSourceProposal(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'source-proposal-decision',
        aggregateId: parsed.data.decisionId,
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'source-proposal.decide',
        createIfMissing: true,
        payload: {
          proposalId: proposal.id,
          proposalVersion: parsed.data.expectedProposalVersion,
          disposition: parsed.data.disposition,
          targetInitiativeId,
          reasonCode: parsed.data.reasonCode,
          rationale: parsed.data.rationale,
          evidenceSnapshot: parsed.data.evidenceSnapshot,
          resolverId: parsed.data.resolverId,
          dueAt: parsed.data.dueAt,
          reviewTrigger: parsed.data.reviewTrigger,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/initiatives',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (
        req.query.organizationId !== undefined &&
        firstParam(req.query.organizationId as string | string[]) !== actor.organizationId
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const rawLimit = req.query.limit;
      const limit = rawLimit === undefined ? 50 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const cursor =
        req.query.cursor === undefined ? null : decodeInitiativeCursor(req.query.cursor);
      if (req.query.cursor !== undefined && cursor === null) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const page = await deps.reader.listInitiativesPage(actor.organizationId, limit, cursor);
      const authorizations = await authorizeProjectsMap(
        actor,
        page.initiatives.map((row) => row.initiative.projectId),
        'initiative.view'
      );
      const visible = page.initiatives.filter((row) =>
        Boolean(authorizations.get(row.initiative.projectId))
      );
      res.json({ initiatives: visible, nextCursor: encodeInitiativeCursor(page.nextCursor) });
    })
  );

  router.patch(
    '/initiatives/:initiativeId/metadata',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      const parsed = AmendInitiativeMetadataSchema.safeParse(req.body);
      if (!parsed.success)
        return void res
          .status(400)
          .json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
      const initiativeId = firstParam(req.params.initiativeId);
      const found = await deps.reader.findById(actor.organizationId, initiativeId);
      if (!found) return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      if (!(await deps.authorize(actor, found.initiative.projectId, 'initiative.update')))
        return void res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
      if (
        parsed.data.initiativeOwnerId !== undefined &&
        !(await deps.reader.isEligibleInitiativeOwner(
          actor.organizationId,
          found.initiative.projectId,
          parsed.data.initiativeOwnerId
        ))
      )
        return void res.status(422).json({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        initiativeId
      );
      const result = await amendInitiativeMetadata(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: initiativeId,
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          req.header('X-Correlation-ID') || `initiative-amend-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.metadata.amend',
        payload: parsed.data,
      });
      const readBack = await deps.reader.findById(actor.organizationId, initiativeId);
      res.json({ ...result, initiative: readBack });
    })
  );

  router.post(
    '/initiatives/:initiativeId/cancel',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      const parsed = CancelInitiativeSchema.safeParse(req.body);
      if (!parsed.success)
        return void res
          .status(400)
          .json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
      const initiativeId = firstParam(req.params.initiativeId);
      const found = await deps.reader.findById(actor.organizationId, initiativeId);
      if (!found) return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      if (!(await deps.authorize(actor, found.initiative.projectId, 'initiative.update')))
        return void res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        initiativeId
      );
      const result = await cancelInitiative(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: initiativeId,
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          req.header('X-Correlation-ID') || `initiative-cancel-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.cancel',
        payload: parsed.data,
      });
      const readBack = await deps.reader.findById(actor.organizationId, initiativeId);
      res.json({ ...result, initiative: readBack });
    })
  );

  router.get(
    '/initiatives/:initiativeId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (!(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );

  router.get(
    '/initiatives/:initiativeId/cards',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const cards = await deps.reader.listLatestInitiativeCards(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      res.json({ initiativeVersion: found.version, cards });
    })
  );

  router.get(
    '/initiatives/:initiativeId/card-selection',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const cards = await deps.reader.listInitiativeCardSelection(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      res.json({ initiativeVersion: found.version, registryVersion: 1, cards });
    })
  );

  router.post(
    '/initiatives/:initiativeId/card-selection',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = ConfigureCardsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await configureInitiativeCards(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `card-selection-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.cards.configure',
        payload: {
          registryVersion: parsed.data.registryVersion,
          cards: parsed.data.cards.map((card) => ({
            ...card,
            waiverDecisionId: card.waiverDecisionId ?? null,
          })),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/definition-remediation',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = CreateDefinitionRemediationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await createDefinitionRemediationWork(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `definition-remediation-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.definition-remediation.create',
        payload: parsed.data,
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/initiatives/:initiativeId/capabilities',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const [canUpdate, canReview] = await Promise.all([
        deps.authorize(actor, found.initiative.projectId, 'initiative.update'),
        deps.authorize(actor, found.initiative.projectId, 'initiative.review'),
      ]);
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      res.json({
        actorId: actor.userId,
        canView: true,
        canUpdate,
        canReview,
        canSelfApprove: Boolean(policy.config.selfApproval),
        executionWrites: {
          budgetEntry: {
            available: canUpdate,
            canonicalCommand:
              'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId',
            denialAt: canUpdate ? null : 'ZDOLNOŚĆ',
            denialCode: canUpdate ? null : 'NOT_FOUND',
            legacyDenialAt: 'BRAMKA_LEGACY',
            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
          },
          realization: {
            available: canUpdate,
            canonicalCommand:
              'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/realizations/:realizationId',
            denialAt: canUpdate ? null : 'ZDOLNOŚĆ',
            denialCode: canUpdate ? null : 'NOT_FOUND',
            legacyDenialAt: 'BRAMKA_LEGACY',
            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
          },
          raidMitigation: {
            available: canUpdate,
            canonicalCommand:
              'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations/:raidItemId',
            denialAt: canUpdate ? null : 'ZDOLNOŚĆ',
            denialCode: canUpdate ? null : 'NOT_FOUND',
            legacyDenialAt: 'BRAMKA_LEGACY',
            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
          },
          raidItem: {
            create: {
              available: canUpdate,
              canonicalCommand:
                'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-items/:raidItemId',
              denialAt: canUpdate ? null : 'ZDOLNOŚĆ',
              denialCode: canUpdate ? null : 'NOT_FOUND',
              legacyDenialAt: 'BRAMKA_LEGACY',
              legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
            },
            delete: {
              available: canUpdate,
              canonicalCommand:
                'DELETE /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-items/:raidItemId',
              denialAt: canUpdate ? null : 'ZDOLNOŚĆ',
              denialCode: canUpdate ? null : 'NOT_FOUND',
              legacyDenialAt: 'BRAMKA_LEGACY',
              legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
            },
          },
          managerAction: {
            available: canUpdate,
            canonicalCommand:
              'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions/:managerActionId',
            denialAt: canUpdate ? null : 'ZDOLNOŚĆ',
            denialCode: canUpdate ? null : 'NOT_FOUND',
            legacyDenialAt: 'BRAMKA_LEGACY',
            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
          },
          managerSuggestionReview: {
            available: canReview,
            canonicalCommand:
              'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestions/:suggestionId/review',
            denialAt: canReview ? null : 'ZDOLNOŚĆ',
            denialCode: canReview ? null : 'NOT_FOUND',
            legacyDenialAt: 'BRAMKA_LEGACY',
            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
          },
        },
      });
    })
  );

  router.get(
    '/initiatives/:initiativeId/gates/definition/readiness',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const cards = await deps.reader.listLatestInitiativeCards(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      const source = found.initiative.source;
      const proposal = source?.proposalId
        ? await deps.reader.findSourceProposal(actor.organizationId, source.proposalId)
        : null;
      const sourceFreshness = !proposal
        ? 'SOURCE_UNAVAILABLE'
        : proposal.evidenceState === 'STALE' ||
            proposal.sourceVersion !== source.sourceVersion ||
            proposal.proposalVersion !== source.proposalVersion
          ? 'STALE'
          : proposal.evidenceState === 'READY'
            ? 'CURRENT'
            : 'SOURCE_UNAVAILABLE';
      const readiness = evaluateDefinitionReadiness(
        cards,
        Boolean(source?.sourceType && source.sourceId && source.sourceVersion > 0),
        sourceFreshness
      );
      res.json({
        initiativeId: req.params.initiativeId,
        initiativeVersion: found.version,
        lifecycleState: found.initiative.lifecycleState,
        sourceStatus: {
          proposalId: source?.proposalId ?? null,
          snapshotProposalVersion: source?.proposalVersion ?? null,
          currentProposalVersion: proposal?.proposalVersion ?? null,
          snapshotSourceVersion: source?.sourceVersion ?? null,
          currentSourceVersion: proposal?.sourceVersion ?? null,
          evidenceState: proposal?.evidenceState ?? 'UNKNOWN',
          freshness: sourceFreshness,
        },
        ...readiness,
      });
    })
  );

  router.post(
    '/initiatives/:initiativeId/source-refresh',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = RefreshInitiativeSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await refreshInitiativeSource(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `source-refresh-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.source.refresh',
        payload: {
          expectedProposalVersion: parsed.data.expectedProposalVersion,
          expectedSourceVersion: parsed.data.expectedSourceVersion,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/cards/:cardKey/publications',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = PublishCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await publishInitiativeCard(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `card-publish-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.card.publish',
        payload: {
          cardKey: firstParam(req.params.cardKey),
          expectedCardVersion: parsed.data.expectedCardVersion,
          applicability: parsed.data.applicability,
          completion: parsed.data.completion,
          quality: parsed.data.quality,
          freshness: parsed.data.freshness,
          reviewState: parsed.data.reviewState,
          content: parsed.data.content,
          evidenceRefs: parsed.data.evidenceRefs,
          waiverDecisionId: parsed.data.waiverDecisionId,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/cards/:cardKey/reviews',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = ReviewCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await reviewInitiativeCard(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `card-review-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.card.review',
        payload: {
          cardKey: firstParam(req.params.cardKey),
          expectedCardVersion: parsed.data.expectedCardVersion,
          outcome: parsed.data.outcome,
          rationale: parsed.data.rationale,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/definition/requests',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = RequestDefinitionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await requestDefinitionDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `definition-request-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.definition.request',
        payload: {
          decisionId: parsed.data.decisionId,
          authorityId: parsed.data.authorityId,
          dueAt: parsed.data.dueAt,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/definition/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = DecideDefinitionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await decideDefinition(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `definition-decision-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.definition.decide',
        payload: {
          governanceQuorumRequired: Boolean(policy.config.enforceGateGovernance),
          governanceQuorumRef: parsed.data.governanceQuorumRef,
          decisionId: parsed.data.decisionId,
          outcome: parsed.data.outcome,
          rationale: parsed.data.rationale,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/my-work/definition-decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const pending = await deps.reader.listPendingDefinitionDecisions(
        actor.organizationId,
        actor.userId
      );
      const visible = [];
      for (const decision of pending) {
        const initiative = await deps.reader.findById(actor.organizationId, decision.initiativeId);
        if (
          initiative &&
          (await deps.authorize(actor, initiative.initiative.projectId, 'initiative.view'))
        ) {
          visible.push(decision);
        }
      }
      res.json({ decisions: visible });
    })
  );

  router.get(
    '/my-work/definition-remediation',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listPendingDefinitionRemediation(
        actor.organizationId,
        actor.userId
      );
      res.json({ items });
    })
  );

  router.post(
    '/my-work/definition-remediation/:aggregateType/:aggregateId/resolve',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (req.params.aggregateType !== 'task' && req.params.aggregateType !== 'decision') {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const parsed = ResolveDefinitionRemediationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const work = await deps.reader.findDefinitionRemediationById(
        actor.organizationId,
        req.params.aggregateType,
        firstParam(req.params.aggregateId)
      );
      const initiativeId = String(work?.payload.parentId ?? '');
      const initiative = initiativeId
        ? await deps.reader.findById(actor.organizationId, initiativeId)
        : null;
      if (!work || !initiative) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        initiative.initiative.projectId,
        initiativeId
      );
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await resolveDefinitionRemediationWork(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: req.params.aggregateType,
        aggregateId: firstParam(req.params.aggregateId),
        expectedVersion,
        clientRequestId,
        correlationId:
          String(
            (req as RuntimeRequest).correlationId || req.header('X-Correlation-ID') || ''
          ).trim() || `definition-remediation-resolve-${clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.definition-remediation.resolve',
        payload,
      });
      res.json(result);
    })
  );

  router.get(
    '/initiatives/:initiativeId/gates/analysis/readiness',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const cards = await deps.reader.listLatestInitiativeCards(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      res.json({
        initiativeId: req.params.initiativeId,
        initiativeVersion: found.version,
        lifecycleState: found.initiative.lifecycleState,
        ...evaluateAnalysisReadiness(cards),
      });
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/analysis/start',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = StartAnalysisSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await startAnalysis(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `analysis-start-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.analysis.start',
        payload: {},
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/analysis/requests',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = RequestAnalysisSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await requestAnalysisDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `analysis-request-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.analysis.request',
        payload: {
          decisionId: parsed.data.decisionId,
          authorityId: parsed.data.authorityId,
          dueAt: parsed.data.dueAt,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/analysis/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const parsed = DecideAnalysisSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED', issues: parsed.error.issues } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await decideAnalysis(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `analysis-decision-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.analysis.decide',
        payload: {
          governanceQuorumRequired: Boolean(policy.config.enforceGateGovernance),
          governanceQuorumRef: parsed.data.governanceQuorumRef,
          decisionId: parsed.data.decisionId,
          outcome: parsed.data.outcome,
          rationale: parsed.data.rationale,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/my-work/analysis-decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        decisions: await deps.reader.listPendingAnalysisDecisions(
          actor.organizationId,
          actor.userId
        ),
      });
    })
  );

  router.post(
    '/portfolio-scenarios/:scenarioId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ScenarioSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.scenario.scenarioId !== req.params.scenarioId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const projectId = parsed.data.scenario.scope.portfolioId;
      if (!(await deps.authorize(actor, projectId, 'initiative.update'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(actor.organizationId, projectId);
      const result = await mutatePortfolioScenario(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'portfolio_scenario',
        aggregateId: req.params.scenarioId,
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `portfolio-scenario-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'portfolio.scenario.mutate',
        createIfMissing: parsed.data.operation === 'CREATE',
        payload: {
          operation: parsed.data.operation,
          publishConfirmation: parsed.data.publishConfirmation,
          scenario: {
            ...parsed.data.scenario,
            memberships: parsed.data.scenario.memberships.map((membership) => ({
              ...membership,
              rank: membership.rank ?? null,
              rankOverride: membership.rankOverride
                ? {
                    ...membership.rankOverride,
                    previousRank: membership.rankOverride.previousRank ?? null,
                  }
                : null,
            })),
            publishedBy: parsed.data.scenario.publishedBy ?? null,
            publishedAt: parsed.data.scenario.publishedAt ?? null,
            previousPublishedVersion: parsed.data.scenario.previousPublishedVersion ?? null,
          } as PortfolioScenario,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/portfolio-scenarios/:scenarioId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findPortfolioScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.scenario.scope.portfolioId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );

  router.get(
    '/portfolio-scenarios/:scenarioId/history',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findPortfolioScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.scenario.scope.portfolioId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json({
        versions: await deps.reader.listPortfolioScenarioHistory(
          actor.organizationId,
          firstParam(req.params.scenarioId)
        ),
      });
    })
  );

  router.get(
    '/portfolio-scenarios/:scenarioId/diff',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findPortfolioScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.scenario.scope.portfolioId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const versions = await deps.reader.listPortfolioScenarioHistory(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      const from = versions.find((v) => v.scenarioVersion === Number(req.query.from));
      const to = versions.find((v) => v.scenarioVersion === Number(req.query.to));
      if (!from || !to) {
        res.status(404).json({ error: { code: 'VERSION_NOT_FOUND' } });
        return;
      }
      res.json({
        scenarioId: req.params.scenarioId,
        from: from.scenarioVersion,
        to: to.scenarioVersion,
        changes: diffPortfolioScenarios(from, to),
      });
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/portfolio/requests',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = PortfolioRequestSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await requestPortfolioDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `portfolio-request-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.portfolio.request',
        payload: {
          decisionId: parsed.data.decisionId,
          authorityId: parsed.data.authorityId,
          scenarioId: parsed.data.scenarioId,
          scenarioVersion: parsed.data.scenarioVersion,
          dueAt: parsed.data.dueAt,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/initiatives/:initiativeId/gates/portfolio/decision',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const initiativeId = firstParam(req.params.initiativeId);
      const found = await deps.reader.findById(actor.organizationId, initiativeId);
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const decision = await deps.reader.findPortfolioDecisionForInitiative(
        actor.organizationId,
        initiativeId
      );
      if (!decision) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(decision);
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/portfolio/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = PortfolioDecideSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await decidePortfolio(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `portfolio-decision-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.portfolio.decide',
        payload: {
          governanceQuorumRequired: Boolean(policy.config.enforceGateGovernance),
          governanceQuorumRef: parsed.data.governanceQuorumRef,
          decisionId: parsed.data.decisionId,
          outcome: parsed.data.outcome,
          rationale: parsed.data.rationale,
          conditions: parsed.data.conditions,
          mergeTargetInitiativeId: parsed.data.mergeTargetInitiativeId,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );

  router.get(
    '/my-work/portfolio-decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        decisions: await deps.reader.listPendingPortfolioDecisions(
          actor.organizationId,
          actor.userId
        ),
      });
    })
  );

  router.get(
    '/plan-scenarios',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const scenarios = await deps.reader.listPlanScenarios(actor.organizationId);
      const visible = [];
      for (const s of scenarios) {
        const portfolio = await deps.reader.findPortfolioScenario(
          actor.organizationId,
          s.portfolioRef.scenarioId
        );
        if (
          portfolio &&
          (await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.view'))
        )
          visible.push(s);
      }
      res.json({ scenarios: visible });
    })
  );
  router.post(
    '/plan-scenarios/:scenarioId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = PlanScenarioSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.scenario.scenarioId !== req.params.scenarioId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const portfolio = await deps.reader.findPortfolioScenario(
        actor.organizationId,
        parsed.data.scenario.portfolioScenarioId
      );
      if (
        !portfolio ||
        !(await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        portfolio.scenario.scope.portfolioId
      );
      const result = await mutatePlanScenario(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'plan_scenario',
        aggregateId: req.params.scenarioId,
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `plan-scenario-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'plan.scenario.mutate',
        createIfMissing: parsed.data.operation === 'CREATE',
        payload: {
          operation: parsed.data.operation,
          scenario: {
            ...parsed.data.scenario,
            windows: parsed.data.scenario.windows.map((window) => ({
              ...window,
              earliest: window.earliest ?? null,
              target: window.target ?? null,
              latest: window.latest ?? null,
            })),
            publishedBy: parsed.data.scenario.publishedBy ?? null,
            publishedAt: parsed.data.scenario.publishedAt ?? null,
          },
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/plan-scenarios/:scenarioId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findPlanScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      const portfolio = found
        ? await deps.reader.findPortfolioScenario(
            actor.organizationId,
            found.scenario.portfolioScenarioId
          )
        : null;
      if (
        !found ||
        !portfolio ||
        !(await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );
  router.get(
    '/plan-scenarios/:scenarioId/history',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findPlanScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      const portfolio = found
        ? await deps.reader.findPortfolioScenario(
            actor.organizationId,
            found.scenario.portfolioScenarioId
          )
        : null;
      if (
        !found ||
        !portfolio ||
        !(await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json({
        versions: await deps.reader.listPlanScenarioHistory(
          actor.organizationId,
          firstParam(req.params.scenarioId)
        ),
      });
    })
  );
  router.get(
    '/plan-scenarios/:scenarioId/diff',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findPlanScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      const portfolio = found
        ? await deps.reader.findPortfolioScenario(
            actor.organizationId,
            found.scenario.portfolioScenarioId
          )
        : null;
      if (
        !found ||
        !portfolio ||
        !(await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const versions = await deps.reader.listPlanScenarioHistory(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      const from = versions.find((v) => v.scenarioVersion === Number(req.query.from));
      const to = versions.find((v) => v.scenarioVersion === Number(req.query.to));
      if (!from || !to) {
        res.status(404).json({ error: { code: 'VERSION_NOT_FOUND' } });
        return;
      }
      res.json({
        scenarioId: req.params.scenarioId,
        from: from.scenarioVersion,
        to: to.scenarioVersion,
        changes: diffPlanScenarios(from, to),
      });
    })
  );
  router.post(
    '/plan-scenarios/:scenarioId/analysis-proposals/:proposalId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = PlanAnalysisCreateSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.scenarioId !== req.params.scenarioId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findPlanScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      const portfolio = found
        ? await deps.reader.findPortfolioScenario(
            actor.organizationId,
            found.scenario.portfolioScenarioId
          )
        : null;
      if (
        !found ||
        !portfolio ||
        !(await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        portfolio.scenario.scope.portfolioId
      );
      const linkedCapacity = (await deps.reader.listCapacityScenarios(actor.organizationId)).find(
        (candidate) =>
          candidate.state === 'PUBLISHED' &&
          candidate.planRef.scenarioId === found.scenario.scenarioId &&
          candidate.planRef.scenarioVersion === found.scenario.scenarioVersion
      );
      const result = await createPlanAnalysisProposal(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'plan_analysis_proposal',
        aggregateId: firstParam(req.params.proposalId),
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `plan-analysis-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'plan-analysis.create',
        createIfMissing: true,
        payload: {
          scenarioId: parsed.data.scenarioId,
          inputAggregateVersion: parsed.data.inputAggregateVersion,
          capacityScenarioId: parsed.data.useCapacity ? linkedCapacity?.id : undefined,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/plan-analysis-proposals/:proposalId/review',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = PlanAnalysisReviewSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const result = await reviewPlanAnalysisProposal(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'plan_analysis_proposal',
        aggregateId: firstParam(req.params.proposalId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `plan-analysis-review-${parsed.data.clientRequestId}`,
        policyId: 'plan-analysis-review',
        policyVersion: 1,
        commandType: 'plan-analysis.review',
        payload: { outcome: parsed.data.outcome, rationale: parsed.data.rationale },
      });
      res.json(result);
    })
  );

  router.get(
    '/portfolio-scenarios',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const scenarios = await deps.reader.listPortfolioScenarios(actor.organizationId);
      const visible = [];
      for (const s of scenarios)
        if (await deps.authorize(actor, s.scope.portfolioId, 'initiative.view')) visible.push(s);
      res.json({ scenarios: visible });
    })
  );
  router.post(
    '/capacity-scenarios/:scenarioId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = CapacityScenarioSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.scenario.scenarioId !== req.params.scenarioId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const plan = await deps.reader.findPlanScenario(
        actor.organizationId,
        parsed.data.scenario.planScenarioId
      );
      const portfolio = plan
        ? await deps.reader.findPortfolioScenario(
            actor.organizationId,
            plan.scenario.portfolioScenarioId
          )
        : null;
      if (
        !plan ||
        !portfolio ||
        !(await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        portfolio.scenario.scope.portfolioId
      );
      const result = await mutateCapacityScenario(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'capacity_scenario',
        aggregateId: req.params.scenarioId,
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `capacity-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'capacity.scenario.mutate',
        createIfMissing: parsed.data.operation === 'CREATE',
        payload: {
          operation: parsed.data.operation,
          scenario: {
            ...parsed.data.scenario,
            periods: parsed.data.scenario.periods.map((period) => ({
              ...period,
              demand: {
                ...period.demand,
                low: period.demand.low ?? null,
                base: period.demand.base ?? null,
                high: period.demand.high ?? null,
                sourceRef: period.demand.sourceRef ?? null,
                sourceVersion: period.demand.sourceVersion ?? null,
                reason: period.demand.reason ?? null,
              },
              supply: {
                ...period.supply,
                low: period.supply.low ?? null,
                base: period.supply.base ?? null,
                high: period.supply.high ?? null,
                sourceRef: period.supply.sourceRef ?? null,
                sourceVersion: period.supply.sourceVersion ?? null,
                reason: period.supply.reason ?? null,
              },
            })),
            proposedAssignments: parsed.data.scenario.proposedAssignments.map((assignment) => ({
              ...assignment,
              demand: {
                ...assignment.demand,
                low: assignment.demand.low ?? null,
                base: assignment.demand.base ?? null,
                high: assignment.demand.high ?? null,
                sourceRef: assignment.demand.sourceRef ?? null,
                sourceVersion: assignment.demand.sourceVersion ?? null,
                reason: assignment.demand.reason ?? null,
              },
            })),
            publishedBy: parsed.data.scenario.publishedBy ?? null,
            publishedAt: parsed.data.scenario.publishedAt ?? null,
          },
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/capacity-scenarios/:scenarioId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findCapacityScenario(
        actor.organizationId,
        firstParam(req.params.scenarioId)
      );
      if (!found) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );
  router.get(
    '/capacity-scenarios/:scenarioId/history',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        versions: await deps.reader.listCapacityScenarioHistory(
          actor.organizationId,
          firstParam(req.params.scenarioId)
        ),
      });
    })
  );
  router.post(
    '/resource-commitments/:commitmentId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = RequestCommitmentSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const result = await requestResourceCommitment(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'resource_commitment',
        aggregateId: firstParam(req.params.commitmentId),
        expectedVersion: 0,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `commitment-${parsed.data.clientRequestId}`,
        policyId: 'capacity-resource-authority',
        policyVersion: 1,
        commandType: 'resource.commitment.request',
        createIfMissing: true,
        payload: {
          capacityScenarioId: parsed.data.capacityScenarioId,
          capacityScenarioVersion: parsed.data.capacityScenarioVersion,
          assignmentId: parsed.data.assignmentId,
          initiativeId: parsed.data.initiativeId,
          resourceManagerId: parsed.data.resourceManagerId,
          assigneeId: parsed.data.assigneeId,
          expiresAt: parsed.data.expiresAt,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/resource-commitments/:commitmentId/accept',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = AcceptCommitmentSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const result = await acceptResourceCommitment(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'resource_commitment',
        aggregateId: firstParam(req.params.commitmentId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `commitment-accept-${parsed.data.clientRequestId}`,
        policyId: 'capacity-resource-authority',
        policyVersion: 1,
        commandType: 'resource.commitment.accept',
        payload: {},
      });
      res.json(result);
    })
  );
  router.post(
    '/resource-commitments/:commitmentId/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = DecideCommitmentSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const result = await decideResourceCommitment(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'resource_commitment',
        aggregateId: firstParam(req.params.commitmentId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `commitment-decision-${parsed.data.clientRequestId}`,
        policyId: 'capacity-resource-authority',
        policyVersion: 1,
        commandType: 'resource.commitment.decide',
        payload: parsed.data,
      });
      res.json(result);
    })
  );

  router.post(
    '/initiatives/:initiativeId/gates/schedule/requests',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ScheduleRequestSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await requestScheduleDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `schedule-request-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.schedule.request',
        payload: { ...parsed.data, selfApprovalAllowed: Boolean(policy.config.selfApproval) },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/initiatives/:initiativeId/gates/schedule/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ScheduleDecideSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await decideSchedule(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `schedule-decision-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.schedule.decide',
        payload: {
          governanceQuorumRequired: Boolean(policy.config.enforceGateGovernance),
          governanceQuorumRef: parsed.data.governanceQuorumRef,
          decisionId: parsed.data.decisionId,
          outcome: parsed.data.outcome,
          rationale: parsed.data.rationale,
          conditions: parsed.data.conditions,
          selfApprovalAllowed: Boolean(policy.config.selfApproval),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/my-work/schedule-decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        decisions: await deps.reader.listPendingScheduleDecisions(
          actor.organizationId,
          actor.userId
        ),
      });
    })
  );
  router.get(
    '/handoff-packages/:handoffPackageId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const pack = await deps.reader.findHandoffPackage(
        actor.organizationId,
        firstParam(req.params.handoffPackageId)
      );
      const initiativeId = String(
        (pack as (Record<string, unknown> & { version: number }) | null)?.initiativeId ?? ''
      );
      const initiative = initiativeId
        ? await deps.reader.findById(actor.organizationId, initiativeId)
        : null;
      if (
        !pack ||
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(pack);
    })
  );

  router.get(
    '/capacity-scenarios',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const scenarios = await deps.reader.listCapacityScenarios(actor.organizationId);
      const visible = [];
      for (const s of scenarios) {
        const plan = await deps.reader.findPlanScenario(actor.organizationId, s.planRef.scenarioId);
        const portfolio = plan
          ? await deps.reader.findPortfolioScenario(
              actor.organizationId,
              plan.scenario.portfolioScenarioId
            )
          : null;
        if (
          portfolio &&
          (await deps.authorize(actor, portfolio.scenario.scope.portfolioId, 'initiative.view'))
        )
          visible.push(s);
      }
      res.json({ scenarios: visible });
    })
  );
  router.post(
    '/initiatives/:initiativeId/handoff/requests',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = HandoffRequestSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await requestHandoffAcceptance(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `handoff-request-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.handoff.request',
        payload: parsed.data,
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/initiatives/:initiativeId/handoff/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = HandoffDecideSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !found ||
        !(await deps.authorize(actor, found.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        found.initiative.projectId,
        firstParam(req.params.initiativeId)
      );
      const result = await decideHandoffAcceptance(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'initiative',
        aggregateId: firstParam(req.params.initiativeId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `handoff-decision-${parsed.data.clientRequestId}`,
        policyId: policy.policyId,
        policyVersion: policy.version,
        commandType: 'initiative.handoff.decide',
        payload: {
          ...parsed.data,
          governanceQuorumRequired: Boolean(policy.config.enforceGateGovernance),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/my-work/handoff-acceptances',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        decisions: await deps.reader.listPendingHandoffAcceptances(
          actor.organizationId,
          actor.userId
        ),
      });
    })
  );
  router.get(
    '/execution-cases',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      // 1.12-R2 (2026-09-06): TA LISTA BYLA N+1. Stala tu sekwencyjna petla
      // `for (const item of cases) { await findById(); await authorize(); }`,
      // czyli 1 + N zapytan odpalanych jedno po drugim. Zakladka Zasoby liczy
      // swoj limit 12 s na realizacje DOPIERO po tej liscie, wiec kazda
      // sekunda tutaj przesuwa caly ekran w strone szkieletu na zawsze.
      // Teraz: 1 zapytanie o realizacje + 1 zbiorcze o inicjatywy
      // (`listInitiativesByIds`) + autoryzacja per UNIKALNY projekt, rownolegle.
      const cases = await deps.reader.listExecutionCases(actor.organizationId);
      const initiatives = await deps.reader.listInitiativesByIds(
        actor.organizationId,
        cases.map((item) => item.initiativeId)
      );
      const decisions = await authorizeProjectsMap(
        actor,
        [...initiatives.values()].map((entry) => entry.initiative.projectId),
        'initiative.view'
      );
      const visible = cases
        .map((item) => ({ item, initiative: initiatives.get(item.initiativeId) }))
        .filter(
          (entry) =>
            entry.initiative && decisions.get(entry.initiative.initiative.projectId) === true
        )
        // EXE-1 (G14 05-08, 2026-09-03): the "Wybierz realizację" dropdown
        // (ExecutionReportsSurface.tsx) used to render the raw
        // executionCaseId — the initiative name was already loaded here
        // for the authorize() check above, just never sent to the client.
        .map((entry) => ({ ...entry.item, initiativeTitle: entry.initiative!.initiative.title }));
      res.json({ cases: visible });
    })
  );
  router.get(
    '/execution-cases/:executionCaseId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const item = await deps.reader.findExecutionCase(
        actor.organizationId,
        firstParam(req.params.executionCaseId)
      );
      const initiativeId = String(
        (item?.detail as Record<string, unknown> | undefined)?.initiativeId ?? ''
      );
      const initiative = initiativeId
        ? await deps.reader.findById(actor.organizationId, initiativeId)
        : null;
      if (
        !item ||
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(item);
    })
  );
  router.get(
    '/initiatives/:initiativeId/execution-case',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const initiative = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const item = await deps.reader.findExecutionCaseByInitiative(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!item) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(item);
    })
  );

  router.post(
    '/execution-cases/:executionCaseId/milestones/:milestoneId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = MilestoneCreateSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.executionCaseId !== req.params.executionCaseId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const initiative = await deps.reader.findById(actor.organizationId, parsed.data.initiativeId);
      if (
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await createExecutionMilestone(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_milestone',
        aggregateId: firstParam(req.params.milestoneId),
        expectedVersion,
        clientRequestId,
        correlationId: `milestone-${clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.milestone.create',
        createIfMissing: true,
        payload: {
          ...payload,
          targetAt: payload.targetAt ?? null,
          forecastAt: payload.forecastAt ?? null,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/execution-cases/:executionCaseId/milestones',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const executionCase = await deps.reader.findExecutionCase(
        actor.organizationId,
        firstParam(req.params.executionCaseId)
      );
      const initiativeId = String(
        (executionCase?.detail as Record<string, unknown> | undefined)?.initiativeId ?? ''
      );
      const initiative = initiativeId
        ? await deps.reader.findById(actor.organizationId, initiativeId)
        : null;
      if (
        !executionCase ||
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.view'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json({
        items: await deps.reader.listExecutionMilestones(
          actor.organizationId,
          firstParam(req.params.executionCaseId)
        ),
      });
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/tasks/:taskId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = TaskCreateSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.executionCaseId !== req.params.executionCaseId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const initiative = await deps.reader.findById(actor.organizationId, parsed.data.initiativeId);
      if (
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await createExecutionTask(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_task',
        aggregateId: firstParam(req.params.taskId),
        expectedVersion,
        clientRequestId,
        correlationId: `task-${clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.task.create',
        createIfMissing: true,
        payload,
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.patch(
    '/execution-cases/:executionCaseId/tasks/:taskId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = TaskUpdateSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await updateExecutionTask(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_task',
        aggregateId: firstParam(req.params.taskId),
        expectedVersion,
        clientRequestId,
        correlationId: `task-update-${clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.task.update',
        payload: payload as any,
      });
      res.json(result);
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/tasks/:taskId/complete',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = TaskCompleteSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await completeExecutionTask(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_task',
        aggregateId: firstParam(req.params.taskId),
        expectedVersion,
        clientRequestId,
        correlationId: `task-complete-${clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.task.complete',
        payload,
      });
      res.json(result);
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/decisions/:decisionId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = DecisionCreateSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || parsed.data.executionCaseId !== req.params.executionCaseId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await createExecutionDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_decision',
        aggregateId: firstParam(req.params.decisionId),
        expectedVersion,
        clientRequestId,
        correlationId: `decision-${clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.decision.create',
        createIfMissing: true,
        payload,
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/decisions/:decisionId/request',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = DecisionRequestSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const result = await requestExecutionDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_decision',
        aggregateId: firstParam(req.params.decisionId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: `decision-request-${parsed.data.clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.decision.request',
        payload: { expectedCaseVersion: parsed.data.expectedCaseVersion },
      });
      res.json(result);
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/decisions/:decisionId/decide',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = DecisionDecideSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await decideExecutionDecision(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_decision',
        aggregateId: firstParam(req.params.decisionId),
        expectedVersion,
        clientRequestId,
        correlationId: `decision-decide-${clientRequestId}`,
        policyId: 'execution-work',
        policyVersion: 1,
        commandType: 'execution.decision.decide',
        payload: { ...payload, followUpTask: payload.followUpTask ?? null },
      });
      res.json(result);
    })
  );
  router.get(
    '/execution-cases/:executionCaseId/work',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!(await canViewAggregate(actor, 'execution_case', req.params.executionCaseId))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json({
        tasks: await deps.reader.listExecutionTasks(
          actor.organizationId,
          firstParam(req.params.executionCaseId)
        ),
        decisions: await deps.reader.listExecutionDecisions(
          actor.organizationId,
          firstParam(req.params.executionCaseId)
        ),
      });
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/tasks/:taskId/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = WorkHardeningSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await transitionCanonicalTask(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'execution_task',
          aggregateId: firstParam(req.params.taskId),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'execution-work',
          policyVersion: 1,
          commandType: 'execution.task.transition',
          payload,
        })
      );
    })
  );
  router.post(
    '/execution-cases/:executionCaseId/decisions/:decisionId/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = DecisionHardeningSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await transitionCanonicalDecision(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'execution_decision',
          aggregateId: firstParam(req.params.decisionId),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'execution-work',
          policyVersion: 1,
          commandType: 'execution.decision.transition',
          payload,
        })
      );
    })
  );
  router.get(
    '/my-work/execution',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json(await deps.reader.listMyExecutionWork(actor.organizationId, actor.userId));
    })
  );

  router.post(
    '/execution-cases/:executionCaseId/tasks/:taskId/allocations/:allocationId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = AllocationProposeSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (
        !parsed.success ||
        parsed.data.executionCaseId !== req.params.executionCaseId ||
        parsed.data.taskId !== req.params.taskId
      ) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await proposeOperationalAllocation(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'operational_allocation',
        aggregateId: firstParam(req.params.allocationId),
        expectedVersion,
        clientRequestId,
        correlationId: `allocation-${clientRequestId}`,
        policyId: 'operational-allocation',
        policyVersion: 1,
        commandType: 'operational-allocation.propose',
        createIfMissing: true,
        payload: {
          ...payload,
          demand: {
            ...payload.demand,
            low: payload.demand.low ?? null,
            base: payload.demand.base ?? null,
            high: payload.demand.high ?? null,
          },
          availabilityRef: {
            ...payload.availabilityRef,
            ref: payload.availabilityRef.ref ?? null,
            version: payload.availabilityRef.version ?? null,
            reason: payload.availabilityRef.reason ?? null,
          },
          calendarRef: {
            ...payload.calendarRef,
            ref: payload.calendarRef.ref ?? null,
            version: payload.calendarRef.version ?? null,
            reason: payload.calendarRef.reason ?? null,
          },
          remainingEstimateRef: {
            ...payload.remainingEstimateRef,
            ref: payload.remainingEstimateRef.ref ?? null,
            version: payload.remainingEstimateRef.version ?? null,
            reason: payload.remainingEstimateRef.reason ?? null,
          },
          costRef: payload.costRef ?? null,
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/operational-allocations/simulate',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = AllocationSimulationSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      res.json(
        simulateOperationalAllocation(
          {
            ...parsed.data.allocation,
            demand: {
              ...parsed.data.allocation.demand,
              low: parsed.data.allocation.demand.low ?? null,
              base: parsed.data.allocation.demand.base ?? null,
              high: parsed.data.allocation.demand.high ?? null,
            },
            availabilityRef: {
              ...parsed.data.allocation.availabilityRef,
              ref: parsed.data.allocation.availabilityRef.ref ?? null,
              version: parsed.data.allocation.availabilityRef.version ?? null,
              reason: parsed.data.allocation.availabilityRef.reason ?? null,
            },
            calendarRef: {
              ...parsed.data.allocation.calendarRef,
              ref: parsed.data.allocation.calendarRef.ref ?? null,
              version: parsed.data.allocation.calendarRef.version ?? null,
              reason: parsed.data.allocation.calendarRef.reason ?? null,
            },
            remainingEstimateRef: {
              ...parsed.data.allocation.remainingEstimateRef,
              ref: parsed.data.allocation.remainingEstimateRef.ref ?? null,
              version: parsed.data.allocation.remainingEstimateRef.version ?? null,
              reason: parsed.data.allocation.remainingEstimateRef.reason ?? null,
            },
          },
          parsed.data.expectedTimeBasis
        )
      );
    })
  );
  router.post(
    '/operational-allocations/:allocationId/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = AllocationTransitionSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await transitionOperationalAllocation(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'operational_allocation',
        aggregateId: firstParam(req.params.allocationId),
        expectedVersion,
        clientRequestId,
        correlationId: `allocation-transition-${clientRequestId}`,
        policyId: 'operational-allocation',
        policyVersion: 1,
        commandType: 'operational-allocation.transition',
        payload,
      });
      res.json(result);
    })
  );
  router.get(
    '/execution-cases/:executionCaseId/allocations',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!(await canViewAggregate(actor, 'execution_case', req.params.executionCaseId))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json({
        items: await deps.reader.listOperationalAllocations(
          actor.organizationId,
          firstParam(req.params.executionCaseId)
        ),
      });
    })
  );
  router.get(
    '/my-work/operational-allocations',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        items: await deps.reader.listMyOperationalAllocations(actor.organizationId, actor.userId),
      });
    })
  );

  router.get(
    '/command-receipts/:clientRequestId/read-back',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const readBack = await deps.unitOfWork.transaction(async (tx) => {
        const receipt = await tx.findReceipt<any>(
          actor.organizationId,
          firstParam(req.params.clientRequestId)
        );
        if (!receipt) return null;
        const allowed = await canViewAggregate(actor, receipt.aggregateType, receipt.aggregateId);
        if (!allowed) return null;
        const currentVersion = await tx.getAggregateVersion(
          actor.organizationId,
          receipt.aggregateType,
          receipt.aggregateId
        );
        return {
          receiptId: receipt.clientRequestId,
          commandType: receipt.commandType,
          aggregateType: receipt.aggregateType,
          aggregateId: receipt.aggregateId,
          aggregateVersion: receipt.aggregateVersion,
          currentVersion,
          correlationId: receipt.correlationId,
          readBackState:
            currentVersion !== null && currentVersion >= receipt.aggregateVersion
              ? 'CONFIRMED'
              : 'PENDING',
          response: receipt.response,
        };
      });
      if (!readBack) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(readBack);
    })
  );

  router.post(
    '/execution-control-kpi-policies/:policyId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ExecutionControlKpiPolicySchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const claimedOrganizationId = String(
        (req.body as Record<string, unknown> | undefined)?.organizationId ||
          req.header('X-Organization-Id') ||
          ''
      ).trim();
      if (claimedOrganizationId && claimedOrganizationId !== actor.organizationId)
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      if (!(await deps.authorize(actor, '', 'initiative.update')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });

      const { expectedVersion, clientRequestId, name, parameters } = parsed.data;
      const policyId = firstParam(req.params.policyId);
      const result = await authorExecutionControlKpiPolicy(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_control_kpi_policy',
        aggregateId: policyId,
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId,
        policyVersion: expectedVersion + 1,
        commandType: 'execution-control-kpi-policy.author',
        createIfMissing: true,
        payload: { name, parameters },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/goals/:goalId/perspective',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = GoalPerspectiveAssignmentSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'INVALID_PERSPECTIVE' } });
      const claimedOrganizationId = String(
        (req.body as Record<string, unknown> | undefined)?.organizationId ||
          req.header('X-Organization-Id') ||
          ''
      ).trim();
      if (claimedOrganizationId && claimedOrganizationId !== actor.organizationId)
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      if (!(await deps.authorize(actor, '', 'initiative.update')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const goalId = firstParam(req.params.goalId);
      const { expectedVersion, clientRequestId, perspective } = parsed.data;
      const result = await assignGoalPerspective(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'goal_perspective',
        aggregateId: goalId,
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: expectedVersion + 1,
        commandType: 'goal-perspective.assign',
        createIfMissing: true,
        payload: { perspective },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/initiatives/:initiativeId/budget-entries/:entryId/void',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ExecutionBudgetVoidSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      if (!(await authorizeProjects(actor, projectIds, 'initiative.update')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const result = await voidExecutionBudgetEntry(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_budget_entry',
        aggregateId: firstParam(req.params.entryId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: parsed.data.clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'execution-budget-entry.void',
        payload: { initiativeId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/initiatives/:initiativeId/budget-entries/:entryId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ExecutionBudgetEntrySchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      if (!(await authorizeProjects(actor, projectIds, 'initiative.update'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...entry } = parsed.data;
      const result = await createExecutionBudgetEntry(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_budget_entry',
        aggregateId: firstParam(req.params.entryId),
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'execution-budget-entry.create',
        createIfMissing: true,
        payload: { ...entry, initiativeId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/initiatives/:initiativeId/realizations/:realizationId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ExecutionRealizationSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      if (!(await authorizeProjects(actor, projectIds, 'initiative.update')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const { expectedVersion, clientRequestId, ...entry } = parsed.data;
      const result = await recordExecutionRealization(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'execution_realization',
        aggregateId: firstParam(req.params.realizationId),
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'execution-realization.record',
        createIfMissing: true,
        payload: { ...entry, initiativeId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/initiatives/:initiativeId/realizations',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const items = await deps.reader.listExecutionRealizations(actor.organizationId, initiativeId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'execution_realization',
          (item: any) => item.realizationId
        ),
      });
    })
  );
  router.post(
    '/initiatives/:initiativeId/raid-items/:raidItemId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = RaidItemCreateSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      const canUpdate =
        projectIds.length > 0
          ? await authorizeProjects(actor, projectIds, 'initiative.update')
          : await deps.authorize(actor, '', 'initiative.update');
      if (!canUpdate) return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const { expectedVersion, clientRequestId, ...item } = parsed.data;
      const result = await createRaidItem(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'raid_item',
        aggregateId: firstParam(req.params.raidItemId),
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'raid-item.create',
        createIfMissing: true,
        payload: { ...item, initiativeId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.delete(
    '/initiatives/:initiativeId/raid-items/:raidItemId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = RaidItemDeleteSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      const canUpdate =
        projectIds.length > 0
          ? await authorizeProjects(actor, projectIds, 'initiative.update')
          : await deps.authorize(actor, '', 'initiative.update');
      if (!canUpdate) return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const result = await deleteRaidItem(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'raid_item',
        aggregateId: firstParam(req.params.raidItemId),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: parsed.data.clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'raid-item.delete',
        payload: { initiativeId },
      });
      res.status(200).json(result);
    })
  );
  router.post(
    '/initiatives/:initiativeId/raid-mitigations/:raidItemId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = RaidMitigationSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      if (!(await authorizeProjects(actor, projectIds, 'initiative.update')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const { expectedVersion, clientRequestId, ...mitigation } = parsed.data;
      const raidItemId = firstParam(req.params.raidItemId);
      const result = await recordRaidMitigation(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'raid_mitigation',
        aggregateId: raidItemId,
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'raid-mitigation.record',
        createIfMissing: true,
        payload: { ...mitigation, initiativeId, raidItemId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/initiatives/:initiativeId/raid-mitigations',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const items = await deps.reader.listRaidMitigations(actor.organizationId, initiativeId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'raid_mitigation',
          (item: any) => item.raidItemId
        ),
      });
    })
  );
  router.post(
    '/initiatives/:initiativeId/manager-actions/:managerActionId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ManagerExecutionActionSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      if (!(await authorizeProjects(actor, projectIds, 'initiative.update')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const { expectedVersion, clientRequestId, ...action } = parsed.data;
      const result = await executeCanonicalManagerAction(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'manager_execution_action',
        aggregateId: firstParam(req.params.managerActionId),
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'manager-action.execute',
        createIfMissing: true,
        payload: { ...action, initiativeId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/initiatives/:initiativeId/manager-actions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const items = await deps.reader.listManagerExecutionActions(
        actor.organizationId,
        initiativeId
      );
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'manager_execution_action',
          (item: any) => item.managerActionId
        ),
      });
    })
  );
  router.post(
    '/initiatives/:initiativeId/manager-suggestions/:suggestionId/review',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ManagerSuggestionReviewSchema.safeParse(req.body);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      if (!parsed.success)
        return void res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const projectIds = await deps.reader.resolveProjectIdsForAggregate(
        actor.organizationId,
        'initiative',
        initiativeId
      );
      if (!(await authorizeProjects(actor, projectIds, 'initiative.review')))
        return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
      const { expectedVersion, clientRequestId, ...review } = parsed.data;
      const suggestionId = firstParam(req.params.suggestionId);
      const result = await reviewManagerSuggestion(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'manager_suggestion_review',
        aggregateId: suggestionId,
        expectedVersion,
        clientRequestId,
        correlationId: clientRequestId,
        policyId: 'execution-control',
        policyVersion: 1,
        commandType: 'manager-suggestion.review',
        createIfMissing: true,
        payload: { ...review, initiativeId, suggestionId },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.get(
    '/initiatives/:initiativeId/manager-suggestion-reviews',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) return void res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
      const initiativeId = firstParam(req.params.initiativeId);
      const items = await deps.reader.listManagerSuggestionReviews(
        actor.organizationId,
        initiativeId
      );
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'manager_suggestion_review',
          (item: any) => item.suggestionId
        ),
      });
    })
  );
  router.get('/execution-write-map', (_req, res) => {
    res.json({
      canonicalWriter: '/api/initiatives/runtime-v1',
      mappings: [
        {
          legacyMethod: 'POST',
          legacyPath: '/api/v8/execution-control/budget/entries',
          canonicalCommand:
            'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId',
        },
        {
          legacyMethod: 'POST',
          legacyPath: '/api/v8/execution-control/realizations',
          canonicalCommand:
            'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/realizations/:realizationId',
        },
        {
          legacyMethod: 'PATCH',
          legacyPath: '/api/v8/execution-control/raid/:raidItemId/mitigation',
          canonicalCommand:
            'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations/:raidItemId',
        },
        {
          legacyMethod: 'POST',
          legacyPath: '/api/v8/execution-control/manager/lanes/:laneId/problem-actions/execute',
          canonicalCommand:
            'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-actions/:managerActionId',
        },
        {
          legacyMethod: 'POST',
          legacyPath: '/api/v8/execution-control/manager/lanes/:laneId/suggestions/apply',
          canonicalCommand:
            'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/manager-suggestions/:suggestionId/review',
        },
      ],
    });
  });
  router.post(
    '/management-signals/ingest',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = SignalIngestSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data,
        aggregateId = managementSignalFingerprint(payload);
      const result = await ingestManagementSignal(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'management_signal',
        aggregateId,
        expectedVersion,
        clientRequestId,
        correlationId: `signal-${clientRequestId}`,
        policyId: 'management-control',
        policyVersion: 1,
        commandType: 'management-signal.ingest',
        createIfMissing: expectedVersion === 0,
        payload,
      });
      res.status(result.status === 'APPLIED' && expectedVersion === 0 ? 201 : 200).json(result);
    })
  );
  router.post(
    '/interventions/:interventionId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = InterventionDraftSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await draftInterventionCase(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'intervention_case',
        aggregateId: firstParam(req.params.interventionId),
        expectedVersion,
        clientRequestId,
        correlationId: `intervention-${clientRequestId}`,
        policyId: 'management-control',
        policyVersion: 1,
        commandType: 'intervention.draft',
        createIfMissing: expectedVersion === 0,
        payload,
      });
      res.status(result.status === 'APPLIED' && expectedVersion === 0 ? 201 : 200).json(result);
    })
  );
  router.post(
    '/interventions/:interventionId/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = InterventionTransitionSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      res.json(
        await transitionInterventionCase(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'intervention_case',
          aggregateId: firstParam(req.params.interventionId),
          expectedVersion,
          clientRequestId,
          correlationId: `intervention-transition-${clientRequestId}`,
          policyId: 'management-control',
          policyVersion: 1,
          commandType: 'intervention.transition',
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/management-signals',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listManagementSignals(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'management_signal',
          (item: any) => item.signalId
        ),
      });
    })
  );
  router.get(
    '/interventions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listInterventionCases(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'intervention_case',
          (item: any) => item.interventionId
        ),
      });
    })
  );
  router.post(
    '/report-definitions/:definitionId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ReportDefinitionCreateSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await createReportDefinition(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'report_definition',
        aggregateId: firstParam(req.params.definitionId),
        expectedVersion,
        clientRequestId,
        correlationId: `report-definition-${clientRequestId}`,
        policyId: 'report-definition',
        policyVersion: 1,
        commandType: 'report-definition.create',
        createIfMissing: true,
        payload: {
          ...payload,
          formulas: payload.formulas.map((formula) => ({
            ...formula,
            unit: formula.unit ?? null,
            currency: formula.currency ?? null,
            windowId: formula.windowId ?? null,
          })),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/report-definitions/:definitionId/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ReportDefinitionTransitionSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      res.json(
        await transitionReportDefinition(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'report_definition',
          aggregateId: firstParam(req.params.definitionId),
          expectedVersion,
          clientRequestId,
          correlationId: `report-definition-transition-${clientRequestId}`,
          policyId: 'report-definition',
          policyVersion: 1,
          commandType: 'report-definition.transition',
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/report-definitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listReportDefinitions(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'report_definition',
          (item: any) => item.definitionId
        ),
      });
    })
  );
  router.post(
    '/report-runs/:reportRunId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ReportDraftSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      const result = await createReportRun(deps.unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'report_run',
        aggregateId: firstParam(req.params.reportRunId),
        expectedVersion,
        clientRequestId,
        correlationId: `report-${clientRequestId}`,
        policyId: 'report-run',
        policyVersion: 1,
        commandType: 'report-run.create',
        createIfMissing: true,
        payload: {
          ...payload,
          parentRunRef: payload.parentRunRef ?? null,
          sources: payload.sources.map((source) => ({
            ...source,
            formula: source.formula ?? null,
            unit: source.unit ?? null,
            currency: source.currency ?? null,
            window: source.window ?? null,
          })),
        },
      });
      res.status(result.status === 'APPLIED' ? 201 : 200).json(result);
    })
  );
  router.post(
    '/report-runs/:reportRunId/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        parsed = ReportTransitionSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = parsed.data;
      res.json(
        await transitionReportRun(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'report_run',
          aggregateId: firstParam(req.params.reportRunId),
          expectedVersion,
          clientRequestId,
          correlationId: `report-transition-${clientRequestId}`,
          policyId: 'report-run',
          policyVersion: 1,
          commandType: 'report-run.transition',
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/report-runs/:reportRunId/reconstruct',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const parsed = ReportReconstructionSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!parsed.success || new Date(parsed.data.asOf).getTime() > Date.now()) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const reportRunId = firstParam(req.params.reportRunId);
      const run = (await deps.reader.listReportRuns(actor.organizationId)).find(
        (item: any) => item.reportRunId === reportRunId
      );
      if (!run || !(await canViewAggregate(actor, 'report_run', reportRunId))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const versions = deps.asOfVersions
        ? await deps.asOfVersions.resolve(
            actor.organizationId,
            (run as any).sources,
            parsed.data.asOf
          )
        : new Date().toISOString();
      res.json(reconstructReportRun(run as any, parsed.data.asOf, versions));
    })
  );
  router.get(
    '/report-definitions/:definitionId',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findReportDefinition(
        actor.organizationId,
        firstParam(req.params.definitionId)
      );
      if (!found) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (!(await canViewAggregate(actor, 'report_definition', req.params.definitionId))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );
  router.get(
    '/report-runs',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listReportRuns(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'report_run',
          (item: any) => item.reportRunId
        ),
      });
    })
  );
  router.get(
    '/control-kpis',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      const weekStart = String(req.query.weekStart || '').trim();
      const policyId = String(req.query.policyId || '').trim() || null;
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      if (!deps.controlKpis) {
        res.status(503).json({ error: { code: 'CONTROL_KPI_READ_MODEL_UNAVAILABLE' } });
        return;
      }
      res.json(await deps.controlKpis.read(actor.organizationId, weekStart, policyId));
    })
  );
  router.post(
    '/delivery-acceptances/:id/request',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = AcceptanceCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await requestDeliveryAcceptance(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'delivery_acceptance',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'delivery-acceptance',
          policyVersion: 1,
          commandType: 'delivery-acceptance.request',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/delivery-acceptances/:id/decide',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = AcceptanceCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await decideDeliveryAcceptance(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'delivery_acceptance',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'delivery-acceptance',
          policyVersion: 1,
          commandType: 'delivery-acceptance.decide',
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/results-acceptances/:id/request',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = AcceptanceCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await requestResultsAcceptance(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'results_acceptance',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'results-acceptance',
          policyVersion: 1,
          commandType: 'results-acceptance.request',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/results-acceptances/:id/decide',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = AcceptanceCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await decideResultsAcceptance(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'results_acceptance',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'results-acceptance',
          policyVersion: 1,
          commandType: 'results-acceptance.decide',
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/delivery-acceptances',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listDeliveryAcceptances(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'delivery_acceptance',
          (item: any) => item.decisionId
        ),
      });
    })
  );
  router.get(
    '/results-acceptances',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listResultsAcceptances(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'results_acceptance',
          (item: any) => item.resultsCaseId
        ),
      });
    })
  );
  router.get(
    '/benefits-handoff-packs/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const found = await deps.reader.findBenefitsHandoffPack(
        actor.organizationId,
        firstParam(req.params.id)
      );
      if (!found) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );
  router.get(
    '/my-work/acceptances',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json(await deps.reader.listMyAcceptanceWork(actor.organizationId, actor.userId));
    })
  );
  router.post(
    '/finance-reconciliations/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await createFinanceReconciliation(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'finance_reconciliation',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'finance-reconciliation',
          policyVersion: 1,
          commandType: 'finance-reconciliation.create',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/results-observations/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await createResultsKpiObservation(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'results_kpi_observation',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'results-observation',
          policyVersion: 1,
          commandType: 'results-observation.create',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/finance-reconciliations/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const item = await deps.reader.findFinanceReconciliation(
        actor.organizationId,
        firstParam(req.params.id)
      );
      if (!item || !(await canViewAggregate(actor, 'finance_reconciliation', req.params.id))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(item);
    })
  );
  router.get(
    '/results-observations',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listResultsKpiObservations(
        actor.organizationId,
        typeof req.query.resultsCaseId === 'string' ? req.query.resultsCaseId : undefined
      );
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'results_kpi_observation',
          (item: any) => item.observationId
        ),
      });
    })
  );
  router.get(
    '/results-observations/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const item = await deps.reader.findResultsKpiObservation(
        actor.organizationId,
        firstParam(req.params.id)
      );
      if (!item || !(await canViewAggregate(actor, 'results_kpi_observation', req.params.id))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(item);
    })
  );
  router.post(
    '/effectiveness/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await createEffectivenessCase(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'effectiveness_case',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'effectiveness',
          policyVersion: 1,
          commandType: 'effectiveness.create',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/effectiveness/:id/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await transitionEffectiveness(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'effectiveness_case',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'effectiveness',
          policyVersion: 1,
          commandType: 'effectiveness.transition',
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/effectiveness/:id/close',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await closeEffectiveInitiative(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'effectiveness_case',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'effectiveness',
          policyVersion: 1,
          commandType: 'effectiveness.close',
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/closures/:id/requests',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const initiativeId = String((p.data as any).initiativeId ?? '');
      const initiative = initiativeId
        ? await deps.reader.findById(actor.organizationId, initiativeId)
        : null;
      if (
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.update'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        initiative.initiative.projectId,
        initiativeId
      );
      res.json(
        await requestClosureCase(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'closure_case',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: policy.policyId,
          policyVersion: policy.version,
          commandType: 'closure.request',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/closures/:id/decisions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const closure = await deps.reader.findClosureCase(
        actor.organizationId,
        firstParam(req.params.id)
      );
      const initiativeId = String((closure as any)?.initiativeId ?? '');
      const initiative = initiativeId
        ? await deps.reader.findById(actor.organizationId, initiativeId)
        : null;
      if (
        !closure ||
        !initiative ||
        !(await deps.authorize(actor, initiative.initiative.projectId, 'initiative.review'))
      ) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
        actor.organizationId,
        initiative.initiative.projectId,
        initiativeId
      );
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await decideClosureCase(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'closure_case',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: policy.policyId,
          policyVersion: policy.version,
          commandType: 'closure.decide',
          payload: {
            ...payload,
            governanceQuorumRequired: Boolean(policy.config.enforceGateGovernance),
          } as any,
        })
      );
    })
  );
  router.get(
    '/closures',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listClosureCases(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'closure_case',
          (item: any) => item.closureCaseId
        ),
      });
    })
  );
  router.get(
    '/effectiveness-snapshots/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const item = await deps.reader.findEffectivenessSnapshot(
        actor.organizationId,
        firstParam(req.params.id)
      );
      if (!item || !(await canViewAggregate(actor, 'effectiveness_snapshot', req.params.id))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(item);
    })
  );
  router.post(
    '/archives/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = EffectivenessCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await archiveClosedInitiative(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'archive_manifest',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'archive',
          policyVersion: 1,
          commandType: 'initiative.archive',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/effectiveness',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listEffectivenessCases(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'effectiveness_case',
          (item: any) => item.effectivenessCaseId
        ),
      });
    })
  );
  router.get(
    '/closure-snapshots/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const x = await deps.reader.findClosureSnapshot(
        actor.organizationId,
        firstParam(req.params.id)
      );
      if (!x || !(await canViewAggregate(actor, 'closure_snapshot', req.params.id))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(x);
    })
  );
  router.get(
    '/archives',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listArchiveManifests(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'archive_manifest',
          (item: any) => item.archiveId
        ),
      });
    })
  );
  router.get(
    '/my-work/effectiveness',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        items: await deps.reader.listMyEffectivenessWork(actor.organizationId, actor.userId),
      });
    })
  );
  router.post(
    '/material-changes/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = MaterialChangeCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await createMaterialChange(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'material_change',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'material-change',
          policyVersion: 1,
          commandType: 'material-change.create',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/material-changes/:id/transitions',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = MaterialChangeCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await transitionMaterialChange(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'material_change',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'material-change',
          policyVersion: 1,
          commandType: 'material-change.transition',
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/material-changes',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listMaterialChanges(actor.organizationId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'material_change',
          (item: any) => item.proposalId
        ),
      });
    })
  );
  router.get(
    '/my-work/material-changes',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const items = await deps.reader.listMyMaterialChangeWork(actor.organizationId, actor.userId);
      res.json({
        items: await filterVisibleAggregates(
          actor,
          items,
          'material_change',
          (item: any) => item.proposalId
        ),
      });
    })
  );
  router.post(
    '/ai-analysis-proposals/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = AIAnalysisCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await createAIAnalysisProposal(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'ai_analysis_proposal',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'ai-evidence',
          policyVersion: 1,
          commandType: 'ai-analysis.create',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/ai-analysis-proposals/:id/review',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = AIAnalysisCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await reviewAIAnalysisProposal(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'ai_analysis_proposal',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'ai-evidence',
          policyVersion: 1,
          commandType: 'ai-analysis.review',
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/ai-analysis-proposals',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({ items: await deps.reader.listAIAnalysisProposals(actor.organizationId) });
    })
  );
  router.get(
    '/my-work/ai-analysis-reviews',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({
        items: await deps.reader.listMyAIAnalysisReviews(actor.organizationId, actor.userId),
      });
    })
  );
  router.post(
    '/capacity-options/:id',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = CapacityOptionsCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await createCapacityOptions(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'capacity_options',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'capacity-options',
          policyVersion: 1,
          commandType: 'capacity-options.create',
          createIfMissing: true,
          payload: payload as any,
        })
      );
    })
  );
  router.post(
    '/capacity-options/:id/select',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = CapacityOptionsCommandSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const { expectedVersion, clientRequestId, ...payload } = p.data;
      res.json(
        await selectCapacityOption(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'capacity_options',
          aggregateId: firstParam(req.params.id),
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: 'capacity-options',
          policyVersion: 1,
          commandType: 'capacity-options.select',
          payload: payload as any,
        })
      );
    })
  );
  router.get(
    '/capacity-options',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({ items: await deps.reader.listCapacityOptions(actor.organizationId) });
    })
  );
  router.post(
    '/initiatives/:initiativeId/gate-signoffs',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req),
        p = GateSignoffSchema.safeParse(req.body);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      if (!p.success) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findById(
        actor.organizationId,
        firstParam(req.params.initiativeId)
      );
      if (!found) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(
          actor.organizationId,
          found.initiative.projectId,
          firstParam(req.params.initiativeId)
        ),
        { expectedVersion, clientRequestId, ...data } = p.data,
        aggregateId = gateSignoffId(data.gate, data.decisionId, actor.userId, data.roleKey);
      res.json(
        await submitGateSignoff(deps.unitOfWork, {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          aggregateType: 'gate_signoff',
          aggregateId,
          expectedVersion,
          clientRequestId,
          correlationId: clientRequestId,
          policyId: policy.policyId,
          policyVersion: policy.version,
          commandType: 'gate.signoff',
          createIfMissing: true,
          payload: {
            ...data,
            initiativeId: firstParam(req.params.initiativeId),
            delegationProof: data.delegationProof ?? null,
            policy,
          },
        })
      );
    })
  );
  router.get(
    '/my-work/gate-signoffs',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const pending = await deps.reader.listMyGateSignoffs(actor.organizationId, actor.userId);
      const items = [];
      for (const item of pending) {
        if (
          item.actorAuthorized &&
          item.effectivePolicy.policyEnforced &&
          item.projectId &&
          (await deps.authorize(actor, item.projectId, 'initiative.review'))
        ) {
          items.push(item);
        }
      }
      res.json({ items });
    })
  );
  router.get(
    '/gate-quorums',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      res.json({ items: await deps.reader.listGateQuorums(actor.organizationId) });
    })
  );

  router.get(
    '/source-read-back',
    asyncHandler(async (req, res) => {
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const sourceType = String(req.query.sourceType || '').trim();
      const sourceId = String(req.query.sourceId || '').trim();
      if (!sourceType || !sourceId) {
        res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
        return;
      }
      const found = await deps.reader.findBySource(actor.organizationId, sourceType, sourceId);
      if (!found) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      if (!(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      res.json(found);
    })
  );

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof MaterialCommandConflictError) {
      res.status(409).json({
        error: {
          code: 'VERSION_OR_IDEMPOTENCY_CONFLICT',
          expectedVersion: error.expectedVersion,
          currentVersion: error.currentVersion,
        },
      });
      return;
    }
    if (error instanceof MaterialCommandValidationError) {
      if (error.message.includes('Authorized signer role or exact delegation proof required')) {
        res.status(403).json({ error: { code: 'GATE_SIGNOFF_AUTHORITY_REQUIRED' } });
        return;
      }
      // FIX-4 (odbior dyzuru 33): „nie ma takiego celu w mojej organizacji" to NIE jest
      // bledna komenda, tylko brak zasobu. DoD wymaga 404. Zrodlo:
      // server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:516
      // rzuca GOAL_NOT_FOUND, gdy UPDATE goals ... WHERE organization_id=$2 AND id=$3
      // nie trafil w zaden wiersz — czyli takze wtedy, gdy cel nalezy do innego tenanta.
      // Wczesniej wpadalo to w ogolne 400 COMMAND_VALIDATION_FAILED, wiec obcy tenant
      // dostawal inna odpowiedz niz na nieistniejacy identyfikator.
      if (error.message === 'GOAL_NOT_FOUND') {
        res.status(404).json({ error: { code: 'GOAL_NOT_FOUND' } });
        return;
      }
      res.status(400).json({ error: { code: 'COMMAND_VALIDATION_FAILED' } });
      return;
    }
    res.status(500).json({ error: { code: 'INITIATIVES_EXECUTION_RUNTIME_FAILED' } });
  });
  return router;
}

const runtimePool = new Pool(databaseConfig.postgres as PoolConfig | undefined);
const runtimeDependencies: InitiativesExecutionRuntimeDependencies = {
  unitOfWork: new PostgresMaterialCommandUnitOfWork(runtimePool),
  reader: new PostgresInitiativeReader(runtimePool),
  controlKpis: new ControlKpiReadModel(runtimePool),
  asOfVersions: new PostgresAsOfVersionReader(runtimePool),
  resolvePolicy: (organizationId, projectId, initiativeId) =>
    new PostgresGovernancePolicyResolver(runtimePool).resolve(
      organizationId,
      projectId,
      initiativeId
    ),
  authorize: async (actor, projectId, capability) => {
    const access = await resolveEffectiveAccess({
      userId: actor.userId,
      organizationId: actor.organizationId,
      applicationRole: actor.applicationRole,
      projectId,
      isImpersonating: actor.isImpersonating,
    });
    return hasEffectiveCapability(access, capability);
  },
};

export default createInitiativesExecutionRuntimeRouter(runtimeDependencies);
