import { describe, expect, it, vi } from 'vitest';

const logger = { error: vi.fn() };
const redis = {
  get: vi.fn(),
  setEx: vi.fn(),
  set: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
};

vi.mock('../../../../server/src/utils/Logger.js', () => ({ default: logger }));
vi.mock('../../../../server/src/utils/RedisClient.js', () => ({ default: redis }));

async function importFresh() {
  vi.resetModules();
  logger.error.mockClear();
  redis.get.mockReset();
  redis.setEx.mockReset();
  redis.set.mockReset();
  redis.expire.mockReset();
  redis.keys.mockReset();
  redis.del.mockReset();
  return await import('../../../../server/src/utils/cacheHelper.js');
}

describe('server utils/cacheHelper', () => {
  it('getCached returns cached value when present', async () => {
    const { getCached } = await importFresh();
    redis.get.mockResolvedValueOnce(JSON.stringify({ a: 1 }));
    const fetchFn = vi.fn(async () => ({ a: 2 }));
    await expect(getCached('k', fetchFn)).resolves.toEqual({ a: 1 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('getCached calls fetchFn and caches via setEx when cache miss', async () => {
    const { getCached } = await importFresh();
    redis.get.mockResolvedValueOnce(null);
    const fetchFn = vi.fn(async () => ({ ok: true }));
    await expect(getCached('k', fetchFn, 10)).resolves.toEqual({ ok: true });
    expect(redis.setEx).toHaveBeenCalledWith('k', 10, JSON.stringify({ ok: true }));
  });

  it('getCached falls back to fetchFn on Redis errors', async () => {
    const { getCached } = await importFresh();
    redis.get.mockRejectedValueOnce(new Error('redis down'));
    const fetchFn = vi.fn(async () => ({ ok: true }));
    await expect(getCached('k', fetchFn)).resolves.toEqual({ ok: true });
    expect(logger.error).toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalled();
  });

  it('invalidatePattern returns 0 when no keys match', async () => {
    const { invalidatePattern } = await importFresh();
    redis.keys.mockResolvedValueOnce([]);
    await expect(invalidatePattern('p:*')).resolves.toBe(0);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('invalidate deletes by exact key and returns boolean', async () => {
    const { invalidate } = await importFresh();
    redis.del.mockResolvedValueOnce(1);
    await expect(invalidate('k1')).resolves.toBe(true);
    redis.del.mockResolvedValueOnce(0);
    await expect(invalidate('k2')).resolves.toBe(false);
  });
});
