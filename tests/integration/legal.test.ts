import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { dbAll, dbGet } = vi.hoisted(() => ({ dbAll: vi.fn(), dbGet: vi.fn() }));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
}));

async function loadLegalRouter() {
  return (await import('../../server/src/routes/legal.routes.ts')).default;
}

describe('Legal routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGet.mockResolvedValue(undefined);
    dbAll.mockResolvedValue([]);
    delete process.env.LEGAL_TOS_CONTENT;
    delete process.env.LEGAL_PRIVACY_CONTENT;
    delete process.env.LEGAL_COOKIES_CONTENT;
    delete process.env.LEGAL_DPA_CONTENT;
  });

  it('GET /documents lists supported docs (configured=false by default)', async () => {
    const router = await loadLegalRouter();
    const app = makeTestApp({ mountPath: '/api/legal', router });
    const res = await request(app).get('/api/legal/documents');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.any(Array));
  });

  it('GET /document/:type returns 404 when no active document exists', async () => {
    const router = await loadLegalRouter();
    const app = makeTestApp({ mountPath: '/api/legal', router });
    const res = await request(app).get('/api/legal/document/tos');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LEGAL_DOC_NOT_FOUND');
  });

  it('GET /document/:type returns 404 for unknown type', async () => {
    const router = await loadLegalRouter();
    const app = makeTestApp({ mountPath: '/api/legal', router });
    const res = await request(app).get('/api/legal/document/nope');
    expect(res.status).toBe(404);
  });
});
