import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Organization data routes (honest 503 when unavailable)', () => {
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

  it('GET /api/organization-data/stats returns 503 with FEATURE_UNAVAILABLE', async () => {
    const res = await request(makeApp()).get(`${basePath}/stats`);
    expect(res.status).toBe(503);
    expect(res.body?.code).toBe('FEATURE_UNAVAILABLE');
  });

  it('POST /api/organization-data/export/all returns 503 with FEATURE_UNAVAILABLE', async () => {
    const res = await request(makeApp()).post(`${basePath}/export/all`).send({});
    expect(res.status).toBe(503);
    expect(res.body?.code).toBe('FEATURE_UNAVAILABLE');
  });

  it('POST /api/organization-data/export/users returns 503 with FEATURE_UNAVAILABLE', async () => {
    const res = await request(makeApp()).post(`${basePath}/export/users`).send({});
    expect(res.status).toBe(503);
    expect(res.body?.code).toBe('FEATURE_UNAVAILABLE');
  });
});
