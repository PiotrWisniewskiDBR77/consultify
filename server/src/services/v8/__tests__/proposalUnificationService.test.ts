import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbAll = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getConversationProposals } from '../proposalUnificationService.js';

// ==========================================
// FIXTURES
// ==========================================

const CONVERSATION_ID = 'c0000000-0000-4000-8000-000000000001';
const ORG_ID = '00000000-0000-4000-8000-000000000099';
const AI_ACTION_ID = 'a0000000-0000-4000-8000-000000000010';
const V8_PROPOSAL_ID = 'b0000000-0000-4000-8000-000000000020';
const FACADE_ID = 'f0000000-0000-4000-8000-000000000030';

function makeMessage(
  overrides: Partial<{
    id: string;
    message_type: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>
) {
  return {
    id: overrides.id || 'm-unspecified',
    conversation_id: CONVERSATION_ID,
    role: 'ai',
    content: overrides.content || 'AI proposed action',
    message_type: overrides.message_type || 'execution_proposal',
    metadata: JSON.stringify(overrides.metadata || {}),
    created_at: overrides.created_at || '2026-04-17T10:00:00.000Z',
  };
}

// ==========================================
// TESTS
// ==========================================

describe('proposalUnificationService.getConversationProposals', () => {
  beforeEach(() => {
    mockDbAll.mockReset();
  });

  it('returns empty list when no execution-family messages exist', async () => {
    mockDbAll
      .mockResolvedValueOnce([]) // messages
      // governance probes should not be called, but guard anyway
      .mockResolvedValue([]);

    const result = await getConversationProposals({ conversationId: CONVERSATION_ID });
    expect(result).toEqual([]);
    expect(mockDbAll).toHaveBeenCalledTimes(1);
  });

  it('merges an ai_actions governance row as the truth of lifecycleState', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeMessage({
          id: 'm-1',
          message_type: 'execution_proposal',
          content: 'AI proposed: create task',
          metadata: {
            executionProposal: {
              proposalId: AI_ACTION_ID,
              lifecycleState: 'pending_review',
              actionType: 'create_task',
              planSummary: 'AI proposed: create task',
              stepCount: 2,
              steps: [{ label: 'Draft' }, { label: 'Notify owner' }],
              risk: 'medium',
            },
          },
          created_at: '2026-04-17T10:00:00.000Z',
        }),
      ])
      // ai_actions probe — governance row shows it was already APPROVED
      .mockResolvedValueOnce([
        {
          id: AI_ACTION_ID,
          action_type: 'create_task',
          status: 'APPROVED',
          approved_at: '2026-04-17T10:05:00.000Z',
          approved_by: 'user-1',
          executed_at: null,
          created_at: '2026-04-17T10:00:00.000Z',
        },
      ])
      // v8_action_proposals probe — nothing
      .mockResolvedValueOnce([])
      // facade probe — nothing
      .mockResolvedValueOnce([]);

    const [view] = await getConversationProposals({ conversationId: CONVERSATION_ID });
    expect(view.proposalId).toBe(AI_ACTION_ID);
    expect(view.source).toBe('ai_actions');
    // Governance wins over stale message snapshot
    expect(view.lifecycleState).toBe('approved');
    expect(view.actionType).toBe('create_task');
    expect(view.planSummary).toBe('AI proposed: create task');
    expect(view.stepCount).toBe(2);
    expect(view.steps).toHaveLength(2);
    expect(view.risk).toBe('medium');
    expect(view.messageIds).toEqual(['m-1']);
    expect(view.latestMessageType).toBe('execution_proposal');
    expect(view.resolvedAt).toBe('2026-04-17T10:05:00.000Z');
  });

  it('merges v8_action_proposals governance and maps risk_class + status', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeMessage({
          id: 'm-1',
          message_type: 'execution_proposal',
          content: 'Update KPI target',
          metadata: {
            executionProposal: {
              proposalId: V8_PROPOSAL_ID,
              lifecycleState: 'pending_review',
              planSummary: 'Update KPI target',
            },
          },
        }),
      ])
      .mockResolvedValueOnce([]) // ai_actions
      .mockResolvedValueOnce([
        {
          proposal_id: V8_PROPOSAL_ID,
          proposal_type: 'update_artifact',
          risk_class: 'destructive',
          approval_class: 'requires_human_approval',
          status: 'approved',
          summary: 'Update KPI target from 80% to 90%',
          created_at: '2026-04-17T10:00:00.000Z',
          resolved_at: '2026-04-17T10:10:00.000Z',
          resolved_by: 'reviewer-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          chat_proposal_id: FACADE_ID,
          conversation_id: CONVERSATION_ID,
          message_id: 'm-1',
          underlying_proposal_id: V8_PROPOSAL_ID,
          organization_id: ORG_ID,
          display_summary: 'Update KPI target from 80% to 90%',
          rendering_hints: JSON.stringify({ style: 'card_expanded', showRiskBadge: true }),
          created_at: '2026-04-17T10:00:00.000Z',
        },
      ]);

    const [view] = await getConversationProposals({
      conversationId: CONVERSATION_ID,
      organizationId: ORG_ID,
    });
    expect(view.source).toBe('v8_action_proposals');
    expect(view.lifecycleState).toBe('approved');
    expect(view.actionType).toBe('update_artifact');
    // destructive -> high risk
    expect(view.risk).toBe('high');
    // facade supplies canonical summary + rendering hints + chatProposalId
    expect(view.planSummary).toBe('Update KPI target from 80% to 90%');
    expect(view.chatProposalId).toBe(FACADE_ID);
    expect(view.renderingHints).toMatchObject({ style: 'card_expanded', showRiskBadge: true });
    expect(view.resolvedAt).toBe('2026-04-17T10:10:00.000Z');
  });

  it('falls back to archived source + message snapshot when governance is missing', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeMessage({
          id: 'm-1',
          message_type: 'execution_proposal',
          content: 'Ghost proposal',
          metadata: {
            executionProposal: {
              proposalId: 'ghost-proposal-id',
              lifecycleState: 'pending_review',
              actionType: 'create_task',
              planSummary: 'Ghost proposal',
            },
          },
        }),
      ])
      .mockResolvedValueOnce([]) // ai_actions
      .mockResolvedValueOnce([]) // v8_action_proposals
      .mockResolvedValueOnce([]); // facade

    const [view] = await getConversationProposals({ conversationId: CONVERSATION_ID });
    expect(view.source).toBe('archived');
    // Falls back to metadata snapshot
    expect(view.lifecycleState).toBe('pending_review');
    expect(view.actionType).toBe('create_task');
  });

  it('collapses a proposal→progress→result chain to a single view and picks the latest lifecycle from governance', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeMessage({
          id: 'm-1',
          message_type: 'execution_proposal',
          content: 'AI proposed: update status',
          metadata: {
            executionProposal: {
              proposalId: AI_ACTION_ID,
              lifecycleState: 'pending_review',
              actionType: 'update_status',
              planSummary: 'AI proposed: update status',
            },
          },
          created_at: '2026-04-17T10:00:00.000Z',
        }),
        makeMessage({
          id: 'm-2',
          message_type: 'execution_progress',
          content: 'Approved',
          metadata: {
            executionProposal: {
              proposalId: AI_ACTION_ID,
              lifecycleState: 'approved',
              reviewer: { userId: 'user-1', name: 'Alex Reviewer' },
            },
          },
          created_at: '2026-04-17T10:05:00.000Z',
        }),
        makeMessage({
          id: 'm-3',
          message_type: 'execution_result',
          content: 'Executed',
          metadata: {
            executionProposal: {
              proposalId: AI_ACTION_ID,
              lifecycleState: 'executed',
              reviewer: { userId: 'user-1', name: 'Alex Reviewer' },
            },
          },
          created_at: '2026-04-17T10:10:00.000Z',
        }),
      ])
      // ai_actions shows EXECUTED
      .mockResolvedValueOnce([
        {
          id: AI_ACTION_ID,
          action_type: 'update_status',
          status: 'EXECUTED',
          approved_at: '2026-04-17T10:05:00.000Z',
          approved_by: 'user-1',
          executed_at: '2026-04-17T10:10:00.000Z',
          created_at: '2026-04-17T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getConversationProposals({ conversationId: CONVERSATION_ID });
    expect(result).toHaveLength(1);
    const [view] = result;
    expect(view.proposalId).toBe(AI_ACTION_ID);
    expect(view.lifecycleState).toBe('executed');
    expect(view.messageIds).toEqual(['m-1', 'm-2', 'm-3']);
    expect(view.latestMessageType).toBe('execution_result');
    expect(view.reviewer?.name).toBe('Alex Reviewer');
    expect(view.createdAt).toBe('2026-04-17T10:00:00.000Z');
    expect(view.resolvedAt).toBe('2026-04-17T10:10:00.000Z');
  });

  it('preserves chronological first-seen order across multiple proposals', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeMessage({
          id: 'm-1',
          metadata: {
            executionProposal: {
              proposalId: 'prop-B',
              lifecycleState: 'pending_review',
              planSummary: 'B',
            },
          },
          created_at: '2026-04-17T10:00:00.000Z',
        }),
        makeMessage({
          id: 'm-2',
          metadata: {
            executionProposal: {
              proposalId: 'prop-A',
              lifecycleState: 'pending_review',
              planSummary: 'A',
            },
          },
          created_at: '2026-04-17T10:01:00.000Z',
        }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getConversationProposals({ conversationId: CONVERSATION_ID });
    expect(result.map((v) => v.proposalId)).toEqual(['prop-B', 'prop-A']);
  });

  it('drops execution-family messages whose metadata lacks a proposalId', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeMessage({ id: 'm-1', metadata: {} }), // no executionProposal
        makeMessage({ id: 'm-2', metadata: { executionProposal: {} } }), // empty shape
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    // Since no proposalIds were extracted, only the initial messages query
    // runs — governance probes are short-circuited.
    const result = await getConversationProposals({ conversationId: CONVERSATION_ID });
    expect(result).toEqual([]);
    expect(mockDbAll).toHaveBeenCalledTimes(1);
  });
});
