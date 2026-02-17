import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

vi.mock('../../server/src/database/index.js', () => ({
  getDatabaseAsync: async () => {
    throw new Error('db down');
  },
  getConnectionPool: () => null,
}));

async function loadSystemHealthRouter() {
  return (await import('../../server/src/routes/system-health.routes.ts')).default;
}

describe('Critical endpoint: /system/health - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health returns structured report even when DB is down', async () => {
    const router = await loadSystemHealthRouter();
    const app = makeTestApp({ mountPath: '/api/system', router });
    const res = await request(app).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        overall: expect.any(String),
        timestamp: expect.any(String),
        checks: expect.any(Array),
      })
    );
  });

  it('GET /health marks database connection check as error when DB is down', async () => {
    const router = await loadSystemHealthRouter();
    const app = makeTestApp({ mountPath: '/api/system', router });
    const res = await request(app).get('/api/system/health');
    const dbCheck = res.body.checks.find((c: any) => c.name === 'Database Connection');
    expect(dbCheck).toEqual(expect.objectContaining({ status: 'error' }));
  });
});
