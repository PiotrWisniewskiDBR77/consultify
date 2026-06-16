/**
 * interviewTranscriptService — S4 conversational transcript persistence unit tests
 * (L-03 / M10 Wywiad). The conversational interview mode persists the running
 * chat transcript here; the f2 evidence flagged this service as untested. These
 * cover org-scoping, metadata (JSONB) round-trip, and the org-scoped read/count/delete.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('uuid', () => ({ v4: () => 'uuid-msg' }));

const ORG = 'org-1';
const SESSION = 's1';

describe('interviewTranscriptService (S4 conversational transcript)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset();
    mockDbRun.mockResolvedValue(undefined);
  });

  it('addMessage: persists an org+session-scoped message with serialized metadata', async () => {
    const { addMessage } = await import(
      '../../../../server/src/services/interviewTranscriptService.js'
    );
    const msg = await addMessage(ORG, SESSION, 'user', 'My answer about delivery risk.', {
      modality: 'voice',
      questionId: 'q1',
    });

    expect(msg).toMatchObject({
      id: 'uuid-msg',
      sessionId: SESSION,
      organizationId: ORG,
      role: 'user',
      content: 'My answer about delivery risk.',
      metadata: { modality: 'voice', questionId: 'q1' },
    });

    const insert = mockDbRun.mock.calls[0];
    expect(String(insert[0])).toContain('INSERT INTO interview_transcript_messages');
    const params = insert[1] as unknown[];
    // org + session scoping present.
    expect(params).toContain(ORG);
    expect(params).toContain(SESSION);
    expect(params).toContain('user');
    // metadata serialized to JSON string.
    expect(params.some((p) => typeof p === 'string' && p.includes('"modality":"voice"'))).toBe(true);
  });

  it('addMessage: defaults metadata to an empty object when omitted', async () => {
    const { addMessage } = await import(
      '../../../../server/src/services/interviewTranscriptService.js'
    );
    const msg = await addMessage(ORG, SESSION, 'ai', 'Follow-up question.');
    expect(msg.metadata).toEqual({});
    const params = mockDbRun.mock.calls[0][1] as unknown[];
    expect(params.some((p) => p === '{}')).toBe(true);
  });

  it('getMessages: scopes the read to org+session and parses string metadata (JSONB round-trip)', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'm1',
        session_id: SESSION,
        organization_id: ORG,
        role: 'user',
        content: 'Answer one.',
        metadata: '{"questionId":"q1"}', // string form (SQLite / serialized JSONB)
        created_at: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'm2',
        session_id: SESSION,
        organization_id: ORG,
        role: 'ai',
        content: 'Follow-up.',
        metadata: { source: 'llm' }, // object form (node-pg JSONB)
        created_at: '2026-06-01T00:01:00.000Z',
      },
    ]);

    const { getMessages } = await import(
      '../../../../server/src/services/interviewTranscriptService.js'
    );
    const rows = await getMessages(ORG, SESSION);

    // Both org and session are passed to the query for scoping.
    const queryParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(queryParams).toContain(ORG);
    expect(queryParams).toContain(SESSION);

    expect(rows).toHaveLength(2);
    // String metadata parsed; object metadata passed through.
    expect(rows[0].metadata).toEqual({ questionId: 'q1' });
    expect(rows[1].metadata).toEqual({ source: 'llm' });
  });

  it('getMessageCount: returns the scoped count', async () => {
    mockDbGet.mockResolvedValueOnce({ cnt: 7 });
    const { getMessageCount } = await import(
      '../../../../server/src/services/interviewTranscriptService.js'
    );
    expect(await getMessageCount(ORG, SESSION)).toBe(7);
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(ORG);
    expect(params).toContain(SESSION);
  });

  it('deleteMessages: deletes only the org+session-scoped rows', async () => {
    const { deleteMessages } = await import(
      '../../../../server/src/services/interviewTranscriptService.js'
    );
    await deleteMessages(ORG, SESSION);
    const del = mockDbRun.mock.calls[0];
    expect(String(del[0])).toContain('DELETE FROM interview_transcript_messages');
    const params = del[1] as unknown[];
    expect(params).toContain(ORG);
    expect(params).toContain(SESSION);
  });
});
