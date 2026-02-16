import { describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({ v4: () => 'uuid-1' }));

async function importFresh() {
  vi.resetModules();
  return await import('../../../../server/src/utils/RequestStore.js');
}

describe('server utils/RequestStore', () => {
  it('getCorrelationId returns null outside of middleware context', async () => {
    const mod = await importFresh();
    expect(mod.getCorrelationId()).toBeNull();
    expect(mod.getStartTime()).toBeNull();
    expect(mod.getStore()).toBeUndefined();
  });

  it('correlationMiddleware uses provided X-Correlation-ID header', async () => {
    const mod = await importFresh();
    const req = {
      get: (h: string) => (h === 'X-Correlation-ID' ? 'cid-123' : undefined),
    } as any;
    const res = { set: vi.fn() } as any;
    const next = vi.fn(() => {
      expect(mod.getCorrelationId()).toBe('cid-123');
      expect(mod.getStore()?.correlationId).toBe('cid-123');
    });

    mod.correlationMiddleware(req, res, next);
    expect((req as any).correlationId).toBe('cid-123');
    expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'cid-123');
    expect(next).toHaveBeenCalled();
  });

  it('correlationMiddleware generates a UUID when header is missing', async () => {
    const mod = await importFresh();
    const req = { get: () => undefined } as any;
    const res = { set: vi.fn() } as any;
    const next = vi.fn(() => {
      expect(mod.getCorrelationId()).toBe('uuid-1');
    });

    mod.correlationMiddleware(req, res, next);
    expect((req as any).correlationId).toBe('uuid-1');
    expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'uuid-1');
  });

  it('stores startTime based on Date.now()', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
    const mod = await importFresh();

    const req = { get: () => 'cid' } as any;
    const res = { set: vi.fn() } as any;
    const next = vi.fn(() => {
      expect(mod.getStartTime()).toBe(new Date('2020-01-01T00:00:00.000Z').getTime());
    });
    mod.correlationMiddleware(req, res, next);

    vi.useRealTimers();
  });

  it('default export exposes the same functions', async () => {
    const mod = await importFresh();
    expect(mod.default.getCorrelationId).toBe(mod.getCorrelationId);
    expect(mod.default.getStartTime).toBe(mod.getStartTime);
    expect(mod.default.getStore).toBe(mod.getStore);
    expect(mod.default.correlationMiddleware).toBe(mod.correlationMiddleware);
  });
});
