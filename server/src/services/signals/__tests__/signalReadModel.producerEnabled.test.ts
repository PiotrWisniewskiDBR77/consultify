import { afterEach, describe, expect, it, vi } from 'vitest';

import { readSignalFeed } from '../signalReadModel';

describe('signal feed producerEnabled envelope', () => {
  afterEach(() => delete process.env.ENABLE_SIGNAL_PRODUCER);

  const read = () =>
    readSignalFeed({
      db: { query: vi.fn().mockResolvedValue([]) },
      organizationId: 'org-1',
      userId: 'user-1',
      roles: [],
      locale: 'pl',
    });

  it('is false while the producer flag is absent', async () => {
    await expect(read()).resolves.toEqual({
      signals: [],
      nextCursor: null,
      producerEnabled: false,
    });
  });

  it('is true without changing signals or cursor when enabled', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    await expect(read()).resolves.toEqual({ signals: [], nextCursor: null, producerEnabled: true });
  });
});
