import { v8Get } from './client';

export interface V8MultiplayerResourceMapping {
  mappingId: string;
  resourceType: string;
  roomGranularity: string;
  embeddedIn: string | null;
  surfaceAware: boolean;
  organizationId: string;
  createdAt: string;
}

export interface V8MultiplayerRoomBinding {
  roomResourceType: string;
  roomResourceId: string;
}

export interface V8MultiplayerSurfacePresence {
  surfacePresenceId: string;
  userId: string;
  roomId: string;
  activeSurface: string;
  presenceType: string;
  cursorState: Record<string, unknown> | null;
  lastHeartbeat: string;
  organizationId: string;
}

export interface V8MultiplayerLockRecord {
  lockId: string;
  organizationId: string;
  lockType: string;
  lockScope: string;
  holderId: string;
  holderClientId: string;
  roomId: string;
  ttl: number;
  acquiredAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
}

export const V8MultiplayerApi = {
  getWorkspaceMapping: () =>
    v8Get<{ mapping: V8MultiplayerResourceMapping | null; resourceType: string }>(
      '/multiplayer/resource-mappings/workspace',
    ),

  getRoomBinding: (resourceType: string, resourceId: string, parentResourceId?: string) =>
    v8Get<{
      binding: V8MultiplayerRoomBinding;
      resourceType: string;
      resourceId: string;
      parentResourceId: string | null;
    }>('/multiplayer/room-binding', {
      resourceType,
      resourceId,
      ...(parentResourceId ? { parentResourceId } : {}),
    }),

  getRoomPresence: (roomId: string) =>
    v8Get<{ roomId: string; presence: V8MultiplayerSurfacePresence[]; count: number }>(
      `/multiplayer/rooms/${encodeURIComponent(roomId)}/presence`,
    ),

  getRoomLocks: (roomId: string) =>
    v8Get<{ roomId: string; locks: V8MultiplayerLockRecord[]; count: number }>(
      `/multiplayer/rooms/${encodeURIComponent(roomId)}/locks`,
    ),
};
