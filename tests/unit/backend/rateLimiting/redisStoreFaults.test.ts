/**
 * OPS-DEMO-002 — TRUE fail-closed on a Redis fault.
 *
 * `RedisRateLimitStore.increment()` historically swallowed EVERY Redis error and
 * returned `{ totalHits: 1 }`. That is worse than failing open: during an outage
 * each request looks like the first hit of a fresh window, so the quota silently
 * becomes infinite AND the caller cannot detect it. The earlier round worked
 * around that by probing the client BEFORE calling, which only catches "not
 * connected" — not a rejection from INCR, from the TTL read, or from EXPIRE.
 *
 * These tests drive the REAL adapter (no injected store factory) over the REAL
 * `RedisRateLimitStore` on top of a fake Redis client whose individual commands
 * reject, one failure point at a time. The client stays `isOpen: true`
 * throughout and always exposes `incr`/`ttl` as functions, so the adapter's
 * pre-call connectivity probe never fires and cannot be what makes these pass.
 *
 * HARNESS NOTE: unlike the sibling suites this file imports the middleware ONCE.
 * Vitest stops applying a module mock to a *dynamically* imported module after
 * the second `vi.resetModules()` in a file, and the adapter reaches RedisClient
 * through `await import(...)`. Repeated resets therefore silently handed the
 * adapter the real client and every test "passed" for the wrong reason. One
 * instance plus explicit per-test state resets keeps the fake in place.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * A Redis stand-in that can be told to reject from a specific command, starting
 * at a specific call number. `failFromCall` is what lets us prove the failure
 * path is not a cold-start artefact.
 */
const redisState = vi.hoisted(() => ({
  isOpen: true,
  failOn: null as null | 'incr' | 'ttl' | 'expire',
  failFromCall: 1,
  counters: new Map<string, number>(),
  ttlSeconds: new Map<string, number>(),
  incrCalls: 0,
  ttlCalls: 0,
  expireCalls: 0,
}));

vi.mock('../../../../server/src/utils/RedisClient.js', () => {
  const client = {
    get isOpen() {
      return redisState.isOpen;
    },
    async incr(key: string): Promise<number> {
      redisState.incrCalls += 1;
      if (redisState.failOn === 'incr' && redisState.incrCalls >= redisState.failFromCall) {
        throw new Error('INCR rejected');
      }
      const next = (redisState.counters.get(key) ?? 0) + 1;
      redisState.counters.set(key, next);
      return next;
    },
    async ttl(key: string): Promise<number> {
      redisState.ttlCalls += 1;
      if (redisState.failOn === 'ttl' && redisState.ttlCalls >= redisState.failFromCall) {
        throw new Error('TTL rejected');
      }
      // -1 on a key with no expiry drives the EXPIRE branch on the first hit.
      return redisState.ttlSeconds.get(key) ?? -1;
    },
    async expire(key: string, seconds: number): Promise<number> {
      redisState.expireCalls += 1;
      if (redisState.failOn === 'expire' && redisState.expireCalls >= redisState.failFromCall) {
        throw new Error('EXPIRE rejected');
      }
      redisState.ttlSeconds.set(key, seconds);
      return 1;
    },
    async decr(): Promise<number> {
      return 0;
    },
    async del(): Promise<number> {
      return 1;
    },
  };
  return { default: client };
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
  // 0 = "the limiter has not written a status", i.e. the request was allowed
  // through. Starting at 200 made "has this request been decided yet?" untestable.
  const res: FakeRes = {
    statusCode: 0,
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

type RateLimitModule = typeof import('../../../../server/src/middleware/rateLimiting.middleware.js');
type StoreModule = typeof import('../../../../server/src/utils/RedisRateLimitStore.js');

let mod: RateLimitModule;
let storeModule: StoreModule;

beforeAll(async () => {
  // Captured at import time by the limiter definitions, so it must be set first.
  vi.stubEnv('NODE_ENV', 'production');
  mod = await import('../../../../server/src/middleware/rateLimiting.middleware.js');
  storeModule = await import('../../../../server/src/utils/RedisRateLimitStore.js');
});

beforeEach(() => {
  redisState.isOpen = true;
  redisState.failOn = null;
  redisState.failFromCall = 1;
  redisState.counters.clear();
  redisState.ttlSeconds.clear();
  redisState.incrCalls = 0;
  redisState.ttlCalls = 0;
  redisState.expireCalls = 0;
  loggerCalls.warn.length = 0;
  loggerCalls.error.length = 0;
  vi.stubEnv('NODE_ENV', 'production');
  mod.__private__.resetRateLimitTelemetry();
  // Bumps the store generation, so each test builds a fresh adapter rather than
  // reusing one cached under an earlier test's environment.
  mod.__private__.setSharedRateLimitStoreFactory(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function enableSharedRedis(): void {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'redis');
}

/** The adapter loads two modules dynamically, so settle over several turns. */
async function settle(res: FakeRes, expected: number): Promise<void> {
  await vi.waitFor(() => expect(res.statusCode).toBe(expected), { timeout: 5_000 });
}

/** Waits until this specific request has been either allowed or answered. */
async function settleRequest(res: FakeRes, next: { mock: { calls: unknown[] } }): Promise<void> {
  await vi.waitFor(() => expect(next.mock.calls.length > 0 || res.statusCode !== 0).toBe(true), {
    timeout: 5_000,
  });
}

describe('RedisRateLimitStore fault propagation', () => {
  describe('the underlying store', () => {
    it('still SWALLOWS by default, so the express-rate-limit caller in index.ts is unchanged', async () => {
      // index.ts constructs `new RedisRateLimitStore({ windowMs })` with no
      // second key, so `throwOnError` is undefined. That caller must keep
      // failing open on a Redis blip.
      redisState.failOn = 'incr';
      const store = new storeModule.RedisRateLimitStore({ windowMs: 15 * 60_000 });

      const result = await store.increment('gateway-key');

      expect(result.totalHits).toBe(1);
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(redisState.incrCalls).toBe(1);
    });

    it('propagates each failure point when the caller opts in with throwOnError', async () => {
      const store = new storeModule.RedisRateLimitStore({ windowMs: 60_000, throwOnError: true });

      redisState.failOn = 'incr';
      await expect(store.increment('k1')).rejects.toThrow('INCR rejected');

      redisState.failOn = 'ttl';
      await expect(store.increment('k2')).rejects.toThrow('TTL rejected');

      redisState.failOn = 'expire';
      await expect(store.increment('k3')).rejects.toThrow('EXPIRE rejected');
    });
  });

  describe('demo signup limiter, failMode=closed (default)', () => {
    it('answers 503 when INCR rejects', async () => {
      enableSharedRedis();
      redisState.failOn = 'incr';

      const req: any = { method: 'POST', ip: '203.0.113.10', headers: {}, body: {} };
      const res = makeRes();
      const next = vi.fn();
      mod.demoSignupIpRateLimiter(req, res as any, next);
      await settle(res, 503);

      expect(next).not.toHaveBeenCalled();
      expect(res.jsonBody).toEqual(
        expect.objectContaining({ code: 'RATE_LIMIT_STORE_UNAVAILABLE' })
      );
      // Proof the fault came from the command, not from the connectivity probe.
      expect(redisState.incrCalls).toBe(1);
      expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(1);
    });

    it('answers 503 when the TTL read rejects', async () => {
      enableSharedRedis();
      redisState.failOn = 'ttl';

      const req: any = { method: 'POST', ip: '203.0.113.11', headers: {}, body: {} };
      const res = makeRes();
      const next = vi.fn();
      mod.demoSignupIpRateLimiter(req, res as any, next);
      await settle(res, 503);

      expect(next).not.toHaveBeenCalled();
      // INCR succeeded; the fault is strictly downstream of it.
      expect(redisState.incrCalls).toBe(1);
      expect(redisState.ttlCalls).toBe(1);
      expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(1);
    });

    it('answers 503 when EXPIRE rejects mid-operation', async () => {
      enableSharedRedis();
      redisState.failOn = 'expire';

      const req: any = { method: 'POST', ip: '203.0.113.12', headers: {}, body: {} };
      const res = makeRes();
      const next = vi.fn();
      mod.demoSignupIpRateLimiter(req, res as any, next);
      await settle(res, 503);

      expect(next).not.toHaveBeenCalled();
      // INCR and TTL both succeeded; only the window write failed.
      expect(redisState.incrCalls).toBe(1);
      expect(redisState.ttlCalls).toBe(1);
      expect(redisState.expireCalls).toBe(1);
      expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(1);
    });

    it('answers 503 when INCR starts rejecting on the SECOND call, window already established', async () => {
      enableSharedRedis();
      redisState.failOn = 'incr';
      redisState.failFromCall = 2;

      const req: any = { method: 'POST', ip: '203.0.113.13', headers: {}, body: {} };

      // First request establishes the window and is allowed through.
      const first = makeRes();
      const firstNext = vi.fn();
      mod.demoSignupIpRateLimiter(req, first as any, firstNext);
      await vi.waitFor(() => expect(firstNext).toHaveBeenCalledTimes(1), { timeout: 5_000 });
      expect(first.statusCode).toBe(0);
      expect(redisState.counters.get('rl:demo-signup-ip:ip:203.0.113.13')).toBe(1);

      // Redis then falls over. This is NOT a cold-start artefact.
      const second = makeRes();
      const secondNext = vi.fn();
      mod.demoSignupIpRateLimiter(req, second as any, secondNext);
      await settle(second, 503);

      expect(secondNext).not.toHaveBeenCalled();
      expect(mod.getRateLimitTelemetry()['demo-signup-ip']).toEqual({
        rejected: 0,
        storeUnavailable: 1,
      });
    });

    it('answers 503 when the TTL read starts rejecting on the SECOND call', async () => {
      enableSharedRedis();
      redisState.failOn = 'ttl';
      redisState.failFromCall = 2;

      const req: any = { method: 'POST', ip: '203.0.113.14', headers: {}, body: {} };

      const first = makeRes();
      const firstNext = vi.fn();
      mod.demoSignupIpRateLimiter(req, first as any, firstNext);
      await vi.waitFor(() => expect(firstNext).toHaveBeenCalledTimes(1), { timeout: 5_000 });
      expect(first.statusCode).toBe(0);

      const second = makeRes();
      const secondNext = vi.fn();
      mod.demoSignupIpRateLimiter(req, second as any, secondNext);
      await settle(second, 503);

      expect(secondNext).not.toHaveBeenCalled();
      expect(redisState.incrCalls).toBe(2);
      expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(1);
    });

    it('counts normally while Redis is healthy, so 503 is not the only outcome', async () => {
      enableSharedRedis();

      const req: any = { method: 'POST', ip: '203.0.113.15', headers: {}, body: {} };
      const next = vi.fn();
      let last = makeRes();
      for (let i = 0; i < 6; i += 1) {
        last = makeRes();
        const iterationNext = vi.fn(() => next());
        mod.demoSignupIpRateLimiter(req, last as any, iterationNext);
        await settleRequest(last, iterationNext);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(last.statusCode).toBe(429);
      expect(redisState.counters.get('rl:demo-signup-ip:ip:203.0.113.15')).toBe(6);
      // EXPIRE ran once: the window was established on the first hit and reused.
      expect(redisState.expireCalls).toBe(1);
    });
  });

  describe('fail mode still governs the direction', () => {
    it('degrades to the per-replica bucket when configured local, even on an INCR fault', async () => {
      enableSharedRedis();
      vi.stubEnv('RATE_LIMIT_SHARED_STORE_FAIL_MODE', 'local');
      redisState.failOn = 'incr';

      const req: any = { method: 'POST', ip: '203.0.113.16', headers: {}, body: {} };
      const next = vi.fn();
      let last = makeRes();
      for (let i = 0; i < 6; i += 1) {
        last = makeRes();
        const iterationNext = vi.fn(() => next());
        mod.demoSignupIpRateLimiter(req, last as any, iterationNext);
        await settleRequest(last, iterationNext);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(last.statusCode).toBe(429);
      expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(6);
    });

    it('lets everything through when configured open, on an EXPIRE fault', async () => {
      enableSharedRedis();
      vi.stubEnv('RATE_LIMIT_SHARED_STORE_FAIL_MODE', 'open');
      redisState.failOn = 'expire';

      const req: any = { method: 'POST', ip: '203.0.113.17', headers: {}, body: {} };
      const next = vi.fn();
      for (let i = 0; i < 8; i += 1) {
        const res = makeRes();
        mod.demoSignupIpRateLimiter(req, res as any, next);
      }
      await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(8), { timeout: 5_000 });

      expect(mod.getRateLimitTelemetry()['demo-signup-ip'].storeUnavailable).toBe(8);
    });
  });

  describe('the limiter readiness probe over the same faults', () => {
    it('reports ok while Redis counts', async () => {
      enableSharedRedis();
      const probe = await mod.probeRateLimiterHealth();
      expect(probe).toEqual(
        expect.objectContaining({ ok: true, store: 'redis', failMode: 'closed', bypassed: false })
      );
      // Two INCRs on one throwaway key — the probe's whole cost.
      expect(redisState.incrCalls).toBe(2);
    });

    it('reports NOT ok when INCR rejects', async () => {
      enableSharedRedis();
      redisState.failOn = 'incr';
      const probe = await mod.probeRateLimiterHealth();
      expect(probe.ok).toBe(false);
      expect(probe.store).toBe('redis');
    });

    it('reports NOT ok when the counter does not advance, which is the mock-client failure', async () => {
      enableSharedRedis();
      // A store that answers but always says "1" — exactly what MOCK_REDIS gives.
      mod.__private__.setSharedRateLimitStoreFactory(() => ({
        async increment() {
          return { count: 1, resetAt: Date.now() + 60_000 };
        },
      }));

      const probe = await mod.probeRateLimiterHealth();
      expect(probe.ok).toBe(false);
      expect(probe.detail).toBe('shared store did not advance its counter');

      mod.__private__.setSharedRateLimitStoreFactory(null);
    });
  });
});
