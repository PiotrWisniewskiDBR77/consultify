/**
 * Wave 9 — AI Operating Environment Integration Flow
 *
 * End-to-end proof that the AI operating environment works:
 * Chat captures context → Prompt OS selects preset → Knowledge retrieves
 * with governance → Execution proposes → Trust audits.
 *
 * Services: contextConsumerBindingService, chatExecutionService,
 *           promptOsRuntimeService, governedRetrievalService,
 *           trustAuditService, executionSpineService,
 *           aiOperatingEnvironmentService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ==========================================
// IMPORT SERVICES (after DB mock)
// ==========================================

import {
  executeGovernedRetrieval,
  getOperatingEnvironmentStatus,
  processChatTurn,
  selectPromptPreset,
} from '../../../aiOperatingEnvironmentService.js';
import { classifyIntent, initiateHandoff } from '../../../chatExecutionService.js';
import { captureSnapshot, getSnapshot } from '../../../contextSnapshotService.js';
import { createRetrievalRequest } from '../../../governedRetrievalService.js';
import { createPreset } from '../../../promptOsRuntimeService.js';
import { recordDegradedCondition, recordHealthSignal } from '../../../trustAuditService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const WORKSPACE_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000020';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';

const MOCK_CHAT_SNAPSHOT = {
  snapshotId: SNAPSHOT_ID,
  workspaceId: WORKSPACE_ID,
  organizationId: ORG_ID,
  projectId: null,
  conversationId: CONVERSATION_ID,
  executionRunId: null,
  artifactRefs: [],
  effectiveScopeRef: 'workspace',
  resolvedRoleRef: 'member',
  initiatorUserId: USER_ID,
  consumerClass: 'chat' as const,
  sourceContextRefs: [],
  parentSnapshotId: null,
  createdAt: new Date().toISOString(),
};

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ==========================================
// F01 — Chat turn → context capture → intent classification
// ==========================================

describe('F01 — Chat turn → context capture → intent classification', () => {
  it('processes a conversational chat turn with correct snapshot and intent', async () => {
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ success: true });

    const intent = await classifyIntent('What is the current project status?', SNAPSHOT_ID, ORG_ID);

    expect(intent.intentType).toBe('conversational');
    expect(intent.confidence).toBeGreaterThan(0.5);
    expect(intent.suggestedAction).toBe('continue_chat');

    const snapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: null,
      conversationId: CONVERSATION_ID,
      executionRunId: null,
      artifactRefs: [],
      effectiveScopeRef: 'workspace',
      resolvedRoleRef: 'member',
      initiatorUserId: USER_ID,
      consumerClass: 'chat',
      sourceContextRefs: [],
    });

    expect(snapshot).toBeDefined();
    expect(snapshot.consumerClass).toBe('chat');
    expect(snapshot.organizationId).toBe(ORG_ID);
    expect(snapshot.conversationId).toBe(CONVERSATION_ID);

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO v8_context_snapshots'),
      expect.any(Array)
    );
  });

  it('classifies governed work intent correctly', async () => {
    const intent = await classifyIntent(
      'Create a report from this initiative and generate risk slides',
      SNAPSHOT_ID,
      ORG_ID
    );

    expect(intent.intentType).toBe('governed_work');
    expect(intent.suggestedAction).toBe('initiate_execution');
  });

  it('classifies ambiguous intent correctly', async () => {
    const intent = await classifyIntent(
      'What if we update all the tasks across every project?',
      SNAPSHOT_ID,
      ORG_ID
    );

    expect(intent.intentType).toBe('ambiguous');
    expect(intent.suggestedAction).toBe('ask_user_confirmation');
  });
});

// ==========================================
// F02 — Governed work → handoff → execution snapshot
// ==========================================

describe('F02 — Governed work → handoff → execution snapshot', () => {
  it('creates handoff and execution snapshot for governed work', async () => {
    mockDbGet.mockImplementation((sql: string, params: unknown[]) => {
      if (typeof sql === 'string' && sql.includes('v8_context_snapshots')) {
        return Promise.resolve({
          snapshot_id: SNAPSHOT_ID,
          workspace_id: WORKSPACE_ID,
          organization_id: ORG_ID,
          project_id: null,
          conversation_id: CONVERSATION_ID,
          execution_run_id: null,
          artifact_refs: '[]',
          effective_scope_ref: 'workspace',
          resolved_role_ref: 'member',
          initiator_user_id: USER_ID,
          consumer_class: 'chat',
          source_context_refs: '[]',
          parent_snapshot_id: null,
          created_at: new Date().toISOString(),
        });
      }
      return Promise.resolve(null);
    });

    const intent = await classifyIntent(
      'Create a report from this note and add risk slides',
      SNAPSHOT_ID,
      ORG_ID
    );
    expect(intent.intentType).toBe('governed_work');

    const handoff = await initiateHandoff({
      conversationId: CONVERSATION_ID,
      contextSnapshotId: SNAPSHOT_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
      goal: 'Create a report from this note and add risk slides',
    });

    expect(handoff).toBeDefined();
    expect(handoff.conversationId).toBe(CONVERSATION_ID);
    expect(handoff.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(handoff.organizationId).toBe(ORG_ID);
    expect(handoff.executionRunId).toBeDefined();
    expect(handoff.handoffId).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('v8_chat_execution_handoffs'),
      expect.any(Array)
    );
  });
});

// ==========================================
// F03 — Prompt preset selection
// ==========================================

describe('F03 — Prompt preset selection', () => {
  it('selects correct preset by purpose family', async () => {
    const presetId = '00000000-0000-4000-8000-000000000060';
    mockDbAll.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('v8_prompt_presets')) {
        return Promise.resolve([
          {
            preset_id: presetId,
            organization_id: ORG_ID,
            name: 'Conversational Default',
            purpose_family: 'conversational',
            model_ref: 'gpt-4',
            prompt_block_refs: JSON.stringify(['block-a']),
            policy_ref: null,
            gate_type: 'soft',
            eval_thresholds: JSON.stringify({
              qualityMin: 0.8,
              latencyP95MaxMs: 3000,
              costMaxPerInteraction: 0.05,
              trustDegradationMaxPct: 5,
              failureRateMaxPct: 2,
            }),
            created_at: '2025-01-01T00:00:00.000Z',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const preset = await selectPromptPreset({
      purposeFamily: 'conversational',
      organizationId: ORG_ID,
      consumerClass: 'chat',
    });

    expect(preset).not.toBeNull();
    expect(preset!.presetId).toBe(presetId);
    expect(preset!.purposeFamily).toBe('conversational');
    expect(preset!.name).toBe('Conversational Default');
  });

  it('returns null when no preset matches', async () => {
    mockDbAll.mockResolvedValue([]);

    const preset = await selectPromptPreset({
      purposeFamily: 'background_automation',
      organizationId: ORG_ID,
      consumerClass: 'background',
    });

    expect(preset).toBeNull();
  });

  it('creates and retrieves a preset through the service', async () => {
    const preset = await createPreset({
      organizationId: ORG_ID,
      name: 'Retrieval Grounded',
      purposeFamily: 'retrieval_grounded',
      modelRef: 'gpt-4-turbo',
      promptBlockRefs: ['retrieval-block-1'],
      policyRef: null,
      gateType: 'hard',
      evalThresholds: {
        qualityMin: 0.9,
        latencyP95MaxMs: 2000,
        costMaxPerInteraction: 0.03,
        trustDegradationMaxPct: 2,
        failureRateMaxPct: 1,
      },
    });

    expect(preset.presetId).toBeDefined();
    expect(preset.purposeFamily).toBe('retrieval_grounded');
    expect(preset.gateType).toBe('hard');

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('v8_prompt_presets'),
      expect.any(Array)
    );
  });
});

// ==========================================
// F04 — Governed retrieval with context binding
// ==========================================

describe('F04 — Governed retrieval with context binding', () => {
  it('creates retrieval snapshot chained to parent and retrieval request', async () => {
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ success: true });

    const retrievalSnapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: null,
      conversationId: null,
      executionRunId: null,
      artifactRefs: [],
      effectiveScopeRef: 'retrieval',
      resolvedRoleRef: 'system',
      initiatorUserId: USER_ID,
      consumerClass: 'retrieval',
      sourceContextRefs: [],
      parentSnapshotId: SNAPSHOT_ID,
    });

    expect(retrievalSnapshot.consumerClass).toBe('retrieval');
    expect(retrievalSnapshot.parentSnapshotId).toBe(SNAPSHOT_ID);

    const request = await createRetrievalRequest({
      organizationId: ORG_ID,
      contextSnapshotId: retrievalSnapshot.snapshotId,
      consumerClass: 'retrieval',
      query: 'find related initiative documents',
      searchPreset: 'workspace_broad',
    });

    expect(request.requestId).toBeDefined();
    expect(request.contextSnapshotId).toBe(retrievalSnapshot.snapshotId);
    expect(request.organizationId).toBe(ORG_ID);
    expect(request.status).toBe('pending');

    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('v8_retrieval_requests'),
      expect.any(Array)
    );
  });
});

// ==========================================
// F05 — Full pipeline: chat → execution → retrieval → trust
// ==========================================

describe('F05 — Full pipeline: chat → execution → retrieval → trust', () => {
  it('connects all layers end-to-end', async () => {
    // Step 1: Classify governed work intent
    const intent = await classifyIntent(
      'Create a report from this initiative',
      SNAPSHOT_ID,
      ORG_ID
    );
    expect(intent.intentType).toBe('governed_work');

    // Step 2: Capture chat snapshot
    const chatSnapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: null,
      conversationId: CONVERSATION_ID,
      executionRunId: null,
      artifactRefs: [],
      effectiveScopeRef: 'workspace',
      resolvedRoleRef: 'member',
      initiatorUserId: USER_ID,
      consumerClass: 'chat',
      sourceContextRefs: [],
    });
    expect(chatSnapshot.consumerClass).toBe('chat');

    // Step 3: Capture execution snapshot inheriting from chat
    const execSnapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: null,
      conversationId: null,
      executionRunId: '00000000-0000-4000-8000-eeeeeeeeeeee',
      artifactRefs: [],
      effectiveScopeRef: 'workspace',
      resolvedRoleRef: 'member',
      initiatorUserId: USER_ID,
      consumerClass: 'execution',
      sourceContextRefs: [],
      parentSnapshotId: chatSnapshot.snapshotId,
    });
    expect(execSnapshot.consumerClass).toBe('execution');
    expect(execSnapshot.parentSnapshotId).toBe(chatSnapshot.snapshotId);

    // Step 4: Capture retrieval snapshot chained to execution
    const retrievalSnapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: null,
      conversationId: null,
      executionRunId: null,
      artifactRefs: [],
      effectiveScopeRef: 'retrieval',
      resolvedRoleRef: 'system',
      initiatorUserId: USER_ID,
      consumerClass: 'retrieval',
      sourceContextRefs: [],
      parentSnapshotId: execSnapshot.snapshotId,
    });
    expect(retrievalSnapshot.consumerClass).toBe('retrieval');
    expect(retrievalSnapshot.parentSnapshotId).toBe(execSnapshot.snapshotId);

    // Step 5: Create governed retrieval request
    const request = await createRetrievalRequest({
      organizationId: ORG_ID,
      contextSnapshotId: retrievalSnapshot.snapshotId,
      consumerClass: 'retrieval',
      query: 'find initiative data',
      searchPreset: 'workspace_broad',
    });
    expect(request.contextSnapshotId).toBe(retrievalSnapshot.snapshotId);

    // Step 6: Record trust health signal
    const signal = await recordHealthSignal({
      organizationId: ORG_ID,
      signalType: 'retrieval_latency_p95',
      componentId: 'trust-engine',
      status: 'healthy',
      value: 120,
      threshold: 3000,
      metadata: { pipeline: 'full' },
    });
    expect(signal.status).toBe('healthy');

    // Verify the full chain was persisted
    const insertCalls = mockDbRun.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT')
    );
    expect(insertCalls.length).toBeGreaterThanOrEqual(4);
  });
});

// ==========================================
// F06 — Operating environment health check
// ==========================================

describe('F06 — Operating environment health check', () => {
  it('aggregates healthy status across all layers', async () => {
    mockDbAll.mockResolvedValue([]);

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(true);
    expect(status.layers.context).toBe('healthy');
    expect(status.layers.retrieval).toBe('healthy');
    expect(status.layers.execution).toBe('healthy');
    expect(status.layers.trust).toBe('healthy');
  });

  it('detects degraded trust layer from degraded conditions', async () => {
    mockDbAll.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('v8_degraded_conditions')) {
        return Promise.resolve([
          {
            condition_id: '00000000-0000-4000-8000-cccccccccccc',
            organization_id: ORG_ID,
            condition_type: 'voice_transcript_partial',
            severity: 'warning',
            user_message: 'Transcript may be incomplete',
            operator_detail: 'Partial transcript detected',
            support_trace_id: null,
            created_at: new Date().toISOString(),
            resolved_at: null,
            resolved_by: null,
            resolution_note: null,
          },
        ]);
      }
      if (typeof sql === 'string' && sql.includes('v8_health_signals')) {
        return Promise.resolve([]);
      }
      if (typeof sql === 'string' && sql.includes('v8_execution_runs')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(false);
    expect(status.layers.trust).toBe('degraded');
  });

  it('detects critical retrieval layer from health signal', async () => {
    mockDbAll.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('v8_health_signals')) {
        return Promise.resolve([
          {
            signal_id: '00000000-0000-4000-8000-dddddddddddd',
            organization_id: ORG_ID,
            signal_type: 'error_rate',
            component_id: 'retrieval-pipeline',
            status: 'critical',
            value: 50,
            threshold: 5,
            metadata: '{}',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      if (typeof sql === 'string' && sql.includes('v8_degraded_conditions')) {
        return Promise.resolve([]);
      }
      if (typeof sql === 'string' && sql.includes('v8_execution_runs')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(false);
    expect(status.layers.retrieval).toBe('unavailable');
  });
});
