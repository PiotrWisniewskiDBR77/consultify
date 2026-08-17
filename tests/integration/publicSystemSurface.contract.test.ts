/**
 * SEC-PUB-002 — the anonymous system surface must disclose nothing and cost little.
 *
 * `GET /api/system/health` was an unauthenticated, unrate-limited endpoint that ran
 * twelve SQL queries plus a `bcrypt.compare` per request and answered with the
 * literal strings `admin@dbr77.com` and `123456` — including a branch that said
 * `Default credentials working`. That is a credential oracle anyone could query,
 * plus an asymmetric CPU and database cost, on a route mounted ahead of the global
 * rate limiter.
 *
 * These cases run against the REAL app so the assertions cover the real mount
 * order and middleware chain.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const { bcryptSpy, childProcessSpy } = vi.hoisted(() => ({
  bcryptSpy: { compares: 0 },
  childProcessSpy: { calls: [] as string[] },
}));

vi.mock('bcryptjs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: {
      ...(actual.default ?? actual),
      compare: (...args: unknown[]) => {
        bcryptSpy.compares += 1;
        return (actual.default ?? actual).compare(...(args as [string, string]));
      },
    },
    compare: (...args: unknown[]) => {
      bcryptSpy.compares += 1;
      return (actual.default ?? actual).compare(...(args as [string, string]));
    },
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const wrap =
    (name: string, fn: any) =>
    (...args: unknown[]) => {
      childProcessSpy.calls.push(`${name}:${String(args[0])}`);
      return fn(...args);
    };
  return {
    ...actual,
    execSync: wrap('execSync', actual.execSync),
    exec: wrap('exec', actual.exec),
    spawn: wrap('spawn', actual.spawn),
  };
});

vi.hoisted(() => {
  const nodePath = require('path');
  const nodeFs = require('fs');
  const dbFile = nodePath.resolve(__dirname, 'public-system-surface.integration.db');
  try {
    nodeFs.rmSync(dbFile, { force: true });
  } catch {
    /* best effort */
  }
  process.env.SQLITE_PATH = dbFile;
  process.env.MOCK_DB = 'false';
});

import app, { databaseInitPromise } from '../../server/src/index';
import { dbProxy } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';

/** Everything the public surface must never emit. */
const FORBIDDEN_LITERALS = ['admin@dbr77.com', '123456', 'Default credentials'];

/** Resolved at runtime so the assertion cannot drift from the real values. */
const FORBIDDEN_PATHS = [__dirname, process.cwd()];

function assertNoDisclosure(body: unknown, label: string): void {
  const serialized = JSON.stringify(body ?? {});
  for (const literal of FORBIDDEN_LITERALS) {
    expect(serialized, `${label} must not contain ${literal}`).not.toContain(literal);
  }
  for (const p of FORBIDDEN_PATHS) {
    expect(serialized, `${label} must not contain a filesystem path`).not.toContain(p);
  }
  // An address anywhere in the payload, and stack-trace shapes.
  expect(serialized, `${label} must not contain an email address`).not.toMatch(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
  );
  expect(serialized, `${label} must not contain a stack trace`).not.toMatch(/\s+at\s+.+:\d+:\d+/);
}

describe('SEC-PUB-002 public system surface', () => {
  // Deliberately NO resetConnection()/initializeDatabase() here.
  //
  // Vitest runs files in parallel and this harness shares one external database,
  // so tearing the connection down and re-initialising the schema from this file
  // disrupts whatever else is mid-run — it made an unrelated case in
  // demoPublicEntry fail intermittently. These cases only need the app to answer;
  // they do not seed anything, so they can ride whatever connection the app has.
  beforeAll(async () => {
    await databaseInitPromise;
    await setDependencies({ db: dbProxy });
  }, 180_000);

  describe('GET /api/system/health — anonymous', () => {
    it('answers a minimal readiness body and nothing else', async () => {
      const res = await request(app).get('/api/system/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body.status === 'ready' || res.body.status === 'not-ready').toBe(true);

      // Exactly the two documented keys — a new key is how disclosure creeps back.
      expect(Object.keys(res.body).sort()).toEqual(['status', 'timestamp']);
      assertNoDisclosure(res.body, 'readiness');
    }, 180_000);

    it('discloses no credentials, addresses, table names or configuration', async () => {
      const res = await request(app).get('/api/system/health');
      const serialized = JSON.stringify(res.body);
      assertNoDisclosure(res.body, 'readiness');
      // Shapes the old body carried.
      expect(serialized).not.toContain('checks');
      expect(serialized).not.toContain('userCount');
      expect(serialized).not.toContain('adminCount');
      expect(serialized).not.toContain('NODE_ENV');
      expect(serialized).not.toMatch(/table/i);
    }, 180_000);

    it('runs no bcrypt and spawns no process, under 20 concurrent anonymous requests', async () => {
      bcryptSpy.compares = 0;
      childProcessSpy.calls = [];

      const responses = await Promise.all(
        Array.from({ length: 20 }, () => request(app).get('/api/system/health'))
      );

      // Every response is still a readiness answer — not an error page that
      // happened to skip the expensive work.
      for (const res of responses) {
        expect([200, 503, 429]).toContain(res.status);
        assertNoDisclosure(res.body, 'concurrent readiness');
      }
      expect(bcryptSpy.compares, 'no bcrypt on an anonymous endpoint').toBe(0);
      expect(childProcessSpy.calls, 'no child process on an anonymous endpoint').toEqual([]);
    }, 180_000);
  });

  describe('detailed diagnostics are not public', () => {
    it('the BASE /api/system-health route no longer serves diagnostics anonymously', async () => {
      // It was the only route on that router without verifySuperAdmin, and it
      // called the same getDetailedHealth() as the guarded /detailed — host
      // memory, load average, CPU count, database details, error rate, and which
      // AI providers hold credentials, to anyone who asked.
      const res = await request(app).get('/api/system-health');
      expect(res.status).not.toBe(200);

      const serialized = JSON.stringify(res.body ?? {});
      for (const leak of ['memory', 'loadavg', 'cpus', 'errorRate', 'providers', 'uptime']) {
        expect(serialized, `must not disclose ${leak}`).not.toContain(leak);
      }
      assertNoDisclosure(res.body, 'base system-health');
    }, 180_000);

    it('the superadmin surface refuses an anonymous caller', async () => {
      const res = await request(app).get('/api/system-health/detailed');
      expect([401, 403, 404]).toContain(res.status);
      assertNoDisclosure(res.body, 'superadmin detailed');
    }, 180_000);

    it('an ordinary authenticated user gets no detail either', async () => {
      const email = `sec-pub-002+user-${Date.now().toString(36)}@fixture.invalid`;
      const reg = await request(app).post('/api/auth/register').send({
        email,
        password: 'sec-pub-002-fixture-pass',
        firstName: 'Plain',
        lastName: 'User',
        companyName: `sec-pub-002 ${Date.now().toString(36)}`,
      });
      const token = reg.body?.token;
      expect(token).toBeTruthy();

      const res = await request(app)
        .get('/api/system-health/detailed')
        .set('Authorization', `Bearer ${token}`);
      expect([401, 403, 404]).toContain(res.status);
      assertNoDisclosure(res.body, 'detailed as plain user');
    }, 180_000);
  });

  describe('GET /test-frontend-path is gone', () => {
    it('is indistinguishable from a path that never existed', async () => {
      // Asserting a fixed status here would be brittle and misleading: the SPA
      // catch-all answers unknown non-API paths the same way whatever they are,
      // and that answer differs between environments. The property that matters is
      // that the removed route is no longer special.
      const removed = await request(app).get('/test-frontend-path');
      const neverExisted = await request(app).get('/definitely-not-a-route-sec-pub-002');

      expect(removed.status).toBe(neverExisted.status);
      expect(removed.headers['content-type']).toBe(neverExisted.headers['content-type']);
    }, 180_000);

    it('no longer serves the deployment layout it used to', async () => {
      const res = await request(app).get('/test-frontend-path');
      const serialized = `${JSON.stringify(res.body ?? {})}${res.text ?? ''}`;
      // Only markers the OLD HANDLER emitted and the SPA catch-all does not.
      // `__dirname`, `frontendDistPath` and friends appear in the catch-all's own
      // FRONTEND_NOT_FOUND body for every unknown path — see the case below — so
      // asserting those here would test that pre-existing leak, not this removal.
      expect(serialized).not.toContain('globalFrontendDistPath');
      expect(serialized).not.toContain('/app/dist');
      expect(serialized).not.toContain('hasIndex');
      expect(serialized).not.toContain('"exists"');
    }, 180_000);

  });

  describe('the public readiness route carries a limiter', () => {
    /**
     * The concurrency case above tolerates 429 but cannot PROVE throttling: under
     * NODE_ENV=test every limiter short-circuits to next() before counting. So
     * that case would pass just as happily with the middleware deleted.
     *
     * These two assert the thing that actually regresses — the middleware being
     * removed from the route, or reconfigured away — without depending on runtime
     * throttling in an environment that disables it.
     */
    it('the limiter middleware is mounted on GET /health, by identity', async () => {
      const [{ default: systemRouter }, limiters] = await Promise.all([
        import('../../server/src/routes/system-health.routes.js'),
        import('../../server/src/middleware/rateLimiting.middleware.js'),
      ]);

      const layers = (systemRouter as unknown as { stack: any[] }).stack;
      const healthLayer = layers.find((l) => l?.route?.path === '/health');
      expect(healthLayer, 'GET /health must still be routed').toBeTruthy();

      const handlers = healthLayer.route.stack.map((entry: any) => entry.handle);
      // Identity, not name: createLimiter returns an anonymous closure, so a name
      // check would pass against any anonymous middleware.
      expect(
        handlers.includes(limiters.defaultRateLimiter),
        'defaultRateLimiter must be in the chain for GET /api/system/health'
      ).toBe(true);
    }, 180_000);

    it('that limiter really throttles when it is not bypassed', async () => {
      // Loaded under production so the NODE_ENV=test short-circuit is not in play.
      // This proves the middleware identity above is a limiter that limits, rather
      // than an inert function that merely occupies the slot.
      vi.resetModules();
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const { defaultRateLimiter } = await import(
          '../../server/src/middleware/rateLimiting.middleware.js'
        );
        let refused = false;
        const res: any = {
          statusCode: 200,
          setHeader: () => {},
          status(code: number) {
            this.statusCode = code;
            if (code === 429) refused = true;
            return this;
          },
          json: () => res,
        };
        const req: any = { method: 'GET', ip: '203.0.113.250', headers: {}, body: {} };
        for (let i = 0; i < 400 && !refused; i += 1) {
          defaultRateLimiter(req, res, () => {});
        }
        expect(refused, 'defaultRateLimiter must refuse eventually').toBe(true);
      } finally {
        process.env.NODE_ENV = previous;
        vi.resetModules();
      }
    }, 180_000);
  });

  describe('/ping stays cheap', () => {
    it('returns pong without spawning a process', async () => {
      childProcessSpy.calls = [];
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
      expect(res.text).toContain('pong');
      expect(childProcessSpy.calls).toEqual([]);
    }, 180_000);
  });
});
