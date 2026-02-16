import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
  get: vi.fn(),
}));

describe('Login history routes (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/loginHistory.routes.ts')).default;
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

  const makeApp = () => makeTestApp({ mountPath: '/api/auth/login-history', router });

  it('GET /api/auth/login-history formats device based on user_agent', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([
      {
        id: 'l1',
        ip_address: '1',
        user_agent: 'Chrome Mac',
        location: null,
        status: 'success',
        created_at: '2025-01-01',
      },
    ]);
    const res = await request(makeApp()).get('/api/auth/login-history?limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'l1', device: expect.stringMatching(/chrome/i) }),
        ]),
      })
    );
  });

  it('POST /api/auth/login-history validates userId', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .post('/api/auth/login-history')
      .send({ status: 'success' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });

  it('POST /api/auth/login-history records entry', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/auth/login-history').send({
      userId: 'u1',
      ipAddress: '1',
      userAgent: 'Chrome',
      status: 'success',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, data: expect.any(Object) }));
    expect(dbRun).toHaveBeenCalled();
  });

  it('GET /api/auth/login-history/suspicious returns failures', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([{ id: 's1', status: 'failed' }]);
    const res = await request(makeApp()).get('/api/auth/login-history/suspicious');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
  });
});
