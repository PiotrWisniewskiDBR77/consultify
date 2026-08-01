/**
 * OPS-DEMO-002 — where the rate-limit telemetry is allowed to be read.
 *
 * The existing health surface is a mix: `/api/health/database`, `/connections`
 * and `/api/health/aggregated` are UNAUTHENTICATED, `/data-context` sits behind
 * `verifyToken`. Per-limiter counters plus the active store and fail mode are a
 * different class of information — together they tell an anonymous reader how
 * much headroom a flood has and whether the brake is on at all. So they go
 * behind the strongest guard already in the codebase, and the public aggregate
 * keeps only the single unlabelled counter it already had.
 *
 * `verifyToken` is stubbed (it needs a database and a real JWT); the REAL
 * `requireSuperAdmin` is kept via importOriginal, so the guard under test is the
 * shipped one rather than a re-implementation.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    verifyToken: (req: any, res: any, next: any) => {
      if (!authState.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      req.user = authState.user;
      next();
    },
  };
});

vi.mock('../../../../server/src/utils/Logger.js', () => {
  const stub = { warn: () => {}, error: () => {}, info: () => {}, http: () => {}, debug: () => {} };
  return { default: stub, logger: stub };
});

async function makeApp() {
  const routes = await import('../../../../server/src/routes/health.routes.js');
  const app = express();
  app.use('/api/health', routes.default);
  return app;
}

beforeEach(() => {
  authState.user = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health/rate-limit (protected telemetry surface)', () => {
  it('rejects an anonymous caller', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/health/rate-limit');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('demo-signup');
  });

  it('rejects an authenticated non-superadmin', async () => {
    authState.user = { id: 'u1', email: 'consultant@example.test', isSuperAdmin: false };
    const app = await makeApp();
    const res = await request(app).get('/api/health/rate-limit');
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('activeStore');
  });

  it('serves per-limiter counters, the active store and the fail mode to a superadmin', async () => {
    authState.user = { id: 'root', email: 'root@example.test', isSuperAdmin: true };
    const app = await makeApp();

    const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.js');
    mod.__private__.resetRateLimitTelemetry();

    const res = await request(app).get('/api/health/rate-limit');

    expect(res.status).toBe(200);
    expect(res.body.limiter).toEqual(
      expect.objectContaining({
        activeStore: expect.any(String),
        failMode: expect.any(String),
        bypassed: expect.any(Boolean),
        probe: expect.objectContaining({ ok: expect.any(Boolean), detail: expect.any(String) }),
      })
    );
    expect(res.body.posture).toEqual(
      expect.objectContaining({ effective: 'single-replica', errors: [], warnings: [] })
    );
    expect(res.body).toHaveProperty('counters');
  });

  it('never leaks a rate limit key, address or IP', async () => {
    authState.user = { id: 'root', email: 'root@example.test', isSuperAdmin: true };
    vi.stubEnv('NODE_ENV', 'production');
    const app = await makeApp();

    const mod = await import('../../../../server/src/middleware/rateLimiting.middleware.js');
    mod.__private__.resetRateLimitTelemetry();

    // Push a real refusal through the identity limiter so the counters are
    // populated by traffic that carried an address.
    const req: any = {
      method: 'POST',
      ip: '198.51.100.77',
      headers: {},
      body: { email: 'Victim@Example.Test' },
    };
    const noopRes: any = {
      statusCode: 0,
      setHeader() {},
      status(code: number) {
        noopRes.statusCode = code;
        return noopRes;
      },
      json() {
        return noopRes;
      },
    };
    // The limiter's ceiling is baked in at import time from NODE_ENV, which was
    // 'test' when this file loaded, so the non-prod ceiling (500) applies here.
    for (let i = 0; i < 502; i += 1) mod.demoSignupIdentityRateLimiter(req, noopRes, () => {});
    expect(noopRes.statusCode).toBe(429);

    const res = await request(app).get('/api/health/rate-limit');
    const body = JSON.stringify(res.body);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.counters)).toContain('demo-signup-id');
    expect(body.toLowerCase()).not.toContain('victim@example.test');
    expect(body).not.toContain('198.51.100.77');
    expect(body).not.toContain('rl:');
  });
});

describe('GET /api/health/ready/rate-limit (unauthenticated readiness)', () => {
  it('is reachable without a token and answers ready when the limiter counts', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = await makeApp();

    const res = await request(app).get('/api/health/ready/rate-limit');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('answers 503 when the limiter is not enforcing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DISABLE_RATE_LIMIT', 'true');
    vi.stubEnv('RATE_LIMIT_ALLOW_PROD_DISABLE', 'true');
    const app = await makeApp();

    const res = await request(app).get('/api/health/ready/rate-limit');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('RATE_LIMIT_NOT_READY');
  });

  it('is not swallowed by the /ready route that index.ts mounts on an earlier router', async () => {
    // index.ts does `app.use('/api/health', healthRoutes)` BEFORE
    // `app.use('/api/health', dbHealthRoutes)`, and healthRoutes registers
    // `/ready`. If that matched as a prefix, the new probe would never run.
    vi.stubEnv('NODE_ENV', 'production');
    const routes = await import('../../../../server/src/routes/health.routes.js');
    const earlier = express.Router();
    earlier.get('/ready', (_req, res) => {
      res.status(200).json({ status: 'ready', from: 'earlier-router' });
    });

    const app = express();
    app.use('/api/health', earlier);
    app.use('/api/health', routes.default);

    const res = await request(app).get('/api/health/ready/rate-limit');

    expect(res.body.from).toBeUndefined();
    expect(Object.keys(res.body)).toContain('status');
    // And the earlier router still owns the bare /ready path.
    const bare = await request(app).get('/api/health/ready');
    expect(bare.body.from).toBe('earlier-router');
  });

  it('discloses NOTHING about the store, fail mode or counters to an anonymous caller', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RATE_LIMIT_SHARED_STORE', 'local');
    const app = await makeApp();

    const res = await request(app).get('/api/health/ready/rate-limit');
    const body = JSON.stringify(res.body);

    expect(Object.keys(res.body).sort()).toEqual(['status', 'timestamp']);
    expect(body).not.toContain('local');
    expect(body).not.toContain('closed');
    expect(body).not.toContain('demo-signup');
  });
});
