import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Performance metrics routes', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-performance-metrics-${workerId}.db`);
  const basePath = '/api/performance-metrics';

  let resetConnection: (() => Promise<void>) | null = null;
  let router: any;
  const mount = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();

    router = (await import('../../../server/src/routes/performance-metrics.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  it('GET /api/performance-metrics returns summary payload', async () => {
    const res = await request(mount()).get(`${basePath}/`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: false,
        timestamp: expect.any(String),
        node: expect.any(Object),
        db: expect.any(Object),
      })
    );
    expect(typeof res.body?.node?.uptimeMs).toBe('number');
  });

  it('GET /api/performance-metrics/health returns 200/503 with ok boolean', async () => {
    const res = await request(mount()).get(`${basePath}/health`);
    // Health endpoint: 200 when healthy, 503 when degraded (ok boolean asserted below).
    expect([200, 503]).toContain(res.status);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: expect.any(Boolean),
        timestamp: expect.any(String),
      })
    );
  });
});
