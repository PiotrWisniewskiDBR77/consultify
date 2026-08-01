/**
 * OPS-DEMO-002 (P1) — `POST /api/auth/demo-login` must be unreachable in production.
 *
 * The gateway used to open on a DISJUNCTION:
 *   NODE_ENV === 'test' || E2E_MODE === 'true' || ENABLE_TEST_GATEWAY === 'true'
 * so a single stray Railway variable re-opened an anonymous auth endpoint that
 * also AUTO-PROVISIONS an ADMIN-shaped demo account. This file pins the
 * conjunction that replaced it, from both directions:
 *
 *   1. the exported predicate `isDemoLoginGatewayOpen` over the full flag matrix
 *      (cheap, and it is the actual code both call sites run — not a re-statement
 *      of the rule);
 *   2. the real Express route, mounted bare, asserting the 410 +
 *      DEMO_LOGIN_DEPRECATED contract AND that the auto-provisioning branch
 *      writes nothing in any closed combination.
 *
 * Env is read at REQUEST time by the predicate (there is no module-load-time
 * capture of NODE_ENV / E2E_MODE / ENABLE_TEST_GATEWAY / TEST_SUPPORT_KEY in
 * auth.routes.ts), so `vi.stubEnv` alone is sufficient — no `vi.resetModules()`
 * dance and no re-import per case.
 *
 * ---------------------------------------------------------------------------
 * WHY 410 AND NOT 404 — and where a 404 sighting actually comes from
 * ---------------------------------------------------------------------------
 * 410 is the committed contract, not a preference:
 *   docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/OPS-DEMO-002_DEMO_ENTRY_AUTH.md:98
 *   "Anonimowe `/demo-login` pozostaje `410` poza test gateway i nie jest przywracane."
 * It is a deliberate deprecation signal with a machine-readable successor list
 * (`alternatives`), which `src/services/api.ts` (`Api.demoLogin`, ~line 1424) and
 * the Playwright specs still call. 404 would tell an existing caller "wrong URL"
 * instead of "this is gone, go here" — so the route deliberately does NOT hide.
 *
 * Three DIFFERENT things answer non-410 on this path. None of them is the route
 * being wrong; all three were measured, and the ones this file can reach cheaply
 * are pinned below so the distinction stops being accidental:
 *
 *  1. THE ROUTER WAS NEVER MOUNTED (404 `API_ROUTE_NOT_FOUND`).
 *     `server/src/index.ts:1118` — `if (isTest && ENABLE_TEST_GATEWAY !== 'true')`
 *     skips `apiGateway.initializeRoutes(app)` entirely, and the gateway is what
 *     mounts `/api/auth` (`server/src/Gateway.ts:433`). That branch is decided at
 *     MODULE LOAD of index.ts, not per request, and `isTest`
 *     (`server/src/index.ts:64`) is `NODE_ENV === 'test' || !!process.env.VITEST`
 *     — so it is true under EVERY vitest invocation. Any runner config that does
 *     not set `ENABLE_TEST_GATEWAY: 'true'` in `test.env` (vitest.config.ts does;
 *     vitest.security.config.ts and vitest.acceptance.config.ts do not) therefore
 *     imports a full app with NO auth API at all. Measured in that state:
 *     `/api/auth/demo-login`, `/api/auth/login`, `/api/auth/register-demo` and
 *     `/api/auth/logout` ALL answer 404 `API_ROUTE_NOT_FOUND`. That is the tell:
 *     a 404 that is not specific to demo-login is a mount failure, not a contract.
 *     It cannot happen in production, where `isTest` is false and the gateway
 *     always mounts. (Below ~that threshold the readiness gate at
 *     `server/src/index.ts:210` answers 503 `SERVER_STARTING` first, because the
 *     same missing flag also skips DB init — so the 404 only surfaces once
 *     `E2E_MODE=true` turns init back on.)
 *
 *  2. THE WRONG HTTP VERB (404, no route for that method). `router.post` binds
 *     POST only; GET/PUT/PATCH/DELETE fall through — to bare Express's 404 here,
 *     and, measured, to 404 `API_ROUTE_NOT_FOUND` in the full app too, because
 *     `resolveAllowedApiMethods` (`server/src/index.ts:1780`) produced no Allow
 *     list for this path and so never reached its 405 branch. This one IS
 *     production-reachable and is the likeliest way to see "410 expected, 404
 *     actual" from a hand-run probe. Pinned below as a class (404/405), not as an
 *     exact number, so tightening it to a true 405 stays a free improvement.
 *
 *  3. A BODY THE PARSER REFUSES (400, from `express.json()`, before the handler).
 *     Also pinned below — the point being that it fails loudly rather than
 *     sliding into the handler with a half-parsed body.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The demo-login handler reaches the database only AFTER the gateway check, and
// the auto-provision branch is pure `dbRun` INSERTs. Mocking the DB module turns
// "did auto-provisioning run?" into a directly observable fact instead of an
// inference from the response body.
const dbGetMock = vi.fn();
const dbRunMock = vi.fn();
const dbAllMock = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => dbGetMock(...args),
  run: (...args: unknown[]) => dbRunMock(...args),
  all: (...args: unknown[]) => dbAllMock(...args),
  exec: vi.fn(),
  default: {
    get: (...args: unknown[]) => dbGetMock(...args),
    run: (...args: unknown[]) => dbRunMock(...args),
    all: (...args: unknown[]) => dbAllMock(...args),
  },
}));

const authRoutes = (await import('../../../../server/src/routes/auth.routes.js')).default;
const { isDemoLoginGatewayOpen } = await import(
  '../../../../server/src/routes/auth.routes.js'
);

const VALID_KEY = 'local-test-support-key-change-me'; // what playwright.config.ts injects
const SHORT_KEY = 'abcdefghijk'; // 11 chars — one below the mirrored minimum

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

/**
 * Every environment shape that must keep the gateway CLOSED, plus the single one
 * that may open it. `NODE_ENV: undefined` models the variable being absent.
 */
const CLOSED_COMBINATIONS: Array<{
  label: string;
  env: Record<string, string | undefined>;
}> = [
  {
    label: 'NODE_ENV=production with E2E_MODE=true',
    env: { NODE_ENV: 'production', E2E_MODE: 'true', TEST_SUPPORT_KEY: VALID_KEY },
  },
  {
    label: 'NODE_ENV=production with ENABLE_TEST_GATEWAY=true',
    env: { NODE_ENV: 'production', ENABLE_TEST_GATEWAY: 'true', TEST_SUPPORT_KEY: VALID_KEY },
  },
  {
    label: 'NODE_ENV=production with both flags and a valid key',
    env: {
      NODE_ENV: 'production',
      E2E_MODE: 'true',
      ENABLE_TEST_GATEWAY: 'true',
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
  {
    label: 'NODE_ENV=staging with every flag set',
    env: {
      NODE_ENV: 'staging',
      E2E_MODE: 'true',
      ENABLE_TEST_GATEWAY: 'true',
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
  {
    label: 'NODE_ENV unset with every flag set',
    env: {
      NODE_ENV: undefined,
      E2E_MODE: 'true',
      ENABLE_TEST_GATEWAY: 'true',
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
  {
    label: 'NODE_ENV=test but no enable flag',
    env: {
      NODE_ENV: 'test',
      E2E_MODE: undefined,
      ENABLE_TEST_GATEWAY: undefined,
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
  {
    label: 'NODE_ENV=test with a flag but no test-support key',
    env: { NODE_ENV: 'test', ENABLE_TEST_GATEWAY: 'true', TEST_SUPPORT_KEY: undefined },
  },
  {
    label: 'NODE_ENV=test with a flag but an empty test-support key',
    env: { NODE_ENV: 'test', ENABLE_TEST_GATEWAY: 'true', TEST_SUPPORT_KEY: '' },
  },
  {
    label: 'NODE_ENV=test with a flag but a too-short test-support key',
    env: { NODE_ENV: 'test', ENABLE_TEST_GATEWAY: 'true', TEST_SUPPORT_KEY: SHORT_KEY },
  },
  // Adjacent near-misses: the flags are string comparisons, not truthiness.
  {
    label: 'NODE_ENV=test with ENABLE_TEST_GATEWAY=1 (not the literal "true")',
    env: { NODE_ENV: 'test', ENABLE_TEST_GATEWAY: '1', TEST_SUPPORT_KEY: VALID_KEY },
  },
  {
    label: 'NODE_ENV=Production (mixed case) with everything set',
    env: {
      NODE_ENV: 'Production',
      E2E_MODE: 'true',
      ENABLE_TEST_GATEWAY: 'true',
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
];

const OPEN_COMBINATIONS: Array<{ label: string; env: Record<string, string | undefined> }> = [
  {
    label: 'NODE_ENV=test + ENABLE_TEST_GATEWAY=true + valid key',
    env: {
      NODE_ENV: 'test',
      ENABLE_TEST_GATEWAY: 'true',
      E2E_MODE: undefined,
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
  {
    label: 'NODE_ENV=test + E2E_MODE=true + valid key',
    env: {
      NODE_ENV: 'test',
      ENABLE_TEST_GATEWAY: undefined,
      E2E_MODE: 'true',
      TEST_SUPPORT_KEY: VALID_KEY,
    },
  },
  {
    label: 'NODE_ENV=test + flag + a key of exactly the minimum length',
    env: {
      NODE_ENV: 'test',
      ENABLE_TEST_GATEWAY: 'true',
      E2E_MODE: undefined,
      TEST_SUPPORT_KEY: '123456789012', // exactly 12
    },
  },
];

/** Apply a combination onto process.env for the duration of one test. */
function stub(env: Record<string, string | undefined>) {
  // Start from a known-blank slate so a value left over from vitest.config.ts
  // (which sets NODE_ENV=test and ENABLE_TEST_GATEWAY=true globally) cannot make
  // a "closed" case pass for the wrong reason.
  for (const key of ['NODE_ENV', 'E2E_MODE', 'ENABLE_TEST_GATEWAY', 'TEST_SUPPORT_KEY']) {
    vi.stubEnv(key, undefined as unknown as string);
  }
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value as unknown as string);
  }
}

describe('OPS-DEMO-002 — demo-login gateway predicate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    dbGetMock.mockReset();
    dbRunMock.mockReset();
    dbAllMock.mockReset();
  });

  describe('isDemoLoginGatewayOpen (pure predicate, explicit env)', () => {
    for (const { label, env } of CLOSED_COMBINATIONS) {
      it(`is CLOSED — ${label}`, () => {
        expect(isDemoLoginGatewayOpen(env as NodeJS.ProcessEnv)).toBe(false);
      });
    }

    for (const { label, env } of OPEN_COMBINATIONS) {
      it(`is OPEN — ${label}`, () => {
        expect(isDemoLoginGatewayOpen(env as NodeJS.ProcessEnv)).toBe(true);
      });
    }

    it('reads process.env by default, at call time', () => {
      stub({ NODE_ENV: 'production', ENABLE_TEST_GATEWAY: 'true', TEST_SUPPORT_KEY: VALID_KEY });
      expect(isDemoLoginGatewayOpen()).toBe(false);
      // Same module instance, no re-import: flipping the anchor flips the answer.
      vi.stubEnv('NODE_ENV', 'test');
      expect(isDemoLoginGatewayOpen()).toBe(true);
    });
  });

  describe('POST /api/auth/demo-login (real route)', () => {
    let app: express.Express;

    beforeEach(() => {
      app = makeApp();
      // If the gateway ever opened, the seeded demo user lookup misses and the
      // handler falls into the auto-provisioning branch — which is exactly the
      // branch these closed cases must prove unreachable.
      dbGetMock.mockResolvedValue(null);
      dbRunMock.mockResolvedValue(undefined);
    });

    for (const { label, env } of CLOSED_COMBINATIONS) {
      it(`answers 410 DEMO_LOGIN_DEPRECATED — ${label}`, async () => {
        stub(env);

        const res = await request(app).post('/api/auth/demo-login').send({});

        expect(res.status).toBe(410);
        expect(res.body.code).toBe('DEMO_LOGIN_DEPRECATED');
        expect(res.body.alternatives).toEqual([
          '/api/auth/register-demo',
          '/api/auth/login + /api/demo/toggle',
        ]);
        // No session, no token, nothing that could be mistaken for a login.
        expect(res.body.token).toBeUndefined();
        expect(res.headers['set-cookie']).toBeUndefined();

        // The auto-provisioning branch cannot have run: it is pure INSERTs, and
        // the handler never reached a single query.
        expect(dbRunMock).not.toHaveBeenCalled();
        expect(dbGetMock).not.toHaveBeenCalled();
      });
    }

    it('reaches the auto-provisioning branch ONLY in the open combination', async () => {
      stub(OPEN_COMBINATIONS[0].env);

      const res = await request(app).post('/api/auth/demo-login').send({});

      expect(res.status).not.toBe(410);
      // It looked the seeded user up and, finding none, tried to insert one.
      expect(dbGetMock).toHaveBeenCalled();
      const insertedTables = dbRunMock.mock.calls.map((call) => String(call[0]));
      expect(insertedTables.some((sql) => /INSERT INTO organizations/i.test(sql))).toBe(true);
      expect(insertedTables.some((sql) => /INSERT INTO users/i.test(sql))).toBe(true);
    });
  });

  /**
   * Reasons 2 and 3 from the header note. A reviewer who probes this endpoint by
   * hand — or a smoke check that forgets the verb — gets a 404, and without these
   * cases nothing in the suite says whether that 404 is a defect or the shape of
   * the endpoint. Pin it, so the next person reads an answer instead of guessing.
   */
  describe('what is NOT the 410 contract (so a 404/400 sighting is explained)', () => {
    let app: express.Express;

    beforeEach(() => {
      app = makeApp();
      dbGetMock.mockResolvedValue(null);
      dbRunMock.mockResolvedValue(undefined);
      // Closed gateway: a production-shaped box. Any opening here would be the bug.
      stub({ NODE_ENV: 'production', ENABLE_TEST_GATEWAY: 'true', TEST_SUPPORT_KEY: VALID_KEY });
    });

    it('POST is the only verb the deprecation notice answers', async () => {
      const post = await request(app).post('/api/auth/demo-login').send({});
      expect(post.status).toBe(410);
      expect(post.body.code).toBe('DEMO_LOGIN_DEPRECATED');
    });

    for (const method of ['get', 'put', 'patch', 'delete'] as const) {
      it(`${method.toUpperCase()} is a route-level miss, never the 410 and never a session`, async () => {
        const res = await request(app)[method]('/api/auth/demo-login');

        // A class, not an exact number: `router.post` binds POST only, so today
        // this is bare Express's 404 (and 404 in the full app too — see header
        // note 2). Asserting 404-or-405 documents "the resource does not answer
        // this verb" without freezing a status that ought to become a true 405.
        expect([404, 405]).toContain(res.status);
        expect(res.status).not.toBe(410);

        // The part that actually matters: a wrong verb is not a side door.
        expect(res.body?.token).toBeUndefined();
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(dbRunMock).not.toHaveBeenCalled();
        expect(dbGetMock).not.toHaveBeenCalled();
      });
    }

    it('a body the parser rejects fails at 400 — it never reaches the handler', async () => {
      const res = await request(app)
        .post('/api/auth/demo-login')
        .set('Content-Type', 'application/json')
        .send('{not json');

      expect(res.status).toBe(400);
      expect(res.status).not.toBe(410); // the parser answered, not the route
      expect(res.body?.token).toBeUndefined();
      expect(dbRunMock).not.toHaveBeenCalled();
      expect(dbGetMock).not.toHaveBeenCalled();
    });

    /**
     * The gateway check runs before anything touches `req.body`, so the 410 must
     * not depend on the caller sending well-formed JSON. If any of these ever
     * diverged it would mean the handler started reading the body first.
     */
    const BENIGN_SHAPES: Array<[string, () => request.Test]> = [
      ['no body and no content-type', () => request(app).post('/api/auth/demo-login')],
      [
        'text/plain body',
        () =>
          request(app)
            .post('/api/auth/demo-login')
            .set('Content-Type', 'text/plain')
            .send('hello'),
      ],
      [
        'form-urlencoded body',
        () =>
          request(app)
            .post('/api/auth/demo-login')
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send('a=b'),
      ],
    ];

    it.each(BENIGN_SHAPES)('still answers 410 with %s', async (_label, send) => {
      const res = await send();
      expect(res.status).toBe(410);
      expect(res.body.code).toBe('DEMO_LOGIN_DEPRECATED');
      expect(dbRunMock).not.toHaveBeenCalled();
      expect(dbGetMock).not.toHaveBeenCalled();
    });
  });
});
