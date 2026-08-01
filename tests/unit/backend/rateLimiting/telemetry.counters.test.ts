/**
 * OPS-DEMO-002 — operator telemetry for rate-limit refusals.
 *
 * An operator needs to see a demo-signup flood as something DISTINCT from
 * ordinary auth throttling, without the limiter leaking who was refused and
 * without turning a real attack into a log flood.
 *
 * House pattern in this directory: flip NODE_ENV to production BEFORE the
 * dynamic import (the middleware short-circuits on `NODE_ENV === 'test'` and
 * captures `isProd` at module load), and `vi.resetModules()` for a fresh bucket.
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

async function loadFresh() {
  vi.resetModules();
  loggerCalls.warn.length = 0;
  loggerCalls.error.length = 0;
  const limiters = await import('../../../../server/src/middleware/rateLimiting.middleware.js');
  // Imported from the same freshly reset module graph, so this is the very
  // instance the limiter increments.
  const metrics = await import('../../../../server/src/middleware/metrics.middleware.js');
  return { limiters, metrics };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('rate limit rejection telemetry', () => {
  it('counts a refusal but leaves allowed requests uncounted', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIpRateLimiter, getRateLimitTelemetry } = limiters;

    const req: any = { method: 'POST', ip: '198.51.100.21', headers: {}, body: {} };
    const next = vi.fn();

    // Prod ceiling is 5/hour. Five allowed requests must leave the counter untouched.
    for (let i = 0; i < 5; i += 1) demoSignupIpRateLimiter(req, makeRes() as any, next);
    expect(next).toHaveBeenCalledTimes(5);
    expect(getRateLimitTelemetry()['demo-signup-ip']).toBeUndefined();

    demoSignupIpRateLimiter(req, makeRes() as any, next);
    expect(next).toHaveBeenCalledTimes(5);
    expect(getRateLimitTelemetry()['demo-signup-ip']).toEqual({
      rejected: 1,
      storeUnavailable: 0,
    });
  });

  it('keeps a demo-signup flood separate from ordinary auth throttling', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIpRateLimiter, authRateLimiter, getRateLimitTelemetry } = limiters;

    const next = vi.fn();
    // Demo signup: 5 allowed + 3 refused.
    const demoReq: any = { method: 'POST', ip: '198.51.100.22', headers: {}, body: {} };
    for (let i = 0; i < 8; i += 1) demoSignupIpRateLimiter(demoReq, makeRes() as any, next);
    // Auth: prod ceiling 15, so 16 calls means exactly one refusal.
    const authReq: any = { method: 'POST', ip: '198.51.100.23', headers: {} };
    for (let i = 0; i < 16; i += 1) authRateLimiter(authReq, makeRes() as any, next);

    const snapshot = getRateLimitTelemetry();
    expect(snapshot['demo-signup-ip'].rejected).toBe(3);
    expect(snapshot['auth'].rejected).toBe(1);
  });

  it('exposes a snapshot that cannot be mutated through the accessor', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIpRateLimiter, getRateLimitTelemetry } = limiters;

    const req: any = { method: 'POST', ip: '198.51.100.24', headers: {}, body: {} };
    for (let i = 0; i < 6; i += 1) demoSignupIpRateLimiter(req, makeRes() as any, vi.fn());

    const first = getRateLimitTelemetry();
    first['demo-signup-ip'].rejected = 9999;
    expect(getRateLimitTelemetry()['demo-signup-ip'].rejected).toBe(1);
  });

  it('is resettable, so a test can assert on exact counts', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIpRateLimiter, getRateLimitTelemetry, resetRateLimitTelemetry } = limiters;

    const req: any = { method: 'POST', ip: '198.51.100.25', headers: {}, body: {} };
    for (let i = 0; i < 6; i += 1) demoSignupIpRateLimiter(req, makeRes() as any, vi.fn());
    expect(getRateLimitTelemetry()['demo-signup-ip'].rejected).toBe(1);

    resetRateLimitTelemetry();
    expect(getRateLimitTelemetry()).toEqual({});

    // ...and the reset clears the log-throttle window too, not just the counter,
    // otherwise the next test would silently observe a suppressed line.
    loggerCalls.warn.length = 0;
    demoSignupIpRateLimiter(req, makeRes() as any, vi.fn());
    expect(getRateLimitTelemetry()['demo-signup-ip'].rejected).toBe(1);
    expect(loggerCalls.warn).toHaveLength(1);
  });

  it('never puts a raw address, IP or store key into the counters or the logs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIdentityRateLimiter, getRateLimitTelemetry } = limiters;

    const email = 'ops-demo-002+telemetry@fixture.invalid';
    const ip = '203.0.113.201';
    for (let i = 0; i < 6; i += 1) {
      demoSignupIdentityRateLimiter(
        { method: 'POST', ip, headers: {}, body: { email } } as any,
        makeRes() as any,
        vi.fn()
      );
    }
    expect(getRateLimitTelemetry()['demo-signup-id'].rejected).toBe(3);

    const exposed = JSON.stringify({
      counters: getRateLimitTelemetry(),
      logs: loggerCalls.warn,
      errors: loggerCalls.error,
    });
    expect(loggerCalls.warn.length).toBeGreaterThan(0);
    for (const secret of [email, 'ops-demo-002', 'fixture.invalid', '@', ip, 'rl:demo-signup-id']) {
      expect(exposed).not.toContain(secret);
    }
    // The limiter name itself must survive — that is the whole point of the counter.
    expect(exposed).toContain('demo-signup-id');
  });

  it('summarises instead of emitting one log line per refused request', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIpRateLimiter, __private__ } = limiters;

    const req: any = { method: 'POST', ip: '198.51.100.26', headers: {}, body: {} };
    // 5 allowed, then 200 refusals in a burst.
    for (let i = 0; i < 205; i += 1) demoSignupIpRateLimiter(req, makeRes() as any, vi.fn());

    // One immediate line for the first refusal; the other 199 are counted, not logged.
    expect(loggerCalls.warn).toHaveLength(1);
    expect(loggerCalls.warn[0][1]).toEqual(
      expect.objectContaining({ limiter: 'demo-signup-ip', reason: 'rejected', events: 1 })
    );

    // Once the summary window elapses, the suppressed volume is reported in one line.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + __private__.REJECTION_LOG_INTERVAL_MS + 1_000);
    demoSignupIpRateLimiter(req, makeRes() as any, vi.fn());

    expect(loggerCalls.warn).toHaveLength(2);
    expect(loggerCalls.warn[1][1]).toEqual(
      expect.objectContaining({
        limiter: 'demo-signup-ip',
        reason: 'rejected',
        events: 200,
        distinctSources: 1,
        totalSinceReset: 201,
      })
    );
  });

  it('reports the number of distinct sources without identifying any of them', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters } = await loadFresh();
    const { demoSignupIdentityRateLimiter, __private__ } = limiters;

    // Three addresses, each pushed one request past its quota: a distributed shape.
    for (let round = 0; round < 4; round += 1) {
      for (let addr = 0; addr < 3; addr += 1) {
        demoSignupIdentityRateLimiter(
          {
            method: 'POST',
            ip: '203.0.113.77',
            headers: {},
            body: { email: `ops-demo-002+src-${addr}@fixture.invalid` },
          } as any,
          makeRes() as any,
          vi.fn()
        );
      }
    }

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + __private__.REJECTION_LOG_INTERVAL_MS + 1_000);
    demoSignupIdentityRateLimiter(
      {
        method: 'POST',
        ip: '203.0.113.77',
        headers: {},
        body: { email: 'ops-demo-002+src-0@fixture.invalid' },
      } as any,
      makeRes() as any,
      vi.fn()
    );

    const summary = loggerCalls.warn[loggerCalls.warn.length - 1][1] as Record<string, unknown>;
    expect(summary.distinctSources).toBe(3);
    expect(summary.distinctSourcesTruncated).toBe(false);
    expect(JSON.stringify(summary)).not.toContain('ops-demo-002');
  });

  it('feeds the shared counter that /api/health/aggregated already reports', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { limiters, metrics } = await loadFresh();
    const { demoSignupIpRateLimiter } = limiters;

    // `rate_limit_hits_total` / components.metrics.details.rateLimitHits existed
    // with zero callers before OPS-DEMO-002 — the aggregate was permanently 0.
    const before = metrics.getRequestMetrics().rateLimitHits;
    const req: any = { method: 'POST', ip: '198.51.100.27', headers: {}, body: {} };
    for (let i = 0; i < 8; i += 1) demoSignupIpRateLimiter(req, makeRes() as any, vi.fn());

    expect(metrics.getRequestMetrics().rateLimitHits).toBe(before + 3);
    expect(metrics.getPrometheusMetrics()).toContain(`rate_limit_hits_total ${before + 3}`);
  });
});
