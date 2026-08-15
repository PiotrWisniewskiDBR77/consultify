import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('User/report stubbed routes (no 501 placeholders)', () => {
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

  it('GET /api/report-comments returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/report-comments.routes.ts')).default;
    const res = await request(makeApp('/api/report-comments', router)).get('/api/report-comments');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Not implemented');
  });

  it('GET /api/user/profile-completeness returns current missing-user boundary (not 501)', async () => {
    const router = (await import('../../../server/src/routes/user/user-profile-completeness.routes.ts'))
      .default;
    const res = await request(makeApp('/api/user/profile-completeness', router)).get(
      '/api/user/profile-completeness'
    );
    expect(res.status).toBe(404);
  });

  it('GET /api/user/professional-profile returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/user/user-professional-profile.routes.ts'))
      .default;
    const res = await request(makeApp('/api/user/professional-profile', router)).get(
      '/api/user/professional-profile'
    );
    expect(res.status).toBe(503);
  });

  it('GET /api/user/privacy-settings returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/user/user-privacy-extended.routes.ts'))
      .default;
    const res = await request(makeApp('/api/user/privacy-settings', router)).get(
      '/api/user/privacy-settings'
    );
    expect(res.status).toBe(503);
  });

  it('GET /api/profile returns 503 (not 501)', async () => {
    const router = (await import('../../../server/src/routes/user/user-profile-extended.routes.ts'))
      .default;
    const res = await request(makeApp('/api/profile', router)).get('/api/profile');
    expect(res.status).toBe(503);
  });
});
