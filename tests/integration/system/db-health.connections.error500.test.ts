import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getConnectionPool = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => null,
}));

describe('DB health: connections returns 500 on exception (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue({
      getStats: () => {
        throw new Error('boom');
      },
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('GET /api/health/connections returns 500 with status error', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/connections');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ status: 'error' }));
  });
});
