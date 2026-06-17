/**
 * M27 L-08 — P0-test: non-superadmin MUST receive 403 on global LLM write routes.
 *
 * Routes fixed in M27 L-03/L-04 (verifyAdmin → verifySuperAdmin):
 *   POST /llm/purposes/:purpose/assignments
 *   PUT  /llm/org/:organizationId/policy
 *   POST /llm/market/openrouter/sync
 *   PUT  /llm/market/inbox/:id
 *
 * Each route is tested twice:
 *   1. org-admin JWT (role ADMIN) → strict 403 (not 401 or 404)
 *   2. superadmin JWT (role SUPERADMIN) → NOT 403 (reaches handler, may 500 without real DB)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

// ---------------------------------------------------------------------------
// Hoist DbPromise mock — required before any module with DB calls is loaded
// ---------------------------------------------------------------------------
const { dbGet: mockDbGet, dbRun, dbAll } = vi.hoisted(() => ({
  dbGet: vi.fn(),
  dbRun: vi.fn().mockResolvedValue(undefined),
  dbAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  get: mockDbGet,
  run: dbRun,
  all: dbAll,
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: any) => next(),
}));

// ---------------------------------------------------------------------------
// Configure superAdmin middleware dependencies directly (bypasses JWT verify)
// ---------------------------------------------------------------------------
const JWT_SECRET = 'test-superadmin-gate-secret-32chars-ok';

async function loadApp(dbRole: 'ADMIN' | 'SUPERADMIN') {
  // Set deps on middleware so we control DB-role lookup without a real DB
  const { setDependencies } = await import(
    '../../server/src/middleware/superAdmin.middleware.js'
  );

  const fakeJwt = {
    verify: (_token: string, _secret: string, _opts: any, cb: any) => {
      cb(null, {
        id: 'test-user-1',
        sub: 'test-user-1',
        role: dbRole,
        organizationId: '',
      });
    },
  };

  setDependencies({
    jwt: fakeJwt as any,
    config: { JWT_SECRET },
    dbGet: vi.fn().mockResolvedValue({ role: dbRole }),
  });

  const router = (await import('../../server/src/routes/llm.routes.ts')).default;
  return makeTestApp({ mountPath: '/api/llm', router });
}

// ---------------------------------------------------------------------------
// Routes under test
// ---------------------------------------------------------------------------
const GUARDED_ROUTES = [
  { label: 'POST /purposes/:purpose/assignments', method: 'post', path: '/api/llm/purposes/general/assignments' },
  { label: 'PUT /org/:id/policy',                 method: 'put',  path: '/api/llm/org/org-123/policy' },
  { label: 'POST /market/openrouter/sync',         method: 'post', path: '/api/llm/market/openrouter/sync' },
  { label: 'PUT /market/inbox/:id',                method: 'put',  path: '/api/llm/market/inbox/inbox-1' },
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('M27 L-08 — llm global-write routes: non-superadmin → strict 403', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue(undefined);
    dbAll.mockResolvedValue([]);
  });

  for (const route of GUARDED_ROUTES) {
    describe(route.label, () => {
      it('returns exactly 403 (not 401/404) for an org-admin', async () => {
        const app = await loadApp('ADMIN');
        const res = await (request(app) as any)[route.method](route.path)
          .set('Authorization', 'Bearer some.token.here')
          .send({});

        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({
          code: 'INSUFFICIENT_PLATFORM_ROLE',
        });
      });

      it('does NOT return 403 for a superadmin (reaches handler)', async () => {
        const app = await loadApp('SUPERADMIN');
        const res = await (request(app) as any)[route.method](route.path)
          .set('Authorization', 'Bearer some.token.here')
          .send({});

        expect(res.status).not.toBe(403);
      });
    });
  }
});
