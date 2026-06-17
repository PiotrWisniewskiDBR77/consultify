import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('AI memory metrics routes (honest 503 when unavailable)', () => {
  const basePath = '/api/ai';

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
  });

  const mount = async () => {
    const router = (await import('../../../server/src/routes/ai.routes.ts')).default;
    return makeTestApp({ mountPath: basePath, router });
  };

  it('GET /memory/metrics returns 503 when service is unavailable (no 500)', async () => {
    const res = await request(await mount()).get(`${basePath}/memory/metrics?period=7`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ statusCode: 503, status: false, type: 'not_configured' }));
  });

  it('GET /memory/current returns 503 when service is unavailable (no 500)', async () => {
    const res = await request(await mount()).get(`${basePath}/memory/current`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ statusCode: 503, status: false, type: 'not_configured' }));
  });

  it('GET /memory/latency returns 503 when service is unavailable (no 500)', async () => {
    const res = await request(await mount()).get(`${basePath}/memory/latency?hours=24`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ statusCode: 503, status: false, type: 'not_configured' }));
  });
});
