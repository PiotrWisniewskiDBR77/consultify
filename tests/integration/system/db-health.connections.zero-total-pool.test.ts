import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getConnectionPool = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => null,
}));

describe('DB health routes: /connections zero-total pool contract', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('returns finite utilization percentages when pool total is zero', async function () {
    if (!canListen) this.skip();
    getConnectionPool.mockReturnValue({
      getStats: () => ({ total: 0, active: 0, idle: 0, healthy: 0, unhealthy: 0 }),
    });

    const res = await request(makeApp()).get('/api/health/connections');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.connections.total).toBe(0);
    expect(res.body.utilization.active).toMatch(/^\d+\.\d%$/);
    expect(res.body.utilization.idle).toMatch(/^\d+\.\d%$/);
    expect(Number.parseFloat(res.body.utilization.active)).not.toBeNaN();
    expect(Number.parseFloat(res.body.utilization.idle)).not.toBeNaN();
    expect(res.body.timestamp).toEqual(expect.any(String));
  });
});
