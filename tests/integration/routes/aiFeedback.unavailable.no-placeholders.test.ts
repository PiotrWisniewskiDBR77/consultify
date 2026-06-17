import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('AI feedback adaptive response routes (honest 503 when unavailable)', () => {
  const basePath = '/api/ai-feedback';

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    // Mock the service module so it has no methods → route hits notConfigured()
    vi.doMock('../../../server/src/services/ai/adaptiveResponseService.js', () => ({
      default: {},
    }));
  });

  const mount = async () => {
    const router = (await import('../../../server/src/routes/ai/ai-feedback.routes.ts')).default;
    return makeTestApp({ mountPath: basePath, router });
  };

  it('POST /response returns 503 FEATURE_UNAVAILABLE when service is missing', async () => {
    const res = await request(await mount()).post(`${basePath}/response`).send({});
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ code: 'FEATURE_UNAVAILABLE' }));
  });

  it('GET /response/stats returns 503 FEATURE_UNAVAILABLE when service is missing', async () => {
    const res = await request(await mount()).get(`${basePath}/response/stats`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ code: 'FEATURE_UNAVAILABLE' }));
  });
});
