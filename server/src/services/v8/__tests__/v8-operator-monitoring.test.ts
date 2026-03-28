import express from 'express';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
  getOrgFlags: vi.fn().mockResolvedValue({ chat: true, ai_core: true }),
  getV8Flags: vi.fn().mockResolvedValue({ chat: true, ai_core: true }),
  setV8OrgFlag: vi.fn().mockResolvedValue(undefined),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: vi.fn().mockResolvedValue({
    overall: 'healthy',
    domains: { chat: 'ready', aiCore: 'ready' },
    timestamp: new Date().toISOString(),
  }),
  getCrossDomainIntegrity: vi.fn().mockResolvedValue({ status: 'ok' }),
  getPlatformMetrics: vi.fn().mockResolvedValue({ totalRequests: 100 }),
  getDomainReadiness: vi.fn().mockResolvedValue({
    chat: 'ready',
    aiCore: 'ready',
  }),
}));

vi.mock('../../../services/v8/shadowModeService.js', () => ({
  getShadowStats: vi.fn().mockResolvedValue({
    totalComparisons: 50,
    matchRate: 0.92,
    avgLegacyLatencyMs: 120,
    avgV8LatencyMs: 145,
    v8ErrorRate: 0.04,
    recentMismatches: 2,
  }),
  getRecentComparisons: vi.fn().mockResolvedValue([
    {
      comparisonId: 'cmp-1',
      endpoint: '/context',
      method: 'GET',
      legacyStatusCode: 200,
      v8StatusCode: 200,
      responsesMatch: true,
      createdAt: new Date().toISOString(),
    },
  ]),
  getShadowPromotionReadiness: vi.fn().mockResolvedValue({
    ready: false,
    criteria: [
      { name: 'Minimum 100 comparisons', passed: false, value: '50 comparisons' },
      { name: 'Match rate >= 95%', passed: false, value: '92.0%' },
      { name: 'V8 error rate < 5%', passed: true, value: '4.0%' },
      { name: 'V8 latency overhead < 100ms', passed: true, value: '25ms overhead' },
      { name: 'No mismatches in last 24h', passed: false, value: '2 recent mismatches' },
    ],
  }),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({
    v8RequestCount: 250,
    v8ErrorCount: 5,
    v8TotalLatencyMs: 30000,
  }),
}));

vi.mock('../../../middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    req.userId = 'operator-user';
    req.organizationId = 'test-org';
    req.userRole = 'admin';
    req.user = { isSuperAdmin: true };
    next();
  };
  const requireSuperAdmin = (_req: any, _res: any, next: any) => next();
  return { verifyToken, requireSuperAdmin, default: verifyToken };
});

vi.mock('../../../utils/DbPromise.js', () => ({
  default: {
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ changes: 0 }),
  },
}));

import { v8FeatureGate } from '../../../middleware/v8FeatureGate.middleware.js';
import v8Router from '../../../routes/v8/index.js';

function createOperatorApp() {
  const app = express();
  app.use(express.json());
  process.env.ENABLE_V8_GLOBAL = 'true';
  app.use('/api/v8', v8FeatureGate, v8Router);
  return app;
}

describe('CP-32: Operator Monitoring Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health monitoring endpoints', () => {
    it('GET /api/v8/health returns platform health', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data.overall).toBe('healthy');
      expect(res.body.meta.version).toBe('v8');
    });

    it('GET /api/v8/health/readiness returns domain readiness', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/health/readiness')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('chat');
      expect(res.body.data).toHaveProperty('aiCore');
    });

    it('GET /api/v8/admin/health returns detailed health (superadmin)', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/admin/health')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('health');
      expect(res.body.data).toHaveProperty('integrity');
      expect(res.body.data).toHaveProperty('metrics');
      expect(res.body.data).toHaveProperty('readiness');
    });
  });

  describe('Metrics monitoring', () => {
    it('GET /api/v8/admin/metrics returns request metrics', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/admin/metrics')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data.requests).toBe(250);
      expect(res.body.data.errors).toBe(5);
      expect(res.body.data.avgLatencyMs).toBeDefined();
    });
  });

  describe('Shadow mode monitoring', () => {
    it('GET /api/v8/admin/shadow/stats returns shadow stats', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/admin/shadow/stats')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data.totalComparisons).toBe(50);
      expect(res.body.data.matchRate).toBe(0.92);
      expect(res.body.data.v8ErrorRate).toBe(0.04);
    });

    it('GET /api/v8/admin/shadow/comparisons returns recent comparisons', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/admin/shadow/comparisons')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v8/admin/shadow/promotion-readiness returns readiness assessment', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/admin/shadow/promotion-readiness')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data.ready).toBe(false);
      expect(res.body.data.criteria).toBeInstanceOf(Array);
      expect(res.body.data.criteria.length).toBe(5);
    });
  });

  describe('Feature flag management', () => {
    it('GET /api/v8/admin/flags returns current org flags', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .get('/api/v8/admin/flags')
        .set('Authorization', 'Bearer op-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ chat: true, ai_core: true });
    });

    it('PUT /api/v8/admin/flags/chat toggles chat flag', async () => {
      const app = createOperatorApp();
      const res = await supertest(app)
        .put('/api/v8/admin/flags/chat')
        .set('Authorization', 'Bearer op-token')
        .send({ enabled: false });

      expect(res.status).toBe(200);
    });
  });

  describe('Operator workflow — complete monitoring cycle', () => {
    it('operator can check health → metrics → shadow → flags in sequence', async () => {
      const app = createOperatorApp();

      const health = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer op-token');
      expect(health.status).toBe(200);

      const metrics = await supertest(app)
        .get('/api/v8/admin/metrics')
        .set('Authorization', 'Bearer op-token');
      expect(metrics.status).toBe(200);

      const shadow = await supertest(app)
        .get('/api/v8/admin/shadow/stats')
        .set('Authorization', 'Bearer op-token');
      expect(shadow.status).toBe(200);

      const flags = await supertest(app)
        .get('/api/v8/admin/flags')
        .set('Authorization', 'Bearer op-token');
      expect(flags.status).toBe(200);

      const readiness = await supertest(app)
        .get('/api/v8/admin/shadow/promotion-readiness')
        .set('Authorization', 'Bearer op-token');
      expect(readiness.status).toBe(200);
    });
  });
});
