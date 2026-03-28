import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollaborationRoom, RoomPresence } from '../../../types/collaborationRoom.js';
import { VALID_ROOM_TRANSITIONS } from '../../../types/collaborationRoom.js';

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
  broadcastEvent,
  detectStalePresence,
  enterDegradedMode,
  getActiveRoomsByOrg,
  getRoomHealth,
  recoverFromDegraded,
} from '../collaborationRoomService.js';
import { getCrossCanvasPresence, getToolRoomStatus } from '../multiplayerHardeningService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const ROOM_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const ROOM_ID_2 = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const CLIENT_ID = 'tab-1';
const CLIENT_ID_2 = 'tab-2';
const WORKSPACE_ID = 'ws-001';

function makeFakeRoomRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    room_id: ROOM_ID,
    resource_type: 'workspace',
    resource_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    room_state: 'active',
    created_at: '2026-03-23T10:00:00.000Z',
    closed_at: null,
    metadata: JSON.stringify({ source: 'test' }),
    degraded_since: null,
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
    payload: JSON.stringify({}),
    timestamp: '2026-03-23T10:05:00.000Z',
    state_version: null,
    ...overrides,
  };
}

function makeFakeMembershipRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    membership_id: '00000000-0000-4000-8000-mmmmmmmmmmmm',
    room_id: ROOM_ID,
    user_id: USER_ID,
    joined_at: '2026-03-23T10:00:00.000Z',
    left_at: null,
    role: 'editor',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// 1. detectStalePresence
// ------------------------------------------

describe('detectStalePresence', () => {
  it('returns stale presence entries older than threshold', async () => {
    const oldHeartbeat = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // getRoom call
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    // stale presence query
    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow({ last_heartbeat: oldHeartbeat }),
      makeFakePresenceRow({
        presence_id: '00000000-0000-4000-8000-pppppppppp02',
        user_id: USER_ID_2,
        client_id: CLIENT_ID_2,
        last_heartbeat: oldHeartbeat,
      }),
    ]);

    const result = await detectStalePresence(ROOM_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe(USER_ID);
    expect(result[1].userId).toBe(USER_ID_2);
  });

  it('records presence.stale_removed events for each stale entry', async () => {
    const oldHeartbeat = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    mockDbAll.mockResolvedValueOnce([makeFakePresenceRow({ last_heartbeat: oldHeartbeat })]);

    await detectStalePresence(ROOM_ID, ORG_ID);

    const eventInserts = mockDbRun.mock.calls.filter((call) =>
      (call[0] as string).includes('INSERT INTO v8_collaboration_events')
    );
    expect(eventInserts.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when no stale entries', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    mockDbAll.mockResolvedValueOnce([]);

    const result = await detectStalePresence(ROOM_ID, ORG_ID);

    expect(result).toEqual([]);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('uses default 5-minute threshold', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    mockDbAll.mockResolvedValueOnce([]);

    await detectStalePresence(ROOM_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('last_heartbeat < ?');
  });

  it('accepts custom threshold', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    mockDbAll.mockResolvedValueOnce([]);

    await detectStalePresence(ROOM_ID, ORG_ID, 60_000);

    expect(mockDbAll).toHaveBeenCalledTimes(1);
  });

  it('throws when room not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(detectStalePresence(ROOM_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Room ${ROOM_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ------------------------------------------
// 2. getRoomHealth
// ------------------------------------------

describe('getRoomHealth', () => {
  it('returns health summary with active and stale counts', async () => {
    // getRoom
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    // active presence
    mockDbAll.mockResolvedValueOnce([makeFakePresenceRow()]);
    // stale presence
    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow({ is_stale: 1, presence_id: '00000000-0000-4000-8000-pppppppppp02' }),
    ]);
    // members
    mockDbAll.mockResolvedValueOnce([makeFakeMembershipRow()]);
    // last event
    mockDbGet.mockResolvedValueOnce(makeFakeEventRow());
    // degraded_since
    mockDbGet.mockResolvedValueOnce({ degraded_since: null });

    const result = await getRoomHealth(ROOM_ID, ORG_ID);

    expect(result.state).toBe('active');
    expect(result.activePresenceCount).toBe(1);
    expect(result.stalePresenceCount).toBe(1);
    expect(result.memberCount).toBe(1);
    expect(result.lastEventAt).toBe('2026-03-23T10:05:00.000Z');
  });

  it('sets degradedSince when stale > active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    // 0 active
    mockDbAll.mockResolvedValueOnce([]);
    // 2 stale
    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow({ is_stale: 1 }),
      makeFakePresenceRow({ is_stale: 1, presence_id: '00000000-0000-4000-8000-pppppppppp02' }),
    ]);
    // 0 members
    mockDbAll.mockResolvedValueOnce([]);
    // no events
    mockDbGet.mockResolvedValueOnce(null);
    // no degraded_since in DB
    mockDbGet.mockResolvedValueOnce({ degraded_since: null });

    const result = await getRoomHealth(ROOM_ID, ORG_ID);

    expect(result.degradedSince).not.toBeNull();
    expect(result.stalePresenceCount).toBe(2);
    expect(result.activePresenceCount).toBe(0);
  });

  it('returns existing degradedSince from DB', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    mockDbAll.mockResolvedValueOnce([]);
    mockDbAll.mockResolvedValueOnce([]);
    mockDbAll.mockResolvedValueOnce([]);
    mockDbGet.mockResolvedValueOnce(null);
    mockDbGet.mockResolvedValueOnce({ degraded_since: '2026-03-23T09:00:00.000Z' });

    const result = await getRoomHealth(ROOM_ID, ORG_ID);

    expect(result.degradedSince).toBe('2026-03-23T09:00:00.000Z');
  });

  it('returns null lastEventAt when no events', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());
    mockDbAll.mockResolvedValueOnce([]);
    mockDbAll.mockResolvedValueOnce([]);
    mockDbAll.mockResolvedValueOnce([]);
    mockDbGet.mockResolvedValueOnce(null);
    mockDbGet.mockResolvedValueOnce({ degraded_since: null });

    const result = await getRoomHealth(ROOM_ID, ORG_ID);

    expect(result.lastEventAt).toBeNull();
  });

  it('throws when room not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(getRoomHealth(ROOM_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Room ${ROOM_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ------------------------------------------
// 3. enterDegradedMode
// ------------------------------------------

describe('enterDegradedMode', () => {
  it('transitions room to error state and records system.degraded event', async () => {
    // First getRoom (enterDegradedMode)
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'active' }));
    // Second getRoom (transitionRoomState)
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'active' }));

    const result = await enterDegradedMode(ROOM_ID, ORG_ID, 'Too many stale connections');

    expect(result.roomState).toBe('error');

    const degradedUpdate = mockDbRun.mock.calls.find((call) =>
      (call[0] as string).includes('degraded_since')
    );
    expect(degradedUpdate).toBeDefined();

    const eventInserts = mockDbRun.mock.calls.filter((call) =>
      (call[0] as string).includes('INSERT INTO v8_collaboration_events')
    );
    const degradedEvent = eventInserts.find((call) => {
      const params = call[1] as unknown[];
      return params.includes('system.degraded');
    });
    expect(degradedEvent).toBeDefined();
  });

  it('returns room as-is when already in error state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));

    const result = await enterDegradedMode(ROOM_ID, ORG_ID, 'Already degraded');

    expect(result.roomState).toBe('error');
    const transitionCalls = mockDbRun.mock.calls.filter(
      (call) =>
        (call[0] as string).includes('UPDATE v8_collaboration_rooms') &&
        (call[0] as string).includes('room_state')
    );
    expect(transitionCalls).toHaveLength(0);
  });

  it('throws when room not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(enterDegradedMode(ROOM_ID, OTHER_ORG_ID, 'test')).rejects.toThrow(
      `Room ${ROOM_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ------------------------------------------
// 4. recoverFromDegraded
// ------------------------------------------

describe('recoverFromDegraded', () => {
  it('transitions room from error back to active', async () => {
    // First getRoom (recoverFromDegraded)
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));
    // Second getRoom (transitionRoomState)
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));

    const result = await recoverFromDegraded(ROOM_ID, ORG_ID);

    expect(result.roomState).toBe('active');
  });

  it('clears degraded_since on recovery', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));

    await recoverFromDegraded(ROOM_ID, ORG_ID);

    const clearDegraded = mockDbRun.mock.calls.find((call) =>
      (call[0] as string).includes('degraded_since = NULL')
    );
    expect(clearDegraded).toBeDefined();
  });

  it('records system.reconnected event', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'error' }));

    await recoverFromDegraded(ROOM_ID, ORG_ID);

    const eventInserts = mockDbRun.mock.calls.filter((call) =>
      (call[0] as string).includes('INSERT INTO v8_collaboration_events')
    );
    const reconnectedEvent = eventInserts.find((call) => {
      const params = call[1] as unknown[];
      return params.includes('system.reconnected');
    });
    expect(reconnectedEvent).toBeDefined();
  });

  it('throws when room is not in error state', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow({ room_state: 'active' }));

    await expect(recoverFromDegraded(ROOM_ID, ORG_ID)).rejects.toThrow(
      'Room 00000000-0000-4000-8000-aaaaaaaaaaaa is not in error state (current: active)'
    );
  });

  it('throws when room not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(recoverFromDegraded(ROOM_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Room ${ROOM_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ------------------------------------------
// 5. getActiveRoomsByOrg
// ------------------------------------------

describe('getActiveRoomsByOrg', () => {
  it('returns non-closed rooms for an organization', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRoomRow({ room_state: 'active' }),
      makeFakeRoomRow({ room_id: ROOM_ID_2, room_state: 'idle' }),
    ]);

    const result = await getActiveRoomsByOrg(ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].roomState).toBe('active');
    expect(result[1].roomState).toBe('idle');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain("room_state != 'closed'");
    expect(query).toContain('organization_id = ?');
  });

  it('returns empty array when no active rooms', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getActiveRoomsByOrg(ORG_ID);

    expect(result).toEqual([]);
  });

  it('respects limit parameter', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeRoomRow()]);

    await getActiveRoomsByOrg(ORG_ID, 5);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(5);
  });

  it('defaults limit to 100', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getActiveRoomsByOrg(ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(100);
  });
});

// ------------------------------------------
// 6. broadcastEvent
// ------------------------------------------

describe('broadcastEvent', () => {
  it('records a durable event and returns it', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());

    const result = await broadcastEvent(ROOM_ID, ORG_ID, 'system.heartbeat', { ping: true });

    expect(result.eventId).toBeDefined();
    expect(result.roomId).toBe(ROOM_ID);
    expect(result.eventType).toBe('system.heartbeat');
    expect(result.delivery).toBe('durable');
    expect(result.payload).toEqual({ ping: true });
    expect(result.actorId).toBe('system');
    expect(result.actorType).toBe('system');
  });

  it('throws when room not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(broadcastEvent(ROOM_ID, OTHER_ORG_ID, 'system.heartbeat', {})).rejects.toThrow(
      `Room ${ROOM_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });

  it('supports different event types', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRoomRow());

    const result = await broadcastEvent(ROOM_ID, ORG_ID, 'collaboration.edit_started', {
      field: 'title',
    });

    expect(result.eventType).toBe('collaboration.edit_started');
    expect(result.payload).toEqual({ field: 'title' });
  });
});

// ------------------------------------------
// 7. getCrossCanvasPresence
// ------------------------------------------

describe('getCrossCanvasPresence', () => {
  it('returns presence across all rooms in a workspace', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRoomRow({ room_id: ROOM_ID, resource_type: 'workspace', resource_id: WORKSPACE_ID }),
      makeFakeRoomRow({ room_id: ROOM_ID_2, resource_type: 'whiteboard', resource_id: 'wb-001' }),
    ]);
    // presence for room 1
    mockDbAll.mockResolvedValueOnce([makeFakePresenceRow({ room_id: ROOM_ID })]);
    // presence for room 2
    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow({
        room_id: ROOM_ID_2,
        user_id: USER_ID_2,
        presence_id: '00000000-0000-4000-8000-pppppppppp02',
      }),
    ]);

    const result = await getCrossCanvasPresence(WORKSPACE_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].roomId).toBe(ROOM_ID);
    expect(result[0].presenceEntries).toHaveLength(1);
    expect(result[1].roomId).toBe(ROOM_ID_2);
    expect(result[1].presenceEntries).toHaveLength(1);
  });

  it('returns empty array when no rooms in workspace', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getCrossCanvasPresence(WORKSPACE_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('includes resource metadata in each entry', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRoomRow({ resource_type: 'whiteboard', resource_id: 'wb-001' }),
    ]);
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getCrossCanvasPresence(WORKSPACE_ID, ORG_ID);

    expect(result[0].resourceType).toBe('whiteboard');
    expect(result[0].resourceId).toBe('wb-001');
  });

  it('only includes non-stale presence entries', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeRoomRow()]);
    mockDbAll.mockResolvedValueOnce([]);

    await getCrossCanvasPresence(WORKSPACE_ID, ORG_ID);

    const presenceQuery = mockDbAll.mock.calls[1][0] as string;
    expect(presenceQuery).toContain('is_stale = 0');
  });

  it('enforces organization isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getCrossCanvasPresence(WORKSPACE_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// 8. getToolRoomStatus
// ------------------------------------------

describe('getToolRoomStatus', () => {
  it('returns room status with presence counts', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeRoomRow({ resource_type: 'whiteboard', resource_id: 'wb-001' })
    );
    // active presence
    mockDbAll.mockResolvedValueOnce([makeFakePresenceRow()]);
    // stale presence
    mockDbAll.mockResolvedValueOnce([
      makeFakePresenceRow({ is_stale: 1, presence_id: '00000000-0000-4000-8000-pppppppppp02' }),
    ]);

    const result = await getToolRoomStatus('whiteboard', 'wb-001', ORG_ID);

    expect(result.room).not.toBeNull();
    expect(result.room!.resourceType).toBe('whiteboard');
    expect(result.state).toBe('active');
    expect(result.activePresenceCount).toBe(1);
    expect(result.stalePresenceCount).toBe(1);
  });

  it('returns null room when no room exists for tool+resource', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getToolRoomStatus('notebook', 'nb-999', ORG_ID);

    expect(result.room).toBeNull();
    expect(result.state).toBeNull();
    expect(result.activePresenceCount).toBe(0);
    expect(result.stalePresenceCount).toBe(0);
  });

  it('enforces org isolation in room query', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await getToolRoomStatus('whiteboard', 'wb-001', OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('excludes closed rooms', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await getToolRoomStatus('whiteboard', 'wb-001', ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain("room_state != 'closed'");
  });
});

// ------------------------------------------
// State machine: error → active recovery path
// ------------------------------------------

describe('state machine: error → active recovery', () => {
  it('VALID_ROOM_TRANSITIONS allows error → active', () => {
    expect(VALID_ROOM_TRANSITIONS.error).toContain('active');
  });

  it('VALID_ROOM_TRANSITIONS allows error → closed', () => {
    expect(VALID_ROOM_TRANSITIONS.error).toContain('closed');
  });

  it('error has exactly 2 outgoing transitions', () => {
    expect(VALID_ROOM_TRANSITIONS.error).toHaveLength(2);
  });
});
