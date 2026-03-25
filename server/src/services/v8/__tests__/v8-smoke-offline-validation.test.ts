import express from 'express';
import supertest from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    domains: {},
    timestamp: new Date().toISOString(),
  }),
  getCrossDomainIntegrity: vi.fn().mockResolvedValue({ status: 'ok' }),
  getPlatformMetrics: vi.fn().mockResolvedValue({ totalRequests: 0 }),
  getDomainReadiness: vi.fn().mockResolvedValue({ chat: 'ready', aiCore: 'ready' }),
}));

vi.mock('../../../services/v8/contextSnapshotService.js', () => ({
  getSnapshotsByConversation: vi.fn().mockResolvedValue([]),
  getSnapshotsByRun: vi.fn().mockResolvedValue([]),
  getSnapshot: vi.fn().mockResolvedValue(null),
  captureSnapshot: vi.fn().mockResolvedValue({ snapshotId: 'snap-1' }),
}));

vi.mock('../../../services/v8/chatExecutionService.js', () => ({
  getHandoffsByConversation: vi.fn().mockResolvedValue([]),
  createHandoff: vi.fn().mockResolvedValue({ handoffId: 'ho-1' }),
}));

vi.mock('../../../services/v8/contextConsumerBindingService.js', () => ({
  captureForChat: vi.fn().mockResolvedValue({ bindingId: 'b-1' }),
  captureForExecution: vi.fn().mockResolvedValue({ bindingId: 'b-2' }),
  captureForRetrieval: vi.fn().mockResolvedValue({ bindingId: 'b-3' }),
}));

vi.mock('../../../services/v8/aiOperatingEnvironmentService.js', () => ({
  getOperatingEnvironmentStatus: vi.fn().mockResolvedValue({ status: 'active' }),
  processChatTurn: vi.fn().mockResolvedValue({ turnId: 'turn-1' }),
}));

vi.mock('../../../services/v8/trustAuditService.js', () => ({
  getAuditTrail: vi.fn().mockResolvedValue([]),
  getProvenance: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/v8/toolGovernanceService.js', () => ({
  getToolRegistry: vi.fn().mockResolvedValue([]),
  getToolCatalog: vi.fn().mockResolvedValue([]),
  getTool: vi.fn().mockResolvedValue({ toolId: 'tool-1' }),
  getEffectivePolicy: vi.fn().mockResolvedValue({ policy: {} }),
  getToolPolicy: vi.fn().mockResolvedValue({ toolId: 'tool-1', policy: {} }),
}));

vi.mock('../../../services/v8/shadowModeService.js', () => ({
  getShadowStats: vi.fn().mockResolvedValue({ totalComparisons: 0 }),
  getRecentComparisons: vi.fn().mockResolvedValue([]),
  getShadowPromotionReadiness: vi.fn().mockResolvedValue({ ready: false, criteria: [] }),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({
    v8RequestCount: 0,
    v8ErrorCount: 0,
    v8TotalLatencyMs: 0,
  }),
}));

vi.mock('../../../middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    req.userId = 'smoke-user';
    req.organizationId = 'smoke-org';
    req.userRole = 'admin';
    req.user = { isSuperAdmin: true };
    next();
  };
  const requireSuperAdmin = (_req: any, _res: any, next: any) => next();
  return { verifyToken, requireSuperAdmin, default: verifyToken };
});

const mockDbAllOffline = vi.fn().mockResolvedValue([]);
const mockDbGetOffline = vi.fn().mockResolvedValue(null);
const mockDbRunOffline = vi.fn().mockResolvedValue({ changes: 0 });

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAllOffline(...args),
  get: (...args: unknown[]) => mockDbGetOffline(...args),
  run: (...args: unknown[]) => mockDbRunOffline(...args),
  default: {
    all: (...args: unknown[]) => mockDbAllOffline(...args),
    get: (...args: unknown[]) => mockDbGetOffline(...args),
    run: (...args: unknown[]) => mockDbRunOffline(...args),
  },
}));

import { v8FeatureGate } from '../../../middleware/v8FeatureGate.middleware.js';
import v8Router from '../../../routes/v8/index.js';

function createSmokeApp() {
  const app = express();
  app.use(express.json());
  process.env.ENABLE_V8_GLOBAL = 'true';
  app.use('/api/v8', v8FeatureGate, v8Router);
  return app;
}

describe('CP-29: Smoke Test Offline Validation — all V8 endpoints', () => {
  afterEach(() => {
    delete process.env.ENABLE_V8_GLOBAL;
  });

  const smokeTests: Array<{
    name: string;
    method: 'get' | 'post' | 'put';
    path: string;
    expectedStatus: number;
    body?: Record<string, unknown>;
  }> = [
    { name: 'Health', method: 'get', path: '/api/v8/health', expectedStatus: 200 },
    { name: 'Readiness', method: 'get', path: '/api/v8/health/readiness', expectedStatus: 200 },
    { name: 'Feature flags', method: 'get', path: '/api/v8/admin/flags', expectedStatus: 200 },
    { name: 'Admin health', method: 'get', path: '/api/v8/admin/health', expectedStatus: 200 },
    { name: 'Admin metrics', method: 'get', path: '/api/v8/admin/metrics', expectedStatus: 200 },
    { name: 'Shadow stats', method: 'get', path: '/api/v8/admin/shadow/stats', expectedStatus: 200 },
    { name: 'Shadow comparisons', method: 'get', path: '/api/v8/admin/shadow/comparisons', expectedStatus: 200 },
    { name: 'Shadow promotion', method: 'get', path: '/api/v8/admin/shadow/promotion-readiness', expectedStatus: 200 },
    { name: 'AI Core environment', method: 'get', path: '/api/v8/ai-core/environment', expectedStatus: 200 },
    { name: 'AI Core tools', method: 'get', path: '/api/v8/ai-core/tools', expectedStatus: 200 },
    { name: 'Chat snapshots (no params)', method: 'get', path: '/api/v8/chat/snapshots', expectedStatus: 400 },
    { name: 'Chat snapshots (with conversationId)', method: 'get', path: '/api/v8/chat/snapshots?conversationId=test-conv', expectedStatus: 200 },
    { name: 'Chat handoffs (no params)', method: 'get', path: '/api/v8/chat/handoffs', expectedStatus: 400 },
    { name: 'Chat handoffs (with conversationId)', method: 'get', path: '/api/v8/chat/handoffs?conversationId=test-conv', expectedStatus: 200 },
    { name: 'Prompt OS runtime summary', method: 'get', path: '/api/v8/prompt-os/runtime/summary', expectedStatus: 200 },
    {
      name: 'My Work inbox canonical list',
      method: 'get',
      path: '/api/v8/my-work/inbox/canonical',
      expectedStatus: 200,
    },
    {
      name: 'My Work inbox canonical stats',
      method: 'get',
      path: '/api/v8/my-work/inbox/canonical/stats',
      expectedStatus: 200,
    },
    {
      name: 'My Work inbox canonical materialize',
      method: 'post',
      path: '/api/v8/my-work/inbox/canonical/materialize',
      expectedStatus: 201,
    },
    { name: 'KB search', method: 'get', path: '/api/v8/kb/search?q=ab', expectedStatus: 200 },
    { name: 'KB context', method: 'get', path: '/api/v8/kb/context/chat', expectedStatus: 200 },
    { name: 'Results dashboard', method: 'get', path: '/api/v8/results/dashboard', expectedStatus: 200 },
    { name: 'Sync auth health', method: 'get', path: '/api/v8/sync/auth/health', expectedStatus: 200 },
    { name: 'Sync auth escalations', method: 'get', path: '/api/v8/sync/auth/escalations', expectedStatus: 200 },
    {
      name: 'Sync connector health',
      method: 'get',
      path: '/api/v8/sync/connectors/00000000-0000-4000-8000-000000000030/health',
      expectedStatus: 200,
    },
    { name: 'Sync conflicts', method: 'get', path: '/api/v8/sync/conflicts?limit=50', expectedStatus: 200 },
  ];

  for (const test of smokeTests) {
    it(`${test.method.toUpperCase()} ${test.path} → ${test.expectedStatus} (${test.name})`, async () => {
      const app = createSmokeApp();
      let req = supertest(app)[test.method](test.path)
        .set('Authorization', 'Bearer smoke-token');

      if (test.body) {
        req = req.send(test.body);
      }

      const res = await req;
      expect(res.status).toBe(test.expectedStatus);
    });
  }

  it('all successful smoke tests produce JSON responses', async () => {
    const app = createSmokeApp();
    for (const test of smokeTests) {
      const res = await supertest(app)[test.method](test.path)
        .set('Authorization', 'Bearer smoke-token');
      if (res.status < 500) {
        expect(res.headers['content-type']).toMatch(/json/);
      }
    }
  });

  it('smoke test summary: all endpoints respond', async () => {
    const app = createSmokeApp();
    const results: Array<{ name: string; status: number; passed: boolean }> = [];

    for (const test of smokeTests) {
      const res = await supertest(app)[test.method](test.path)
        .set('Authorization', 'Bearer smoke-token');
      results.push({
        name: test.name,
        status: res.status,
        passed: res.status === test.expectedStatus,
      });
    }

    const passed = results.filter((r) => r.passed).length;
    expect(passed).toBe(results.length);
  });
});
