import { describe, expect, it } from 'vitest';

import { buildPersistedAiResponseMetadata } from '@/utils/chatPersistence';

describe('chatPersistence', () => {
  it('builds unified persisted AI metadata with normalized artifacts and stream session id', () => {
    const metadata = buildPersistedAiResponseMetadata({
      thinking: [
        { id: 'step-1', label: 'Analyze', content: '', status: 'done', timestamp: new Date() },
      ] as any,
      artifacts: [
        {
          id: 'artifact-1',
          type: 'markdown',
          title: 'Plan',
          content: 'Hello',
          language: 'en',
        },
      ] as any,
      citations: [{ title: 'Source 1' }],
      sourceLedger: {
        type: 'source_ledger',
        used_sources: [{ id: 'source-1', type: 'document' }],
        blocked_sources: [],
      },
      streamSessionId: 'stream-123',
      extra: { options: [{ id: 'follow-up', label: 'Follow up', value: 'Follow up' }] },
    });

    expect(metadata).toMatchObject({
      streamSessionId: 'stream-123',
      citations: [{ title: 'Source 1' }],
      sourceLedger: {
        type: 'source_ledger',
        used_sources: [{ id: 'source-1', type: 'document' }],
        blocked_sources: [],
      },
      options: [{ id: 'follow-up', label: 'Follow up', value: 'Follow up' }],
    });
    expect(metadata.thinkingSteps).toHaveLength(1);
    expect(metadata.artifacts).toEqual([
      {
        id: 'artifact-1',
        type: 'markdown',
        title: 'Plan',
        content: 'Hello',
        language: 'en',
      },
    ]);
  });

  it('falls back to empty arrays and omits empty stream session id', () => {
    const metadata = buildPersistedAiResponseMetadata({});

    expect(metadata).toEqual({
      thinkingSteps: [],
      artifacts: [],
      citations: [],
    });
  });
});
