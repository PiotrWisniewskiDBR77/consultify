/**
 * R4 — POST /api/initiatives/from-audit {auditId:nonexistent} → STRICT 404.
 *
 * Deterministic proof of the contract the E2E L3-BB-16 now asserts strictly:
 * a missing audit degrades to 404 "Audit not found", never a 5xx. Auth/rbac
 * mocked to pass-through; queryHelpers.queryOne → null (audit absent) so the REAL
 * createInitiativeFromAudit + route error-mapping run. Zod validation stays real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));
// Audit absent → both SELECT attempts resolve null (no throw) → service → 404.
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn(async () => null),
  queryAll: vi.fn(async () => []),
  queryRun: vi.fn(async () => ({ changes: 0 })),
  getTableColumns: vi.fn(async () => []),
}));

async function makeApp(orgId: string | null = 'org-1') {
  const router = (await import('../../../server/src/routes/initiativeBackbone.routes.ts')).default;
  return makeTestApp({
    mountPath: '/api/initiatives',
    router,
    beforeMount: (app) => {
      app.use((req: any, _res, next) => {
        if (orgId) req.user = { id: 'u1', organizationId: orgId, role: 'ADMIN' };
        next();
      });
    },
  });
}

describe('POST /api/initiatives/from-audit (R4 strict 404)', () => {
  const origEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });
  afterAll(() => {
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
  });
  beforeEach(() => vi.clearAllMocks());

  it('nonexistent audit → 404 (not 5xx)', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/initiatives/from-audit')
      .send({ auditId: `nonexistent-${Date.now()}` });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'from_audit_failed' }),
    );
  });

  it('missing auditId → 400 (zod min(1))', async () => {
    const app = await makeApp();
    const res = await request(app).post('/api/initiatives/from-audit').send({});
    expect(res.status).toBe(400);
  });

  it('no org context → 401', async () => {
    const app = await makeApp(null);
    const res = await request(app).post('/api/initiatives/from-audit').send({ auditId: 'x' });
    expect(res.status).toBe(401);
  });
});
