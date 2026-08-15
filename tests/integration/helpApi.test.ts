import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue(undefined),
}));

async function loadHelpRouter() {
  return (await import('../../server/src/routes/help.routes.ts')).default;
}

describe('Help API routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /categories returns static list', async () => {
    const router = await loadHelpRouter();
    const app = makeTestApp({ mountPath: '/api/help', router });
    const res = await request(app).get('/api/help/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, data: expect.any(Array) }));
  });

  it('GET /articles returns empty list and echoes query', async () => {
    const router = await loadHelpRouter();
    const app = makeTestApp({ mountPath: '/api/help', router });
    const res = await request(app).get('/api/help/articles?q=abc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, data: [], query: 'abc' }));
  });
});
