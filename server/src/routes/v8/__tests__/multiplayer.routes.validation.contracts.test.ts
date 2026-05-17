import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import multiplayerRoutes, { V8_MULTIPLAYER_READ_CONTRACT } from '../multiplayer.routes.js';

const mockResolveRoomBinding = vi.fn();
const mockGetWorkspacePresence = vi.fn();
const mockGetPresenceBySurface = vi.fn();
const mockGetActiveLocks = vi.fn();

vi.mock('../../../services/v8/multiplayerHardeningService.js', () => ({
  getResourceTypeMapping: vi.fn(),
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

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, res, next) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.v8Context = {
      organizationId: mockUser.organizationId,
      userId: mockUser.id,
      userRole: mockUser.role,
      isSuperAdmin: mockUser.isSuperAdmin,
    };
    next();
  });
  app.use('/api/v8/multiplayer', multiplayerRoutes);
  return app;
}

describe('V8 Multiplayer validation contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-mp-v8',
      role: 'ADMIN',
      organizationId: 'org-mp-v8',
      isSuperAdmin: false,
    };
    mockResolveRoomBinding.mockResolvedValue({
      roomResourceType: 'whiteboard',
      roomResourceId: 'wb-1',
    });
    mockGetWorkspacePresence.mockResolvedValue([]);
    mockGetPresenceBySurface.mockResolvedValue([]);
    mockGetActiveLocks.mockResolvedValue([]);
  });

  it('returns coded 400 for missing roomId in room presence route', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/%20/presence')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_MISSING_ROOM_ID');
    expect(mockGetWorkspacePresence).not.toHaveBeenCalled();
  });

  it('returns coded 400 for missing roomId in room locks route', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/%20/locks')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_MISSING_ROOM_ID');
    expect(mockGetActiveLocks).not.toHaveBeenCalled();
  });

  it('returns coded 400 when by-surface query omits surface', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/room-a/presence/by-surface')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_INVALID_SURFACE');
    expect(mockGetPresenceBySurface).not.toHaveBeenCalled();
  });

  it('returns coded 400 when room-binding query omits resourceType', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/room-binding?resourceId=wb-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MULTIPLAYER_INVALID_RESOURCE_TYPE');
    expect(mockResolveRoomBinding).not.toHaveBeenCalled();
  });

  it('keeps stable contract metadata for successful room presence reads', async () => {
    const res = await request(createApp())
      .get('/api/v8/multiplayer/rooms/room-a/presence')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_MULTIPLAYER_READ_CONTRACT);
  });
});
