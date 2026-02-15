/**
 * Health Integration Tests (REAL)
 *
 * These tests intentionally avoid spinning up an HTTP server (sandbox may forbid listen()).
 * They validate the real controller behavior directly with request/response mocks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: vi.fn().mockResolvedValue([{ '1': 1 }]),
  }),
}));

vi.mock('../../../server/src/services/metricsService.js', () => ({
  getMetricsService: () => ({
    getMetrics: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

import { HealthCheckController } from '../../../server/src/controllers/HealthCheckController.js';

function createRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('Health Endpoints Integration (controller-level)', () => {
  beforeEach(() => {
    process.env.MOCK_REDIS = 'true';
  });

  it('GET /ping returns pong', () => {
    const res = createRes();
    HealthCheckController.ping({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('pong');
  });

  it('GET /api/health returns ok + timestamp + redis mock', async () => {
    const res = createRes();
    await HealthCheckController.checkHealth({} as any, res as any);
    expect(res.json).toHaveBeenCalled();
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        redis: 'mock',
      })
    );
  });

  it('GET /api/health/ready returns ready when DB+metrics+redis are ok', async () => {
    const res = createRes();
    await HealthCheckController.checkReadiness({} as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: { database: true, redis: true, metrics: true },
      })
    );
  });

  it('GET /api/health/live returns alive', async () => {
    const res = createRes();
    await HealthCheckController.checkLiveness({} as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ status: 'alive', uptime: expect.any(Number) })
    );
  });
});
