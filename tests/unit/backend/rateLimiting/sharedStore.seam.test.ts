/**
 * OPS-DEMO-002 — shared (cross-replica) store seam for the demo signup limiters.
 *
 * The hand-rolled bucket is per-process, so a horizontally scaled deployment
 * multiplies the effective quota by the replica count. This exercises the
 * PREPARED path: it must stay off by default, only apply to the limiters that
 * opted in, and handle store unavailability by an explicit, configured policy
 * rather than by accident.
 *
 * House pattern: NODE_ENV to production BEFORE the dynamic import, plus
 * `vi.resetModules()` for a fresh bucket.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const loggerCalls = vi.hoisted(() => ({ warn: [] as unknown[][], error: [] as unknown[][] }));

vi.mock('../../../../server/src/utils/Logger.js', () => {
  const stub = {
    warn: (...args: unknown[]) => {
      loggerCalls.warn.push(args);
    },
    error: (...args: unknown[]) => {
      loggerCalls.error.push(args);
    },
    info: () => {},
    http: () => {},
    debug: () => {},
  };
  return { default: stub, logger: stub };
});

type FakeRes = {
  statusCode: number;
  headers: Record<string, unknown>;
  jsonBody: unknown;
  setHeader: (k: string, v: unknown) => void;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
};

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    headers: {},
    jsonBody: undefined,
    setHeader: (k, v) => {
      res.headers[k] = v;
    },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (body) => {
      res.jsonBody = body;
      return res;
    },
  };
  return res;
}

/** The shared path is asynchronous by necessity; let its microtasks settle. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function loadFresh() {
  vi.resetModules();
  loggerCalls.warn.length = 0;
  loggerCalls.error.length = 0;
  return import('../../../../server/src/middleware/rateLimiting.middleware.js');
}

/**
 * Stand-in for Redis: one counter map shared by every "replica" that holds a
 * reference to it. That is exactly the property the real store must provide.
 */
function makeFakeSharedStore() {
  const counts = new Map<string, { count: number; resetAt: number }>();
  const calls: string[] = [];
  return {
    calls,
    counts,
    store: {
      async increment(key: string, windowMs: number) {
        calls.push(key);
        const now = Date.now();
        const existing = counts.get(key);
        if (!existing || now >= existing.resetAt) {
          const fresh = { count: 1, resetAt: now + windowMs };
          counts.set(key, fresh);
          return { ...fresh };
        }
        existing.count += 1;
        return { ...existing };
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('shared rate limit store seam', () => {
  it('is off by default: no store is consulted and the limiter stays synchronous', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await loadFresh();
    const factory = vi.fn(() => makeFakeSharedStore().store);
    mod.__private__.setSharedRateLimitStoreFactory(factory);

    expect(mod.__private__.isSharedStoreEnabled()).toBe(false);

    const req: any = { method: 'POST', ip: '198.51.100.31', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();
    for (let i = 0; i < 6; i += 1) mod.demoSignupIpRateLimiter(req, res as any, next);

    // Decided synchronously, before any await — identical to pre-change behaviour.
    expect(next).toHaveBeenCalledTimes(5);
    expect(res.statusCode).toBe(429);
    expect(factory).not.toHaveBeenCalled();

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('enforces one quota through an injected shared store when explicitly opted in', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    const mod = await loadFresh();
    const fake = makeFakeSharedStore();
    mod.__private__.setSharedRateLimitStoreFactory(() => fake.store);

    expect(mod.__private__.isSharedStoreEnabled()).toBe(true);

    const req: any = { method: 'POST', ip: '198.51.100.32', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();
    for (let i = 0; i < 6; i += 1) {
      mod.demoSignupIpRateLimiter(req, res as any, next);
      await flush();
    }

    expect(fake.calls).toHaveLength(6);
    expect(fake.calls[0]).toBe('rl:demo-signup-ip:ip:198.51.100.32');
    expect(next).toHaveBeenCalledTimes(5);
    expect(res.statusCode).toBe(429);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED', retryAfter: expect.any(Number) })
    );
    // The local per-process bucket was bypassed entirely.
    expect(mod.__private__.getStoreSize()).toBe(0);

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('gives two replicas ONE quota, which the in-memory bucket cannot', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');

    // Replica A and replica B are separate module instances sharing one store,
    // the way separate processes would share Redis.
    const fake = makeFakeSharedStore();
    const replicaA = await loadFresh();
    replicaA.__private__.setSharedRateLimitStoreFactory(() => fake.store);
    const replicaB = await loadFresh();
    replicaB.__private__.setSharedRateLimitStoreFactory(() => fake.store);

    const req: any = { method: 'POST', ip: '198.51.100.33', headers: {}, body: {} };
    const next = vi.fn();
    const responses: FakeRes[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = makeRes();
      responses.push(res);
      replicaA.demoSignupIpRateLimiter(req, res as any, next);
      await flush();
    }
    for (let i = 0; i < 3; i += 1) {
      const res = makeRes();
      responses.push(res);
      replicaB.demoSignupIpRateLimiter(req, res as any, next);
      await flush();
    }

    // Six requests across two replicas, one global ceiling of 5.
    expect(next).toHaveBeenCalledTimes(5);
    expect(responses[5].statusCode).toBe(429);

    replicaA.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('leaves limiters that did not opt in on the local bucket even with the flag on', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    const mod = await loadFresh();
    const fake = makeFakeSharedStore();
    mod.__private__.setSharedRateLimitStoreFactory(() => fake.store);

    const req: any = { method: 'POST', ip: '198.51.100.34', headers: {} };
    const res = makeRes();
    const next = vi.fn();
    for (let i = 0; i < 16; i += 1) mod.authRateLimiter(req, res as any, next);

    expect(fake.calls).toHaveLength(0);
    expect(next).toHaveBeenCalledTimes(15);
    expect(res.statusCode).toBe(429);

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('fails CLOSED by default when the shared store cannot answer', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    const mod = await loadFresh();
    mod.__private__.setSharedRateLimitStoreFactory(() => ({
      async increment() {
        throw new Error('redis unreachable');
      },
    }));

    expect(mod.__private__.resolveSharedStoreFailMode()).toBe('closed');

    const req: any = { method: 'POST', ip: '198.51.100.35', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();
    mod.demoSignupIpRateLimiter(req, res as any, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        code: 'RATE_LIMIT_STORE_UNAVAILABLE',
        retryAfter: expect.any(Number),
      })
    );
    expect(res.headers['Retry-After']).toBeDefined();
    expect(mod.getRateLimitTelemetry()['demo-signup-ip']).toEqual({
      rejected: 0,
      storeUnavailable: 1,
    });
    expect(loggerCalls.warn[0]?.[1]).toEqual(
      expect.objectContaining({ limiter: 'demo-signup-ip', reason: 'store-unavailable' })
    );

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('can be configured to degrade to the per-replica bucket instead of refusing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE_FAIL_MODE', 'local');
    const mod = await loadFresh();
    mod.__private__.setSharedRateLimitStoreFactory(() => ({
      async increment() {
        throw new Error('redis unreachable');
      },
    }));

    expect(mod.__private__.resolveSharedStoreFailMode()).toBe('local');

    const req: any = { method: 'POST', ip: '198.51.100.36', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();
    for (let i = 0; i < 6; i += 1) {
      mod.demoSignupIpRateLimiter(req, res as any, next);
      await flush();
    }

    // Still bounded, just per-replica rather than globally.
    expect(next).toHaveBeenCalledTimes(5);
    expect(res.statusCode).toBe(429);
    expect(mod.getRateLimitTelemetry()['demo-signup-ip']).toEqual({
      rejected: 1,
      storeUnavailable: 6,
    });

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('can be configured to fail open, which is an explicitly accepted risk', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE_FAIL_MODE', 'open');
    const mod = await loadFresh();
    mod.__private__.setSharedRateLimitStoreFactory(() => ({
      async increment() {
        throw new Error('redis unreachable');
      },
    }));

    expect(mod.__private__.resolveSharedStoreFailMode()).toBe('open');

    const req: any = { method: 'POST', ip: '198.51.100.37', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();
    for (let i = 0; i < 20; i += 1) {
      mod.demoSignupIpRateLimiter(req, res as any, next);
      await flush();
    }

    expect(next).toHaveBeenCalledTimes(20);
    expect(res.statusCode).toBe(200);
    expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(20);

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('does not cache a construction failure for the process lifetime', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    const mod = await loadFresh();
    const fake = makeFakeSharedStore();
    let attempts = 0;
    mod.__private__.setSharedRateLimitStoreFactory(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('redis not up yet');
      return fake.store;
    });

    const req: any = { method: 'POST', ip: '198.51.100.38', headers: {}, body: {} };
    const first = makeRes();
    mod.demoSignupIpRateLimiter(req, first as any, vi.fn());
    await flush();
    expect(first.statusCode).toBe(503);

    const second = makeRes();
    const next = vi.fn();
    mod.demoSignupIpRateLimiter(req, second as any, next);
    await flush();
    expect(attempts).toBe(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(second.statusCode).toBe(200);

    mod.__private__.setSharedRateLimitStoreFactory(null);
  });

  it('refuses the in-process mock Redis client, which would enforce nothing', async () => {
    // No injected factory here: this drives the real adapter over
    // RedisRateLimitStore. MOCK_REDIS forces RedisClient to hand out its mock,
    // whose incr() returns a constant 1 — a store that looks alive and counts
    // nothing. The adapter must treat that as unavailable, not as a quota.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
    vi.stubEnv('MOCK_REDIS', 'true');
    const mod = await loadFresh();

    const req: any = { method: 'POST', ip: '198.51.100.39', headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();
    mod.demoSignupIpRateLimiter(req, res as any, next);
    // Loading the real adapter pulls in two modules, so this settles over more
    // than one microtask turn.
    await vi.waitFor(() => expect(res.statusCode).toBe(503), { timeout: 5_000 });

    expect(next).not.toHaveBeenCalled();
    expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(1);
  });
});
