import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Partners routes (no demo placeholders)', () => {
  const basePath = '/api/partners';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-partner-1',
            organizationId: 'o-partner-1',
            role: 'admin',
            partnerOrgId: 'partner-org-1',
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
    router = (await import('../../../server/src/routes/partners.routes.ts')).default;
  });

  it('GET /api/partners/organization does not return demo org (503 instead)', async () => {
    const res = await request(makeApp()).get(`${basePath}/organization`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Acme Consulting');
  });

  it('GET /api/partners/referral-tools does not return demo code (503 when schema missing)', async () => {
    const res = await request(makeApp()).get(`${basePath}/referral-tools`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('ACME-2024');
  });

  it('GET /api/partners/dashboard does not return demo courses (503 when schema missing)', async () => {
    const res = await request(makeApp()).get(`${basePath}/dashboard`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Consultinity Foundations');
  });
});

