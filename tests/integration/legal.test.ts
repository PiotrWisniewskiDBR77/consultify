import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbGet } = vi.hoisted(() => ({ dbGet: vi.fn() }));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

async function loadLegalRouter() {
  return (await import('../../server/src/routes/legal.routes.ts')).default;
}

describe('Legal routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGet.mockResolvedValue(undefined);
  });

  it('GET /documents lists default docs', async () => {
    const router = await loadLegalRouter();
    const app = makeTestApp({ mountPath: '/api/legal', router });
    const res = await request(app).get('/api/legal/documents');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.any(Array));
  });

  it('GET /document/:type returns default when DB row missing', async () => {
    const router = await loadLegalRouter();
    const app = makeTestApp({ mountPath: '/api/legal', router });
    const res = await request(app).get('/api/legal/document/tos');
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('TOS');
    expect(res.body.data.title).toContain('Terms');
  });

  it('GET /document/:type returns 404 for unknown type', async () => {
    const router = await loadLegalRouter();
    const app = makeTestApp({ mountPath: '/api/legal', router });
    const res = await request(app).get('/api/legal/document/nope');
    expect(res.status).toBe(404);
  });
});
