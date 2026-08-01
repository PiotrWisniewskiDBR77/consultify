/**
 * SEC-PUB-002 (follow-up) — the SPA catch-all must not disclose the deployment layout.
 *
 * `serveIndexHtml` in `server/src/index.ts` answers EVERY unknown non-API path for
 * anonymous callers. Its two failure branches used to return the deployment layout
 * in the response body:
 *
 *   - missing index.html  → `path`, `__dirname`, `frontendDistPath`, `resolvedPath`
 *   - res.sendFile error  → `error: err.message`, `path: indexPath`
 *
 * so `curl https://host/anything` printed the container's filesystem layout. Both
 * branches must now answer one constant, minimal body, with the detail logged
 * server-side instead.
 *
 * These cases run against the REAL app so they cover the real mount order,
 * the real static middleware and the real API-route exclusions.
 */
import path from 'path';
import request from 'supertest';
import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import fs from 'fs';

import app from '../../server/src/index';
import { dbProxy } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';

/** The only body either failure branch may return. Asserted whole, not key-by-key. */
const EXPECTED_BODY = {
  error: {
    code: 'FRONTEND_NOT_FOUND',
    message: 'Frontend unavailable',
  },
};

/**
 * Resolved at runtime, never hardcoded, so the assertion cannot drift away from
 * the values the server would actually emit. `__dirname` here is tests/integration;
 * the repo root is its grandparent and is a prefix of every path the old body
 * carried (`frontendDistPath`, `indexPath`, `resolvedPath`, the server `__dirname`).
 */
const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVER_SRC_DIR = path.resolve(REPO_ROOT, 'server/src');
const FRONTEND_DIST_DEV = path.resolve(SERVER_SRC_DIR, '../../dist');
const FORBIDDEN_PATHS = [
  __dirname,
  process.cwd(),
  REPO_ROOT,
  SERVER_SRC_DIR,
  FRONTEND_DIST_DEV,
  path.resolve(FRONTEND_DIST_DEV, 'index.html'),
  '/app/dist', // the production frontendDistPath branch
];

/** Every unknown non-API path the catch-all owns that we exercise. */
const CATCH_ALL_PATHS = [
  '/some-unknown-page',
  // Deleted in an earlier commit; it now falls through to this same catch-all,
  // which is exactly why the catch-all's own body matters.
  '/test-frontend-path',
];

function serialize(res: request.Response): string {
  return `${JSON.stringify(res.body ?? {})}${res.text ?? ''}`;
}

function assertNoLayoutDisclosure(res: request.Response, label: string): void {
  const serialized = serialize(res);

  for (const p of FORBIDDEN_PATHS) {
    expect(serialized, `${label} must not contain the path ${p}`).not.toContain(p);
  }
  for (const key of [
    '__dirname',
    'frontendDistPath',
    'resolvedPath',
    'indexPath',
    'FRONTEND_DIST_PATH',
  ]) {
    expect(serialized, `${label} must not mention ${key}`).not.toContain(key);
  }
  // No absolute filesystem path of any shape, e.g. "/Users/…", "/app/dist/index.html".
  expect(serialized, `${label} must not contain an absolute filesystem path`).not.toMatch(
    /(^|["\s:])\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+/
  );
  // No stack trace and no bare error message smuggled in.
  expect(serialized, `${label} must not contain a stack trace`).not.toMatch(/\s+at\s+.+:\d+:\d+/);
  expect(serialized, `${label} must not carry ENOENT-style error detail`).not.toMatch(
    /ENOENT|EACCES|errno/
  );
}

describe('SEC-PUB-002 SPA catch-all does not disclose the deployment layout', () => {
  // Deliberately NO resetConnection()/initializeDatabase(), following
  // publicSystemSurface.contract.test.ts: vitest runs files in parallel against one
  // shared database, and tearing the connection down from here destabilises other
  // files. These cases seed nothing — they only need the app to answer.
  beforeAll(async () => {
    await setDependencies({ db: dbProxy });
  }, 180_000);

  afterEach(() => {
    delete (app as unknown as { response: Record<string, unknown> }).response.sendFile;
  });

  describe('branch A — index.html missing on disk', () => {
    // This is the branch that fires naturally in this harness: no frontend bundle
    // is built for the test run, so fs.existsSync(indexPath) is false for real.
    // (Verified below rather than assumed.)
    it('the harness really is on the missing-index branch', () => {
      const indexPath = path.resolve(FRONTEND_DIST_DEV, 'index.html');
      expect(
        fs.existsSync(indexPath),
        'if a frontend bundle appears at ' +
          indexPath +
          ', this branch stops being exercised naturally and these cases need an fs stub'
      ).toBe(false);
    });

    for (const target of CATCH_ALL_PATHS) {
      it(`GET ${target} returns exactly the constant minimal body`, async () => {
        const res = await request(app).get(target);

        expect(res.status).toBe(500);
        expect(res.body).toEqual(EXPECTED_BODY);
        // Whole-object equality above already forbids extra keys; this pins the
        // shape of the nested object too, so a sibling key cannot creep back in.
        expect(Object.keys(res.body)).toEqual(['error']);
        expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message']);
        assertNoLayoutDisclosure(res, `missing-index ${target}`);
      }, 180_000);
    }

    it('answers identically for a removed route and a route that never existed', async () => {
      const removed = await request(app).get('/test-frontend-path');
      const neverExisted = await request(app).get('/definitely-not-a-route-sec-pub-002-spa');

      expect(removed.status).toBe(neverExisted.status);
      expect(removed.body).toEqual(neverExisted.body);
      expect(removed.body).toEqual(EXPECTED_BODY);
    }, 180_000);

    it('discloses nothing for a deep unknown path either', async () => {
      const res = await request(app).get('/workspace/42/settings/unknown-tab');
      expect(res.status).toBe(500);
      expect(res.body).toEqual(EXPECTED_BODY);
      assertNoLayoutDisclosure(res, 'deep unknown path');
    }, 180_000);
  });

  describe('branch B — res.sendFile fails', () => {
    /**
     * Reaching this branch needs two things the harness does not have naturally:
     * index.html present, and sendFile failing. Both are stubbed at the app's own
     * response prototype (`app.response`, from which every res for THIS app is
     * created), so the stub is scoped to this app instance and this test, and the
     * real handler code — including the `!res.headersSent` guard — runs unchanged.
     */
    function stubFailingSendFile(err: Error): { calls: string[] } {
      const calls: string[] = [];
      (app as unknown as { response: Record<string, unknown> }).response.sendFile = function (
        this: unknown,
        filePath: string,
        cb?: (e: Error | null) => void
      ) {
        calls.push(filePath);
        cb?.(err);
      };
      return { calls };
    }

    function stubExistingIndex(): () => void {
      const realExistsSync = fs.existsSync;
      // Narrowly scoped: only index.html answers true, everything else (the rest of
      // the app is still running) keeps the real implementation.
      (fs as unknown as { existsSync: unknown }).existsSync = ((p: fs.PathLike, ...rest: []) =>
        String(p).endsWith(`${path.sep}index.html`)
          ? true
          : (realExistsSync as (...a: unknown[]) => boolean)(p, ...rest)) as typeof fs.existsSync;
      return () => {
        (fs as unknown as { existsSync: unknown }).existsSync = realExistsSync;
      };
    }

    for (const target of CATCH_ALL_PATHS) {
      it(`GET ${target} returns the same constant body when sendFile errors`, async () => {
        const restoreFs = stubExistingIndex();
        const secret = 'ENOENT: no such file or directory, stat /srv/leaky-path/dist/index.html';
        const spy = stubFailingSendFile(new Error(secret));
        try {
          const res = await request(app).get(target);

          expect(spy.calls.length, 'the sendFile branch was actually reached').toBe(1);
          expect(res.status).toBe(500);
          expect(res.body).toEqual(EXPECTED_BODY);
          expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message']);
          // The old body carried err.message verbatim under `error`.
          expect(serialize(res)).not.toContain('leaky-path');
          expect(serialize(res)).not.toContain(secret);
          assertNoLayoutDisclosure(res, `sendFile-error ${target}`);
        } finally {
          restoreFs();
        }
      }, 180_000);
    }

    it('does not use a distinguishable code for the sendFile failure', async () => {
      const restoreFs = stubExistingIndex();
      stubFailingSendFile(new Error('boom'));
      try {
        const res = await request(app).get('/some-unknown-page');
        // The old branch answered SERVE_ERROR / "Failed to serve frontend", which
        // told a caller which of the two failure modes the server was in.
        expect(serialize(res)).not.toContain('SERVE_ERROR');
        expect(serialize(res)).not.toContain('Failed to serve frontend');
        expect(res.body).toEqual(EXPECTED_BODY);
      } finally {
        restoreFs();
      }
    }, 180_000);
  });

  describe('unchanged behaviour', () => {
    it('still excludes API routes from the catch-all', async () => {
      const res = await request(app).get('/api/definitely-not-a-route-sec-pub-002-spa');
      // The API 404 handler answers, not the SPA catch-all.
      expect(res.status).toBe(404);
      expect(res.body).not.toEqual(EXPECTED_BODY);
    }, 180_000);

    it('still sets the no-store cache headers before attempting to serve', async () => {
      const restoreFs = stubExistingIndexForHeaders();
      const calls: string[] = [];
      (app as unknown as { response: Record<string, unknown> }).response.sendFile = function (
        filePath: string,
        cb?: (e: Error | null) => void
      ) {
        calls.push(filePath);
        cb?.(new Error('stop here'));
      };
      try {
        const res = await request(app).get('/some-unknown-page');
        expect(calls.length).toBe(1);
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['x-consultify-cache-guard']).toBe('staging-cache-kill-v3');
      } finally {
        restoreFs();
      }
    }, 180_000);

    function stubExistingIndexForHeaders(): () => void {
      const realExistsSync = fs.existsSync;
      (fs as unknown as { existsSync: unknown }).existsSync = ((p: fs.PathLike, ...rest: []) =>
        String(p).endsWith(`${path.sep}index.html`)
          ? true
          : (realExistsSync as (...a: unknown[]) => boolean)(p, ...rest)) as typeof fs.existsSync;
      return () => {
        (fs as unknown as { existsSync: unknown }).existsSync = realExistsSync;
      };
    }
  });
});
