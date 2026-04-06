import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({
    query: mockQuery,
  }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  deleteConversation,
  findOrCreateConversation,
  logVoiceEvent,
  redactConversation,
} from '../virtualWorkerConversationLogger.js';

describe('virtualWorkerConversationLogger channel continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keys conversation lookup by channel so typed and voice do not reuse the same session row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});

    await findOrCreateConversation({
      workerId: 'worker-anna',
      sessionId: 'shared-public-session',
      channel: 'text_chat',
      locale: 'en',
    });

    await findOrCreateConversation({
      workerId: 'worker-anna',
      sessionId: 'shared-public-session',
      channel: 'voice',
      locale: 'en',
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('session_id = $1 AND worker_id = $2 AND channel = $3'),
      ['shared-public-session', 'worker-anna', 'text_chat']
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('session_id = $1 AND worker_id = $2 AND channel = $3'),
      ['shared-public-session', 'worker-anna', 'voice']
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO virtual_worker_conversations'),
      expect.arrayContaining([
        expect.any(String),
        'worker-anna',
        'shared-public-session',
        'voice',
        'en',
      ])
    );
  });

  it('logs voice events against a voice-scoped conversation row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await logVoiceEvent({
      workerId: 'worker-anna',
      sessionId: 'shared-public-session',
      durationSeconds: 14,
      locale: 'pl',
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('session_id = $1 AND worker_id = $2 AND channel = $3'),
      ['shared-public-session', 'worker-anna', 'voice']
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO virtual_worker_conversations'),
      expect.arrayContaining([
        expect.any(String),
        'worker-anna',
        'shared-public-session',
        'voice',
        'pl',
      ])
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SET ended_at = NOW(), duration_seconds = $2, channel = 'voice'"),
      [expect.any(String), 14]
    );
  });

  it('redacts a conversation transcript and clears privacy-sensitive fields', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'conv-1',
            worker_id: 'worker-anna',
            metadata: { source: 'public' },
          },
        ],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const redacted = await redactConversation({
      workerId: 'worker-anna',
      conversationId: 'conv-1',
      redactedBy: 'admin-1',
    });

    expect(redacted).toBe(true);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE virtual_worker_messages'),
      [
        'conv-1',
        '[REDACTED BY ADMIN]',
        JSON.stringify({ redacted: true, redacted_by: 'admin-1' }),
      ]
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('visitor_fingerprint = NULL'),
      expect.arrayContaining([
        'conv-1',
        'Conversation redacted by admin.',
        '[REDACTED BY ADMIN]',
        expect.stringContaining('"redacted_by":"admin-1"'),
      ])
    );
  });

  it('deletes a conversation with its messages', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'conv-1',
            worker_id: 'worker-anna',
          },
        ],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 });

    const deleted = await deleteConversation({
      workerId: 'worker-anna',
      conversationId: 'conv-1',
    });

    expect(deleted).toBe(true);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM virtual_worker_messages WHERE conversation_id = $1',
      ['conv-1']
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      'DELETE FROM virtual_worker_conversations WHERE id = $1 AND worker_id = $2',
      ['conv-1', 'worker-anna']
    );
  });
});
