import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Generic reports routes (honest 503 when unavailable)', () => {
  const basePath = '/api/generic-reports';
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
    router = (await import('../../../server/src/routes/generic-reports.routes.ts')).default;
  });

  it('GET /api/generic-reports returns 503 with FEATURE_UNAVAILABLE', async () => {
    const res = await request(makeApp()).get(`${basePath}`);
    expect(res.status).toBe(503);
    expect(res.body?.code).toBe('FEATURE_UNAVAILABLE');
  });
});
