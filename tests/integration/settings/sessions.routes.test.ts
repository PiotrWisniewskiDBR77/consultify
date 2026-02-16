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

describe('Sessions routes (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/sessions.routes.ts')).default;
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

  const makeApp = () =>
    makeTestApp({ mountPath: '/api/sessions', router, sessionId: 'sess-current' });

  it('GET /api/sessions marks current session', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([
      { id: 'sess-current', device: 'Chrome', ip_address: '1', last_active: 'x', created_at: 'y' },
    ]);
    const res = await request(makeApp()).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'sess-current', isCurrent: true }),
        ]),
      })
    );
  });

  it('POST /api/sessions creates session', async function () {
    if (!canListen) this.skip();
    dbRun.mockResolvedValueOnce({ success: true, lastID: 1, changes: 1 });
    const res = await request(makeApp()).post('/api/sessions').send({ device: 'Chrome' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ sessionId: expect.any(String) }),
      })
    );
  });

  it('DELETE /api/sessions/:id terminates session', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).delete('/api/sessions/sess-1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
  });
});
