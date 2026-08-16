import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { getConnectionPool, getHealthMonitor, resolveReachableDatabaseUrl, resolveDemoPolicy } =
  vi.hoisted(() => ({
    getConnectionPool: vi.fn(),
    getHealthMonitor: vi.fn(),
    resolveReachableDatabaseUrl: vi.fn(),
    resolveDemoPolicy: vi.fn(),
  }));

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => getHealthMonitor(),
}));

vi.mock('../../../server/src/config/databaseTargetResolver.js', () => ({
  resolveReachableDatabaseUrl: (...args: unknown[]) => resolveReachableDatabaseUrl(...args),
}));

vi.mock('../../../server/src/config/demoPolicy.js', () => ({
  resolveDemoPolicy: (...args: unknown[]) => resolveDemoPolicy(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', email: 'user@example.com' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
  requireSuperAdmin: (_req: any, _res: unknown, next: () => void) => next(),
}));

describe('DB health routes coded error contracts', () => {
  let router: any;

  beforeAll(async () => {
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue({
      getStats: () => ({ total: 10, active: 2, idle: 8, healthy: 2, unhealthy: 0 }),
    });
    getHealthMonitor.mockReturnValue({
      getMetrics: () => ({
        uptime: 99.1,
        averageResponseTime: 12,
        consecutiveFailures: 0,
        totalChecks: 10,
        totalFailures: 0,
        lastCheck: new Date().toISOString(),
      }),
    });
    resolveReachableDatabaseUrl.mockReturnValue({
      source: 'database_url',
      reason: null,
      databaseUrl: 'postgres://localhost:5432/consultify',
    });
    resolveDemoPolicy.mockReturnValue({
      demoOrgId: 'demo-org',
      demoOrgName: 'Demo',
      defaultDemoOrgId: 'demo-org',
      usesNonDefaultDemoOrgId: false,
      explicitApprovalEnabled: false,
      approvedBy: null,
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('returns coded 503 when /database probe fails', async () => {
    getConnectionPool.mockImplementationOnce(() => {
      throw new Error('database internal detail');
    });

    const res = await request(makeApp()).get('/api/health/database');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HEALTH_DATABASE_PROBE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('database internal detail');
  });

  it('returns coded 503 when /connections stats read fails', async () => {
    getConnectionPool.mockReturnValueOnce({
      getStats: () => {
        throw new Error('pool internal detail');
      },
    });

    const res = await request(makeApp()).get('/api/health/connections');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HEALTH_CONNECTION_POOL_STATUS_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('pool internal detail');
  });

  it('returns coded 500 when /data-context resolution fails', async () => {
    resolveReachableDatabaseUrl.mockImplementationOnce(() => {
      throw new Error('resolver internal detail');
    });

    const res = await request(makeApp()).get('/api/health/data-context');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('HEALTH_DATA_CONTEXT_RESOLVE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('resolver internal detail');
  });
});
