/**
 * T1 — Contract Integration Tests (C01–C18)
 *
 * Verifies that the output of one V8 service can be parsed/consumed by the
 * input schema of another V8 service.  No DB calls — pure Zod schema validation.
 */

import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

// ── Upstream / downstream schemas ──────────────────────────────────────────

import {
  ContextSnapshotSchema,
} from '../../../../../types/contextSnapshot.js';

import {
  ExecutionAgentRunSchema,
  ActionProposalSchema,
} from '../../../../../types/executionSpine.js';

import {
  InitiateHandoffParamsSchema,
  CreateChatActionProposalParamsSchema,
  ChatExecutionHandoffSchema,
} from '../../../../../types/chatExecutionIntegration.js';

import {
  CreateRetrievalRequestParamsSchema,
} from '../../../../../types/governedRetrieval.js';

import {
  TrustClassValues as TrustAuditTrustClassValues,
} from '../../../../../types/trustAudit.js';

import {
  WorkingMemoryOrchestrationResultSchema,
  OrchestrateRetrievalParamsSchema,
} from '../../../../../types/knowledgeRetrievalIntegration.js';

import {
  ReleaseBundleSchema,
} from '../../../../../types/promptOsRuntime.js';

import {
  SetAIGovernanceConfigParamsSchema,
  OutputArtifactSchema,
} from '../../../../../types/reportsPresOperatingModel.js';

import {
  RecordMaterializationParamsSchema,
  ValidatePromotionParamsSchema,
  PromotionValidationSchema,
} from '../../../../../types/sourceTruthPreservation.js';

import {
  CreateRebaselineProposalParamsSchema,
  ExecutionSignalSchema,
} from '../../../../../types/executionVisibility.js';

import {
  CollaborationRoomSchema,
  RecordEventParamsSchema,
} from '../../../../../types/collaborationRoom.js';

import {
  StartFacilitationParamsSchema,
  UpdateSurfacePresenceParamsSchema,
} from '../../../../../types/multiplayerHardening.js';

import {
  ConnectorAuthRecordSchema,
  SetConnectorAuthStateParamsSchema,
} from '../../../../../types/pmSyncTruth.js';

import {
  EscalationLevelValues,
} from '../../../../../types/pmSyncAuthBaseline.js';

import {
  DeadLetterRecordSchema,
} from '../../../../../types/replayDeadLetterReliability.js';

import {
  RecordFleetHealthParamsSchema,
} from '../../../../../types/operatorAdminSurfaces.js';

import {
  KPIDefinitionSchema,
  InitiateReconciliationParamsSchema,
} from '../../../../../types/resultsROIContinuity.js';

import {
  CreatePublishRecordParamsSchema,
} from '../../../../../types/publishReviewSemantics.js';

import {
  PromotionGateSchema,
} from '../../../../../types/financeIntegrationPromotion.js';

import {
  RecordInboxMaterializationParamsSchema,
} from '../../../../../types/myWorkRoofPackage.js';

import {
  ToolCapabilitySchema,
  RegisterToolParamsSchema as GovRegisterToolParamsSchema,
} from '../../../../../types/toolGovernance.js';

import {
  SharedToolsRegistryEntrySchema,
  RegisterToolParamsSchema as OrgAdminRegisterToolParamsSchema,
} from '../../../../../types/toolsOrgAdminHardening.js';

import {
  LockRecordSchema,
  AcquireLockParamsSchema,
} from '../../../../../types/concurrentEditingNotification.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => randomUUID();
const now = () => new Date().toISOString();

// ═══════════════════════════════════════════════════════════════════════════
// C01: ContextSnapshot → ChatExecution (snapshotId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C01: ContextSnapshot → ChatExecution', () => {
  const snapshotOutput = {
    snapshotId: uuid(),
    snapshotVersion: 1,
    capturedAt: now(),
    workspaceId: uuid(),
    organizationId: uuid(),
    projectId: null,
    conversationId: uuid(),
    executionRunId: null,
    artifactRefs: [],
    effectiveScopeRef: 'scope:default',
    resolvedRoleRef: 'role:analyst',
    initiatorUserId: uuid(),
    consumerClass: 'chat' as const,
    privacyMode: false,
    sourceContextRefs: [],
    driftEvents: [],
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ContextSnapshotSchema.parse(snapshotOutput);
    const handoffInput = InitiateHandoffParamsSchema.parse({
      conversationId: parsed.conversationId!,
      contextSnapshotId: parsed.snapshotId,
      userId: parsed.initiatorUserId,
      organizationId: parsed.organizationId,
      goal: 'Analyze Q4 results',
    });
    expect(handoffInput.contextSnapshotId).toBe(parsed.snapshotId);
  });

  it('missing required field is caught', () => {
    const broken = { ...snapshotOutput, snapshotId: undefined };
    expect(() => ContextSnapshotSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C02: ExecutionSpine → ChatExecution (executionRunId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C02: ExecutionSpine → ChatExecution', () => {
  const runOutput = {
    runId: uuid(),
    organizationId: uuid(),
    contextSnapshotId: uuid(),
    initiatorUserId: uuid(),
    state: 'drafting' as const,
    planVersion: 1,
    goal: 'Rebalance portfolio',
    createdAt: now(),
    updatedAt: now(),
    resolvedAt: null,
    expiresAt: null,
    metadata: {},
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ExecutionAgentRunSchema.parse(runOutput);
    const handoffInput = InitiateHandoffParamsSchema.parse({
      conversationId: uuid(),
      contextSnapshotId: parsed.contextSnapshotId,
      userId: parsed.initiatorUserId,
      organizationId: parsed.organizationId,
      goal: parsed.goal,
    });
    expect(handoffInput.contextSnapshotId).toBe(parsed.contextSnapshotId);
  });

  it('missing required field is caught', () => {
    const broken = { ...runOutput, runId: undefined };
    expect(() => ExecutionAgentRunSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C03: ExecutionSpine proposal → ChatExecution facade (underlyingProposalId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C03: ExecutionSpine Proposal → ChatExecution Facade', () => {
  const proposalOutput = {
    proposalId: uuid(),
    executionRunId: uuid(),
    contextSnapshotRef: 'snap:ref:1',
    proposalType: 'create_artifact' as const,
    targetRef: {
      artifactId: uuid(),
      artifactType: 'report',
      artifactModule: 'reports',
      relationship: 'target' as const,
    },
    summary: 'Create quarterly report',
    reason: 'Requested by user',
    mutationDescription: {
      operation: 'create' as const,
      targetFields: null,
      payloadSummary: null,
      reversibility: 'reversible' as const,
      estimatedImpact: null,
    },
    riskClass: 'safe_additive' as const,
    approvalClass: 'auto_executable' as const,
    previewPayload: null,
    dependsOn: [],
    status: 'draft' as const,
    createdAt: now(),
    resolvedAt: null,
    resolvedBy: null,
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ActionProposalSchema.parse(proposalOutput);
    const chatProposalInput = CreateChatActionProposalParamsSchema.parse({
      conversationId: uuid(),
      messageId: uuid(),
      underlyingProposalId: parsed.proposalId,
      organizationId: uuid(),
      displaySummary: parsed.summary,
      renderingHints: {
        style: 'card_expanded',
        showPreview: true,
        showRiskBadge: true,
        collapsible: true,
        expirationWarning: false,
      },
    });
    expect(chatProposalInput.underlyingProposalId).toBe(parsed.proposalId);
  });

  it('missing required field is caught', () => {
    const broken = { ...proposalOutput, proposalId: undefined };
    expect(() => ActionProposalSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C04: GovernedRetrieval → KnowledgeRetrieval (retrievalRequestId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C04: GovernedRetrieval → KnowledgeRetrieval', () => {
  const orgId = uuid();
  const snapshotId = uuid();

  const retrievalRequestInput = {
    organizationId: orgId,
    contextSnapshotId: snapshotId,
    consumerClass: 'chat' as const,
    query: 'Find latest financial reports',
    searchPreset: 'workspace_broad' as const,
    budgetHint: null,
    workingMemoryContextRef: null,
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = CreateRetrievalRequestParamsSchema.parse(retrievalRequestInput);
    const orchestrateInput = OrchestrateRetrievalParamsSchema.parse({
      organizationId: parsed.organizationId,
      conversationId: uuid(),
      contextSnapshotId: parsed.contextSnapshotId!,
      consumerClass: parsed.consumerClass as 'chat' | 'execution',
      query: parsed.query,
      searchPreset: parsed.searchPreset,
      budgetHint: null,
      workingMemoryContextRef: null,
    });
    expect(orchestrateInput.organizationId).toBe(parsed.organizationId);
  });

  it('missing required field is caught', () => {
    const broken = { ...retrievalRequestInput, query: '' };
    expect(() => CreateRetrievalRequestParamsSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C05: TrustAudit → KnowledgeRetrieval (mergedTrustClass)
// ═══════════════════════════════════════════════════════════════════════════

describe('C05: TrustAudit → KnowledgeRetrieval', () => {
  const orchestrationResult = {
    requestId: uuid(),
    organizationId: uuid(),
    retrievalResults: [],
    workingMemoryResults: [],
    mergedTrustClass: 'synthesis' as const,
    budgetUsed: { maxResults: 10 },
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = WorkingMemoryOrchestrationResultSchema.parse(orchestrationResult);
    expect(TrustAuditTrustClassValues).toContain(parsed.mergedTrustClass);
  });

  it('invalid trust class is caught', () => {
    const broken = { ...orchestrationResult, mergedTrustClass: 'INVALID_CLASS' };
    expect(() => WorkingMemoryOrchestrationResultSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C06: PromptOsRuntime → ReportsPresModel (presetRef)
// ═══════════════════════════════════════════════════════════════════════════

describe('C06: PromptOsRuntime → ReportsPresModel', () => {
  const bundleOutput = {
    bundleId: uuid(),
    organizationId: uuid(),
    version: '1.0.0',
    presetId: uuid(),
    promptVersion: '2.0',
    modelVersion: 'gpt-4o',
    policyVersion: '1.0',
    runtimeConfigVersion: '1.0',
    status: 'active' as const,
    createdAt: now(),
    activatedAt: now(),
    rolledBackAt: null,
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ReleaseBundleSchema.parse(bundleOutput);
    const presetRef = `bundle:${parsed.bundleId}:preset:${parsed.presetId}`;
    const govInput = SetAIGovernanceConfigParamsSchema.parse({
      organizationId: parsed.organizationId,
      outputType: 'report',
      presetRef,
      evalGateRef: null,
      qualityThresholds: {},
    });
    expect(govInput.presetRef).toContain(parsed.bundleId);
  });

  it('missing required field is caught', () => {
    const broken = { ...bundleOutput, presetId: undefined };
    expect(() => ReleaseBundleSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C07: ContextSnapshot → SourceTruth (contextSnapshotId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C07: ContextSnapshot → SourceTruth', () => {
  const snapshotOutput = {
    snapshotId: uuid(),
    snapshotVersion: 1,
    capturedAt: now(),
    workspaceId: uuid(),
    organizationId: uuid(),
    projectId: null,
    conversationId: null,
    executionRunId: null,
    artifactRefs: [],
    effectiveScopeRef: 'scope:org',
    resolvedRoleRef: 'role:pm',
    initiatorUserId: uuid(),
    consumerClass: 'execution' as const,
    privacyMode: false,
    sourceContextRefs: [],
    driftEvents: [],
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ContextSnapshotSchema.parse(snapshotOutput);
    const matInput = RecordMaterializationParamsSchema.parse({
      initiativeId: uuid(),
      organizationId: parsed.organizationId,
      entrypoint: 'chat',
      sourceArtifactId: uuid(),
      sourceArtifactType: 'conversation',
      contextSnapshotId: parsed.snapshotId,
      materializationMode: 'invisible',
      evidenceClass: 'strong',
      promotedBy: parsed.initiatorUserId,
    });
    expect(matInput.contextSnapshotId).toBe(parsed.snapshotId);
  });

  it('missing required field is caught', () => {
    const broken = { ...snapshotOutput, snapshotId: undefined };
    expect(() => ContextSnapshotSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C08: ExecutionSpine → ExecutionVisibility (executionRunId for rebaseline)
// ═══════════════════════════════════════════════════════════════════════════

describe('C08: ExecutionSpine → ExecutionVisibility', () => {
  const runOutput = {
    runId: uuid(),
    organizationId: uuid(),
    contextSnapshotId: uuid(),
    initiatorUserId: uuid(),
    state: 'completed' as const,
    planVersion: 2,
    goal: 'Rebaseline initiative timeline',
    createdAt: now(),
    updatedAt: now(),
    resolvedAt: now(),
    expiresAt: null,
    metadata: {},
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ExecutionAgentRunSchema.parse(runOutput);
    const rebaseInput = CreateRebaselineProposalParamsSchema.parse({
      initiativeId: uuid(),
      organizationId: parsed.organizationId,
      executionRunId: parsed.runId,
      reason: 'Timeline slip detected',
      baselineBefore: { endDate: '2026-06-01' },
      baselineAfter: { endDate: '2026-09-01' },
    });
    expect(rebaseInput.executionRunId).toBe(parsed.runId);
  });

  it('missing required field is caught', () => {
    const broken = { ...runOutput, runId: undefined };
    expect(() => ExecutionAgentRunSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C09: CollaborationRoom → MultiplayerHardening (roomId for facilitation)
// ═══════════════════════════════════════════════════════════════════════════

describe('C09: CollaborationRoom → MultiplayerHardening (facilitation)', () => {
  const roomOutput = {
    roomId: uuid(),
    resourceType: 'whiteboard',
    resourceId: uuid(),
    organizationId: uuid(),
    roomState: 'active' as const,
    createdAt: now(),
    closedAt: null,
    metadata: {},
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = CollaborationRoomSchema.parse(roomOutput);
    const facInput = StartFacilitationParamsSchema.parse({
      roomId: parsed.roomId,
      facilitatorUserId: uuid(),
      initialPhase: 'brainstorm',
      organizationId: parsed.organizationId,
    });
    expect(facInput.roomId).toBe(parsed.roomId);
  });

  it('missing required field is caught', () => {
    const broken = { ...roomOutput, roomId: undefined };
    expect(() => CollaborationRoomSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C10: CollaborationRoom → MultiplayerHardening (roomId for surface presence)
// ═══════════════════════════════════════════════════════════════════════════

describe('C10: CollaborationRoom → MultiplayerHardening (surface presence)', () => {
  const roomOutput = {
    roomId: uuid(),
    resourceType: 'table',
    resourceId: uuid(),
    organizationId: uuid(),
    roomState: 'active' as const,
    createdAt: now(),
    closedAt: null,
    metadata: {},
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = CollaborationRoomSchema.parse(roomOutput);
    const presenceInput = UpdateSurfacePresenceParamsSchema.parse({
      userId: uuid(),
      roomId: parsed.roomId,
      activeSurface: 'table',
      presenceType: 'editor',
      cursorState: null,
      organizationId: parsed.organizationId,
    });
    expect(presenceInput.roomId).toBe(parsed.roomId);
  });

  it('missing required field is caught', () => {
    const broken = { ...roomOutput, roomId: undefined };
    expect(() => CollaborationRoomSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C11: PmSyncTruth → PmSyncAuth (connectorId + auth state for escalation)
// ═══════════════════════════════════════════════════════════════════════════

describe('C11: PmSyncTruth → PmSyncAuth', () => {
  const authRecordOutput = {
    recordId: uuid(),
    connectorId: 'jira-connector-001',
    organizationId: uuid(),
    authState: 'degraded_reauth_needed' as const,
    previousState: 'healthy' as const,
    transitionedAt: now(),
    transitionedBy: 'system',
    reason: 'Token expired',
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ConnectorAuthRecordSchema.parse(authRecordOutput);
    expect(parsed.connectorId).toBe('jira-connector-001');
    expect(parsed.authState).toBe('degraded_reauth_needed');
    expect(EscalationLevelValues).toContain('degraded');
  });

  it('missing required field is caught', () => {
    const broken = { ...authRecordOutput, connectorId: undefined };
    expect(() => ConnectorAuthRecordSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C12: ReplayDeadLetter → OperatorAdmin (deadLetterCount for fleet health)
// ═══════════════════════════════════════════════════════════════════════════

describe('C12: ReplayDeadLetter → OperatorAdmin', () => {
  const deadLetterOutput = {
    deadLetterId: uuid(),
    originalJobRef: 'job:sync:12345',
    originalPayloadRef: null,
    eventName: 'task.updated',
    connectorId: 'asana-connector-001',
    organizationId: uuid(),
    providerKey: 'asana',
    objectType: 'Task',
    objectRef: 'task:abc',
    reason: 'Rate limited',
    errorClass: 'rate_limited' as const,
    replayEligibility: 'eligible' as const,
    retryCount: 3,
    lastAttemptAt: now(),
    deadLetteredAt: now(),
    correlationId: uuid(),
    operatorNote: null,
    resolutionState: 'pending_review' as const,
    createdAt: now(),
    updatedAt: now(),
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = DeadLetterRecordSchema.parse(deadLetterOutput);
    const fleetHealthInput = RecordFleetHealthParamsSchema.parse({
      connectorId: parsed.connectorId,
      organizationId: parsed.organizationId,
      providerKey: parsed.providerKey,
      authState: 'healthy',
      providerTier: 'A',
      stalenessIndicator: 0,
      driftState: 'none',
      deadLetterCount: 1,
      conflictCount: 0,
    });
    expect(fleetHealthInput.connectorId).toBe(parsed.connectorId);
    expect(fleetHealthInput.deadLetterCount).toBe(1);
  });

  it('missing required field is caught', () => {
    const broken = { ...deadLetterOutput, deadLetterId: undefined };
    expect(() => DeadLetterRecordSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C13: ResultsROI KPI → ResultsROI reconciliation (kpiId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C13: ResultsROI KPI → ResultsROI Reconciliation', () => {
  const kpiOutput = {
    kpiId: uuid(),
    organizationId: uuid(),
    name: 'Customer Retention Rate',
    mode: 'initiative_linked' as const,
    initiativeId: uuid(),
    metricType: 'percentage' as const,
    baselineValue: 85,
    targetValue: 92,
    currentValue: 88,
    measurementCadence: 'monthly' as const,
    status: 'active' as const,
    createdAt: now(),
    updatedAt: now(),
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = KPIDefinitionSchema.parse(kpiOutput);
    const reconcInput = InitiateReconciliationParamsSchema.parse({
      organizationId: parsed.organizationId,
      kpiId: parsed.kpiId,
      financeRef: 'finance:model:q4',
      initiatedBy: 'results',
    });
    expect(reconcInput.kpiId).toBe(parsed.kpiId);
  });

  it('missing required field is caught', () => {
    const broken = { ...kpiOutput, kpiId: undefined };
    expect(() => KPIDefinitionSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C14: ReportsPresModel → PublishReview (artifactId)
// ═══════════════════════════════════════════════════════════════════════════

describe('C14: ReportsPresModel → PublishReview', () => {
  const artifactOutput = {
    artifactId: uuid(),
    organizationId: uuid(),
    outputType: 'report' as const,
    deliveryState: 'generated' as const,
    templateFamilyRef: null,
    sourceInitiativeId: null,
    aiGovernancePresetRef: null,
    createdBy: uuid(),
    createdAt: now(),
    lastTransitionAt: now(),
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = OutputArtifactSchema.parse(artifactOutput);
    const publishInput = CreatePublishRecordParamsSchema.parse({
      artifactId: parsed.artifactId,
      artifactType: 'report',
      organizationId: parsed.organizationId,
      publishedBy: parsed.createdBy,
      reviewers: [],
    });
    expect(publishInput.artifactId).toBe(parsed.artifactId);
  });

  it('missing required field is caught', () => {
    const broken = { ...artifactOutput, artifactId: undefined };
    expect(() => OutputArtifactSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C15: FinanceIntegration gate → SourceTruth validation (dual-gate alignment)
// ═══════════════════════════════════════════════════════════════════════════

describe('C15: FinanceIntegration Gate → SourceTruth Validation', () => {
  const gateOutput = {
    gateId: uuid(),
    organizationId: uuid(),
    sourceArtifactRef: 'finance:doc:inv-001',
    targetInitiativeId: uuid(),
    permissionGateResult: 'approved' as const,
    qualityGateResult: 'approved' as const,
    provenancePreserved: true,
    staleStateChecked: true,
    overallResult: 'approved' as const,
    createdAt: now(),
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = PromotionGateSchema.parse(gateOutput);
    const validationInput = ValidatePromotionParamsSchema.parse({
      organizationId: parsed.organizationId,
      promotedBy: uuid(),
      entrypoint: 'tools_assessment',
      evidenceClass: parsed.overallResult === 'approved' ? 'strong' : 'weak',
      hasPermission: parsed.permissionGateResult === 'approved',
      isHighImpact: false,
    });
    expect(validationInput.hasPermission).toBe(true);
    expect(validationInput.evidenceClass).toBe('strong');
  });

  it('missing required field is caught', () => {
    const broken = { ...gateOutput, overallResult: undefined };
    expect(() => PromotionGateSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C16: ExecutionVisibility signal → MyWorkRoof inbox (signal → materialization)
// ═══════════════════════════════════════════════════════════════════════════

describe('C16: ExecutionVisibility Signal → MyWorkRoof Inbox', () => {
  const signalOutput = {
    signalId: uuid(),
    signalType: 'overdue_tasks_count' as const,
    sourceObjectType: 'task' as const,
    sourceObjectId: uuid(),
    organizationId: uuid(),
    severity: 'warning' as const,
    payload: { count: 5 },
    timestamp: now(),
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ExecutionSignalSchema.parse(signalOutput);
    const inboxInput = RecordInboxMaterializationParamsSchema.parse({
      eventSourceRef: `signal:${parsed.signalId}`,
      inboxItemId: uuid(),
      userId: uuid(),
      organizationId: parsed.organizationId,
      latencyMs: 1200,
    });
    expect(inboxInput.eventSourceRef).toContain(parsed.signalId);
  });

  it('missing required field is caught', () => {
    const broken = { ...signalOutput, signalId: undefined };
    expect(() => ExecutionSignalSchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C17: ToolGovernance → ToolsOrgAdmin (tool identity alignment)
// ═══════════════════════════════════════════════════════════════════════════

describe('C17: ToolGovernance → ToolsOrgAdmin', () => {
  const toolCapOutput = {
    toolId: uuid(),
    organizationId: uuid(),
    name: 'SWOT Analysis',
    description: 'Structured SWOT framework',
    category: 'artifact_write' as const,
    riskClass: 'low_risk' as const,
    mutationType: 'bounded_write' as const,
    classificationStatus: 'ratified' as const,
    defaultApprovalMode: 'auto_executable' as const,
    classifiedBy: uuid(),
    classifiedAt: now(),
    version: '1.0.0',
    createdAt: now(),
    updatedAt: now(),
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = ToolCapabilitySchema.parse(toolCapOutput);
    const registryInput = OrgAdminRegisterToolParamsSchema.parse({
      organizationId: parsed.organizationId,
      toolName: parsed.name,
      toolFamily: 'consulting_framework',
      toolSubtype: null,
      isClassicFrameworkTemplate: false,
      knowledgeBankRef: null,
      catalogVisibility: 'published',
    });
    expect(registryInput.toolName).toBe(parsed.name);
    expect(registryInput.organizationId).toBe(parsed.organizationId);
  });

  it('missing required field is caught', () => {
    const broken = { ...toolCapOutput, toolId: undefined };
    expect(() => ToolCapabilitySchema.parse(broken)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C18: ConcurrentEditing lock → CollaborationRoom event (lock → event)
// ═══════════════════════════════════════════════════════════════════════════

describe('C18: ConcurrentEditing Lock → CollaborationRoom Event', () => {
  const lockOutput = {
    lockId: uuid(),
    organizationId: uuid(),
    lockType: 'optimistic_section' as const,
    lockScope: 'section:intro',
    holderId: uuid(),
    holderClientId: 'client-abc-123',
    roomId: uuid(),
    ttl: 30000,
    acquiredAt: now(),
    releasedAt: null,
    releaseReason: null,
  };

  it('upstream output satisfies downstream input contract', () => {
    const parsed = LockRecordSchema.parse(lockOutput);
    const eventInput = RecordEventParamsSchema.parse({
      roomId: parsed.roomId,
      eventType: 'collaboration.edit_started',
      actorId: parsed.holderId,
      actorType: 'human',
      delivery: 'durable',
      payload: {
        lockId: parsed.lockId,
        lockType: parsed.lockType,
        lockScope: parsed.lockScope,
      },
      stateVersion: null,
    });
    expect(eventInput.roomId).toBe(parsed.roomId);
    expect(eventInput.payload).toHaveProperty('lockId', parsed.lockId);
  });

  it('missing required field is caught', () => {
    const broken = { ...lockOutput, lockId: undefined };
    expect(() => LockRecordSchema.parse(broken)).toThrow();
  });
});
