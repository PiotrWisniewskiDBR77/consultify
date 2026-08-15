import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
  run: vi.fn().mockResolvedValue(undefined),
}));

describe('Help routes (no placeholders)', () => {
  const basePath = '/api/help';
  let router: any;

  const mount = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    vi.resetModules();
    router = (await import('../../../server/src/routes/help.routes.ts')).default;
  });

  it('GET /api/help/categories returns db-backed list (empty when no data)', async () => {
    const res = await request(mount()).get(`${basePath}/categories`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('GET /api/help/articles returns db-backed list (empty when no data)', async () => {
    const res = await request(mount()).get(`${basePath}/articles?q=hello`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [], query: 'hello' });
  });
});
