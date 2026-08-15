import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Legacy stubbed routes (no 501 placeholders)', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
  });

  const makeApp = (mountPath: string, router: any) =>
    makeTestApp({
      mountPath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = { id: 'u-1', organizationId: 'o-1', role: 'admin' };
          next();
        });
      },
    });

  it('GET /api/task-advisor returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/task-advisor.routes.ts')).default;
    const res = await request(makeApp('/api/task-advisor', router)).get('/api/task-advisor');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Not implemented');
  });

  it('GET /api/feature-flags enforces authentication (not 501)', async () => {
    const router = (await import('../../../server/src/routes/featureFlags.routes.ts')).default;
    const res = await request(makeApp('/api/feature-flags', router)).get('/api/feature-flags');
    expect(res.status).toBe(401);
  });

  it('GET /api/workspace-defaults returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/workspace-defaults.routes.ts')).default;
    const res = await request(makeApp('/api/workspace-defaults', router)).get(
      '/api/workspace-defaults'
    );
    expect(res.status).toBe(503);
  });

  it('GET /api/system-config returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/systemConfig.routes.ts')).default;
    const res = await request(makeApp('/api/system-config', router)).get('/api/system-config');
    expect(res.status).toBe(503);
  });

  it('GET /api/governance returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/governanceAdmin.routes.ts')).default;
    const res = await request(makeApp('/api/governance', router)).get('/api/governance');
    expect(res.status).toBe(503);
  });

  it('GET /api/help-analytics returns an implemented response (not 501)', async () => {
    const router = (await import('../../../server/src/routes/helpAnalytics.routes.ts')).default;
    const res = await request(makeApp('/api/help-analytics', router)).get('/api/help-analytics');
    expect(res.status).toBe(200);
  });

  it('GET /api/benchmark returns an implemented response (not 501)', async () => {
    const router = (await import('../../../server/src/routes/benchmark.routes.ts')).default;
    const res = await request(makeApp('/api/benchmark', router)).get('/api/benchmark');
    expect(res.status).toBe(200);
  });

  it('GET /api/locations returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/locations.routes.ts')).default;
    const res = await request(makeApp('/api/locations', router)).get('/api/locations');
    expect(res.status).toBe(503);
  });

  it('GET /api/referrals returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/referrals.routes.ts')).default;
    const res = await request(makeApp('/api/referrals', router)).get('/api/referrals');
    expect(res.status).toBe(503);
  });

  it('GET /api/assessment returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/assessment/assessment.routes.ts')).default;
    const res = await request(makeApp('/api/assessment', router)).get('/api/assessment');
    expect(res.status).toBe(503);
  });
});
