import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const mockDbGet = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
}));

import apiLoggingMiddleware from '../../../server/src/middleware/apiLogging.middleware.js';

describe('performance-metrics deploy gate contracts', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-performance-gate-${workerId}.db`);
  const basePath = '/api/performance-metrics';
  let router: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    vi.resetModules();
    router = (await import('../../../server/src/routes/performance-metrics.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockResolvedValue({ ok: 1 });
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  const mount = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => app.use(apiLoggingMiddleware),
    });

  it('returns honest summary payload with db.ok=true on healthy probe', async () => {
    const res = await request(mount())
      .get(`${basePath}/`)
      .set('X-Correlation-ID', 'perf-contract-test-1');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.db.ok).toBe(true);
    expect(res.body.db.type).toEqual(expect.any(String));
    expect(Number.isFinite(res.body.node.uptimeMs)).toBe(true);
    expect(res.body.node.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(res.body.node.memory.heapUsed).toBeLessThanOrEqual(res.body.node.memory.heapTotal);
    expect(res.body.meta.correlationId).toBe('perf-contract-test-1');
  });

  it('returns db.ok=false in summary and coded 503 on health endpoint when probe fails', async () => {
    mockDbGet.mockRejectedValueOnce(new Error('DB_SECRET_LEAK')); // summary
    mockDbGet.mockRejectedValueOnce(new Error('DB_SECRET_LEAK')); // health

    const summary = await request(mount()).get(`${basePath}/`);
    expect(summary.status).toBe(200);
    expect(summary.body.ok).toBe(false);
    expect(summary.body.db.ok).toBe(false);
    expect(JSON.stringify(summary.body)).not.toContain('DB_SECRET_LEAK');

    const health = await request(mount())
      .get(`${basePath}/health`)
      .set('X-Correlation-ID', 'perf-contract-test-2');
    expect(health.status).toBe(503);
    expect(health.body.ok).toBe(false);
    expect(health.body.code).toBe('PERFORMANCE_METRICS_DB_PROBE_FAILED');
    expect(health.body.meta.correlationId).toBe('perf-contract-test-2');
    expect(JSON.stringify(health.body)).not.toContain('DB_SECRET_LEAK');
  });
});
