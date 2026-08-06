/**
 * Cross-tenant guard on the LLM `/org/:organizationId/*` read routes.
 *
 * Audit finding: `GET /org/:organizationId/policy` and `/policy/history` were
 * guarded by `verifyToken` alone, so any authenticated user could read another
 * organization's AI governance policy by editing the URL, and
 * `/org/:organizationId/available-models` carried no authentication at all.
 *
 * These tests pin the fix. They are written so that reverting
 * `requireSameOrganization` in server/src/routes/llm.routes.ts turns them red:
 * the cross-org cases would return 200 instead of 403, and the anonymous case
 * would return 200 instead of 401.
 *
 * `verifyToken` is replaced with a stub that derives the caller's organization
 * from a test header — the guard under test reads `req.user.organizationId`,
 * which is exactly what the real middleware populates.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Auth: a stub that mirrors what the real verifyToken puts on the request.
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: Request, res: Response, next: NextFunction) => {
    const org = req.header('x-test-org');
    const superAdmin = req.header('x-test-superadmin') === '1';
    if (!org && !superAdmin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    (req as Request & { user?: unknown }).user = {
      id: 'user-1',
      organizationId: org,
      isSuperAdmin: superAdmin,
    };
    next();
  },
}));

vi.mock('../../../server/src/middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// DB layer: the handlers must never be reached in the denied cases. If the guard
// regresses, these resolve and the assertions on 403/401 fail loudly.
const mockDbGet = vi.fn(async () => null);
const mockDbAll = vi.fn(async () => []);
const mockDbRun = vi.fn(async () => ({ success: true }));
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockDbGet(...(a as [])),
  all: (...a: unknown[]) => mockDbAll(...(a as [])),
  run: (...a: unknown[]) => mockDbRun(...(a as [])),
}));

vi.mock('../../../server/src/services/ai/llmConfigService.js', () => ({
  default: { getOrganizationProviders: vi.fn(async () => []) },
}));

const buildApp = async (): Promise<Express> => {
  const mod = await import('../../../server/src/routes/llm.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/llm', (mod.default ?? mod) as express.Router);
  return app;
};

describe('LLM org-scoped read routes — cross-tenant guard', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  const CROSS_ORG_READS = [
    ['policy', '/api/llm/org/org-B/policy'],
    ['policy history', '/api/llm/org/org-B/policy/history'],
    ['available models', '/api/llm/org/org-B/available-models'],
  ] as const;

  it.each(CROSS_ORG_READS)(
    'refuses %s for a caller belonging to a different organization',
    async (_label, path) => {
      const res = await request(app).get(path).set('x-test-org', 'org-A');
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('ORG_SCOPE_MISMATCH');
    }
  );

  it('refuses available-models to an unauthenticated caller', async () => {
    const res = await request(app).get('/api/llm/org/org-B/available-models');
    expect(res.status).toBe(401);
  });

  it.each(CROSS_ORG_READS)('allows %s for the caller\'s own organization', async (_label, path) => {
    const ownPath = path.replace('org-B', 'org-A');
    const res = await request(app).get(ownPath).set('x-test-org', 'org-A');
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('allows a super admin to read another organization', async () => {
    const res = await request(app)
      .get('/api/llm/org/org-B/policy')
      .set('x-test-superadmin', '1');
    expect(res.status).not.toBe(403);
  });

  it('refuses when the caller carries no organization at all', async () => {
    const res = await request(app).get('/api/llm/org/org-B/policy').set('x-test-org', '');
    expect([401, 403]).toContain(res.status);
  });
});
