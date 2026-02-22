import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Backups routes (no stub 501)', () => {
  const basePath = '/api/backups';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = { id: 'u-1', organizationId: 'o-1', role: 'admin' };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/backup.routes.ts')).default;
  });

  it('GET /api/backups returns 503 (not 501)', async () => {
    const res = await request(makeApp()).get(`${basePath}`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Not implemented');
  });
});

