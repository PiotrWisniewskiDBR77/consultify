import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('RapidLean routes (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/rapidlean.routes.ts')).default;
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
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/rapidlean', router });

  it('GET /api/rapidlean/assessments returns list', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([{ id: 'a1', title: 't', created_at: 'x' }]);
    const res = await request(makeApp()).get('/api/rapidlean/assessments');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'a1' })]));
  });

  it('POST /api/rapidlean/assessments creates draft assessment', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .post('/api/rapidlean/assessments')
      .send({
        title: 'My Assessment',
        methodology: 'lean_4_0',
        dimensions: { a: 1 },
      });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    expect(dbRun).toHaveBeenCalled();
  });

  it('PUT /api/rapidlean/assessments/:id validates updates', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).put('/api/rapidlean/assessments/a1').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('PUT /api/rapidlean/assessments/:id updates score/status/dimensions', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .put('/api/rapidlean/assessments/a1')
      .send({
        score: 3,
        status: 'submitted',
        dimensions: { b: 2 },
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE rapid_lean_assessments SET'),
      expect.arrayContaining([3, 'submitted', expect.any(String), 'a1'])
    );
  });
});
