/**
 * SEC-PUB-002 — the build-diagnostic surface is gone.
 *
 * `GET /__build-info`, `GET /api/build-info`, `GET /__build-graph` and
 * `GET /api/build-graph` were unrate-limited and mounted ahead of helmet, CORS,
 * sanitisation, CSRF, the global limiter and audit logging.
 *
 * ACCESSIBILITY, precisely — measured, not assumed. The `/__*` pair was reachable
 * ANONYMOUSLY. The `/api/*` pair sat behind the auth catch-all at index.ts:222,
 * which is mounted before the handlers at ~1175, so it answered 401 without a
 * token. Calling all four "anonymous" would overstate it. All four were
 * nonetheless unnecessary, and all four disclosed once the handler was reached.
 *
 * They disclosed `frontendDistPath`, `indexPath`, `bundleFsPath`,
 * `bundlePublicPath`, `entryPublicPath` and `assetsPath` — the container's
 * directory layout — in a 200 body. And they were expensive: `build-info` did a
 * `readdirSync` of the assets directory plus a `readFileSync` of EVERY `.js`
 * chunk per request; `build-graph` did that and then walked the whole import
 * graph. Synchronously, before any authorization, on a route needing no
 * credential. That is a resource-exhaustion surface as much as a disclosure one.
 *
 * All four were deleted — an exhaustive consumer hunt found none, and git history
 * shows the one allowlisted caller was never written.
 *
 * These cases run against the REAL app, so they cover the real mount order.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const { fsSpy } = vi.hoisted(() => ({
  fsSpy: { calls: [] as string[] },
}));

/**
 * Counting wrapper over the synchronous filesystem calls the deleted handlers
 * made. Pass-through: the app still needs these to work for everything else, so
 * we count rather than stub.
 */
vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const wrap =
    (name: string, fn: any) =>
    (...args: unknown[]) => {
      fsSpy.calls.push(`${name}:${String(args[0])}`);
      return fn(...args);
    };
  const patched = {
    ...actual,
    readdirSync: wrap('readdirSync', actual.readdirSync),
    readFileSync: wrap('readFileSync', actual.readFileSync),
  };
  return { ...patched, default: patched };
});

vi.hoisted(() => {
  const nodePath = require('path');
  const nodeFs = require('fs');
  const dbFile = nodePath.resolve(__dirname, 'build-surface.integration.db');
  try {
    nodeFs.rmSync(dbFile, { force: true });
  } catch {
    /* best effort */
  }
  process.env.SQLITE_PATH = dbFile;
  process.env.MOCK_DB = 'false';
});

import app from '../../server/src/index';
import { dbProxy } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';

/** Every historical alias. All four must be closed. */
const BUILD_ROUTES = [
  '/__build-info',
  '/api/build-info',
  '/__build-graph',
  '/api/build-graph',
];

/** Response keys that named the deployment layout. */
const FORBIDDEN_KEYS = [
  'frontendDistPath',
  'indexPath',
  'bundleFsPath',
  'bundlePublicPath',
  'entryFsPath',
  'entryPublicPath',
  'assetsPath',
  'scannedAssetCount',
  'graphNodes',
  'missingImports',
];

/** Resolved at runtime so the assertion cannot drift from the real values. */
const FORBIDDEN_PATHS = [__dirname, process.cwd()];

function assertNoDisclosure(res: { body?: unknown; text?: string }, label: string): void {
  const serialized = `${JSON.stringify(res.body ?? {})}${res.text ?? ''}`;
  for (const key of FORBIDDEN_KEYS) {
    expect(serialized, `${label} must not contain ${key}`).not.toContain(key);
  }
  for (const p of FORBIDDEN_PATHS) {
    expect(serialized, `${label} must not contain a filesystem path`).not.toContain(p);
  }
  // A raw driver/fs error message carries the absolute path with it.
  expect(serialized, `${label} must not contain ENOENT/EACCES text`).not.toMatch(
    /ENOENT|EACCES|no such file or directory/i
  );
  expect(serialized, `${label} must not contain a stack trace`).not.toMatch(/\s+at\s+.+:\d+:\d+/);
}

describe('SEC-PUB-002 build diagnostics surface', () => {
  // No resetConnection()/initializeDatabase(): vitest runs files in parallel
  // against one shared database, and tearing it down here destabilises others.
  beforeAll(async () => {
    await setDependencies({ db: dbProxy });
  }, 180_000);

  describe('all four historical aliases are closed', () => {
    it.each(BUILD_ROUTES)('%s is not served', async (route) => {
      const res = await request(app).get(route);
      expect(res.status, `${route} must not answer 200`).not.toBe(200);
    }, 180_000);

    it.each(BUILD_ROUTES)('%s is indistinguishable from a route that never existed', async (route) => {
      // Asserting a fixed status would be brittle: unknown /api/* answers 401 here
      // while unknown non-API paths fall through to the SPA catch-all. The property
      // that matters is that these routes are no longer special.
      const removed = await request(app).get(route);
      const neverExisted = await request(app).get(
        route.startsWith('/api/')
          ? '/api/definitely-not-a-route-sec-pub-002'
          : '/__definitely-not-a-route-sec-pub-002'
      );
      expect(removed.status).toBe(neverExisted.status);
    }, 180_000);

    it.each(BUILD_ROUTES)('%s discloses no path, key or raw error', async (route) => {
      const res = await request(app).get(route);
      assertNoDisclosure(res, route);
    }, 180_000);
  });

  describe('an ordinary authenticated user gains nothing', () => {
    it('gets the same closed treatment as an anonymous caller', async () => {
      const stamp = Date.now().toString(36);
      const reg = await request(app).post('/api/auth/register').send({
        email: `sec-pub-002+build-${stamp}@fixture.invalid`,
        password: 'sec-pub-002-fixture-pass',
        firstName: 'Build',
        lastName: 'Surface',
        companyName: `sec-pub-002 build ${stamp}`,
      });
      const token = reg.body?.token;
      expect(token).toBeTruthy();

      for (const route of BUILD_ROUTES) {
        const anonymous = await request(app).get(route);
        const authenticated = await request(app)
          .get(route)
          .set('Authorization', `Bearer ${token}`);

        // The two codes legitimately differ on `/api/*`: an anonymous caller is
        // stopped by the auth catch-all (401), while a valid token passes it and
        // then falls through to 404. Both mean "not served", so asserting they
        // MATCH would be asserting an implementation detail. What must hold is
        // that a credential buys nothing.
        expect(anonymous.status, `${route} anonymous must be closed`).not.toBe(200);
        expect(authenticated.status, `${route} must not open up for a token`).not.toBe(200);
        assertNoDisclosure(authenticated, `${route} (authenticated)`);
      }
    }, 180_000);
  });

  describe('no request triggers a filesystem scan', () => {
    it('performs no readdirSync or readFileSync of the asset bundle', async () => {
      fsSpy.calls = [];

      for (const route of BUILD_ROUTES) {
        await request(app).get(route);
      }

      // The handlers scanned `<dist>/assets`. Anything reading that directory, or
      // reading a `.js` chunk, means the scan is back.
      const scanCalls = fsSpy.calls.filter(
        (call) => call.includes('/assets') || /readFileSync:.*\.js$/.test(call)
      );
      expect(scanCalls, `no asset scan may run: ${scanCalls.join(', ')}`).toEqual([]);
    }, 180_000);

    it('20 concurrent requests still trigger no scan', async () => {
      fsSpy.calls = [];

      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          request(app).get(BUILD_ROUTES[i % BUILD_ROUTES.length])
        )
      );

      const scanCalls = fsSpy.calls.filter(
        (call) => call.includes('/assets') || /readFileSync:.*\.js$/.test(call)
      );
      expect(scanCalls).toEqual([]);
    }, 180_000);
  });
});
