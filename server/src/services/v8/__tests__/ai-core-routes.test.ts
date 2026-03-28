import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOperatingEnvironmentStatus = vi.fn();
const mockProcessChatTurn = vi.fn();
const mockGetSupportTracesByRun = vi.fn();
const mockGetProvenanceByOutput = vi.fn();
const mockBuildProvenanceLedger = vi.fn();
const mockGetToolCatalog = vi.fn();
const mockGetTool = vi.fn();
const mockGetEffectivePolicy = vi.fn();

vi.mock('../../../services/v8/aiOperatingEnvironmentService.js', () => ({
  getOperatingEnvironmentStatus: (...a: unknown[]) => mockGetOperatingEnvironmentStatus(...a),
  processChatTurn: (...a: unknown[]) => mockProcessChatTurn(...a),
}));

vi.mock('../../../services/v8/trustAuditService.js', () => ({
  getSupportTracesByRun: (...a: unknown[]) => mockGetSupportTracesByRun(...a),
  getProvenanceByOutput: (...a: unknown[]) => mockGetProvenanceByOutput(...a),
  buildProvenanceLedger: (...a: unknown[]) => mockBuildProvenanceLedger(...a),
  getHealthSignals: vi.fn().mockResolvedValue([]),
  getActiveDegradedConditions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/v8/toolGovernanceService.js', () => ({
  getToolCatalog: (...a: unknown[]) => mockGetToolCatalog(...a),
  getTool: (...a: unknown[]) => mockGetTool(...a),
  getEffectivePolicy: (...a: unknown[]) => mockGetEffectivePolicy(...a),
}));

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: vi.fn().mockResolvedValue({ overall: 'healthy', domains: {} }),
  getDomainReadiness: vi.fn().mockResolvedValue({ domains: [] }),
  getCrossDomainIntegrity: vi.fn().mockResolvedValue({}),
  getPlatformMetrics: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn(),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../services/v8/platformHealthService.js', () => ({
  getPlatformHealth: vi.fn().mockResolvedValue({ overall: 'healthy', domains: {} }),
  getDomainReadiness: vi.fn().mockResolvedValue({ domains: [] }),
  getCrossDomainIntegrity: vi.fn().mockResolvedValue({}),
  getPlatformMetrics: vi.fn().mockResolvedValue({}),
  getModuleHealth: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

let mockUser: any = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    if (!mockUser) {
      _res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (!mockUser) {
      _res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

import v8Router from '../../../routes/v8/index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = 'org-test-456';
const UID = 'user-test-2';

describe('AI Core Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: UID,
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN',
      organizationId: ORG,
      isSuperAdmin: false,
    };
  });

  describe('GET /ai-core/environment', () => {
    it('returns operating environment status', async () => {
      const status = {
        healthy: true,
        layers: {
          context: 'healthy',
          retrieval: 'healthy',
          execution: 'healthy',
          trust: 'healthy',
        },
      };
      mockGetOperatingEnvironmentStatus.mockResolvedValue(status);
      const res = await request(createApp()).get('/api/v8/ai-core/environment');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(status);
      expect(res.body.meta.version).toBe('v8');
      expect(mockGetOperatingEnvironmentStatus).toHaveBeenCalledWith(ORG);
    });
  });

  describe('POST /ai-core/chat-turn', () => {
    it('processes a chat turn', async () => {
      const result = {
        type: 'chat',
        snapshot: { snapshotId: 'snap-1' },
        intent: { intentType: 'conversational' },
      };
      mockProcessChatTurn.mockResolvedValue(result);
      const res = await request(createApp()).post('/api/v8/ai-core/chat-turn').send({
        conversationId: 'conv-1',
        workspaceId: 'ws-1',
        message: 'What is the status?',
        artifactRefs: [],
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(result);
      expect(mockProcessChatTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          organizationId: ORG,
          userId: UID,
          message: 'What is the status?',
        })
      );
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(createApp())
        .post('/api/v8/ai-core/chat-turn')
        .send({ conversationId: 'conv-1' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when message is missing', async () => {
      const res = await request(createApp())
        .post('/api/v8/ai-core/chat-turn')
        .send({ conversationId: 'conv-1', workspaceId: 'ws-1' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /ai-core/trust/audit-trail', () => {
    it('returns audit trail for a snapshotId', async () => {
      mockGetSupportTracesByRun.mockResolvedValue([{ traceId: 'trace-1' }]);
      mockGetProvenanceByOutput.mockResolvedValue([{ entryId: 'entry-1' }]);
      const res = await request(createApp()).get(
        '/api/v8/ai-core/trust/audit-trail?snapshotId=snap-1'
      );
      expect(res.status).toBe(200);
      expect(res.body.data.supportTraces).toEqual([{ traceId: 'trace-1' }]);
      expect(res.body.data.provenanceEntries).toEqual([{ entryId: 'entry-1' }]);
      expect(mockGetSupportTracesByRun).toHaveBeenCalledWith('snap-1', ORG);
      expect(mockGetProvenanceByOutput).toHaveBeenCalledWith('snap-1', ORG);
    });

    it('returns 400 when snapshotId is missing', async () => {
      const res = await request(createApp()).get('/api/v8/ai-core/trust/audit-trail');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });
  });

  describe('GET /ai-core/trust/provenance', () => {
    it('returns provenance ledger', async () => {
      const ledger = { entries: [], explanation: null, supportTrace: null };
      mockBuildProvenanceLedger.mockResolvedValue(ledger);
      const res = await request(createApp()).get(
        '/api/v8/ai-core/trust/provenance?snapshotId=snap-1'
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(ledger);
      expect(mockBuildProvenanceLedger).toHaveBeenCalledWith('snap-1', ORG);
    });

    it('returns 400 when snapshotId is missing', async () => {
      const res = await request(createApp()).get('/api/v8/ai-core/trust/provenance');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });
  });

  describe('GET /ai-core/tools', () => {
    it('returns the tool catalog', async () => {
      const tools = [{ toolId: 'tool-1', name: 'Report Generator' }];
      mockGetToolCatalog.mockResolvedValue(tools);
      const res = await request(createApp()).get('/api/v8/ai-core/tools');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(tools);
      expect(mockGetToolCatalog).toHaveBeenCalledWith(ORG);
    });
  });

  describe('GET /ai-core/tools/:toolId/policy', () => {
    it('returns tool with effective policy', async () => {
      const tool = { toolId: 'tool-1', name: 'Report Generator' };
      const policy = { state: 'allowed', approvalClass: 'auto_executable' };
      mockGetTool.mockResolvedValue(tool);
      mockGetEffectivePolicy.mockResolvedValue(policy);
      const res = await request(createApp()).get(
        '/api/v8/ai-core/tools/tool-1/policy?consumerClass=chat'
      );
      expect(res.status).toBe(200);
      expect(res.body.data.tool).toEqual(tool);
      expect(res.body.data.effectivePolicy).toEqual(policy);
      expect(mockGetTool).toHaveBeenCalledWith('tool-1', ORG);
      expect(mockGetEffectivePolicy).toHaveBeenCalledWith('tool-1', 'chat', ORG, null);
    });

    it('returns 404 when tool not found', async () => {
      mockGetTool.mockResolvedValue(null);
      const res = await request(createApp()).get('/api/v8/ai-core/tools/nonexistent/policy');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('TOOL_NOT_FOUND');
    });

    it('defaults consumerClass to chat', async () => {
      mockGetTool.mockResolvedValue({ toolId: 'tool-1' });
      mockGetEffectivePolicy.mockResolvedValue({ state: 'allowed' });
      await request(createApp()).get('/api/v8/ai-core/tools/tool-1/policy');
      expect(mockGetEffectivePolicy).toHaveBeenCalledWith('tool-1', 'chat', ORG, null);
    });
  });

  describe('organization isolation', () => {
    it('passes authenticated org to services', async () => {
      mockGetToolCatalog.mockResolvedValue([]);
      await request(createApp()).get('/api/v8/ai-core/tools');
      expect(mockGetToolCatalog).toHaveBeenCalledWith(ORG);
    });

    it('returns 401 for unauthenticated requests', async () => {
      mockUser = null;
      const res = await request(createApp()).get('/api/v8/ai-core/environment');
      expect(res.status).toBe(401);
    });

    it('returns 403 when org context is missing', async () => {
      mockUser = {
        id: UID,
        email: 'test@example.com',
        name: 'Test',
        role: 'ADMIN',
        organizationId: undefined,
        isSuperAdmin: false,
      };
      const res = await request(createApp()).get('/api/v8/ai-core/environment');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('V8_MISSING_ORG_CONTEXT');
    });
  });
});
