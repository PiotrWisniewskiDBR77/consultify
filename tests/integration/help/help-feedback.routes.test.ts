import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('Help feedback routes (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/helpFeedback.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    dbAll.mockResolvedValue([]);
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/help/feedback', router });

  it('POST /api/help/feedback creates feedback', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/help/feedback').send({
      category: 'general',
      message: 'This helped.',
      rating: 5,
      pageUrl: '/dashboard',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
    expect(dbRun).toHaveBeenCalled();
  });

  it('POST /api/help/feedback validates message', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/help/feedback').send({ category: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('GET /api/help/feedback returns recent feedback', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([{ id: 'f1', category: 'general', message: 'm', created_at: 'x' }]);
    const res = await request(makeApp()).get('/api/help/feedback');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'f1' })]));
  });
});
