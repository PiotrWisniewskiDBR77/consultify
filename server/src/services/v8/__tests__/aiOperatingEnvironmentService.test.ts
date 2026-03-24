import { describe, expect, it, vi, beforeEach } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ==========================================
// MOCK UPSTREAM SERVICES
// ==========================================

const mockCaptureForChat = vi.fn();
const mockCaptureForExecution = vi.fn();
const mockCaptureForRetrieval = vi.fn();

vi.mock('../contextConsumerBindingService.js', () => ({
  captureForChat: (...args: unknown[]) => mockCaptureForChat(...args),
  captureForExecution: (...args: unknown[]) => mockCaptureForExecution(...args),
  captureForRetrieval: (...args: unknown[]) => mockCaptureForRetrieval(...args),
}));

const mockClassifyIntent = vi.fn();
const mockInitiateHandoff = vi.fn();

vi.mock('../chatExecutionService.js', () => ({
  classifyIntent: (...args: unknown[]) => mockClassifyIntent(...args),
  initiateHandoff: (...args: unknown[]) => mockInitiateHandoff(...args),
}));

const mockCreateRetrievalRequest = vi.fn();

vi.mock('../governedRetrievalService.js', () => ({
  createRetrievalRequest: (...args: unknown[]) => mockCreateRetrievalRequest(...args),
}));

const mockGetHealthSignals = vi.fn();
const mockGetActiveDegradedConditions = vi.fn();

vi.mock('../trustAuditService.js', () => ({
  getHealthSignals: (...args: unknown[]) => mockGetHealthSignals(...args),
  getActiveDegradedConditions: (...args: unknown[]) => mockGetActiveDegradedConditions(...args),
}));

const mockGetActiveRuns = vi.fn();

vi.mock('../executionSpineService.js', () => ({
  getActiveRuns: (...args: unknown[]) => mockGetActiveRuns(...args),
}));

import {
  processChatTurn,
  selectPromptPreset,
  executeGovernedRetrieval,
  getOperatingEnvironmentStatus,
} from '../aiOperatingEnvironmentService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const WORKSPACE_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000020';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const EXEC_SNAPSHOT_ID = '00000000-0000-4000-8000-000000000011';
const RETRIEVAL_SNAPSHOT_ID = '00000000-0000-4000-8000-000000000012';
const HANDOFF_ID = '00000000-0000-4000-8000-000000000030';
const RUN_ID = '00000000-0000-4000-8000-000000000040';
const REQUEST_ID = '00000000-0000-4000-8000-000000000050';
const PRESET_ID = '00000000-0000-4000-8000-000000000060';

const MOCK_SNAPSHOT = {
  snapshotId: SNAPSHOT_ID,
  workspaceId: WORKSPACE_ID,
  organizationId: ORG_ID,
  consumerClass: 'chat',
  createdAt: new Date().toISOString(),
};

const MOCK_EXEC_SNAPSHOT = {
  snapshotId: EXEC_SNAPSHOT_ID,
  workspaceId: WORKSPACE_ID,
  organizationId: ORG_ID,
  consumerClass: 'execution',
  createdAt: new Date().toISOString(),
};

const MOCK_RETRIEVAL_SNAPSHOT = {
  snapshotId: RETRIEVAL_SNAPSHOT_ID,
  workspaceId: WORKSPACE_ID,
  organizationId: ORG_ID,
  consumerClass: 'retrieval',
  createdAt: new Date().toISOString(),
};

const BASE_CHAT_PARAMS = {
  conversationId: CONVERSATION_ID,
  workspaceId: WORKSPACE_ID,
  organizationId: ORG_ID,
  message: 'What is the status?',
  userId: USER_ID,
  artifactRefs: [],
  effectiveScopeRef: 'workspace',
  resolvedRoleRef: 'member',
};

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
  mockGetHealthSignals.mockResolvedValue([]);
  mockGetActiveDegradedConditions.mockResolvedValue([]);
  mockGetActiveRuns.mockResolvedValue([]);
});

// ==========================================
// processChatTurn
// ==========================================

describe('processChatTurn', () => {
  it('returns chat result for conversational intent', async () => {
    mockCaptureForChat.mockResolvedValue(MOCK_SNAPSHOT);
    mockClassifyIntent.mockResolvedValue({
      intentType: 'conversational',
      confidence: 0.9,
      suggestedAction: 'continue_chat',
      reasoning: 'Question pattern',
      classifiedAt: new Date().toISOString(),
    });

    const result = await processChatTurn(BASE_CHAT_PARAMS);

    expect(result.type).toBe('chat');
    expect(result.snapshot.snapshotId).toBe(SNAPSHOT_ID);
    expect(result.intent.intentType).toBe('conversational');
    expect(result.handoff).toBeUndefined();
    expect(result.executionSnapshot).toBeUndefined();

    expect(mockCaptureForChat).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        organizationId: ORG_ID,
        initiatorUserId: USER_ID,
      }),
    );
    expect(mockClassifyIntent).toHaveBeenCalledWith(
      BASE_CHAT_PARAMS.message,
      SNAPSHOT_ID,
      ORG_ID,
    );
  });

  it('returns ambiguous result for ambiguous intent', async () => {
    mockCaptureForChat.mockResolvedValue(MOCK_SNAPSHOT);
    mockClassifyIntent.mockResolvedValue({
      intentType: 'ambiguous',
      confidence: 0.5,
      suggestedAction: 'ask_user_confirmation',
      reasoning: 'Mixed signals',
      classifiedAt: new Date().toISOString(),
    });

    const result = await processChatTurn({
      ...BASE_CHAT_PARAMS,
      message: 'Maybe create something?',
    });

    expect(result.type).toBe('ambiguous');
    expect(result.intent.intentType).toBe('ambiguous');
    expect(result.handoff).toBeUndefined();
  });

  it('returns execution result with handoff for governed_work intent', async () => {
    mockCaptureForChat.mockResolvedValue(MOCK_SNAPSHOT);
    mockClassifyIntent.mockResolvedValue({
      intentType: 'governed_work',
      confidence: 0.85,
      suggestedAction: 'initiate_execution',
      reasoning: 'Work-producing intent',
      classifiedAt: new Date().toISOString(),
    });
    mockInitiateHandoff.mockResolvedValue({
      handoffId: HANDOFF_ID,
      conversationId: CONVERSATION_ID,
      contextSnapshotId: SNAPSHOT_ID,
      executionRunId: RUN_ID,
      organizationId: ORG_ID,
      initiatorUserId: USER_ID,
      intentClassification: { intentType: 'governed_work' },
      goal: 'Create a report',
      createdAt: new Date().toISOString(),
    });
    mockCaptureForExecution.mockResolvedValue(MOCK_EXEC_SNAPSHOT);

    const result = await processChatTurn({
      ...BASE_CHAT_PARAMS,
      message: 'Create a report from this note',
    });

    expect(result.type).toBe('execution');
    expect(result.handoff).toBeDefined();
    expect(result.handoff!.handoffId).toBe(HANDOFF_ID);
    expect(result.executionSnapshot).toBeDefined();
    expect(result.executionSnapshot!.snapshotId).toBe(EXEC_SNAPSHOT_ID);

    expect(mockInitiateHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        contextSnapshotId: SNAPSHOT_ID,
        organizationId: ORG_ID,
        userId: USER_ID,
      }),
    );
    expect(mockCaptureForExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        chatSnapshotId: SNAPSHOT_ID,
        executionRunId: RUN_ID,
      }),
    );
  });

  it('passes projectId through to context capture', async () => {
    const projectId = '00000000-0000-4000-8000-bbbbbbbbbbbb';
    mockCaptureForChat.mockResolvedValue(MOCK_SNAPSHOT);
    mockClassifyIntent.mockResolvedValue({
      intentType: 'conversational',
      confidence: 0.9,
      suggestedAction: 'continue_chat',
      reasoning: 'Question',
      classifiedAt: new Date().toISOString(),
    });

    await processChatTurn({ ...BASE_CHAT_PARAMS, projectId });

    expect(mockCaptureForChat).toHaveBeenCalledWith(
      expect.objectContaining({ projectId }),
    );
  });
});

// ==========================================
// selectPromptPreset
// ==========================================

describe('selectPromptPreset', () => {
  it('returns null when no preset exists for purpose family', async () => {
    mockDbAll.mockResolvedValue([]);

    const result = await selectPromptPreset({
      purposeFamily: 'conversational',
      organizationId: ORG_ID,
      consumerClass: 'chat',
    });

    expect(result).toBeNull();
  });

  it('returns the matching preset for a purpose family', async () => {
    mockDbAll.mockResolvedValue([
      {
        preset_id: PRESET_ID,
        organization_id: ORG_ID,
        name: 'Chat Conversational',
        purpose_family: 'conversational',
        model_ref: 'gpt-4',
        prompt_block_refs: JSON.stringify(['block-1']),
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

    const result = await selectPromptPreset({
      purposeFamily: 'conversational',
      organizationId: ORG_ID,
      consumerClass: 'chat',
    });

    expect(result).not.toBeNull();
    expect(result!.presetId).toBe(PRESET_ID);
    expect(result!.purposeFamily).toBe('conversational');
    expect(result!.modelRef).toBe('gpt-4');
    expect(result!.promptBlockRefs).toEqual(['block-1']);
  });

  it('queries with correct organization and purpose family', async () => {
    mockDbAll.mockResolvedValue([]);

    await selectPromptPreset({
      purposeFamily: 'governed_proposal',
      organizationId: ORG_ID,
      consumerClass: 'execution',
    });

    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('v8_prompt_presets'),
      [ORG_ID, 'governed_proposal'],
      expect.any(Object),
    );
  });
});

// ==========================================
// executeGovernedRetrieval
// ==========================================

describe('executeGovernedRetrieval', () => {
  it('captures retrieval snapshot and creates request', async () => {
    mockCaptureForRetrieval.mockResolvedValue(MOCK_RETRIEVAL_SNAPSHOT);
    mockCreateRetrievalRequest.mockResolvedValue({
      requestId: REQUEST_ID,
      organizationId: ORG_ID,
      contextSnapshotId: RETRIEVAL_SNAPSHOT_ID,
      consumerClass: 'retrieval',
      query: 'find related docs',
      searchPreset: 'workspace_broad',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const result = await executeGovernedRetrieval({
      snapshotId: SNAPSHOT_ID,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      query: 'find related docs',
      userId: USER_ID,
    });

    expect(result.retrievalSnapshot.snapshotId).toBe(RETRIEVAL_SNAPSHOT_ID);
    expect(result.request.requestId).toBe(REQUEST_ID);

    expect(mockCaptureForRetrieval).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSnapshotId: SNAPSHOT_ID,
        organizationId: ORG_ID,
      }),
    );
    expect(mockCreateRetrievalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        contextSnapshotId: RETRIEVAL_SNAPSHOT_ID,
        query: 'find related docs',
        searchPreset: 'workspace_broad',
      }),
    );
  });

  it('uses provided searchPreset', async () => {
    mockCaptureForRetrieval.mockResolvedValue(MOCK_RETRIEVAL_SNAPSHOT);
    mockCreateRetrievalRequest.mockResolvedValue({
      requestId: REQUEST_ID,
      organizationId: ORG_ID,
      contextSnapshotId: RETRIEVAL_SNAPSHOT_ID,
      consumerClass: 'retrieval',
      query: 'deep search',
      searchPreset: 'artifact_deep',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    await executeGovernedRetrieval({
      snapshotId: SNAPSHOT_ID,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      query: 'deep search',
      userId: USER_ID,
      searchPreset: 'artifact_deep',
    });

    expect(mockCreateRetrievalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ searchPreset: 'artifact_deep' }),
    );
  });

  it('chains retrieval snapshot to parent snapshot', async () => {
    mockCaptureForRetrieval.mockResolvedValue(MOCK_RETRIEVAL_SNAPSHOT);
    mockCreateRetrievalRequest.mockResolvedValue({
      requestId: REQUEST_ID,
      organizationId: ORG_ID,
      contextSnapshotId: RETRIEVAL_SNAPSHOT_ID,
      consumerClass: 'retrieval',
      query: 'test',
      searchPreset: 'workspace_broad',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    await executeGovernedRetrieval({
      snapshotId: SNAPSHOT_ID,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      query: 'test',
      userId: USER_ID,
    });

    expect(mockCaptureForRetrieval).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSnapshotId: SNAPSHOT_ID,
      }),
    );
  });
});

// ==========================================
// getOperatingEnvironmentStatus
// ==========================================

describe('getOperatingEnvironmentStatus', () => {
  it('returns healthy when no signals or conditions exist', async () => {
    mockGetHealthSignals.mockResolvedValue([]);
    mockGetActiveDegradedConditions.mockResolvedValue([]);
    mockGetActiveRuns.mockResolvedValue([]);

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(true);
    expect(status.layers.context).toBe('healthy');
    expect(status.layers.retrieval).toBe('healthy');
    expect(status.layers.execution).toBe('healthy');
    expect(status.layers.trust).toBe('healthy');
  });

  it('marks trust as degraded when degraded conditions exist', async () => {
    mockGetHealthSignals.mockResolvedValue([]);
    mockGetActiveDegradedConditions.mockResolvedValue([
      {
        conditionId: '00000000-0000-4000-8000-cccccccccccc',
        conditionType: 'voice_transcript_partial',
        severity: 'warning',
      },
    ]);
    mockGetActiveRuns.mockResolvedValue([]);

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(false);
    expect(status.layers.trust).toBe('degraded');
  });

  it('marks layer as unavailable on critical health signal', async () => {
    mockGetHealthSignals.mockResolvedValue([
      {
        signalId: '00000000-0000-4000-8000-dddddddddddd',
        signalType: 'latency',
        componentId: 'retrieval-engine',
        status: 'critical',
        value: 15000,
        threshold: 3000,
        metadata: {},
        timestamp: new Date().toISOString(),
      },
    ]);
    mockGetActiveDegradedConditions.mockResolvedValue([]);
    mockGetActiveRuns.mockResolvedValue([]);

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(false);
    expect(status.layers.retrieval).toBe('unavailable');
  });

  it('marks layer as degraded on warning health signal', async () => {
    mockGetHealthSignals.mockResolvedValue([
      {
        signalId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        signalType: 'error_rate',
        componentId: 'execution-spine',
        status: 'warning',
        value: 5,
        threshold: 3,
        metadata: {},
        timestamp: new Date().toISOString(),
      },
    ]);
    mockGetActiveDegradedConditions.mockResolvedValue([]);
    mockGetActiveRuns.mockResolvedValue([]);

    const status = await getOperatingEnvironmentStatus(ORG_ID);

    expect(status.healthy).toBe(false);
    expect(status.layers.execution).toBe('degraded');
  });
});
