/**
 * F05 — Multiplayer room lifecycle flow integration test
 *
 * Flow: createRoom() → updateSurfacePresence() → startFacilitationSession() →
 *       acquireLock() → recordConflict() → createNotification() →
 *       verify room → presence → facilitation → lock → conflict → notification chain
 *
 * Services: collaborationRoomService, multiplayerHardeningService, concurrentEditingService
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createRoom } from '../../../collaborationRoomService.js';
import {
  acquireLock,
  createNotification,
  recordConflict,
} from '../../../concurrentEditingService.js';
import {
  startFacilitationSession,
  updateSurfacePresence,
} from '../../../multiplayerHardeningService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const RESOURCE_ID = '00000000-0000-4000-8000-000000000080';
const CLIENT_ID = 'client-tab-1';

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

describe('F05 — Multiplayer room lifecycle flow', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Create a collaboration room
    const room = await createRoom({
      resourceType: 'initiative',
      resourceId: RESOURCE_ID,
      organizationId: ORG_ID,
      metadata: { title: 'Q4 Planning Session' },
    });
    expect(room.roomId).toBeDefined();
    expect(room.resourceType).toBe('initiative');
    expect(room.resourceId).toBe(RESOURCE_ID);
    expect(room.roomState).toBe('active');
    expect(room.organizationId).toBe(ORG_ID);

    // Step 2: Update surface presence — user joins a specific surface
    mockDbGet.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('v8_surface_presence')) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const presence = await updateSurfacePresence({
      userId: USER_ID,
      roomId: room.roomId,
      activeSurface: 'table',
      presenceType: 'editor',
      organizationId: ORG_ID,
      cursorState: { column: 'In Progress', cardIndex: 2 },
    });
    expect(presence.surfacePresenceId).toBeDefined();
    expect(presence.roomId).toBe(room.roomId);
    expect(presence.userId).toBe(USER_ID);
    expect(presence.activeSurface).toBe('table');
    expect(presence.presenceType).toBe('editor');

    // Step 3: Start facilitation session in the room
    const facilitation = await startFacilitationSession({
      roomId: room.roomId,
      facilitatorUserId: USER_ID,
      organizationId: ORG_ID,
      initialPhase: 'brainstorming',
    });
    expect(facilitation.sessionId).toBeDefined();
    expect(facilitation.roomId).toBe(room.roomId);
    expect(facilitation.facilitatorUserId).toBe(USER_ID);
    expect(facilitation.sessionState).toBe('active');
    expect(facilitation.currentPhase).toBe('brainstorming');

    // Step 4: Acquire a lock on a resource scope within the room
    const lock = await acquireLock({
      organizationId: ORG_ID,
      lockType: 'advisory_object',
      lockScope: `initiative:${RESOURCE_ID}:budget`,
      holderId: USER_ID,
      holderClientId: CLIENT_ID,
      roomId: room.roomId,
      ttl: 30000,
    });
    expect(lock.lockId).toBeDefined();
    expect(lock.roomId).toBe(room.roomId);
    expect(lock.holderId).toBe(USER_ID);
    expect(lock.lockScope).toBe(`initiative:${RESOURCE_ID}:budget`);
    expect(lock.releasedAt).toBeNull();

    // Step 5: Record a conflict — two users editing same field
    const conflict = await recordConflict({
      organizationId: ORG_ID,
      conflictClass: 'concurrent_property_edit',
      resourceType: 'initiative',
      resourceId: RESOURCE_ID,
      roomId: room.roomId,
      affectedPath: 'budget.total',
      actorIds: [USER_ID, USER_ID_2],
      resolutionStrategy: 'review_first_gating',
      metadata: { fieldType: 'currency', originalValue: 100000, conflictingValue: 120000 },
    });
    expect(conflict.conflictId).toBeDefined();
    expect(conflict.roomId).toBe(room.roomId);
    expect(conflict.actorIds).toContain(USER_ID);
    expect(conflict.actorIds).toContain(USER_ID_2);
    expect(conflict.resolutionStatus).toBe('pending_user_action');

    // Step 6: Create notification about the conflict
    const notification = await createNotification({
      organizationId: ORG_ID,
      recipientId: USER_ID_2,
      eventRef: conflict.conflictId,
      channel: 'in_app_inbox',
      priority: 'high',
      title: 'Edit conflict on budget field',
      body: `Your edit to budget.total conflicts with ${USER_ID}'s change. Please resolve.`,
    });
    expect(notification.notificationId).toBeDefined();
    expect(notification.recipientId).toBe(USER_ID_2);
    expect(notification.eventRef).toBe(conflict.conflictId);
    expect(notification.state).toBe('unread');
    expect(notification.priority).toBe('high');

    // Verify the full chain: room → presence → facilitation → lock → conflict → notification
    expect(presence.roomId).toBe(room.roomId);
    expect(facilitation.roomId).toBe(room.roomId);
    expect(lock.roomId).toBe(room.roomId);
    expect(conflict.roomId).toBe(room.roomId);
    expect(notification.eventRef).toBe(conflict.conflictId);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // createRoom output has roomId needed by all downstream services
    const room = await createRoom({
      resourceType: 'report',
      resourceId: RESOURCE_ID,
      organizationId: ORG_ID,
      metadata: {},
    });
    expect(room).toHaveProperty('roomId');
    expect(room).toHaveProperty('resourceType');
    expect(room).toHaveProperty('roomState');
    expect(room).toHaveProperty('organizationId');
    expect(typeof room.roomId).toBe('string');
    expect(room.roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // updateSurfacePresence output has surfacePresenceId and roomId
    mockDbGet.mockResolvedValue(null);
    const surfacePresence = await updateSurfacePresence({
      userId: USER_ID,
      roomId: room.roomId,
      activeSurface: 'table',
      presenceType: 'viewer',
      organizationId: ORG_ID,
    });
    expect(surfacePresence).toHaveProperty('surfacePresenceId');
    expect(surfacePresence).toHaveProperty('roomId');
    expect(surfacePresence).toHaveProperty('activeSurface');
    expect(surfacePresence).toHaveProperty('presenceType');
    expect(surfacePresence.roomId).toBe(room.roomId);

    // startFacilitationSession output has sessionId and roomId
    const session = await startFacilitationSession({
      roomId: room.roomId,
      facilitatorUserId: USER_ID,
      organizationId: ORG_ID,
    });
    expect(session).toHaveProperty('sessionId');
    expect(session).toHaveProperty('roomId');
    expect(session).toHaveProperty('sessionState');
    expect(session).toHaveProperty('facilitatorUserId');
    expect(session.roomId).toBe(room.roomId);

    // acquireLock output has lockId, roomId, holderId
    const lock = await acquireLock({
      organizationId: ORG_ID,
      lockType: 'optimistic_section',
      lockScope: `report:${RESOURCE_ID}:section-1`,
      holderId: USER_ID,
      holderClientId: CLIENT_ID,
      roomId: room.roomId,
      ttl: 60000,
    });
    expect(lock).toHaveProperty('lockId');
    expect(lock).toHaveProperty('roomId');
    expect(lock).toHaveProperty('holderId');
    expect(lock).toHaveProperty('lockScope');
    expect(lock).toHaveProperty('ttl');
    expect(lock.roomId).toBe(room.roomId);

    // recordConflict output has conflictId needed by createNotification
    const conflict = await recordConflict({
      organizationId: ORG_ID,
      conflictClass: 'structural_conflict',
      resourceType: 'report',
      resourceId: RESOURCE_ID,
      roomId: room.roomId,
      affectedPath: 'section.summary',
      actorIds: [USER_ID, USER_ID_2],
      resolutionStrategy: 'crdt_auto_merge',
      metadata: {},
    });
    expect(conflict).toHaveProperty('conflictId');
    expect(conflict).toHaveProperty('conflictClass');
    expect(conflict).toHaveProperty('resolutionStatus');
    expect(conflict).toHaveProperty('roomId');
    expect(typeof conflict.conflictId).toBe('string');

    // createNotification output has notificationId and eventRef
    const notif = await createNotification({
      organizationId: ORG_ID,
      recipientId: USER_ID,
      eventRef: conflict.conflictId,
      channel: 'in_app_inbox',
      priority: 'low',
      title: 'Conflict auto-resolved',
    });
    expect(notif).toHaveProperty('notificationId');
    expect(notif).toHaveProperty('recipientId');
    expect(notif).toHaveProperty('eventRef');
    expect(notif).toHaveProperty('state');
    expect(notif.eventRef).toBe(conflict.conflictId);
  });
});
