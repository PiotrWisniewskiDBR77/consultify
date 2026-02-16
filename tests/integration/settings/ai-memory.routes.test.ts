import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('AI memory routes (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  });

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/aiMemory.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue(null);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/ai-memory', router });

  it('GET /api/ai-memory returns list and total', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([{ id: 'm1', key: 'preferred_language', value: 'pl' }]);
    const res = await request(makeApp()).get('/api/ai-memory');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ total: 1 }));
  });

  it('GET /api/ai-memory/context returns null when empty', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([]);
    const res = await request(makeApp()).get('/api/ai-memory/context');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ context: null, memories: [] }));
  });

  it('PUT /api/ai-memory/:key validates key/value', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).put('/api/ai-memory/Bad-Key').send({ value: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('PUT /api/ai-memory/:key inserts when missing', async function () {
    if (!canListen) this.skip();
    dbGet.mockResolvedValueOnce(null); // existing
    dbGet.mockResolvedValueOnce({ id: 'm2', key: 'preferred_language', value: 'en' }); // updated
    const res = await request(makeApp())
      .put('/api/ai-memory/preferred_language')
      .send({ value: 'en', source: 'explicit' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: 'm2', key: 'preferred_language' }));
    expect(dbRun).toHaveBeenCalled();
  });

  it('DELETE /api/ai-memory/:key returns 404 when not found', async function () {
    if (!canListen) this.skip();
    dbRun.mockResolvedValueOnce({ success: true, changes: 0 });
    const res = await request(makeApp()).delete('/api/ai-memory/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
