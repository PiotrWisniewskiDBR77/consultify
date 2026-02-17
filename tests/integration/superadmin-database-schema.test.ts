import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadSecurityPoliciesRouter() {
  return (await import('../../server/src/routes/securityPolicies.routes.ts')).default;
}

describe('Schema sanity: security_policies table - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    dbGet.mockResolvedValue({ id: 'any' });
    dbAll.mockResolvedValue([]);
  });

  it('issues CREATE TABLE IF NOT EXISTS with composite primary key', async () => {
    const router = await loadSecurityPoliciesRouter();
    const app = makeTestApp({
      mountPath: '/api/security-policies',
      router,
      beforeMount: (a) =>
        a.use((req, _res, next) => {
          (req as any).user = { organizationId: 'org-1' };
          next();
        }),
    });
    await request(app).get('/api/security-policies');

    const createCall = dbRun.mock.calls.find((c) =>
      String(c[0]).includes('CREATE TABLE IF NOT EXISTS security_policies')
    );
    expect(createCall).toBeDefined();
    expect(String(createCall?.[0])).toContain('PRIMARY KEY (id, organization_id)');
  });
});
