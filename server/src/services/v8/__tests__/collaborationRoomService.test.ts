import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateRoomParams,
  RoomState,
} from '../../../types/collaborationRoom.js';
import {
  CollaborationRoomSchema,
  RoomPresenceSchema,
  RoomMembershipSchema,
  CollaborationEventSchema,
  CreateRoomParamsSchema,
  JoinRoomParamsSchema,
  RecordEventParamsSchema,
  VALID_ROOM_TRANSITIONS,
  TERMINAL_ROOM_STATES,
} from '../../../types/collaborationRoom.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  createRoom,
  getRoom,
  getRoomByResource,
  transitionRoomState,
  joinRoom,
  leaveRoom,
  updatePresence,
  getActivePresence,
  cleanStalePresence,
  recordEvent,
  getEventsByRoom,
} from '../collaborationRoomService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const ROOM_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const CLIENT_ID = 'tab-1';
const CLIENT_ID_2 = 'tab-2';

function makeRoomParams(overrides?: Partial<CreateRoomParams>): CreateRoomParams {
  return {
    resourceType: 'workspace',
    resourceId: 'ws-001',
    organizationId: ORG_ID,
    metadata: { source: 'test' },
    ...overrides,
  };
}

function makeFakeRoomRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    room_id: ROOM_ID,
    resource_type: 'workspace',
    resource_id: 'ws-001',
    organization_id: ORG_ID,
    room_state: 'active',
    created_at: '2026-03-23T10:00:00.000Z',
    closed_at: null,
    metadata: JSON.stringify({ source: 'test' }),
    ...overrides,
  };
}

function makeFakePresenceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    presence_id: '00000000-0000-4000-8000-pppppppppppp',
    room_id: ROOM_ID,
    user_id: USER_ID,
    presence_type: 'editor',
    cursor_state: null,
    last_heartbeat: '2026-03-23T10:00:00.000Z',
    connected_at: '2026-03-23T10:00:00.000Z',
    client_id: CLIENT_ID,
    is_stale: 0,
    ...overrides,
  };
}

function makeFakeEventRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    event_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    room_id: ROOM_ID,
    event_type: 'room.created',
    actor_id: 'system',
    actor_type: 'system',
    delivery: 'durable',
    payload: JSON.stringify({ resourceType: 'workspace' }),
    timestamp: '2026-03-23T10:00:00.000Z',
    state_version: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRoom', () => {
  it('creates a room in active state bound to a resource', async () => {
    const result = await createRoom(makeRoomParams());

    expect(result.roomId).toBeDefined();
    expect(result.roomState).toBe('active');
    expect(result.resourceType).toBe('workspace');
    expect(result.resourceId).toBe('ws-001');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.closedAt).toBeNull();
    expect(result.metadata).toEqual({ source: 'test' });

    // INSERT room + INSERT event (room.created)
    expect(mockDbRun).toHaveBeenCalledTimes(2);
    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_collaboration_rooms');
  });

  it('records a room.created event on creation', async () => {
    await createRoom(makeRoomParams());

    const eventSql = mockDbRun.mock.calls[1][0] as string;
    expect(eventSql).toContain('INSERT INTO v8_collaboration_events');
  });

  it('defaults metadata to empty object', async () => {
    const result = await createRoom(makeRoomParams({ metadata: undefined }));
    expect(result.metadata).toEqual({});
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(
      createRoom({ organizationId: ORG_ID } as any),
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      createRoom(makeRoomParams({ organizationId: 'not-a-uuid' })),
    ).rejects.toThrow(ZodError);
  });
});

describe('getRoom', () => {
  it('returns a room when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());

    const result = await getRoom(ROOM_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.roomId).toBe(ROOM_ID);
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.roomState).toBe('active');

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when room does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getRoom('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getRoom(ROOM_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('getRoomByResource', () => {
  it('finds the active room for a resource', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());

    const result = await getRoomByResource('workspace', 'ws-001', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.resourceType).toBe('workspace');
    expect(result!.resourceId).toBe('ws-001');

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain("room_state != 'closed'");
  });

  it('returns null when no active room exists for resource', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getRoomByResource('workspace', 'ws-999', ORG_ID);
    expect(result).toBeNull();
  });
});

describe('transitionRoomState', () => {
  it('transitions active → idle', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'active' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'idle', 'All users left');

    expect(result.roomState).toBe('idle');
    expect(result.closedAt).toBeNull();

    // UPDATE room + INSERT event
    expect(mockDbRun).toHaveBeenCalledTimes(2);
  });

  it('transitions idle → active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'idle' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'active');

    expect(result.roomState).toBe('active');
  });

  it('transitions active → closed and sets closedAt', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'active' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'closed', 'Session ended');

    expect(result.roomState).toBe('closed');
    expect(result.closedAt).not.toBeNull();
  });

  it('transitions active → error', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'active' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'error', 'Connection failure');

    expect(result.roomState).toBe('error');
  });

  it('transitions error → closed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'closed', 'Recovery complete');

    expect(result.roomState).toBe('closed');
    expect(result.closedAt).not.toBeNull();
  });

  it('transitions idle → closed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'idle' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'closed');

    expect(result.roomState).toBe('closed');
  });

  it('rejects invalid transition: closed → active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'closed' }));

    await expect(
      transitionRoomState(ROOM_ID, ORG_ID, 'active'),
    ).rejects.toThrow('Invalid room state transition: closed → active');
  });

  it('rejects invalid transition: idle → error', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'idle' }));

    await expect(
      transitionRoomState(ROOM_ID, ORG_ID, 'error'),
    ).rejects.toThrow('Invalid room state transition');
  });

  it('transitions error → active (recovery path)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));

    const result = await transitionRoomState(ROOM_ID, ORG_ID, 'active', 'Recovered');

    expect(result.roomState).toBe('active');
  });

  it('throws when room not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      transitionRoomState('nonexistent', ORG_ID, 'idle'),
    ).rejects.toThrow('Room nonexistent not found');
  });
});

describe('joinRoom', () => {
  it('creates presence and membership records', async () => {
    const result = await joinRoom(ROOM_ID, USER_ID, 'editor', CLIENT_ID);

    expect(result.presenceId).toBeDefined();
    expect(result.roomId).toBe(ROOM_ID);
    expect(result.userId).toBe(USER_ID);
    expect(result.presenceType).toBe('editor');
    expect(result.clientId).toBe(CLIENT_ID);
    expect(result.isStale).toBe(false);
    expect(result.cursorState).toBeNull();

    // INSERT presence + INSERT membership + INSERT event
    expect(mockDbRun).toHaveBeenCalledTimes(3);

    const presenceSql = mockDbRun.mock.calls[0][0] as string;
    expect(presenceSql).toContain('INSERT INTO v8_room_presence');

    const membershipSql = mockDbRun.mock.calls[1][0] as string;
    expect(membershipSql).toContain('INSERT INTO v8_room_memberships');
  });

  it('records a membership.joined event', async () => {
    await joinRoom(ROOM_ID, USER_ID, 'editor', CLIENT_ID);

    const eventSql = mockDbRun.mock.calls[2][0] as string;
    expect(eventSql).toContain('INSERT INTO v8_collaboration_events');
  });

  it('supports ai_agent presence type', async () => {
    const result = await joinRoom(ROOM_ID, 'ai-agent-1', 'ai_agent', 'agent-client-1');

    expect(result.presenceType).toBe('ai_agent');
  });

  it('rejects invalid presenceType via Zod', async () => {
    await expect(
      joinRoom(ROOM_ID, USER_ID, 'invalid' as any, CLIENT_ID),
    ).rejects.toThrow(ZodError);
  });
});

describe('multi-tab presence (Decision W1-6)', () => {
  it('allows same user with different clientIds', async () => {
    const presence1 = await joinRoom(ROOM_ID, USER_ID, 'editor', CLIENT_ID);
    const presence2 = await joinRoom(ROOM_ID, USER_ID, 'editor', CLIENT_ID_2);

    expect(presence1.clientId).toBe(CLIENT_ID);
    expect(presence2.clientId).toBe(CLIENT_ID_2);
    expect(presence1.presenceId).not.toBe(presence2.presenceId);
  });
});

describe('leaveRoom', () => {
  it('deletes presence and stamps membership leftAt', async () => {
    await leaveRoom(ROOM_ID, USER_ID, CLIENT_ID);

    // DELETE presence + UPDATE membership + INSERT event
    expect(mockDbRun).toHaveBeenCalledTimes(3);

    const deleteSql = mockDbRun.mock.calls[0][0] as string;
    expect(deleteSql).toContain('DELETE FROM v8_room_presence');

    const updateSql = mockDbRun.mock.calls[1][0] as string;
    expect(updateSql).toContain('UPDATE v8_room_memberships');
    expect(updateSql).toContain('left_at');
  });

  it('records a membership.left event', async () => {
    await leaveRoom(ROOM_ID, USER_ID, CLIENT_ID);

    const eventSql = mockDbRun.mock.calls[2][0] as string;
    expect(eventSql).toContain('INSERT INTO v8_collaboration_events');
  });
});

describe('updatePresence', () => {
  it('updates heartbeat and cursor state', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakePresenceRow({ cursor_state: JSON.stringify({ x: 100, y: 200 }) }),
    );

    const result = await updatePresence(ROOM_ID, USER_ID, CLIENT_ID, {
      cursorState: { x: 100, y: 200 },
    });

    expect(result.cursorState).toEqual({ x: 100, y: 200 });

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_room_presence');
    expect(updateSql).toContain('cursor_state');
  });

  it('updates heartbeat only when no cursor state provided', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakePresenceRow());

    await updatePresence(ROOM_ID, USER_ID, CLIENT_ID, {});

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('last_heartbeat');
    expect(updateSql).not.toContain('cursor_state');
  });

  it('throws when presence not found after update', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      updatePresence(ROOM_ID, 'unknown-user', CLIENT_ID, {}),
    ).rejects.toThrow('Presence not found');
  });

  it('resets is_stale to false on heartbeat', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakePresenceRow({ is_stale: 0 }));

    const result = await updatePresence(ROOM_ID, USER_ID, CLIENT_ID, {});

    expect(result.isStale).toBe(false);
    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('is_stale = 0');
  });
});

describe('getActivePresence', () => {
  it('returns non-stale presence records', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow(),
      makeFakePresenceRow({ presence_id: 'p2', user_id: USER_ID_2, client_id: 'tab-3' }),
    ]);

    const results = await getActivePresence(ROOM_ID);

    expect(results).toHaveLength(2);
    expect(results[0].userId).toBe(USER_ID);
    expect(results[1].userId).toBe(USER_ID_2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('is_stale = 0');
  });

  it('returns empty array when no presence exists', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getActivePresence(ROOM_ID);
    expect(results).toEqual([]);
  });
});

describe('cleanStalePresence', () => {
  it('marks stale records and returns removed userIds', async () => {
    const oldHeartbeat = new Date(Date.now() - 120_000).toISOString();

    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow({ last_heartbeat: oldHeartbeat }),
      makeFakePresenceRow({
        presence_id: 'p2',
        user_id: USER_ID_2,
        client_id: 'tab-3',
        last_heartbeat: oldHeartbeat,
      }),
    ]);

    const removed = await cleanStalePresence(ROOM_ID, 60_000);

    expect(removed).toHaveLength(2);
    expect(removed).toContain(USER_ID);
    expect(removed).toContain(USER_ID_2);

    // UPDATE stale + 2x INSERT event (presence.stale_removed)
    expect(mockDbRun).toHaveBeenCalledTimes(3);

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_room_presence');
    expect(updateSql).toContain('is_stale = 1');
  });

  it('returns empty array when no stale records', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const removed = await cleanStalePresence(ROOM_ID, 60_000);
    expect(removed).toEqual([]);
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

describe('recordEvent', () => {
  it('appends a durable event to the stream', async () => {
    const result = await recordEvent({
      roomId: ROOM_ID,
      eventType: 'collaboration.edit_started',
      actorId: USER_ID,
      actorType: 'human',
      delivery: 'durable',
      payload: { field: 'title' },
    });

    expect(result.eventId).toBeDefined();
    expect(result.roomId).toBe(ROOM_ID);
    expect(result.eventType).toBe('collaboration.edit_started');
    expect(result.actorId).toBe(USER_ID);
    expect(result.actorType).toBe('human');
    expect(result.delivery).toBe('durable');
    expect(result.payload).toEqual({ field: 'title' });
    expect(result.stateVersion).toBeNull();

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_collaboration_events');
  });

  it('supports stateVersion for durable state events', async () => {
    const result = await recordEvent({
      roomId: ROOM_ID,
      eventType: 'room.activated',
      actorId: 'system',
      actorType: 'system',
      delivery: 'durable',
      stateVersion: 5,
    });

    expect(result.stateVersion).toBe(5);
  });

  it('defaults payload to empty object', async () => {
    const result = await recordEvent({
      roomId: ROOM_ID,
      eventType: 'system.heartbeat',
      actorId: 'system',
      actorType: 'system',
      delivery: 'ephemeral',
    });

    expect(result.payload).toEqual({});
  });

  it('rejects invalid eventType via Zod', async () => {
    await expect(
      recordEvent({
        roomId: ROOM_ID,
        eventType: 'invalid.event' as any,
        actorId: USER_ID,
        actorType: 'human',
        delivery: 'durable',
      }),
    ).rejects.toThrow(ZodError);
  });
});

describe('getEventsByRoom', () => {
  it('returns events ordered by timestamp', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeEventRow({ timestamp: '2026-03-23T10:00:00.000Z' }),
      makeFakeEventRow({
        event_id: 'e2',
        event_type: 'membership.joined',
        timestamp: '2026-03-23T10:01:00.000Z',
      }),
    ]);

    const results = await getEventsByRoom(ROOM_ID);

    expect(results).toHaveLength(2);
    expect(results[0].eventType).toBe('room.created');
    expect(results[1].eventType).toBe('membership.joined');
  });

  it('filters by eventType when provided', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeEventRow({ event_type: 'membership.joined' }),
    ]);

    const results = await getEventsByRoom(ROOM_ID, { eventType: 'membership.joined' });

    expect(results).toHaveLength(1);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('event_type = ?');
  });

  it('supports pagination with limit and offset', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getEventsByRoom(ROOM_ID, { limit: 10, offset: 20 });

    const queryParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(queryParams).toContain(10);
    expect(queryParams).toContain(20);
  });

  it('returns empty array when no events exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getEventsByRoom(ROOM_ID);
    expect(results).toEqual([]);
  });
});

describe('org isolation', () => {
  it('getRoom enforces organization_id in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getRoom(ROOM_ID, OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('getRoomByResource enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getRoomByResource('workspace', 'ws-001', OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
  });

  it('transitionRoomState enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      transitionRoomState(ROOM_ID, OTHER_ORG_ID, 'idle'),
    ).rejects.toThrow(`Room ${ROOM_ID} not found in organization ${OTHER_ORG_ID}`);
  });
});

describe('state machine completeness', () => {
  it('VALID_ROOM_TRANSITIONS covers all RoomState values', () => {
    const allStates: RoomState[] = ['active', 'idle', 'closed', 'error'];

    for (const state of allStates) {
      expect(VALID_ROOM_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_ROOM_STATES) {
      const transitions = VALID_ROOM_TRANSITIONS[state];
      expect(transitions).toHaveLength(0);
    }
  });

  it('active allows idle, closed, error', () => {
    expect(VALID_ROOM_TRANSITIONS.active).toContain('idle');
    expect(VALID_ROOM_TRANSITIONS.active).toContain('closed');
    expect(VALID_ROOM_TRANSITIONS.active).toContain('error');
  });

  it('idle allows active and closed only', () => {
    expect(VALID_ROOM_TRANSITIONS.idle).toContain('active');
    expect(VALID_ROOM_TRANSITIONS.idle).toContain('closed');
    expect(VALID_ROOM_TRANSITIONS.idle).toHaveLength(2);
  });

  it('error allows active (recovery) and closed', () => {
    expect(VALID_ROOM_TRANSITIONS.error).toContain('active');
    expect(VALID_ROOM_TRANSITIONS.error).toContain('closed');
    expect(VALID_ROOM_TRANSITIONS.error).toHaveLength(2);
  });
});

describe('Zod schema validation', () => {
  it('validates a correct CollaborationRoom', () => {
    expect(() =>
      CollaborationRoomSchema.parse({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        roomState: 'active',
        createdAt: '2026-03-23T10:00:00.000Z',
        closedAt: null,
        metadata: {},
      }),
    ).not.toThrow();
  });

  it('rejects room with invalid state', () => {
    expect(() =>
      CollaborationRoomSchema.parse({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        roomState: 'invalid_state',
        createdAt: '2026-03-23T10:00:00.000Z',
        closedAt: null,
        metadata: {},
      }),
    ).toThrow(ZodError);
  });

  it('validates a correct RoomPresence', () => {
    expect(() =>
      RoomPresenceSchema.parse({
        presenceId: '00000000-0000-4000-8000-b00000000001',
        roomId: ROOM_ID,
        userId: USER_ID,
        presenceType: 'editor',
        cursorState: null,
        lastHeartbeat: '2026-03-23T10:00:00.000Z',
        connectedAt: '2026-03-23T10:00:00.000Z',
        clientId: CLIENT_ID,
        isStale: false,
      }),
    ).not.toThrow();
  });

  it('validates a correct RoomMembership', () => {
    expect(() =>
      RoomMembershipSchema.parse({
        membershipId: '00000000-0000-4000-8000-b00000000002',
        roomId: ROOM_ID,
        userId: USER_ID,
        joinedAt: '2026-03-23T10:00:00.000Z',
        leftAt: null,
        role: 'editor',
      }),
    ).not.toThrow();
  });

  it('validates a correct CollaborationEvent', () => {
    expect(() =>
      CollaborationEventSchema.parse({
        eventId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        roomId: ROOM_ID,
        eventType: 'room.created',
        actorId: 'system',
        actorType: 'system',
        delivery: 'durable',
        payload: {},
        timestamp: '2026-03-23T10:00:00.000Z',
        stateVersion: null,
      }),
    ).not.toThrow();
  });

  it('validates CreateRoomParams', () => {
    expect(() => CreateRoomParamsSchema.parse(makeRoomParams())).not.toThrow();
  });

  it('validates JoinRoomParams', () => {
    expect(() =>
      JoinRoomParamsSchema.parse({
        roomId: ROOM_ID,
        userId: USER_ID,
        presenceType: 'editor',
        clientId: CLIENT_ID,
      }),
    ).not.toThrow();
  });

  it('validates RecordEventParams', () => {
    expect(() =>
      RecordEventParamsSchema.parse({
        roomId: ROOM_ID,
        eventType: 'room.created',
        actorId: 'system',
        actorType: 'system',
        delivery: 'durable',
      }),
    ).not.toThrow();
  });
});
