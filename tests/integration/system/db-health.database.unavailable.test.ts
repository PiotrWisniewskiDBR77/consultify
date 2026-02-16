import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getConnectionPool = vi.fn();
const getHealthMonitor = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => getHealthMonitor(),
}));

describe('DB health routes: /database unavailable (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue(null);
    getHealthMonitor.mockReturnValue(null);
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('GET /api/health/database returns 503 when pool not initialized', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/database');
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        message: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });
});
