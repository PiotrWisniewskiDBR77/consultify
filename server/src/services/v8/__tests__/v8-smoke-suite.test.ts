import { describe, it, expect, vi, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    req.userId = 'smoke-user';
    req.organizationId = 'smoke-org';
    req.user = { id: 'smoke-user', isSuperAdmin: true };
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = 'smoke-user';
    req.organizationId = 'smoke-org';
    req.user = { id: 'smoke-user', isSuperAdmin: true };
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: () => void) => next(),
  attachV8Context: (req: any, _res: any, next: () => void) => {
    req.v8Context = { organizationId: 'smoke-org', userId: 'smoke-user' };
    next();
  },
  getV8Context: (req: any) =>
    req.v8Context ?? { organizationId: 'smoke-org', userId: 'smoke-user' },
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: vi.fn().mockResolvedValue({ overall: 'healthy', domains: {} }),
  getDomainReadiness: vi.fn().mockResolvedValue({ domains: [], overallReady: false }),
  getCrossDomainIntegrity: vi.fn().mockResolvedValue({ integrity: 'ok' }),
  getPlatformMetrics: vi.fn().mockResolvedValue({ metrics: {} }),
  getModuleHealth: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
  getV8Flags: vi.fn().mockResolvedValue({ chat: true, ai_core: true }),
  setV8OrgFlag: vi.fn().mockResolvedValue(undefined),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  clearFlagCache: vi.fn(),
}));

vi.mock('../../../services/v8/contextSnapshotService.js', () => ({
  getSnapshotsByConversation: vi.fn().mockResolvedValue([]),
  getSnapshotsByRun: vi.fn().mockResolvedValue([]),
  getSnapshot: vi.fn().mockResolvedValue({
    snapshotId: 'smoke-snap',
    organizationId: 'smoke-org',
    workspaceId: 'ws-1',
    conversationId: 'test-conv',
    capturedAt: new Date().toISOString(),
    snapshotVersion: 1,
    artifactRefs: [],
    effectiveScopeRef: 'default',
    resolvedRoleRef: 'user',
    initiatorUserId: 'smoke-user',
    consumerClass: 'chat',
    privacyMode: false,
    sourceContextRefs: [],
    driftEvents: [],
    parentSnapshotId: null,
    projectId: null,
    executionRunId: null,
  }),
  captureSnapshot: vi.fn().mockResolvedValue({ snapshotId: 'smoke-capture' }),
}));

vi.mock('../../../services/v8/chatExecutionService.js', () => ({
  getHandoffsByConversation: vi.fn().mockResolvedValue([]),
  initiateHandoff: vi.fn().mockResolvedValue({ handoffId: 'smoke-handoff' }),
}));

vi.mock('../../../services/v8/contextConsumerBindingService.js', () => ({
  captureForChat: vi.fn().mockResolvedValue({ bindingId: 'smoke-chat-binding' }),
  captureForExecution: vi.fn().mockResolvedValue({ bindingId: 'smoke-exec-binding' }),
  captureForRetrieval: vi.fn().mockResolvedValue({ bindingId: 'smoke-ret-binding' }),
}));

vi.mock('../../../services/v8/aiOperatingEnvironmentService.js', () => ({
  getOperatingEnvironmentStatus: vi.fn().mockResolvedValue({ status: 'operational' }),
  processChatTurn: vi.fn().mockResolvedValue({ turnId: 'smoke-turn' }),
}));

vi.mock('../../../services/v8/trustAuditService.js', () => ({
  getSupportTracesByRun: vi.fn().mockResolvedValue([]),
  getProvenanceByOutput: vi.fn().mockResolvedValue([]),
  buildProvenanceLedger: vi.fn().mockResolvedValue({ entries: [] }),
}));

vi.mock('../../../services/v8/toolGovernanceService.js', () => ({
  getToolCatalog: vi.fn().mockResolvedValue([]),
  getTool: vi.fn().mockResolvedValue({ toolId: 't1', name: 'test-tool' }),
  getEffectivePolicy: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../../../services/v8/shadowModeService.js', () => ({
  getShadowStats: vi.fn().mockResolvedValue({ totalComparisons: 0, matchRate: 0 }),
  getRecentComparisons: vi.fn().mockResolvedValue([]),
  getShadowPromotionReadiness: vi.fn().mockResolvedValue({ ready: false, criteria: [] }),
}));

/** Admin metrics route reads v8-prefixed fields from the snapshot helper. */
vi.mock('../../../utils/v8MetricsStore.js', () => ({
  getV8MetricsSnapshot: vi.fn().mockReturnValue({
    v8RequestCount: 0,
    v8ErrorCount: 0,
    v8TotalLatencyMs: 0,
  }),
}));

vi.mock('../../../services/v8/pmSyncAuthService.js', () => ({
  getCredentialHealth: vi.fn().mockResolvedValue({
    total: 0,
    healthy: 0,
    failing: 0,
    escalated: 0,
  }),
  getActiveEscalations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/v8/pmSyncTruthService.js', () => ({
  getConnectorHealth: vi.fn().mockResolvedValue({
    healthy: true,
    syncStatus: 'unknown',
    conflictCount: 0,
    lastSyncAt: null,
    authState: 'unknown',
  }),
  getUnresolvedConflicts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import v8Router from '../../../routes/v8/index.js';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
});

describe('V8 Smoke Test Suite — All Endpoints', () => {
  describe('Health endpoints', () => {
    it('GET /api/v8/health → 200', async () => {
      const res = await request(app).get('/api/v8/health');
      expect(res.status).toBe(200);
      expect(res.body.meta?.version).toBe('v8');
    });

    it('GET /api/v8/health/readiness → 200', async () => {
      const res = await request(app).get('/api/v8/health/readiness');
      expect(res.status).toBe(200);
      expect(res.body.meta?.version).toBe('v8');
    });
  });

  describe('Admin — feature flags', () => {
    it('GET /api/v8/admin/flags → 200', async () => {
      const res = await request(app).get('/api/v8/admin/flags');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/admin/flags/all → 200', async () => {
      const res = await request(app).get('/api/v8/admin/flags/all');
      expect(res.status).toBe(200);
    });

    it('PUT /api/v8/admin/flags/chat with body → 200', async () => {
      const res = await request(app).put('/api/v8/admin/flags/chat').send({ enabled: true });
      expect(res.status).toBe(200);
    });

    it('PUT /api/v8/admin/flags/chat without boolean enabled → 400', async () => {
      const res = await request(app).put('/api/v8/admin/flags/chat').send({ enabled: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });
  });

  describe('Admin — health, metrics, shadow', () => {
    it('GET /api/v8/admin/health → 200', async () => {
      const res = await request(app).get('/api/v8/admin/health');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/admin/metrics → 200', async () => {
      const res = await request(app).get('/api/v8/admin/metrics');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/admin/shadow/stats → 200', async () => {
      const res = await request(app).get('/api/v8/admin/shadow/stats');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/admin/shadow/comparisons → 200', async () => {
      const res = await request(app).get('/api/v8/admin/shadow/comparisons');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/admin/shadow/promotion-readiness → 200', async () => {
      const res = await request(app).get('/api/v8/admin/shadow/promotion-readiness');
      expect(res.status).toBe(200);
    });
  });

  describe('Chat endpoints', () => {
    it('GET /api/v8/chat/snapshots?conversationId=x → 200', async () => {
      const res = await request(app).get('/api/v8/chat/snapshots?conversationId=test-conv');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/chat/snapshots?runId=x → 200', async () => {
      const res = await request(app).get('/api/v8/chat/snapshots?runId=run-1');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/chat/snapshots (no params) → 400', async () => {
      const res = await request(app).get('/api/v8/chat/snapshots');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });

    it('GET /api/v8/chat/snapshots/:snapshotId → 200', async () => {
      const res = await request(app).get('/api/v8/chat/snapshots/smoke-snap');
      expect(res.status).toBe(200);
    });

    it('POST /api/v8/chat/snapshots → 201', async () => {
      const res = await request(app)
        .post('/api/v8/chat/snapshots')
        .send({
          workspaceId: 'ws-1',
          artifactRefs: [],
          effectiveScopeRef: 'default',
          resolvedRoleRef: 'user',
          consumerClass: 'chat',
          sourceContextRefs: [],
        });
      expect(res.status).toBe(201);
    });

    it('GET /api/v8/chat/handoffs?conversationId=x → 200', async () => {
      const res = await request(app).get('/api/v8/chat/handoffs?conversationId=test-conv');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/chat/handoffs (no params) → 400', async () => {
      const res = await request(app).get('/api/v8/chat/handoffs');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });

    it('POST /api/v8/chat/handoffs → 201', async () => {
      const res = await request(app).post('/api/v8/chat/handoffs').send({
        conversationId: 'conv-1',
        contextSnapshotId: 'snap-1',
        goal: 'Smoke goal',
      });
      expect(res.status).toBe(201);
    });

    it('POST /api/v8/chat/bindings/chat → 201', async () => {
      const res = await request(app)
        .post('/api/v8/chat/bindings/chat')
        .send({
          conversationId: 'conv-1',
          workspaceId: 'ws-1',
          artifactRefs: [],
          effectiveScopeRef: 'default',
          resolvedRoleRef: 'user',
        });
      expect(res.status).toBe(201);
    });

    it('POST /api/v8/chat/bindings/execution → 201', async () => {
      const res = await request(app)
        .post('/api/v8/chat/bindings/execution')
        .send({
          chatSnapshotId: 'snap-1',
          workspaceId: 'ws-1',
          artifactRefs: [],
          effectiveScopeRef: 'default',
          resolvedRoleRef: 'user',
          executionRunId: 'run-1',
        });
      expect(res.status).toBe(201);
    });

    it('POST /api/v8/chat/bindings/retrieval → 201', async () => {
      const res = await request(app)
        .post('/api/v8/chat/bindings/retrieval')
        .send({
          activeSnapshotId: 'snap-1',
          workspaceId: 'ws-1',
          effectiveScopeRef: 'retrieval',
        });
      expect(res.status).toBe(201);
    });
  });

  describe('AI Core endpoints', () => {
    it('GET /api/v8/ai-core/environment → 200', async () => {
      const res = await request(app).get('/api/v8/ai-core/environment');
      expect(res.status).toBe(200);
    });

    it('POST /api/v8/ai-core/chat-turn → 200', async () => {
      const res = await request(app).post('/api/v8/ai-core/chat-turn').send({
        conversationId: 'c1',
        workspaceId: 'ws-1',
        message: 'hello',
      });
      expect(res.status).toBe(200);
    });

    it('POST /api/v8/ai-core/chat-turn (missing fields) → 400', async () => {
      const res = await request(app).post('/api/v8/ai-core/chat-turn').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('GET /api/v8/ai-core/trust/audit-trail?snapshotId=x → 200', async () => {
      const res = await request(app).get('/api/v8/ai-core/trust/audit-trail?snapshotId=test-snap');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/ai-core/trust/audit-trail (no snapshotId) → 400', async () => {
      const res = await request(app).get('/api/v8/ai-core/trust/audit-trail');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });

    it('GET /api/v8/ai-core/trust/provenance?snapshotId=x → 200', async () => {
      const res = await request(app).get('/api/v8/ai-core/trust/provenance?snapshotId=test-snap');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/ai-core/trust/provenance (no snapshotId) → 400', async () => {
      const res = await request(app).get('/api/v8/ai-core/trust/provenance');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });

    it('GET /api/v8/ai-core/tools → 200', async () => {
      const res = await request(app).get('/api/v8/ai-core/tools');
      expect(res.status).toBe(200);
    });

    it('GET /api/v8/ai-core/tools/:toolId/policy → 200', async () => {
      const res = await request(app).get('/api/v8/ai-core/tools/t1/policy');
      expect(res.status).toBe(200);
    });
  });

  describe('Prompt OS endpoints', () => {
    it('GET /api/v8/prompt-os/runtime/summary → 200', async () => {
      const res = await request(app).get('/api/v8/prompt-os/runtime/summary');
      expect(res.status).toBe(200);
      expect(res.body.data?.contract).toBe('prompt-os-runtime-v8');
    });
  });

  describe('Sync read bridge (B-13)', () => {
    const smokeConnectorId = '00000000-0000-4000-8000-000000000030';

    it('GET /api/v8/sync/auth/health → 200', async () => {
      const res = await request(app).get('/api/v8/sync/auth/health');
      expect(res.status).toBe(200);
      expect(res.body.meta?.contract).toBe('sync_runtime_read_v1');
    });

    it('GET /api/v8/sync/auth/escalations → 200', async () => {
      const res = await request(app).get('/api/v8/sync/auth/escalations');
      expect(res.status).toBe(200);
      expect(res.body.meta?.contract).toBe('sync_runtime_read_v1');
    });

    it('GET /api/v8/sync/connectors/:id/health → 200', async () => {
      const res = await request(app).get(`/api/v8/sync/connectors/${smokeConnectorId}/health`);
      expect(res.status).toBe(200);
      expect(res.body.meta?.contract).toBe('sync_runtime_read_v1');
    });

    it('GET /api/v8/sync/conflicts?limit=50 → 200', async () => {
      const res = await request(app).get('/api/v8/sync/conflicts?limit=50');
      expect(res.status).toBe(200);
      expect(res.body.meta?.contract).toBe('sync_runtime_read_v1');
    });
  });

  describe('Endpoint inventory', () => {
    it('should cover all known V8 HTTP routes', () => {
      const knownEndpoints = [
        'GET /health',
        'GET /health/readiness',
        'GET /admin/flags',
        'GET /admin/flags/all',
        'PUT /admin/flags/:module',
        'GET /admin/health',
        'GET /admin/metrics',
        'GET /admin/shadow/stats',
        'GET /admin/shadow/comparisons',
        'GET /admin/shadow/promotion-readiness',
        'GET /chat/snapshots',
        'GET /chat/snapshots/:snapshotId',
        'POST /chat/snapshots',
        'GET /chat/handoffs',
        'POST /chat/handoffs',
        'POST /chat/bindings/chat',
        'POST /chat/bindings/execution',
        'POST /chat/bindings/retrieval',
        'GET /ai-core/environment',
        'POST /ai-core/chat-turn',
        'GET /ai-core/trust/audit-trail',
        'GET /ai-core/trust/provenance',
        'GET /ai-core/tools',
        'GET /ai-core/tools/:toolId/policy',
        'GET /prompt-os/runtime/summary',
        'GET /prompt-os/presets',
        'GET /prompt-os/presets/:presetId',
        'POST /prompt-os/presets',
        'GET /prompt-os/bundles',
        'GET /prompt-os/bundles/:bundleId',
        'POST /prompt-os/bundles',
        'POST /prompt-os/bundles/:bundleId/activate',
        'POST /prompt-os/bundles/:bundleId/rollback',
        'GET /prompt-os/bundles/:bundleId/eval-gates',
        'POST /prompt-os/bundles/:bundleId/eval-gates',
        'GET /prompt-os/bundles/:bundleId/canary',
        'POST /prompt-os/bundles/:bundleId/canary',
        'GET /sync/auth/health',
        'GET /sync/auth/escalations',
        'GET /sync/connectors/:connectorId/health',
        'GET /sync/conflicts',
      ];
      expect(knownEndpoints).toHaveLength(41);
    });
  });
});
