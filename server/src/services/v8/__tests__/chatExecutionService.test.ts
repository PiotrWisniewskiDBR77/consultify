import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateChatActionProposalParams,
  InitiateHandoffParams,
  RenderingHints,
} from '../../../types/chatExecutionIntegration.js';
import {
  IntentClassificationSchema,
  ChatActionProposalSchema,
  ChatExecutionHandoffSchema,
  ProposalMessageSchema,
  RenderingHintsSchema,
  ClassifyIntentParamsSchema,
  InitiateHandoffParamsSchema,
  CreateChatActionProposalParamsSchema,
} from '../../../types/chatExecutionIntegration.js';

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
// MOCK WAVE 1 SERVICES
// ==========================================

const mockGetSnapshot = vi.fn();
const mockCreateRun = vi.fn();

vi.mock('../contextSnapshotService.js', () => ({
  getSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
  captureSnapshot: vi.fn(),
}));

vi.mock('../executionSpineService.js', () => ({
  createRun: (...args: unknown[]) => mockCreateRun(...args),
}));

import {
  classifyIntent,
  initiateHandoff,
  getHandoff,
  getHandoffsByConversation,
  createChatActionProposal,
  getChatProposalsByConversation,
} from '../chatExecutionService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000020';
const RUN_ID = '00000000-0000-4000-8000-000000000030';
const MESSAGE_ID = '00000000-0000-4000-8000-000000000040';
const PROPOSAL_ID = '00000000-0000-4000-8000-000000000050';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';

function makeFakeSnapshot() {
  return {
    snapshotId: SNAPSHOT_ID,
    snapshotVersion: 1,
    capturedAt: '2026-03-23T10:00:00.000Z',
    workspaceId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    organizationId: ORG_ID,
    projectId: null,
    conversationId: CONVERSATION_ID,
    executionRunId: null,
    artifactRefs: [],
    effectiveScopeRef: 'scope:default',
    resolvedRoleRef: 'role:admin',
    initiatorUserId: USER_ID,
    consumerClass: 'chat' as const,
    privacyMode: false,
    sourceContextRefs: [],
    driftEvents: [],
  };
}

function makeFakeRun() {
  return {
    runId: RUN_ID,
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    initiatorUserId: USER_ID,
    state: 'drafting' as const,
    planVersion: 1,
    goal: 'Build a report from this note',
    createdAt: '2026-03-23T10:00:00.000Z',
    updatedAt: '2026-03-23T10:00:00.000Z',
    resolvedAt: null,
    expiresAt: null,
    metadata: {},
  };
}

function makeHandoffParams(overrides?: Partial<InitiateHandoffParams>): InitiateHandoffParams {
  return {
    conversationId: CONVERSATION_ID,
    contextSnapshotId: SNAPSHOT_ID,
    userId: USER_ID,
    organizationId: ORG_ID,
    goal: 'Build a report from this note and add risk slides',
    ...overrides,
  };
}

function makeDefaultRenderingHints(): RenderingHints {
  return {
    style: 'card_expanded',
    showPreview: true,
    showRiskBadge: true,
    collapsible: true,
    expirationWarning: false,
  };
}

function makeChatProposalParams(
  overrides?: Partial<CreateChatActionProposalParams>,
): CreateChatActionProposalParams {
  return {
    conversationId: CONVERSATION_ID,
    messageId: MESSAGE_ID,
    underlyingProposalId: PROPOSAL_ID,
    organizationId: ORG_ID,
    displaySummary: 'Update KPI target from 80% to 90%',
    renderingHints: makeDefaultRenderingHints(),
    ...overrides,
  };
}

function makeFakeHandoffRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    handoff_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    conversation_id: CONVERSATION_ID,
    context_snapshot_id: SNAPSHOT_ID,
    execution_run_id: RUN_ID,
    organization_id: ORG_ID,
    initiator_user_id: USER_ID,
    intent_classification: JSON.stringify({
      intentType: 'governed_work',
      confidence: 0.85,
      suggestedAction: 'initiate_execution',
      reasoning: 'Work-producing intent',
      classifiedAt: '2026-03-23T10:00:00.000Z',
    }),
    goal: 'Build a report',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeChatProposalRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    chat_proposal_id: '00000000-0000-4000-8000-ffffffffffff',
    conversation_id: CONVERSATION_ID,
    message_id: MESSAGE_ID,
    underlying_proposal_id: PROPOSAL_ID,
    organization_id: ORG_ID,
    display_summary: 'Update KPI target',
    rendering_hints: JSON.stringify(makeDefaultRenderingHints()),
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyIntent', () => {
  it('classifies a clear conversational question', async () => {
    const result = await classifyIntent(
      'What is the status of initiative X?',
      SNAPSHOT_ID,
      ORG_ID,
    );

    expect(result.intentType).toBe('conversational');
    expect(result.suggestedAction).toBe('continue_chat');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.classifiedAt).toBeDefined();
  });

  it('classifies a clear governed work request', async () => {
    const result = await classifyIntent(
      'Create a report from this note and add risk slides',
      SNAPSHOT_ID,
      ORG_ID,
    );

    expect(result.intentType).toBe('governed_work');
    expect(result.suggestedAction).toBe('initiate_execution');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('classifies an ambiguous message', async () => {
    const result = await classifyIntent(
      'I need to think about the quarterly review',
      SNAPSHOT_ID,
      ORG_ID,
    );

    expect(result.intentType).toBe('ambiguous');
    expect(result.suggestedAction).toBe('ask_user_confirmation');
    expect(result.confidence).toBeLessThanOrEqual(0.7);
  });

  it('rejects empty message via Zod', async () => {
    await expect(
      classifyIntent('', SNAPSHOT_ID, ORG_ID),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid contextSnapshotId via Zod', async () => {
    await expect(
      classifyIntent('Hello', 'not-a-uuid', ORG_ID),
    ).rejects.toThrow(ZodError);
  });

  it('returns valid IntentClassification structure', async () => {
    const result = await classifyIntent(
      'Build a deck from this initiative',
      SNAPSHOT_ID,
      ORG_ID,
    );

    expect(() => IntentClassificationSchema.parse(result)).not.toThrow();
  });
});

describe('initiateHandoff', () => {
  it('creates snapshot retrieval + run + handoff record', async () => {
    mockGetSnapshot.mockResolvedValueOnce(makeFakeSnapshot());
    mockCreateRun.mockResolvedValueOnce(makeFakeRun());

    const result = await initiateHandoff(makeHandoffParams());

    expect(result.handoffId).toBeDefined();
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(result.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.executionRunId).toBe(RUN_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.initiatorUserId).toBe(USER_ID);
    expect(result.intentClassification).toBeDefined();
    expect(result.intentClassification.intentType).toBeDefined();
    expect(result.goal).toBe('Build a report from this note and add risk slides');

    expect(mockGetSnapshot).toHaveBeenCalledWith(SNAPSHOT_ID, ORG_ID);
    expect(mockCreateRun).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      initiatorUserId: USER_ID,
      goal: 'Build a report from this note and add risk slides',
    });

    expect(mockDbRun).toHaveBeenCalledOnce();
    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_chat_execution_handoffs');
  });

  it('throws when snapshot not found', async () => {
    mockGetSnapshot.mockResolvedValueOnce(null);

    await expect(
      initiateHandoff(makeHandoffParams()),
    ).rejects.toThrow(`ContextSnapshot ${SNAPSHOT_ID} not found`);
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      initiateHandoff({ ...makeHandoffParams(), conversationId: 'not-a-uuid' }),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty goal via Zod', async () => {
    await expect(
      initiateHandoff({ ...makeHandoffParams(), goal: '' }),
    ).rejects.toThrow(ZodError);
  });

  it('returns valid ChatExecutionHandoff structure', async () => {
    mockGetSnapshot.mockResolvedValueOnce(makeFakeSnapshot());
    mockCreateRun.mockResolvedValueOnce(makeFakeRun());

    const result = await initiateHandoff(makeHandoffParams());

    expect(() => ChatExecutionHandoffSchema.parse(result)).not.toThrow();
  });
});

describe('getHandoff', () => {
  it('returns a handoff when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeHandoffRow());

    const result = await getHandoff('00000000-0000-4000-8000-eeeeeeeeeeee', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.handoffId).toBe('00000000-0000-4000-8000-eeeeeeeeeeee');
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.intentClassification.intentType).toBe('governed_work');

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when handoff does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getHandoff('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getHandoff('00000000-0000-4000-8000-eeeeeeeeeeee', OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('getHandoffsByConversation', () => {
  it('returns handoffs for a conversation with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeHandoffRow(),
      makeFakeHandoffRow({
        handoff_id: 'handoff-2',
        goal: 'Second handoff',
      }),
    ]);

    const results = await getHandoffsByConversation(CONVERSATION_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].handoffId).toBe('00000000-0000-4000-8000-eeeeeeeeeeee');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(query).toContain('conversation_id');
  });

  it('returns empty array when no handoffs exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getHandoffsByConversation(CONVERSATION_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns empty', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getHandoffsByConversation(CONVERSATION_ID, OTHER_ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('createChatActionProposal', () => {
  it('creates a chat proposal wrapping an underlying proposal', async () => {
    const result = await createChatActionProposal(makeChatProposalParams());

    expect(result.chatProposalId).toBeDefined();
    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(result.messageId).toBe(MESSAGE_ID);
    expect(result.underlyingProposalId).toBe(PROPOSAL_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.displaySummary).toBe('Update KPI target from 80% to 90%');
    expect(result.renderingHints.style).toBe('card_expanded');
    expect(result.renderingHints.showPreview).toBe(true);
    expect(result.renderingHints.showRiskBadge).toBe(true);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_chat_action_proposals');
  });

  it('supports all rendering hint styles', async () => {
    const styles = ['inline_compact', 'card_expanded', 'card_collapsed', 'diff_view'] as const;

    for (const style of styles) {
      vi.clearAllMocks();
      const result = await createChatActionProposal(
        makeChatProposalParams({
          renderingHints: { ...makeDefaultRenderingHints(), style },
        }),
      );
      expect(result.renderingHints.style).toBe(style);
    }
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      createChatActionProposal({
        ...makeChatProposalParams(),
        conversationId: 'not-a-uuid',
      }),
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty displaySummary via Zod', async () => {
    await expect(
      createChatActionProposal({
        ...makeChatProposalParams(),
        displaySummary: '',
      }),
    ).rejects.toThrow(ZodError);
  });

  it('returns valid ChatActionProposal structure', async () => {
    const result = await createChatActionProposal(makeChatProposalParams());
    expect(() => ChatActionProposalSchema.parse(result)).not.toThrow();
  });
});

describe('getChatProposalsByConversation', () => {
  it('returns chat proposals for a conversation with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeChatProposalRow(),
      makeFakeChatProposalRow({
        chat_proposal_id: 'cp-2',
        display_summary: 'Second proposal',
      }),
    ]);

    const results = await getChatProposalsByConversation(CONVERSATION_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].chatProposalId).toBe('00000000-0000-4000-8000-ffffffffffff');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(query).toContain('conversation_id');
  });

  it('returns empty array when no chat proposals exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getChatProposalsByConversation(CONVERSATION_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns empty', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getChatProposalsByConversation(CONVERSATION_ID, OTHER_ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('Zod schema validation', () => {
  it('validates IntentClassification', () => {
    expect(() =>
      IntentClassificationSchema.parse({
        intentType: 'governed_work',
        confidence: 0.85,
        suggestedAction: 'initiate_execution',
        reasoning: 'Work intent detected',
        classifiedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('rejects invalid intentType', () => {
    expect(() =>
      IntentClassificationSchema.parse({
        intentType: 'invalid',
        confidence: 0.5,
        suggestedAction: 'continue_chat',
        reasoning: 'test',
        classifiedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).toThrow(ZodError);
  });

  it('rejects confidence out of range', () => {
    expect(() =>
      IntentClassificationSchema.parse({
        intentType: 'conversational',
        confidence: 1.5,
        suggestedAction: 'continue_chat',
        reasoning: 'test',
        classifiedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).toThrow(ZodError);

    expect(() =>
      IntentClassificationSchema.parse({
        intentType: 'conversational',
        confidence: -0.1,
        suggestedAction: 'continue_chat',
        reasoning: 'test',
        classifiedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).toThrow(ZodError);
  });

  it('validates RenderingHints', () => {
    expect(() =>
      RenderingHintsSchema.parse(makeDefaultRenderingHints()),
    ).not.toThrow();
  });

  it('validates ProposalMessage', () => {
    expect(() =>
      ProposalMessageSchema.parse({
        messageType: 'execution_proposal',
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        proposalRefs: [PROPOSAL_ID],
        planSummary: 'Build report with 3 sections',
        stepCount: 3,
      }),
    ).not.toThrow();
  });

  it('rejects ProposalMessage with wrong messageType', () => {
    expect(() =>
      ProposalMessageSchema.parse({
        messageType: 'wrong_type',
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        proposalRefs: [],
        planSummary: 'test',
        stepCount: 0,
      }),
    ).toThrow(ZodError);
  });

  it('validates ChatExecutionHandoff', () => {
    expect(() =>
      ChatExecutionHandoffSchema.parse({
        handoffId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        conversationId: CONVERSATION_ID,
        contextSnapshotId: SNAPSHOT_ID,
        executionRunId: RUN_ID,
        organizationId: ORG_ID,
        initiatorUserId: USER_ID,
        intentClassification: {
          intentType: 'governed_work',
          confidence: 0.85,
          suggestedAction: 'initiate_execution',
          reasoning: 'Work intent',
          classifiedAt: '2026-03-23T10:00:00.000Z',
        },
        goal: 'Build a report',
        createdAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates ClassifyIntentParams', () => {
    expect(() =>
      ClassifyIntentParamsSchema.parse({
        message: 'Create a report',
        contextSnapshotId: SNAPSHOT_ID,
        organizationId: ORG_ID,
      }),
    ).not.toThrow();
  });

  it('validates InitiateHandoffParams', () => {
    expect(() =>
      InitiateHandoffParamsSchema.parse(makeHandoffParams()),
    ).not.toThrow();
  });

  it('validates CreateChatActionProposalParams', () => {
    expect(() =>
      CreateChatActionProposalParamsSchema.parse(makeChatProposalParams()),
    ).not.toThrow();
  });
});
