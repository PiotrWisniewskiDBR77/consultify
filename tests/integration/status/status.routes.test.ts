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

describe('Status routes (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/status.routes.ts')).default;
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
    dbGet.mockResolvedValue(undefined);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/status', router });

  it('GET /api/status returns project statuses', async function () {
    if (!canListen) this.skip();
    dbAll.mockResolvedValueOnce([
      { id: 'p1', name: 'P', status: 'active', health: 'green', progress_pct: 10 },
    ]);
    const res = await request(makeApp()).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'p1' })]));
  });

  it('GET /api/status/overview returns defaults when DB returns nothing', async function () {
    if (!canListen) this.skip();
    dbGet.mockResolvedValueOnce(undefined);
    const res = await request(makeApp()).get('/api/status/overview');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ total: 0, active: 0, completed: 0, at_risk: 0, avg_progress: 0 })
    );
  });

  it('PUT /api/status/:id updates status/health/progressPct', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).put('/api/status/p1').send({
      status: 'active',
      health: 'red',
      progressPct: 42,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE projects SET'),
      expect.arrayContaining(['active', 'red', 42, 'p1'])
    );
  });
});
