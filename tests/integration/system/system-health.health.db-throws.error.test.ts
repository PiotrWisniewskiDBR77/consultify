import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getDatabaseAsync = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabaseAsync: (...args: any[]) => getDatabaseAsync(...args),
}));

describe('System health: db failure yields overall error (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/system-health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getDatabaseAsync.mockRejectedValue(new Error('db down'));
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/system', router });

  it('GET /api/system/health returns overall error with checks', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        overall: 'error',
        checks: expect.any(Array),
        timestamp: expect.any(String),
      })
    );
  });
});
