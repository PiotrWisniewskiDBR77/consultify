import express from 'express';
import supertest from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn(),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
  getOrgFlags: vi.fn().mockResolvedValue({}),
  getV8Flags: vi.fn().mockResolvedValue({ chat: true, ai_core: true }),
  setV8OrgFlag: vi.fn().mockResolvedValue(undefined),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: vi.fn().mockResolvedValue({
    overall: 'healthy',
    domains: {},
    timestamp: new Date().toISOString(),
  }),
  getDomainReadiness: vi.fn().mockResolvedValue({
    chat: 'ready',
    aiCore: 'ready',
  }),
}));

vi.mock('../../../middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.userId = 'test-user';
      req.organizationId = 'test-org';
      req.userRole = 'admin';
      req.user = { isSuperAdmin: true };
      next();
    } else {
      _res.status(401).json({ error: 'Unauthorized' });
    }
  };
  const requireSuperAdmin = (req: any, _res: any, next: any) => {
    if (req.user?.isSuperAdmin) {
      next();
    } else {
      _res.status(403).json({ error: 'Forbidden' });
    }
  };
  return { verifyToken, requireSuperAdmin, default: verifyToken };
});

vi.mock('../../../utils/DbPromise.js', () => ({
  default: {
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ changes: 0 }),
  },
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({
    v8RequestCount: 0,
    v8ErrorCount: 0,
    avgResponseTimeMs: 0,
    endpointBreakdown: {},
  }),
}));

import { isV8Enabled } from '../../../services/v8/featureFlagService.js';
import { v8FeatureGate } from '../../../middleware/v8FeatureGate.middleware.js';
import v8Router from '../../../routes/v8/index.js';

function createTestApp(globalEnabled: boolean) {
  const app = express();
  app.use(express.json());

  if (globalEnabled) {
    process.env.ENABLE_V8_GLOBAL = 'true';
  } else {
    process.env.ENABLE_V8_GLOBAL = 'false';
  }

  app.use('/api/v8', v8FeatureGate, v8Router);
  return app;
}

describe('CP-24: Gateway E2E — V8 routes through full middleware chain', () => {
  const mockedIsV8Enabled = vi.mocked(isV8Enabled);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsV8Enabled.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.ENABLE_V8_GLOBAL;
  });

  describe('Feature gate — global toggle', () => {
    it('returns 404 when ENABLE_V8_GLOBAL is false', async () => {
      const app = createTestApp(false);
      const res = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('V8_DISABLED');
    });

    it('passes through when ENABLE_V8_GLOBAL is true', async () => {
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });

  describe('Auth chain', () => {
    it('returns 401 for unauthenticated request', async () => {
      const app = createTestApp(true);
      const res = await supertest(app).get('/api/v8/health');

      expect(res.status).toBe(401);
    });

    it('returns 200 for authenticated request to health', async () => {
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.meta.version).toBe('v8');
    });
  });

  describe('Org-level gate', () => {
    it('returns 404 when V8 is disabled for the org', async () => {
      mockedIsV8Enabled.mockResolvedValue(false);
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('V8_ORG_DISABLED');
    });
  });

  describe('Full chain — health endpoint', () => {
    it('returns health data through full middleware chain', async () => {
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/health')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.meta.version).toBe('v8');
    });

    it('returns readiness through full middleware chain', async () => {
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/health/readiness')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('Admin endpoints through full chain', () => {
    it('returns feature flags list', async () => {
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/admin/flags')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });

    it('returns admin metrics', async () => {
      const app = createTestApp(true);
      const res = await supertest(app)
        .get('/api/v8/admin/metrics')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });
});
