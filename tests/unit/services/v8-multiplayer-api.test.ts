import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8MultiplayerApi } from '@/services/api/v8/multiplayer';
import { v8Get } from '@/services/api/v8/client';

describe('V8MultiplayerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests the governed workspace resource mapping from the V8 multiplayer namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      mapping: {
        mappingId: 'mapping-1',
        resourceType: 'workspace',
        roomGranularity: 'resource',
        embeddedIn: null,
        surfaceAware: true,
        organizationId: 'org-1',
        createdAt: '2026-03-25T00:00:00Z',
      },
      resourceType: 'workspace',
    });

    const data = await V8MultiplayerApi.getWorkspaceMapping();

    expect(v8Get).toHaveBeenCalledWith('/multiplayer/resource-mappings/workspace');
    expect(data.mapping?.surfaceAware).toBe(true);
    expect(data.mapping?.roomGranularity).toBe('resource');
  });

  it('builds room-binding query with optional parent resource id', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      binding: {
        roomResourceType: 'whiteboard',
        roomResourceId: 'wb-1',
      },
      resourceType: 'whiteboard',
      resourceId: 'wb-1',
      parentResourceId: 'ws-parent',
    });

    await V8MultiplayerApi.getRoomBinding('whiteboard', 'wb-1', 'ws-parent');
    await V8MultiplayerApi.getRoomBinding('whiteboard', 'wb-1');

    expect(v8Get).toHaveBeenNthCalledWith(1, '/multiplayer/room-binding', {
      resourceType: 'whiteboard',
      resourceId: 'wb-1',
      parentResourceId: 'ws-parent',
    });
    expect(v8Get).toHaveBeenNthCalledWith(2, '/multiplayer/room-binding', {
      resourceType: 'whiteboard',
      resourceId: 'wb-1',
    });
  });

  it('encodes room id in room presence and lock paths', async () => {
    vi.mocked(v8Get).mockResolvedValue({ roomId: 'room/with space', presence: [], locks: [], count: 0 });

    await V8MultiplayerApi.getRoomPresence('room/with space');
    await V8MultiplayerApi.getRoomLocks('room/with space');

    expect(v8Get).toHaveBeenNthCalledWith(1, '/multiplayer/rooms/room%2Fwith%20space/presence');
    expect(v8Get).toHaveBeenNthCalledWith(2, '/multiplayer/rooms/room%2Fwith%20space/locks');
  });
});
