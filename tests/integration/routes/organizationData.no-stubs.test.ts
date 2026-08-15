import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Organization data routes (current governed contracts)', () => {
  const basePath = '/api/organization-data';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/organization/organization-data.routes.ts')).default;
  });

  it('GET /api/organization-data/stats returns the implemented stats contract', async () => {
    const res = await request(makeApp()).get(`${basePath}/stats`);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('POST /api/organization-data/export/all requires explicit confirmation', async () => {
    const res = await request(makeApp()).post(`${basePath}/export/all`).send({});
    expect(res.status).toBe(403);
  });

  it('POST /api/organization-data/export/users requires explicit confirmation', async () => {
    const res = await request(makeApp()).post(`${basePath}/export/users`).send({});
    expect(res.status).toBe(403);
  });
});
