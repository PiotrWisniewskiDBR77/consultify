import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Admin backup routes (no demo placeholders)', () => {
  const basePath = '/api/admin/backups';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-admin-1',
            organizationId: 'o-admin-1',
            role: 'admin',
          };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/admin/backup.routes.ts')).default;
  });

  it('GET /api/admin/backups is honest when backup service is unavailable', async () => {
    const res = await request(makeApp()).get(`${basePath}`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('demo-backup');
    expect(JSON.stringify(res.body)).not.toContain('"demo"');
  });

  it('GET /api/admin/backups/status is honest when backup service is unavailable', async () => {
    const res = await request(makeApp()).get(`${basePath}/status`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('"demo"');
  });

  it('GET /api/admin/backups/:id/status is honest when backup service is unavailable', async () => {
    const res = await request(makeApp()).get(`${basePath}/any-id/status`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('"demo"');
  });
});

