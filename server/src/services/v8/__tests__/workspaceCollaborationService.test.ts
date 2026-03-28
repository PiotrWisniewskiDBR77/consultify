import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateSessionParams,
  WorkspaceSessionState,
} from '../../../types/workspaceCollaboration.js';
import {
  ActivityFeedEntrySchema,
  CreateSessionParamsSchema,
  LinkRoomParamsSchema,
  RecordActivityParamsSchema,
  TERMINAL_SESSION_STATES,
  UpdateSharedContextParamsSchema,
  VALID_SESSION_TRANSITIONS,
  WorkspaceSessionSchema,
} from '../../../types/workspaceCollaboration.js';

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
  completeSession,
  createSession,
  getActivityFeed,
  getLinkedRooms,
  getSession,
  getSessionsByWorkspace,
  linkRoom,
  pauseSession,
  recordActivity,
  resumeSession,
  unlinkRoom,
  updateSharedContext,
} from '../workspaceCollaborationService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const WORKSPACE_ID = 'ws-001';
const SESSION_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const ROOM_ID_1 = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const ROOM_ID_2 = '00000000-0000-4000-8000-cccccccccccc';
const USER_ID = '00000000-0000-4000-8000-000000000003';

function makeSessionParams(overrides?: Partial<CreateSessionParams>): CreateSessionParams {
  return {
    workspaceId: WORKSPACE_ID,
    organizationId: ORG_ID,
    title: 'Sprint Planning',
    createdBy: USER_ID,
    ...overrides,
  };
}

function makeFakeSessionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    session_id: SESSION_ID,
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    title: 'Sprint Planning',
    state: 'active',
    created_by: USER_ID,
    linked_room_ids: JSON.stringify([]),
    shared_context: JSON.stringify({}),
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

function makeFakeActivityRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entry_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    entry_type: 'session.started',
    actor_id: USER_ID,
    actor_display_name: 'Test User',
    payload: JSON.stringify({ title: 'Sprint Planning' }),
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSession', () => {
  it('creates a session in active state', async () => {
    const result = await createSession(makeSessionParams());

    expect(result.sessionId).toBeDefined();
    expect(result.state).toBe('active');
    expect(result.workspaceId).toBe(WORKSPACE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.title).toBe('Sprint Planning');
    expect(result.createdBy).toBe(USER_ID);
    expect(result.linkedRoomIds).toEqual([]);
    expect(result.sharedContext).toEqual({});
    expect(result.completedAt).toBeNull();

    // INSERT session + INSERT activity (session.started)
    expect(mockDbRun).toHaveBeenCalledTimes(2);
    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_workspace_sessions');
  });

  it('records a session.started activity entry on creation', async () => {
    await createSession(makeSessionParams());

    const activitySql = mockDbRun.mock.calls[1][0] as string;
    expect(activitySql).toContain('INSERT INTO v8_activity_feed');
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(createSession({ organizationId: ORG_ID } as any)).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      createSession(makeSessionParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getSession', () => {
  it('returns a session when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow());

    const result = await getSession(SESSION_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe(SESSION_ID);
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.state).toBe('active');

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when session does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getSession('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getSession(SESSION_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

describe('pauseSession', () => {
  it('transitions active → paused', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'active' }));

    const result = await pauseSession(SESSION_ID, ORG_ID);

    expect(result.state).toBe('paused');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain("state = 'paused'");
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(pauseSession('nonexistent', ORG_ID)).rejects.toThrow(
      'Session nonexistent not found'
    );
  });

  it('rejects invalid transition: completed → paused', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'completed' }));

    await expect(pauseSession(SESSION_ID, ORG_ID)).rejects.toThrow(
      'Invalid session state transition: completed → paused'
    );
  });
});

describe('resumeSession', () => {
  it('transitions paused → active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'paused' }));

    const result = await resumeSession(SESSION_ID, ORG_ID);

    expect(result.state).toBe('active');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resumeSession('nonexistent', ORG_ID)).rejects.toThrow(
      'Session nonexistent not found'
    );
  });

  it('rejects invalid transition: active → active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'active' }));

    await expect(resumeSession(SESSION_ID, ORG_ID)).rejects.toThrow(
      'Invalid session state transition: active → active'
    );
  });
});

describe('completeSession', () => {
  it('transitions active → completed and sets completedAt', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'active' }));

    const result = await completeSession(SESSION_ID, ORG_ID);

    expect(result.state).toBe('completed');
    expect(result.completedAt).not.toBeNull();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('transitions paused → completed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'paused' }));

    const result = await completeSession(SESSION_ID, ORG_ID);

    expect(result.state).toBe('completed');
    expect(result.completedAt).not.toBeNull();
  });

  it('rejects invalid transition: abandoned → completed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'abandoned' }));

    await expect(completeSession(SESSION_ID, ORG_ID)).rejects.toThrow(
      'Invalid session state transition: abandoned → completed'
    );
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(completeSession('nonexistent', ORG_ID)).rejects.toThrow(
      'Session nonexistent not found'
    );
  });
});

describe('linkRoom', () => {
  it('adds a room to linkedRoomIds', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ linked_room_ids: JSON.stringify([]) }));

    const result = await linkRoom(SESSION_ID, ROOM_ID_1, ORG_ID);

    expect(result.linkedRoomIds).toContain(ROOM_ID_1);
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('linked_room_ids');
  });

  it('does not duplicate if room already linked', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSessionRow({ linked_room_ids: JSON.stringify([ROOM_ID_1]) })
    );

    const result = await linkRoom(SESSION_ID, ROOM_ID_1, ORG_ID);

    expect(result.linkedRoomIds).toEqual([ROOM_ID_1]);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('rejects linking to a completed session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'completed' }));

    await expect(linkRoom(SESSION_ID, ROOM_ID_1, ORG_ID)).rejects.toThrow(
      'Cannot link room to session'
    );
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(linkRoom(SESSION_ID, ROOM_ID_1, ORG_ID)).rejects.toThrow(
      `Session ${SESSION_ID} not found`
    );
  });
});

describe('unlinkRoom', () => {
  it('removes a room from linkedRoomIds', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSessionRow({ linked_room_ids: JSON.stringify([ROOM_ID_1, ROOM_ID_2]) })
    );

    const result = await unlinkRoom(SESSION_ID, ROOM_ID_1, ORG_ID);

    expect(result.linkedRoomIds).toEqual([ROOM_ID_2]);
    expect(result.linkedRoomIds).not.toContain(ROOM_ID_1);
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('is a no-op if room not in linkedRoomIds', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSessionRow({ linked_room_ids: JSON.stringify([ROOM_ID_2]) })
    );

    const result = await unlinkRoom(SESSION_ID, ROOM_ID_1, ORG_ID);

    expect(result.linkedRoomIds).toEqual([ROOM_ID_2]);
    // Still updates DB (filter produces same array)
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('rejects unlinking from an abandoned session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'abandoned' }));

    await expect(unlinkRoom(SESSION_ID, ROOM_ID_1, ORG_ID)).rejects.toThrow(
      'Cannot unlink room from session'
    );
  });
});

describe('getLinkedRooms', () => {
  it('returns linked room IDs', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSessionRow({ linked_room_ids: JSON.stringify([ROOM_ID_1, ROOM_ID_2]) })
    );

    const result = await getLinkedRooms(SESSION_ID, ORG_ID);

    expect(result).toEqual([ROOM_ID_1, ROOM_ID_2]);
  });

  it('returns empty array when no rooms linked', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow());

    const result = await getLinkedRooms(SESSION_ID, ORG_ID);

    expect(result).toEqual([]);
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(getLinkedRooms('nonexistent', ORG_ID)).rejects.toThrow(
      'Session nonexistent not found'
    );
  });
});

describe('updateSharedContext', () => {
  it('merges updates into sharedContext', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSessionRow({ shared_context: JSON.stringify({ existing: 'value' }) })
    );

    const result = await updateSharedContext(SESSION_ID, ORG_ID, [
      { key: 'goal', value: 'Ship v2', updatedBy: USER_ID },
      { key: 'priority', value: 'high', updatedBy: USER_ID },
    ]);

    expect(result.sharedContext).toEqual({
      existing: 'value',
      goal: 'Ship v2',
      priority: 'high',
    });
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('overwrites existing keys', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSessionRow({ shared_context: JSON.stringify({ goal: 'old' }) })
    );

    const result = await updateSharedContext(SESSION_ID, ORG_ID, [
      { key: 'goal', value: 'new', updatedBy: USER_ID },
    ]);

    expect(result.sharedContext).toEqual({ goal: 'new' });
  });

  it('rejects updating context on completed session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSessionRow({ state: 'completed' }));

    await expect(
      updateSharedContext(SESSION_ID, ORG_ID, [{ key: 'goal', value: 'test', updatedBy: USER_ID }])
    ).rejects.toThrow('Cannot update shared context on session');
  });

  it('rejects empty updates array via Zod', async () => {
    await expect(updateSharedContext(SESSION_ID, ORG_ID, [])).rejects.toThrow(ZodError);
  });

  it('throws when session not found', async () => {
    const missingId = '00000000-0000-4000-8000-ffffffffffff';
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      updateSharedContext(missingId, ORG_ID, [{ key: 'k', value: 'v', updatedBy: USER_ID }])
    ).rejects.toThrow(`Session ${missingId} not found`);
  });
});

describe('recordActivity', () => {
  it('records an activity feed entry', async () => {
    const result = await recordActivity({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      entryType: 'participant.joined',
      actorId: USER_ID,
      actorDisplayName: 'Test User',
      payload: { role: 'editor' },
    });

    expect(result.entryId).toBeDefined();
    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.entryType).toBe('participant.joined');
    expect(result.actorId).toBe(USER_ID);
    expect(result.actorDisplayName).toBe('Test User');
    expect(result.payload).toEqual({ role: 'editor' });

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_activity_feed');
  });

  it('defaults payload to empty object', async () => {
    const result = await recordActivity({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      entryType: 'session.paused',
      actorId: USER_ID,
      actorDisplayName: 'Test User',
    });

    expect(result.payload).toEqual({});
  });

  it('rejects invalid entryType via Zod', async () => {
    await expect(
      recordActivity({
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        entryType: 'invalid.type' as any,
        actorId: USER_ID,
        actorDisplayName: 'Test User',
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('getActivityFeed', () => {
  it('returns activity entries ordered by creation time', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeActivityRow({ created_at: '2026-03-23T10:01:00.000Z' }),
      makeFakeActivityRow({
        entry_id: 'e2',
        entry_type: 'participant.joined',
        created_at: '2026-03-23T10:00:00.000Z',
      }),
    ]);

    const results = await getActivityFeed(SESSION_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].entryType).toBe('session.started');
    expect(results[1].entryType).toBe('participant.joined');
  });

  it('respects limit parameter', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getActivityFeed(SESSION_ID, ORG_ID, 10);

    const queryParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(queryParams).toContain(10);
  });

  it('returns empty array when no entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getActivityFeed(SESSION_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('getSessionsByWorkspace', () => {
  it('returns active sessions by default (excludes completed/abandoned)', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSessionRow(),
      makeFakeSessionRow({ session_id: 's2', state: 'paused' }),
    ]);

    const results = await getSessionsByWorkspace(WORKSPACE_ID, ORG_ID);

    expect(results).toHaveLength(2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain("state NOT IN ('completed', 'abandoned')");
  });

  it('includes completed sessions when includeCompleted is true', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSessionRow({ state: 'completed' })]);

    const results = await getSessionsByWorkspace(WORKSPACE_ID, ORG_ID, true);

    expect(results).toHaveLength(1);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).not.toContain('state NOT IN');
  });

  it('returns empty array when no sessions exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSessionsByWorkspace(WORKSPACE_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('org isolation', () => {
  it('getSession enforces organization_id in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getSession(SESSION_ID, OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('pauseSession enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(pauseSession(SESSION_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Session ${SESSION_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });

  it('getActivityFeed enforces organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActivityFeed(SESSION_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

describe('state machine completeness', () => {
  it('VALID_SESSION_TRANSITIONS covers all WorkspaceSessionState values', () => {
    const allStates: WorkspaceSessionState[] = ['active', 'paused', 'completed', 'abandoned'];

    for (const state of allStates) {
      expect(VALID_SESSION_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_SESSION_STATES) {
      const transitions = VALID_SESSION_TRANSITIONS[state];
      expect(transitions).toHaveLength(0);
    }
  });

  it('active allows paused, completed, abandoned', () => {
    expect(VALID_SESSION_TRANSITIONS.active).toContain('paused');
    expect(VALID_SESSION_TRANSITIONS.active).toContain('completed');
    expect(VALID_SESSION_TRANSITIONS.active).toContain('abandoned');
    expect(VALID_SESSION_TRANSITIONS.active).toHaveLength(3);
  });

  it('paused allows active, completed, abandoned', () => {
    expect(VALID_SESSION_TRANSITIONS.paused).toContain('active');
    expect(VALID_SESSION_TRANSITIONS.paused).toContain('completed');
    expect(VALID_SESSION_TRANSITIONS.paused).toContain('abandoned');
    expect(VALID_SESSION_TRANSITIONS.paused).toHaveLength(3);
  });
});

describe('Zod schema validation', () => {
  it('validates a correct WorkspaceSession', () => {
    expect(() =>
      WorkspaceSessionSchema.parse({
        sessionId: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        title: 'Sprint Planning',
        state: 'active',
        createdBy: USER_ID,
        linkedRoomIds: [],
        sharedContext: {},
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
        completedAt: null,
      })
    ).not.toThrow();
  });

  it('rejects session with invalid state', () => {
    expect(() =>
      WorkspaceSessionSchema.parse({
        sessionId: SESSION_ID,
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        title: 'Sprint Planning',
        state: 'invalid_state',
        createdBy: USER_ID,
        linkedRoomIds: [],
        sharedContext: {},
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
        completedAt: null,
      })
    ).toThrow(ZodError);
  });

  it('validates a correct ActivityFeedEntry', () => {
    expect(() =>
      ActivityFeedEntrySchema.parse({
        entryId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        entryType: 'session.started',
        actorId: USER_ID,
        actorDisplayName: 'Test User',
        payload: {},
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates CreateSessionParams', () => {
    expect(() => CreateSessionParamsSchema.parse(makeSessionParams())).not.toThrow();
  });

  it('validates LinkRoomParams', () => {
    expect(() =>
      LinkRoomParamsSchema.parse({
        sessionId: SESSION_ID,
        roomId: ROOM_ID_1,
        organizationId: ORG_ID,
      })
    ).not.toThrow();
  });

  it('validates RecordActivityParams', () => {
    expect(() =>
      RecordActivityParamsSchema.parse({
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        entryType: 'session.started',
        actorId: USER_ID,
        actorDisplayName: 'Test User',
      })
    ).not.toThrow();
  });

  it('validates UpdateSharedContextParams', () => {
    expect(() =>
      UpdateSharedContextParamsSchema.parse({
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        updates: [{ key: 'goal', value: 'test', updatedBy: USER_ID }],
      })
    ).not.toThrow();
  });
});
