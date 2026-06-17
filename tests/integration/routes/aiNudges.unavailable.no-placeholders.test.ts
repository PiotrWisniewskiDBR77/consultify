import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('AI nudges routes (honest 503 when unavailable)', () => {
  const basePath = '/api/ai/nudges';

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    // Mock the service module so it has no methods → route hits notConfigured()
    vi.doMock('../../../server/src/services/ai/proactiveNudges.js', () => ({
      default: {},
    }));
  });

  const mount = async () => {
    const router = (await import('../../../server/src/routes/ai/ai-nudges.routes.ts')).default;
    return makeTestApp({ mountPath: basePath, router });
  };

  it('GET /pending returns 503 FEATURE_UNAVAILABLE when service is missing', async () => {
    const res = await request(await mount()).get(`${basePath}/pending`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ success: false, code: 'FEATURE_UNAVAILABLE' }));
  });

  it('POST /track returns 503 FEATURE_UNAVAILABLE when service is missing', async () => {
    const res = await request(await mount()).post(`${basePath}/track`).send({});
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ success: false, code: 'FEATURE_UNAVAILABLE' }));
  });
});
