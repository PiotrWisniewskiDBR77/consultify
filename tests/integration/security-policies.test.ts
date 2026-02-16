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

async function makeSecurityPoliciesApp() {
  const router = await loadSecurityPoliciesRouter();
  return makeTestApp({
    mountPath: '/api/security-policies',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organizationId: 'org-1' };
        next();
      });
    },
  });
}

describe('Security policies routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue({ id: 'any' });
  });

  it('GET / returns policies and safely parses settings_json', async () => {
    dbAll.mockResolvedValueOnce([
      {
        id: 'p1',
        organization_id: 'org-1',
        name: 'Policy',
        category: 'Auth',
        settings_json: '{bad json',
        enabled: 1,
        last_updated: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const app = await makeSecurityPoliciesApp();
    const res = await request(app).get('/api/security-policies');
    expect(res.status).toBe(200);
    expect(res.body.policies).toHaveLength(1);
    expect(res.body.policies[0]).toEqual(
      expect.objectContaining({
        id: 'p1',
        enabled: true,
        settings: {},
      })
    );
  });

  it('GET / inserts defaults when org has no policies yet', async () => {
    dbGet.mockResolvedValueOnce(null); // exists check => no rows
    dbAll.mockResolvedValueOnce([]); // select all

    const app = await makeSecurityPoliciesApp();
    const res = await request(app).get('/api/security-policies');
    expect(res.status).toBe(200);

    const createCalls = dbRun.mock.calls.filter((c) => String(c[0]).includes('CREATE TABLE'));
    const insertCalls = dbRun.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO security_policies')
    );
    expect(createCalls.length).toBeGreaterThanOrEqual(1);
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('PUT /:id returns 404 when policy does not exist', async () => {
    dbGet.mockResolvedValueOnce(null);

    const app = await makeSecurityPoliciesApp();
    const res = await request(app).put('/api/security-policies/p404').send({ enabled: false });
    expect(res.status).toBe(404);
  });

  it('PUT /:id updates enabled flag and settings', async () => {
    dbGet.mockResolvedValueOnce({
      id: 'p1',
      organization_id: 'org-1',
      name: 'Policy',
      category: 'Auth',
      settings_json: JSON.stringify({ a: 1 }),
      enabled: 1,
      last_updated: '2026-01-01T00:00:00.000Z',
    });

    const app = await makeSecurityPoliciesApp();
    const res = await request(app)
      .put('/api/security-policies/p1')
      .send({ enabled: false, settings: { a: 2 } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const updateArgs = dbRun.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE security_policies')
    );
    expect(updateArgs).toBeDefined();
    expect(updateArgs?.[1]).toEqual(
      expect.arrayContaining([JSON.stringify({ a: 2 }), 0, 'org-1', 'p1'])
    );
  });

  it('GET / returns enabled boolean based on integer flag', async () => {
    dbAll.mockResolvedValueOnce([
      {
        id: 'p2',
        organization_id: 'org-1',
        name: 'P2',
        category: 'Session',
        settings_json: JSON.stringify({}),
        enabled: 0,
        last_updated: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const app = await makeSecurityPoliciesApp();
    const res = await request(app).get('/api/security-policies');
    expect(res.status).toBe(200);
    expect(res.body.policies[0].enabled).toBe(false);
  });
});
