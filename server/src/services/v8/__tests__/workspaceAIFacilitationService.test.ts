import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateDecisionParams,
  GenerateSuggestionParams,
  RecordInsightParams,
} from '../../../types/workspaceAIFacilitation.js';
import {
  AISuggestionSchema,
  CollaborativeDecisionSchema,
  CreateDecisionParamsSchema,
  GenerateSuggestionParamsSchema,
  RecordInsightParamsSchema,
  SessionInsightSchema,
} from '../../../types/workspaceAIFacilitation.js';

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

import {
  acceptSuggestion,
  closeDecision,
  createCollaborativeDecision,
  dismissSuggestion,
  expireStaleSuggestions,
  generateSuggestion,
  getDecisions,
  getInsights,
  getSessionAISummary,
  getSuggestions,
  recordInsight,
  voteOnDecision,
} from '../workspaceAIFacilitationService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const SESSION_ID = 'session-001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const SUGGESTION_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const DECISION_ID = '00000000-0000-4000-8000-dddddddddddd';

function makeSuggestionParams(
  overrides?: Partial<GenerateSuggestionParams>
): GenerateSuggestionParams {
  return {
    sessionId: SESSION_ID,
    organizationId: ORG_ID,
    suggestionType: 'action_item',
    content: 'Follow up on the budget review',
    confidence: 0.85,
    ...overrides,
  };
}

function makeFakeSuggestionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    suggestion_id: SUGGESTION_ID,
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    suggestion_type: 'action_item',
    state: 'pending',
    content: 'Follow up on the budget review',
    confidence: 0.85,
    source_snapshot_id: null,
    created_at: '2026-03-23T10:00:00.000Z',
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  };
}

function makeInsightParams(overrides?: Partial<RecordInsightParams>): RecordInsightParams {
  return {
    sessionId: SESSION_ID,
    organizationId: ORG_ID,
    insightType: 'topic_drift',
    title: 'Discussion drifting off-topic',
    body: 'The conversation has moved away from the agenda item.',
    severity: 'warning',
    ...overrides,
  };
}

function makeFakeInsightRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    insight_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    insight_type: 'topic_drift',
    title: 'Discussion drifting off-topic',
    body: 'The conversation has moved away from the agenda item.',
    severity: 'warning',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeDecisionParams(overrides?: Partial<CreateDecisionParams>): CreateDecisionParams {
  return {
    sessionId: SESSION_ID,
    organizationId: ORG_ID,
    question: 'Which approach should we take for the migration?',
    options: [
      { optionId: 'opt-a', label: 'Big bang migration' },
      { optionId: 'opt-b', label: 'Incremental migration' },
    ],
    ...overrides,
  };
}

function makeFakeDecisionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    decision_id: DECISION_ID,
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    question: 'Which approach should we take for the migration?',
    options: JSON.stringify([
      { optionId: 'opt-a', label: 'Big bang migration', votes: [] },
      { optionId: 'opt-b', label: 'Incremental migration', votes: [] },
    ]),
    status: 'open',
    outcome: null,
    created_at: '2026-03-23T10:00:00.000Z',
    closed_at: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// generateSuggestion
// ------------------------------------------

describe('generateSuggestion', () => {
  it('creates a suggestion in pending state', async () => {
    const result = await generateSuggestion(makeSuggestionParams());

    expect(result.suggestionId).toBeDefined();
    expect(result.state).toBe('pending');
    expect(result.suggestionType).toBe('action_item');
    expect(result.content).toBe('Follow up on the budget review');
    expect(result.confidence).toBe(0.85);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.resolvedAt).toBeNull();
    expect(result.resolvedBy).toBeNull();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_ai_suggestions');
  });

  it('defaults confidence to 0.5 when not provided', async () => {
    const result = await generateSuggestion(makeSuggestionParams({ confidence: undefined }));
    expect(result.confidence).toBe(0.5);
  });

  it('rejects invalid suggestionType via Zod', async () => {
    await expect(
      generateSuggestion(makeSuggestionParams({ suggestionType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      generateSuggestion(makeSuggestionParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty content', async () => {
    await expect(generateSuggestion(makeSuggestionParams({ content: '' }))).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// getSuggestions
// ------------------------------------------

describe('getSuggestions', () => {
  it('returns all suggestions for a session', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSuggestionRow(),
      makeFakeSuggestionRow({ suggestion_id: 's2', state: 'accepted' }),
    ]);

    const results = await getSuggestions(SESSION_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].sessionId).toBe(SESSION_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('session_id = ?');
    expect(query).toContain('organization_id = ?');
  });

  it('filters by state when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSuggestionRow()]);

    await getSuggestions(SESSION_ID, ORG_ID, 'pending');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('state = ?');
  });

  it('returns empty array when no suggestions exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSuggestions(SESSION_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// acceptSuggestion
// ------------------------------------------

describe('acceptSuggestion', () => {
  it('transitions a pending suggestion to accepted', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSuggestionRow());

    const result = await acceptSuggestion(SUGGESTION_ID, ORG_ID, USER_ID);

    expect(result.state).toBe('accepted');
    expect(result.resolvedBy).toBe(USER_ID);
    expect(result.resolvedAt).not.toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("state = 'accepted'");
  });

  it('throws when suggestion not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(acceptSuggestion('nonexistent', ORG_ID, USER_ID)).rejects.toThrow('not found');
  });

  it('throws when suggestion is not pending', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSuggestionRow({ state: 'dismissed' }));

    await expect(acceptSuggestion(SUGGESTION_ID, ORG_ID, USER_ID)).rejects.toThrow(
      "current state is 'dismissed'"
    );
  });
});

// ------------------------------------------
// dismissSuggestion
// ------------------------------------------

describe('dismissSuggestion', () => {
  it('transitions a pending suggestion to dismissed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSuggestionRow());

    const result = await dismissSuggestion(SUGGESTION_ID, ORG_ID, USER_ID);

    expect(result.state).toBe('dismissed');
    expect(result.resolvedBy).toBe(USER_ID);
    expect(result.resolvedAt).not.toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("state = 'dismissed'");
  });

  it('throws when suggestion not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(dismissSuggestion('nonexistent', ORG_ID, USER_ID)).rejects.toThrow('not found');
  });

  it('throws when suggestion is already accepted', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSuggestionRow({ state: 'accepted' }));

    await expect(dismissSuggestion(SUGGESTION_ID, ORG_ID, USER_ID)).rejects.toThrow(
      "current state is 'accepted'"
    );
  });
});

// ------------------------------------------
// expireStaleSuggestions
// ------------------------------------------

describe('expireStaleSuggestions', () => {
  it('expires pending suggestions older than threshold', async () => {
    const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mockDbAll.mockResolvedValueOnce([
      makeFakeSuggestionRow({ created_at: oldTimestamp }),
      makeFakeSuggestionRow({ suggestion_id: 's2', created_at: oldTimestamp }),
    ]);

    const expired = await expireStaleSuggestions(SESSION_ID, ORG_ID, 30 * 60 * 1000);

    expect(expired).toHaveLength(2);
    expect(expired[0].state).toBe('expired');
    expect(expired[0].resolvedAt).not.toBeNull();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("state = 'expired'");
  });

  it('returns empty array when no stale suggestions', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const expired = await expireStaleSuggestions(SESSION_ID, ORG_ID);

    expect(expired).toEqual([]);
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

// ------------------------------------------
// recordInsight
// ------------------------------------------

describe('recordInsight', () => {
  it('creates a session insight', async () => {
    const result = await recordInsight(makeInsightParams());

    expect(result.insightId).toBeDefined();
    expect(result.insightType).toBe('topic_drift');
    expect(result.severity).toBe('warning');
    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.organizationId).toBe(ORG_ID);

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_session_insights');
  });

  it('defaults severity to info', async () => {
    const result = await recordInsight(makeInsightParams({ severity: undefined }));
    expect(result.severity).toBe('info');
  });

  it('rejects empty title via Zod', async () => {
    await expect(recordInsight(makeInsightParams({ title: '' }))).rejects.toThrow(ZodError);
  });

  it('rejects invalid organizationId', async () => {
    await expect(recordInsight(makeInsightParams({ organizationId: 'bad' }))).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// getInsights
// ------------------------------------------

describe('getInsights', () => {
  it('returns all insights for a session', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeInsightRow(),
      makeFakeInsightRow({ insight_id: 'i2', severity: 'critical' }),
    ]);

    const results = await getInsights(SESSION_ID, ORG_ID);

    expect(results).toHaveLength(2);
    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('session_id = ?');
    expect(query).toContain('organization_id = ?');
  });

  it('filters by severity when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeInsightRow()]);

    await getInsights(SESSION_ID, ORG_ID, 'warning');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('severity = ?');
  });

  it('returns empty array when no insights exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getInsights(SESSION_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// createCollaborativeDecision
// ------------------------------------------

describe('createCollaborativeDecision', () => {
  it('creates a decision with options in open state', async () => {
    const result = await createCollaborativeDecision(makeDecisionParams());

    expect(result.decisionId).toBeDefined();
    expect(result.status).toBe('open');
    expect(result.question).toBe('Which approach should we take for the migration?');
    expect(result.options).toHaveLength(2);
    expect(result.options[0].votes).toEqual([]);
    expect(result.outcome).toBeNull();
    expect(result.closedAt).toBeNull();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_collaborative_decisions');
  });

  it('rejects fewer than 2 options via Zod', async () => {
    await expect(
      createCollaborativeDecision(
        makeDecisionParams({ options: [{ optionId: 'only', label: 'Only one' }] })
      )
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty question', async () => {
    await expect(createCollaborativeDecision(makeDecisionParams({ question: '' }))).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// voteOnDecision
// ------------------------------------------

describe('voteOnDecision', () => {
  it('adds a vote to the specified option', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecisionRow());

    const result = await voteOnDecision(DECISION_ID, 'opt-a', USER_ID, ORG_ID);

    expect(result.options[0].votes).toContain(USER_ID);

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_collaborative_decisions');
    expect(sql).toContain('options = ?');
  });

  it('throws when decision not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(voteOnDecision('nonexistent', 'opt-a', USER_ID, ORG_ID)).rejects.toThrow(
      'not found'
    );
  });

  it('throws when decision is closed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecisionRow({ status: 'closed' }));

    await expect(voteOnDecision(DECISION_ID, 'opt-a', USER_ID, ORG_ID)).rejects.toThrow('closed');
  });

  it('throws when option does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecisionRow());

    await expect(voteOnDecision(DECISION_ID, 'opt-nonexistent', USER_ID, ORG_ID)).rejects.toThrow(
      'not found'
    );
  });

  it('throws on duplicate vote', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeDecisionRow({
        options: JSON.stringify([
          { optionId: 'opt-a', label: 'Big bang migration', votes: [USER_ID] },
          { optionId: 'opt-b', label: 'Incremental migration', votes: [] },
        ]),
      })
    );

    await expect(voteOnDecision(DECISION_ID, 'opt-a', USER_ID, ORG_ID)).rejects.toThrow(
      'already voted'
    );
  });
});

// ------------------------------------------
// closeDecision
// ------------------------------------------

describe('closeDecision', () => {
  it('closes an open decision with outcome', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecisionRow());

    const result = await closeDecision(DECISION_ID, ORG_ID, 'Incremental migration chosen');

    expect(result.status).toBe('closed');
    expect(result.outcome).toBe('Incremental migration chosen');
    expect(result.closedAt).not.toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'closed'");
  });

  it('throws when decision not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(closeDecision('nonexistent', ORG_ID, 'outcome')).rejects.toThrow('not found');
  });

  it('throws when decision is already closed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecisionRow({ status: 'closed' }));

    await expect(closeDecision(DECISION_ID, ORG_ID, 'outcome')).rejects.toThrow('already closed');
  });
});

// ------------------------------------------
// getDecisions
// ------------------------------------------

describe('getDecisions', () => {
  it('returns all decisions for a session', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeDecisionRow(),
      makeFakeDecisionRow({ decision_id: 'd2', status: 'closed' }),
    ]);

    const results = await getDecisions(SESSION_ID, ORG_ID);

    expect(results).toHaveLength(2);
    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('session_id = ?');
    expect(query).toContain('organization_id = ?');
  });

  it('filters by status when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeDecisionRow()]);

    await getDecisions(SESSION_ID, ORG_ID, 'open');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('status = ?');
  });

  it('returns empty array when no decisions exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getDecisions(SESSION_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// getSessionAISummary
// ------------------------------------------

describe('getSessionAISummary', () => {
  it('aggregates counts across suggestions, insights, and decisions', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeFakeSuggestionRow({ state: 'pending' }),
        makeFakeSuggestionRow({ suggestion_id: 's2', state: 'pending' }),
        makeFakeSuggestionRow({ suggestion_id: 's3', state: 'accepted' }),
      ])
      .mockResolvedValueOnce([
        makeFakeInsightRow({ severity: 'info' }),
        makeFakeInsightRow({ insight_id: 'i2', severity: 'warning' }),
        makeFakeInsightRow({ insight_id: 'i3', severity: 'critical' }),
      ])
      .mockResolvedValueOnce([makeFakeDecisionRow()]);

    const summary = await getSessionAISummary(SESSION_ID, ORG_ID);

    expect(summary.sessionId).toBe(SESSION_ID);
    expect(summary.organizationId).toBe(ORG_ID);
    expect(summary.suggestions.pending).toBe(2);
    expect(summary.suggestions.accepted).toBe(1);
    expect(summary.suggestions.dismissed).toBe(0);
    expect(summary.suggestions.expired).toBe(0);
    expect(summary.insights.info).toBe(1);
    expect(summary.insights.warning).toBe(1);
    expect(summary.insights.critical).toBe(1);
    expect(summary.openDecisions).toBe(1);
  });

  it('returns zeroes when session has no data', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const summary = await getSessionAISummary(SESSION_ID, ORG_ID);

    expect(summary.suggestions.pending).toBe(0);
    expect(summary.suggestions.accepted).toBe(0);
    expect(summary.insights.info).toBe(0);
    expect(summary.insights.warning).toBe(0);
    expect(summary.insights.critical).toBe(0);
    expect(summary.openDecisions).toBe(0);
  });
});

// ------------------------------------------
// Org isolation
// ------------------------------------------

describe('org isolation', () => {
  it('getSuggestions enforces organization_id in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSuggestions(SESSION_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('acceptSuggestion enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(acceptSuggestion(SUGGESTION_ID, OTHER_ORG_ID, USER_ID)).rejects.toThrow(
      `not found in organization ${OTHER_ORG_ID}`
    );
  });

  it('voteOnDecision enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(voteOnDecision(DECISION_ID, 'opt-a', USER_ID, OTHER_ORG_ID)).rejects.toThrow(
      `not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct AISuggestion', () => {
    expect(() =>
      AISuggestionSchema.parse({
        suggestionId: SUGGESTION_ID,
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        suggestionType: 'action_item',
        state: 'pending',
        content: 'Test content',
        confidence: 0.8,
        sourceSnapshotId: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        resolvedAt: null,
        resolvedBy: null,
      })
    ).not.toThrow();
  });

  it('rejects suggestion with invalid state', () => {
    expect(() =>
      AISuggestionSchema.parse({
        suggestionId: SUGGESTION_ID,
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        suggestionType: 'action_item',
        state: 'invalid_state',
        content: 'Test',
        confidence: 0.5,
        sourceSnapshotId: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        resolvedAt: null,
        resolvedBy: null,
      })
    ).toThrow(ZodError);
  });

  it('validates a correct SessionInsight', () => {
    expect(() =>
      SessionInsightSchema.parse({
        insightId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        insightType: 'topic_drift',
        title: 'Test',
        body: 'Test body',
        severity: 'warning',
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct CollaborativeDecision', () => {
    expect(() =>
      CollaborativeDecisionSchema.parse({
        decisionId: DECISION_ID,
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        question: 'Which approach?',
        options: [
          { optionId: 'a', label: 'Option A', votes: [] },
          { optionId: 'b', label: 'Option B', votes: ['user-1'] },
        ],
        status: 'open',
        outcome: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        closedAt: null,
      })
    ).not.toThrow();
  });

  it('validates GenerateSuggestionParams', () => {
    expect(() => GenerateSuggestionParamsSchema.parse(makeSuggestionParams())).not.toThrow();
  });

  it('validates RecordInsightParams', () => {
    expect(() => RecordInsightParamsSchema.parse(makeInsightParams())).not.toThrow();
  });

  it('validates CreateDecisionParams', () => {
    expect(() => CreateDecisionParamsSchema.parse(makeDecisionParams())).not.toThrow();
  });
});
