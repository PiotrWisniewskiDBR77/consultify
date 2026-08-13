import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// SERVICE MOCKS
// ==========================================

const mockGetSnapshotsByConversation = vi.fn();
const mockGetSnapshotsByRun = vi.fn();
const mockGetSnapshot = vi.fn();
const mockCaptureSnapshot = vi.fn();

const mockGetHandoffsByConversation = vi.fn();
const mockInitiateHandoff = vi.fn();

const mockCaptureForChat = vi.fn();
const mockCaptureForExecution = vi.fn();
const mockCaptureForRetrieval = vi.fn();

vi.mock('../../../services/v8/contextSnapshotService.js', () => ({
  getSnapshotsByConversation: (...args: unknown[]) => mockGetSnapshotsByConversation(...args),
  getSnapshotsByRun: (...args: unknown[]) => mockGetSnapshotsByRun(...args),
  getSnapshot: (...args: unknown[]) => mockGetSnapshot(...args),
  captureSnapshot: (...args: unknown[]) => mockCaptureSnapshot(...args),
}));

vi.mock('../../../services/v8/chatExecutionService.js', () => ({
  getHandoffsByConversation: (...args: unknown[]) => mockGetHandoffsByConversation(...args),
  initiateHandoff: (...args: unknown[]) => mockInitiateHandoff(...args),
}));

vi.mock('../../../services/v8/contextConsumerBindingService.js', () => ({
  captureForChat: (...args: unknown[]) => mockCaptureForChat(...args),
  captureForExecution: (...args: unknown[]) => mockCaptureForExecution(...args),
  captureForRetrieval: (...args: unknown[]) => mockCaptureForRetrieval(...args),
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

// ==========================================
// AUTH MOCK
// ==========================================

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
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

import v8Router from '../../../routes/v8/index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

// ==========================================
// FIXTURES
// ==========================================

const MOCK_SNAPSHOT = {
  snapshotId: 'snap-1',
  organizationId: 'org-123',
  workspaceId: 'ws-1',
  conversationId: 'conv-1',
  capturedAt: '2026-03-23T00:00:00.000Z',
  snapshotVersion: 1,
  artifactRefs: [],
  effectiveScopeRef: 'default',
  resolvedRoleRef: 'user',
  initiatorUserId: 'user-1',
  consumerClass: 'chat',
  privacyMode: false,
  sourceContextRefs: [],
  driftEvents: [],
  parentSnapshotId: null,
  projectId: null,
  executionRunId: null,
};

const MOCK_HANDOFF = {
  handoffId: 'handoff-1',
  conversationId: 'conv-1',
  contextSnapshotId: 'snap-1',
  executionRunId: 'run-1',
  organizationId: 'org-123',
  initiatorUserId: 'user-1',
  intentClassification: { intentType: 'governed_work', confidence: 0.85 },
  goal: 'Create a report',
  createdAt: '2026-03-23T00:00:00.000Z',
};

// ==========================================
// TESTS
// ==========================================

describe('Chat Routes (/api/v8/chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ADMIN',
      organizationId: 'org-123',
      isSuperAdmin: false,
    };
  });

  // ------------------------------------------
  // SNAPSHOTS
  // ------------------------------------------

  describe('GET /chat/snapshots', () => {
    it('returns snapshots by conversationId', async () => {
      mockGetSnapshotsByConversation.mockResolvedValue([MOCK_SNAPSHOT]);
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots?conversationId=conv-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].snapshotId).toBe('snap-1');
      expect(res.body.meta.version).toBe('v8');
      expect(mockGetSnapshotsByConversation).toHaveBeenCalledWith('conv-1', 'org-123');
    });

    it('returns snapshots by runId', async () => {
      mockGetSnapshotsByRun.mockResolvedValue([MOCK_SNAPSHOT]);
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots?runId=run-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockGetSnapshotsByRun).toHaveBeenCalledWith('run-1', 'org-123');
    });

    it('returns 400 when no query param provided', async () => {
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });

    it('enforces org isolation — passes orgId from auth context', async () => {
      mockGetSnapshotsByConversation.mockResolvedValue([]);
      const app = createApp();

      await request(app).get('/api/v8/chat/snapshots?conversationId=conv-1');

      expect(mockGetSnapshotsByConversation).toHaveBeenCalledWith('conv-1', 'org-123');
    });
  });

  describe('GET /chat/snapshots/:snapshotId', () => {
    it('returns a specific snapshot', async () => {
      mockGetSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots/snap-1');

      expect(res.status).toBe(200);
      expect(res.body.data.snapshotId).toBe('snap-1');
      expect(mockGetSnapshot).toHaveBeenCalledWith('snap-1', 'org-123');
    });

    it('returns 404 when snapshot not found', async () => {
      mockGetSnapshot.mockResolvedValue(null);
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SNAPSHOT_NOT_FOUND');
    });
  });

  describe('POST /chat/snapshots', () => {
    it('creates a snapshot and returns 201', async () => {
      mockCaptureSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/snapshots').send({
        workspaceId: 'ws-1',
        artifactRefs: [],
        effectiveScopeRef: 'default',
        resolvedRoleRef: 'user',
        initiatorUserId: 'user-1',
        consumerClass: 'chat',
        sourceContextRefs: [],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.snapshotId).toBe('snap-1');
      expect(res.body.meta.version).toBe('v8');
    });

    it('overrides organizationId from auth context', async () => {
      mockCaptureSnapshot.mockResolvedValue(MOCK_SNAPSHOT);
      const app = createApp();

      await request(app).post('/api/v8/chat/snapshots').send({
        organizationId: 'attacker-org',
        workspaceId: 'ws-1',
        artifactRefs: [],
        effectiveScopeRef: 'default',
        resolvedRoleRef: 'user',
        initiatorUserId: 'user-1',
        consumerClass: 'chat',
        sourceContextRefs: [],
      });

      expect(mockCaptureSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-123' })
      );
    });

    it('returns 400 on validation error', async () => {
      const { ZodError } = await import('zod');
      mockCaptureSnapshot.mockRejectedValue(
        new ZodError([
          {
            // zod v4 dropped `received` from invalid_type issues; the assertion
            // below only reads the mapped VALIDATION_ERROR code.
            code: 'invalid_type',
            expected: 'string',
            path: ['workspaceId'],
            message: 'Required',
          },
        ])
      );
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/snapshots').send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ------------------------------------------
  // HANDOFFS
  // ------------------------------------------

  describe('GET /chat/handoffs', () => {
    it('returns handoffs for a conversation', async () => {
      mockGetHandoffsByConversation.mockResolvedValue([MOCK_HANDOFF]);
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/handoffs?conversationId=conv-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].handoffId).toBe('handoff-1');
      expect(mockGetHandoffsByConversation).toHaveBeenCalledWith('conv-1', 'org-123');
    });

    it('returns 400 when conversationId is missing', async () => {
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/handoffs');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY_PARAM');
    });
  });

  describe('POST /chat/handoffs', () => {
    it('creates a handoff and returns 201', async () => {
      mockInitiateHandoff.mockResolvedValue(MOCK_HANDOFF);
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/handoffs').send({
        conversationId: 'conv-1',
        contextSnapshotId: 'snap-1',
        goal: 'Create a report',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.handoffId).toBe('handoff-1');
      expect(mockInitiateHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          userId: 'user-1',
        })
      );
    });

    it('returns 404 when snapshot not found', async () => {
      mockInitiateHandoff.mockRejectedValue(
        new Error('ContextSnapshot snap-missing not found in organization org-123')
      );
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/handoffs').send({
        conversationId: 'conv-1',
        contextSnapshotId: 'snap-missing',
        goal: 'Create a report',
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // ------------------------------------------
  // CONSUMER BINDINGS
  // ------------------------------------------

  describe('POST /chat/bindings/chat', () => {
    it('captures a chat binding and returns 201', async () => {
      mockCaptureForChat.mockResolvedValue(MOCK_SNAPSHOT);
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/bindings/chat').send({
        conversationId: 'conv-1',
        workspaceId: 'ws-1',
        artifactRefs: [],
        effectiveScopeRef: 'default',
        resolvedRoleRef: 'user',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.snapshotId).toBe('snap-1');
      expect(mockCaptureForChat).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          initiatorUserId: 'user-1',
        })
      );
    });
  });

  describe('POST /chat/bindings/execution', () => {
    it('captures an execution binding and returns 201', async () => {
      mockCaptureForExecution.mockResolvedValue({ ...MOCK_SNAPSHOT, consumerClass: 'execution' });
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/bindings/execution').send({
        chatSnapshotId: 'snap-1',
        workspaceId: 'ws-1',
        artifactRefs: [],
        effectiveScopeRef: 'default',
        resolvedRoleRef: 'user',
        executionRunId: 'run-1',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.consumerClass).toBe('execution');
    });
  });

  describe('POST /chat/bindings/retrieval', () => {
    it('captures a retrieval binding and returns 201', async () => {
      mockCaptureForRetrieval.mockResolvedValue({ ...MOCK_SNAPSHOT, consumerClass: 'retrieval' });
      const app = createApp();

      const res = await request(app).post('/api/v8/chat/bindings/retrieval').send({
        activeSnapshotId: 'snap-1',
        workspaceId: 'ws-1',
        effectiveScopeRef: 'retrieval',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.consumerClass).toBe('retrieval');
    });
  });

  // ------------------------------------------
  // AUTH ENFORCEMENT
  // ------------------------------------------

  describe('authentication enforcement', () => {
    it('returns 401 when not authenticated', async () => {
      mockUser = null;
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots?conversationId=conv-1');

      expect(res.status).toBe(401);
    });

    it('returns 403 when org context is missing', async () => {
      mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'ADMIN',
        organizationId: undefined,
        isSuperAdmin: false,
      };
      const app = createApp();

      const res = await request(app).get('/api/v8/chat/snapshots?conversationId=conv-1');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('V8_MISSING_ORG_CONTEXT');
    });
  });
});
