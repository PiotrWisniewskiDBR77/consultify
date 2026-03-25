import { beforeEach, describe, expect, it, vi } from 'vitest';

const incrMock = vi.fn();
const expireMock = vi.fn();
const ttlMock = vi.fn();
const delMock = vi.fn();
const decrMock = vi.fn();

vi.mock('../../../../server/src/utils/RedisClient.js', () => ({
  default: {
    incr: (...args: unknown[]) => incrMock(...args),
    expire: (...args: unknown[]) => expireMock(...args),
    ttl: (...args: unknown[]) => ttlMock(...args),
    del: (...args: unknown[]) => delMock(...args),
    decr: (...args: unknown[]) => decrMock(...args),
  },
}));

describe('RedisRateLimitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets expiry only when the key has no ttl yet', async () => {
    incrMock.mockResolvedValue(1);
    ttlMock.mockResolvedValue(-1);
    expireMock.mockResolvedValue(1);

    const { RedisRateLimitStore } = await import(
      '../../../../server/src/utils/RedisRateLimitStore.ts'
    );

    const store = new RedisRateLimitStore({ windowMs: 15 * 60 * 1000 });
    const result = await store.increment('rl:key');

    expect(expireMock).toHaveBeenCalledWith('rl:key', 900);
    expect(result.totalHits).toBe(1);
    expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('preserves existing ttl instead of extending the window on every hit', async () => {
    incrMock.mockResolvedValue(301);
    ttlMock.mockResolvedValue(42);

    const { RedisRateLimitStore } = await import(
      '../../../../server/src/utils/RedisRateLimitStore.ts'
    );

    const store = new RedisRateLimitStore({ windowMs: 15 * 60 * 1000 });
    const before = Date.now();
    const result = await store.increment('rl:key');

    expect(expireMock).not.toHaveBeenCalled();
    expect(result.totalHits).toBe(301);
    expect(result.resetTime.getTime()).toBeGreaterThanOrEqual(before + 40_000);
    expect(result.resetTime.getTime()).toBeLessThanOrEqual(before + 43_000);
  });
});
