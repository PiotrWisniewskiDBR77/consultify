import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_MULTIPLAYER_READ_CONTRACT } from '../multiplayer.routes.js';

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockGetResourceTypeMapping = vi.fn();
const mockResolveRoomBinding = vi.fn();
const mockGetWorkspacePresence = vi.fn();
const mockGetPresenceBySurface = vi.fn();
const mockGetActiveLocks = vi.fn();

vi.mock('../../../services/v8/multiplayerHardeningService.js', () => ({
  getResourceTypeMapping: (...a: unknown[]) => mockGetResourceTypeMapping(...a),
  resolveRoomBinding: (...a: unknown[]) => mockResolveRoomBinding(...a),
  getWorkspacePresence: (...a: unknown[]) => mockGetWorkspacePresence(...a),
  getPresenceBySurface: (...a: unknown[]) => mockGetPresenceBySurface(...a),
}));

vi.mock('../../../services/v8/concurrentEditingService.js', () => ({
  getActiveLocks: (...a: unknown[]) => mockGetActiveLocks(...a),
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
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
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = 'org-mp-v8';
const UID = 'user-mp-v8';

describe('V8 Multiplayer read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetResourceTypeMapping.mockResolvedValue(null);
    mockResolveRoomBinding.mockResolvedValue({ roomResourceType: 'whiteboard', roomResourceId: 'wb-1' });
    mockGetWorkspacePresence.mockResolvedValue([]);
    mockGetPresenceBySurface.mockResolvedValue([]);
    mockGetActiveLocks.mockResolvedValue([]);
  });

  it('GET /api/v8/multiplayer/resource-mappings/:resourceType calls getResourceTypeMapping', async () => {
    mockGetResourceTypeMapping.mockResolvedValue({
      mappingId: 'm1',
      resourceType: 'whiteboard',
      roomGranularity: 'per_resource',
      embeddedIn: null,
      surfaceAware: true,
      organizationId: ORG,
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    const res = await request(createApp())
      .get('/api/v8/multiplayer/resource-mappings/whiteboard')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetResourceTypeMapping).toHaveBeenCalledWith('whiteboard', ORG);
    expect(res.body.data?.mapping?.mappingId).toBe('m1');
    expect(res.body.meta?.contract).toBe(V8_MULTIPLAYER_READ_CONTRACT);
    expect(res.body.meta?.readScope).toBe('persisted_database');
  });

  it('GET /api/v8/multiplayer/resource-mappings/:resourceType returns 400 for invalid type', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/resource-mappings/not-a-tool')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_INVALID_RESOURCE_TYPE');
    expect(mockGetResourceTypeMapping).not.toHaveBeenCalled();
  });

  it('GET /api/v8/multiplayer/room-binding delegates to resolveRoomBinding', async () => {
    mockResolveRoomBinding.mockResolvedValue({
      roomResourceType: 'workspace',
      roomResourceId: 'ws-parent',
    });

    const res = await request(createApp())
      .get('/api/v8/multiplayer/room-binding?resourceType=whiteboard&resourceId=wb-1&parentResourceId=ws-parent')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockResolveRoomBinding).toHaveBeenCalledWith('whiteboard', 'wb-1', ORG, 'ws-parent');
    expect(res.body.data?.binding).toEqual({
      roomResourceType: 'workspace',
      roomResourceId: 'ws-parent',
    });
    expect(res.body.meta?.contract).toBe(V8_MULTIPLAYER_READ_CONTRACT);
  });

  it('GET /api/v8/multiplayer/room-binding returns 400 without resourceId', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/room-binding?resourceType=whiteboard')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_MISSING_RESOURCE_ID');
    expect(mockResolveRoomBinding).not.toHaveBeenCalled();
  });

  it('GET /api/v8/multiplayer/rooms/:roomId/presence calls getWorkspacePresence', async () => {
    mockGetWorkspacePresence.mockResolvedValue([
      {
        surfacePresenceId: 'sp1',
        userId: 'u1',
        roomId: 'room-a',
        activeSurface: 'whiteboard',
        presenceType: 'active',
        cursorState: null,
        lastHeartbeat: '2025-01-01T00:00:00.000Z',
        organizationId: ORG,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/room-a/presence')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetWorkspacePresence).toHaveBeenCalledWith('room-a', ORG);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.meta?.contract).toBe(V8_MULTIPLAYER_READ_CONTRACT);
  });

  it('GET /api/v8/multiplayer/rooms/:roomId/presence/by-surface calls getPresenceBySurface', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/room-a/presence/by-surface?surface=whiteboard')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetPresenceBySurface).toHaveBeenCalledWith('room-a', 'whiteboard', ORG);
    expect(res.body.data?.surface).toBe('whiteboard');
  });

  it('GET /api/v8/multiplayer/rooms/:roomId/presence/by-surface returns 400 without valid surface', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/room-a/presence/by-surface?surface=invalid')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_INVALID_SURFACE');
    expect(mockGetPresenceBySurface).not.toHaveBeenCalled();
  });

  it('GET /api/v8/multiplayer/rooms/:roomId/locks calls getActiveLocks', async () => {
    mockGetActiveLocks.mockResolvedValue([
      {
        lockId: 'l1',
        organizationId: ORG,
        lockType: 'exclusive_document',
        lockScope: 'document',
        holderId: 'u1',
        holderClientId: 'c1',
        roomId: 'room-a',
        ttl: 60000,
        acquiredAt: '2025-01-01T00:00:00.000Z',
        releasedAt: null,
        releaseReason: null,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/room-a/locks')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetActiveLocks).toHaveBeenCalledWith('room-a', ORG);
    expect(res.body.data?.locks).toHaveLength(1);
    expect(res.body.meta?.readScope).toBe('persisted_database');
  });
});
