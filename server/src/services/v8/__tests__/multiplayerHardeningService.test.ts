import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  FacilitationSessionState,
  RegisterResourceTypeMappingParams,
  RegisterSeamParams,
  RegisterToolEventParams,
  StartFacilitationParams,
  UpdateSurfacePresenceParams,
} from '../../../types/multiplayerHardening.js';
import {
  FacilitationSessionSchema,
  FacilitationSessionStateValues,
  PlatformSeamRecordSchema,
  RegisterResourceTypeMappingParamsSchema,
  RegisterSeamParamsSchema,
  RegisterToolEventParamsSchema,
  ResourceTypeMappingSchema,
  SeamCurrentStateValues,
  SeamTypeValues,
  StartFacilitationParamsSchema,
  SurfacePresenceSchema,
  SurfaceValues,
  TERMINAL_FACILITATION_STATES,
  ToolEventRegistrationSchema,
  UpdateSurfacePresenceParamsSchema,
  VALID_FACILITATION_TRANSITIONS,
  WorkspaceToolValues,
} from '../../../types/multiplayerHardening.js';

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
  endFacilitationSession,
  getFacilitationSession,
  getPresenceBySurface,
  getResourceTypeMapping,
  getSeamsByOrg,
  getToolEvents,
  getWorkspacePresence,
  migrateSeam,
  pauseFacilitationSession,
  registerResourceTypeMapping,
  registerSeam,
  registerToolEvent,
  resolveRoomBinding,
  resumeFacilitationSession,
  startFacilitationSession,
  updateSurfacePresence,
} from '../multiplayerHardeningService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const ROOM_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const SESSION_ID = '00000000-0000-4000-8000-ssssssssssss';
const SEAM_ID = '00000000-0000-4000-8000-dddddddddddd';

function makeMappingParams(
  overrides?: Partial<RegisterResourceTypeMappingParams>
): RegisterResourceTypeMappingParams {
  return {
    resourceType: 'whiteboard',
    roomGranularity: 'per_workspace',
    embeddedIn: 'workspace',
    surfaceAware: true,
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeFakeMappingRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    mapping_id: '00000000-0000-4000-8000-mmmmmmmmmmmm',
    resource_type: 'whiteboard',
    room_granularity: 'per_workspace',
    embedded_in: 'workspace',
    surface_aware: 1,
    organization_id: ORG_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeSurfacePresenceParams(
  overrides?: Partial<UpdateSurfacePresenceParams>
): UpdateSurfacePresenceParams {
  return {
    userId: USER_ID,
    roomId: ROOM_ID,
    activeSurface: 'whiteboard',
    presenceType: 'editor',
    cursorState: { x: 100, y: 200 },
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeFakeSurfacePresenceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    surface_presence_id: '00000000-0000-4000-8000-spspspspspsp',
    user_id: USER_ID,
    room_id: ROOM_ID,
    active_surface: 'whiteboard',
    presence_type: 'editor',
    cursor_state: JSON.stringify({ x: 100, y: 200 }),
    last_heartbeat: '2026-03-23T10:00:00.000Z',
    organization_id: ORG_ID,
    ...overrides,
  };
}

function makeFacilitationParams(
  overrides?: Partial<StartFacilitationParams>
): StartFacilitationParams {
  return {
    roomId: ROOM_ID,
    facilitatorUserId: USER_ID,
    initialPhase: 'brainstorm',
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeFakeFacilitationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    session_id: SESSION_ID,
    room_id: ROOM_ID,
    facilitator_user_id: USER_ID,
    session_state: 'active',
    current_phase: 'brainstorm',
    phase_history: JSON.stringify([
      { phase: 'brainstorm', startedAt: '2026-03-23T10:00:00.000Z', endedAt: null },
    ]),
    started_at: '2026-03-23T10:00:00.000Z',
    paused_at: null,
    ended_at: null,
    pause_reason: null,
    organization_id: ORG_ID,
    ...overrides,
  };
}

function makeSeamParams(overrides?: Partial<RegisterSeamParams>): RegisterSeamParams {
  return {
    toolName: 'whiteboard',
    seamType: 'room_binding',
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeFakeSeamRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    seam_id: SEAM_ID,
    tool_name: 'whiteboard',
    seam_type: 'room_binding',
    current_state: 'module_local',
    v4_seam_ref: null,
    organization_id: ORG_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    migrated_at: null,
    ...overrides,
  };
}

function makeToolEventParams(
  overrides?: Partial<RegisterToolEventParams>
): RegisterToolEventParams {
  return {
    eventType: 'board.object_created',
    toolName: 'whiteboard',
    deliveryTier: 'durable',
    surfaceContext: true,
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeFakeToolEventRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    registration_id: '00000000-0000-4000-8000-rrrrrrrrrrrr',
    event_type: 'board.object_created',
    tool_name: 'whiteboard',
    delivery_tier: 'durable',
    surface_context: 1,
    registered: 1,
    organization_id: ORG_ID,
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

// ------------------------------------------
// Resource Type Mapping
// ------------------------------------------

describe('registerResourceTypeMapping', () => {
  it('registers a mapping with embedded parent', async () => {
    const result = await registerResourceTypeMapping(makeMappingParams());

    expect(result.mappingId).toBeDefined();
    expect(result.resourceType).toBe('whiteboard');
    expect(result.roomGranularity).toBe('per_workspace');
    expect(result.embeddedIn).toBe('workspace');
    expect(result.surfaceAware).toBe(true);
    expect(result.organizationId).toBe(ORG_ID);

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_resource_type_mappings');
  });

  it('registers a standalone mapping with no parent', async () => {
    const result = await registerResourceTypeMapping(
      makeMappingParams({
        resourceType: 'notebook',
        roomGranularity: 'per_resource',
        embeddedIn: null,
        surfaceAware: false,
      })
    );

    expect(result.resourceType).toBe('notebook');
    expect(result.roomGranularity).toBe('per_resource');
    expect(result.embeddedIn).toBeNull();
    expect(result.surfaceAware).toBe(false);
  });

  it('defaults embeddedIn to null when not provided', async () => {
    const result = await registerResourceTypeMapping(makeMappingParams({ embeddedIn: undefined }));
    expect(result.embeddedIn).toBeNull();
  });

  it('rejects invalid resourceType via Zod', async () => {
    await expect(
      registerResourceTypeMapping({ ...makeMappingParams(), resourceType: 'invalid' as any })
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      registerResourceTypeMapping(makeMappingParams({ organizationId: 'not-uuid' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('resolveRoomBinding', () => {
  it('resolves embedded resource to parent workspace room (Decision W4-1)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeMappingRow());

    const result = await resolveRoomBinding('whiteboard', 'wb-001', ORG_ID, 'ws-001');

    expect(result.roomResourceType).toBe('workspace');
    expect(result.roomResourceId).toBe('ws-001');
  });

  it('resolves standalone resource to its own room', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeMappingRow({ embedded_in: null, room_granularity: 'per_resource' })
    );

    const result = await resolveRoomBinding('whiteboard', 'wb-standalone-001', ORG_ID);

    expect(result.roomResourceType).toBe('whiteboard');
    expect(result.roomResourceId).toBe('wb-standalone-001');
  });

  it('falls back to resource identity when no mapping exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await resolveRoomBinding('notebook', 'nb-001', ORG_ID);

    expect(result.roomResourceType).toBe('notebook');
    expect(result.roomResourceId).toBe('nb-001');
  });

  it('resolves embedded resource without parentResourceId to standalone', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeMappingRow());

    const result = await resolveRoomBinding('whiteboard', 'wb-001', ORG_ID);

    expect(result.roomResourceType).toBe('whiteboard');
    expect(result.roomResourceId).toBe('wb-001');
  });
});

describe('getResourceTypeMapping', () => {
  it('returns mapping when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeMappingRow());

    const result = await getResourceTypeMapping('whiteboard', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.resourceType).toBe('whiteboard');
    expect(result!.organizationId).toBe(ORG_ID);
  });

  it('returns null when mapping not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getResourceTypeMapping('notebook', ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// Surface Presence (Decision W4-5)
// ------------------------------------------

describe('updateSurfacePresence', () => {
  it('creates new surface presence when none exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await updateSurfacePresence(makeSurfacePresenceParams());

    expect(result.surfacePresenceId).toBeDefined();
    expect(result.userId).toBe(USER_ID);
    expect(result.roomId).toBe(ROOM_ID);
    expect(result.activeSurface).toBe('whiteboard');
    expect(result.presenceType).toBe('editor');
    expect(result.cursorState).toEqual({ x: 100, y: 200 });
    expect(result.organizationId).toBe(ORG_ID);

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_surface_presence');
  });

  it('updates existing surface presence on same room+user', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSurfacePresenceRow());

    const result = await updateSurfacePresence(
      makeSurfacePresenceParams({ activeSurface: 'mindmap', cursorState: { nodeId: 'n1' } })
    );

    expect(result.activeSurface).toBe('mindmap');
    expect(result.cursorState).toEqual({ nodeId: 'n1' });

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_surface_presence');
  });

  it('defaults cursorState to null', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await updateSurfacePresence(
      makeSurfacePresenceParams({ cursorState: undefined })
    );

    expect(result.cursorState).toBeNull();
  });

  it('rejects invalid surface via Zod', async () => {
    await expect(
      updateSurfacePresence({ ...makeSurfacePresenceParams(), activeSurface: 'invalid' as any })
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid presenceType via Zod', async () => {
    await expect(
      updateSurfacePresence({ ...makeSurfacePresenceParams(), presenceType: 'invalid' as any })
    ).rejects.toThrow(ZodError);
  });

  it('supports ai_agent presence type on surface', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await updateSurfacePresence(
      makeSurfacePresenceParams({
        userId: 'ai-001',
        presenceType: 'ai_agent',
        activeSurface: 'mindmap',
      })
    );

    expect(result.presenceType).toBe('ai_agent');
    expect(result.activeSurface).toBe('mindmap');
  });
});

describe('getWorkspacePresence', () => {
  it('returns all surface presence records for a room', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSurfacePresenceRow(),
      makeFakeSurfacePresenceRow({
        surface_presence_id: 'sp2',
        user_id: USER_ID_2,
        active_surface: 'mindmap',
      }),
    ]);

    const results = await getWorkspacePresence(ROOM_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].activeSurface).toBe('whiteboard');
    expect(results[1].activeSurface).toBe('mindmap');
  });

  it('returns empty array when no presence exists', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getWorkspacePresence(ROOM_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getWorkspacePresence(ROOM_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

describe('getPresenceBySurface', () => {
  it('returns presence filtered by surface', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSurfacePresenceRow({ active_surface: 'whiteboard' })]);

    const results = await getPresenceBySurface(ROOM_ID, 'whiteboard', ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].activeSurface).toBe('whiteboard');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('active_surface = ?');
  });

  it('returns empty array when no presence on surface', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getPresenceBySurface(ROOM_ID, 'process_flow', ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Facilitation Lifecycle (Decision W4-2)
// ------------------------------------------

describe('startFacilitationSession', () => {
  it('creates a session in active state with initial phase', async () => {
    const result = await startFacilitationSession(makeFacilitationParams());

    expect(result.sessionId).toBeDefined();
    expect(result.roomId).toBe(ROOM_ID);
    expect(result.facilitatorUserId).toBe(USER_ID);
    expect(result.sessionState).toBe('active');
    expect(result.currentPhase).toBe('brainstorm');
    expect(result.phaseHistory).toHaveLength(1);
    expect(result.phaseHistory[0].phase).toBe('brainstorm');
    expect(result.pausedAt).toBeNull();
    expect(result.endedAt).toBeNull();
    expect(result.pauseReason).toBeNull();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_facilitation_sessions');
  });

  it('creates a session without initial phase', async () => {
    const result = await startFacilitationSession(
      makeFacilitationParams({ initialPhase: undefined })
    );

    expect(result.currentPhase).toBeNull();
    expect(result.phaseHistory).toHaveLength(0);
  });

  it('rejects invalid roomId via Zod', async () => {
    await expect(
      startFacilitationSession({ ...makeFacilitationParams(), roomId: 'not-uuid' })
    ).rejects.toThrow(ZodError);
  });

  it('rejects missing facilitatorUserId via Zod', async () => {
    await expect(
      startFacilitationSession({ ...makeFacilitationParams(), facilitatorUserId: '' })
    ).rejects.toThrow(ZodError);
  });
});

describe('pauseFacilitationSession', () => {
  it('pauses an active session with facilitator_disconnect reason', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow());

    const result = await pauseFacilitationSession(SESSION_ID, 'facilitator_disconnect', ORG_ID);

    expect(result.sessionState).toBe('paused_degraded');
    expect(result.pausedAt).not.toBeNull();
    expect(result.pauseReason).toBe('facilitator_disconnect');

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("session_state = 'paused_degraded'");
  });

  it('pauses with room_degraded reason', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow());

    const result = await pauseFacilitationSession(SESSION_ID, 'room_degraded', ORG_ID);

    expect(result.pauseReason).toBe('room_degraded');
  });

  it('pauses with manual reason', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow());

    const result = await pauseFacilitationSession(SESSION_ID, 'manual', ORG_ID);

    expect(result.pauseReason).toBe('manual');
  });

  it('rejects pausing an already paused session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow({ session_state: 'paused_degraded' }));

    await expect(pauseFacilitationSession(SESSION_ID, 'manual', ORG_ID)).rejects.toThrow(
      'Invalid facilitation state transition: paused_degraded → paused_degraded'
    );
  });

  it('rejects pausing an ended session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow({ session_state: 'ended' }));

    await expect(pauseFacilitationSession(SESSION_ID, 'manual', ORG_ID)).rejects.toThrow(
      'Invalid facilitation state transition: ended → paused_degraded'
    );
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(pauseFacilitationSession('nonexistent', 'manual', ORG_ID)).rejects.toThrow(
      'Facilitation session nonexistent not found'
    );
  });
});

describe('resumeFacilitationSession', () => {
  it('resumes a paused session back to active', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeFacilitationRow({
        session_state: 'paused_degraded',
        paused_at: '2026-03-23T10:05:00.000Z',
        pause_reason: 'facilitator_disconnect',
      })
    );

    const result = await resumeFacilitationSession(SESSION_ID, ORG_ID);

    expect(result.sessionState).toBe('active');
    expect(result.pausedAt).toBeNull();
    expect(result.pauseReason).toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("session_state = 'active'");
  });

  it('rejects resuming an active session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow({ session_state: 'active' }));

    await expect(resumeFacilitationSession(SESSION_ID, ORG_ID)).rejects.toThrow(
      'Invalid facilitation state transition: active → active'
    );
  });

  it('rejects resuming an ended session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow({ session_state: 'ended' }));

    await expect(resumeFacilitationSession(SESSION_ID, ORG_ID)).rejects.toThrow(
      'Invalid facilitation state transition: ended → active'
    );
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resumeFacilitationSession('nonexistent', ORG_ID)).rejects.toThrow(
      'Facilitation session nonexistent not found'
    );
  });
});

describe('endFacilitationSession', () => {
  it('ends an active session and closes current phase', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow());

    const result = await endFacilitationSession(SESSION_ID, ORG_ID);

    expect(result.sessionState).toBe('ended');
    expect(result.endedAt).not.toBeNull();
    expect(result.phaseHistory[0].endedAt).not.toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("session_state = 'ended'");
  });

  it('ends a paused session', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeFacilitationRow({
        session_state: 'paused_degraded',
        paused_at: '2026-03-23T10:05:00.000Z',
        pause_reason: 'room_degraded',
      })
    );

    const result = await endFacilitationSession(SESSION_ID, ORG_ID);

    expect(result.sessionState).toBe('ended');
    expect(result.endedAt).not.toBeNull();
  });

  it('rejects ending an already ended session', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow({ session_state: 'ended' }));

    await expect(endFacilitationSession(SESSION_ID, ORG_ID)).rejects.toThrow(
      'Invalid facilitation state transition: ended → ended'
    );
  });

  it('throws when session not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(endFacilitationSession('nonexistent', ORG_ID)).rejects.toThrow(
      'Facilitation session nonexistent not found'
    );
  });
});

describe('facilitation full lifecycle: active → paused → resumed → ended', () => {
  it('completes the full lifecycle', async () => {
    const started = await startFacilitationSession(makeFacilitationParams());
    expect(started.sessionState).toBe('active');

    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow());
    const paused = await pauseFacilitationSession(
      started.sessionId,
      'facilitator_disconnect',
      ORG_ID
    );
    expect(paused.sessionState).toBe('paused_degraded');

    mockDbGet.mockResolvedValueOnce(
      makeFakeFacilitationRow({
        session_state: 'paused_degraded',
        paused_at: paused.pausedAt,
        pause_reason: 'facilitator_disconnect',
      })
    );
    const resumed = await resumeFacilitationSession(started.sessionId, ORG_ID);
    expect(resumed.sessionState).toBe('active');

    mockDbGet.mockResolvedValueOnce(makeFakeFacilitationRow({ session_state: 'active' }));
    const ended = await endFacilitationSession(started.sessionId, ORG_ID);
    expect(ended.sessionState).toBe('ended');
    expect(ended.endedAt).not.toBeNull();
  });
});

describe('facilitation org isolation', () => {
  it('getFacilitationSession enforces org_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getFacilitationSession(SESSION_ID, OTHER_ORG_ID);
    expect(result).toBeNull();

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('pauseFacilitationSession rejects cross-org access', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(pauseFacilitationSession(SESSION_ID, 'manual', OTHER_ORG_ID)).rejects.toThrow(
      `Facilitation session ${SESSION_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });

  it('resumeFacilitationSession rejects cross-org access', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resumeFacilitationSession(SESSION_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Facilitation session ${SESSION_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });

  it('endFacilitationSession rejects cross-org access', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(endFacilitationSession(SESSION_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Facilitation session ${SESSION_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ------------------------------------------
// Platform Seam Registry
// ------------------------------------------

describe('registerSeam', () => {
  it('registers a seam in module_local state by default', async () => {
    const result = await registerSeam(makeSeamParams());

    expect(result.seamId).toBeDefined();
    expect(result.toolName).toBe('whiteboard');
    expect(result.seamType).toBe('room_binding');
    expect(result.currentState).toBe('module_local');
    expect(result.v4SeamRef).toBeNull();
    expect(result.migratedAt).toBeNull();

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_platform_seam_registry');
  });

  it('registers a seam with v4 reference', async () => {
    const result = await registerSeam(makeSeamParams({ v4SeamRef: 'realtime_channels' }));

    expect(result.v4SeamRef).toBe('realtime_channels');
  });

  it('registers a seam with explicit state', async () => {
    const result = await registerSeam(makeSeamParams({ currentState: 'platform_migrated' }));

    expect(result.currentState).toBe('platform_migrated');
  });

  it('rejects invalid seamType via Zod', async () => {
    await expect(registerSeam({ ...makeSeamParams(), seamType: 'invalid' as any })).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid toolName via Zod', async () => {
    await expect(registerSeam({ ...makeSeamParams(), toolName: 'invalid' as any })).rejects.toThrow(
      ZodError
    );
  });
});

describe('migrateSeam', () => {
  it('transitions seam from module_local to platform_migrated', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSeamRow());

    const result = await migrateSeam(SEAM_ID, ORG_ID);

    expect(result.currentState).toBe('platform_migrated');
    expect(result.migratedAt).not.toBeNull();

    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain("current_state = 'platform_migrated'");
  });

  it('rejects migrating an already migrated seam', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSeamRow({ current_state: 'platform_migrated' }));

    await expect(migrateSeam(SEAM_ID, ORG_ID)).rejects.toThrow('already platform_migrated');
  });

  it('rejects migrating an eliminated seam', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSeamRow({ current_state: 'eliminated' }));

    await expect(migrateSeam(SEAM_ID, ORG_ID)).rejects.toThrow('already eliminated');
  });

  it('throws when seam not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(migrateSeam('nonexistent', ORG_ID)).rejects.toThrow('Seam nonexistent not found');
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(migrateSeam(SEAM_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Seam ${SEAM_ID} not found in organization ${OTHER_ORG_ID}`
    );
  });
});

describe('getSeamsByOrg', () => {
  it('returns all seams for an org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSeamRow(),
      makeFakeSeamRow({ seam_id: 's2', seam_type: 'presence' }),
    ]);

    const results = await getSeamsByOrg(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].seamType).toBe('room_binding');
    expect(results[1].seamType).toBe('presence');
  });

  it('filters by toolName when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSeamRow()]);

    const results = await getSeamsByOrg(ORG_ID, 'whiteboard');

    expect(results).toHaveLength(1);
    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('tool_name = ?');
  });

  it('returns empty array when no seams exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSeamsByOrg(ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Tool Event Registration
// ------------------------------------------

describe('registerToolEvent', () => {
  it('registers a durable tool event with surface context', async () => {
    const result = await registerToolEvent(makeToolEventParams());

    expect(result.registrationId).toBeDefined();
    expect(result.eventType).toBe('board.object_created');
    expect(result.toolName).toBe('whiteboard');
    expect(result.deliveryTier).toBe('durable');
    expect(result.surfaceContext).toBe(true);
    expect(result.registered).toBe(true);

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_tool_event_registry');
  });

  it('registers an ephemeral event without surface context', async () => {
    const result = await registerToolEvent(
      makeToolEventParams({
        eventType: 'surface.switched',
        deliveryTier: 'ephemeral',
        surfaceContext: false,
      })
    );

    expect(result.deliveryTier).toBe('ephemeral');
    expect(result.surfaceContext).toBe(false);
  });

  it('rejects invalid deliveryTier via Zod', async () => {
    await expect(
      registerToolEvent({ ...makeToolEventParams(), deliveryTier: 'invalid' as any })
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty eventType via Zod', async () => {
    await expect(registerToolEvent({ ...makeToolEventParams(), eventType: '' })).rejects.toThrow(
      ZodError
    );
  });
});

describe('getToolEvents', () => {
  it('returns registered events for a tool', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeToolEventRow(),
      makeFakeToolEventRow({ registration_id: 'r2', event_type: 'board.object_moved' }),
    ]);

    const results = await getToolEvents('whiteboard', ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].eventType).toBe('board.object_created');
    expect(results[1].eventType).toBe('board.object_moved');
  });

  it('returns empty array when no events registered', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getToolEvents('notebook', ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getToolEvents('whiteboard', OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// Facilitation State Machine Completeness
// ------------------------------------------

describe('facilitation state machine completeness', () => {
  it('VALID_FACILITATION_TRANSITIONS covers all states', () => {
    const allStates: FacilitationSessionState[] = ['active', 'paused_degraded', 'ended'];
    for (const state of allStates) {
      expect(VALID_FACILITATION_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_FACILITATION_STATES) {
      const transitions = VALID_FACILITATION_TRANSITIONS[state];
      expect(transitions).toHaveLength(0);
    }
  });

  it('active allows paused_degraded and ended', () => {
    expect(VALID_FACILITATION_TRANSITIONS.active).toContain('paused_degraded');
    expect(VALID_FACILITATION_TRANSITIONS.active).toContain('ended');
    expect(VALID_FACILITATION_TRANSITIONS.active).toHaveLength(2);
  });

  it('paused_degraded allows active and ended', () => {
    expect(VALID_FACILITATION_TRANSITIONS.paused_degraded).toContain('active');
    expect(VALID_FACILITATION_TRANSITIONS.paused_degraded).toContain('ended');
    expect(VALID_FACILITATION_TRANSITIONS.paused_degraded).toHaveLength(2);
  });

  it('ended has no outgoing transitions', () => {
    expect(VALID_FACILITATION_TRANSITIONS.ended).toHaveLength(0);
  });
});

// ------------------------------------------
// Zod Schema Validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct ResourceTypeMapping', () => {
    expect(() =>
      ResourceTypeMappingSchema.parse({
        mappingId: '00000000-0000-4000-8000-000000000001',
        resourceType: 'whiteboard',
        roomGranularity: 'per_workspace',
        embeddedIn: 'workspace',
        surfaceAware: true,
        organizationId: ORG_ID,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects ResourceTypeMapping with invalid resourceType', () => {
    expect(() =>
      ResourceTypeMappingSchema.parse({
        mappingId: '00000000-0000-4000-8000-000000000001',
        resourceType: 'invalid',
        roomGranularity: 'per_workspace',
        embeddedIn: null,
        surfaceAware: false,
        organizationId: ORG_ID,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates a correct SurfacePresence', () => {
    expect(() =>
      SurfacePresenceSchema.parse({
        surfacePresenceId: '00000000-0000-4000-8000-000000000001',
        userId: USER_ID,
        roomId: ROOM_ID,
        activeSurface: 'whiteboard',
        presenceType: 'editor',
        cursorState: null,
        lastHeartbeat: '2026-03-23T10:00:00.000Z',
        organizationId: ORG_ID,
      })
    ).not.toThrow();
  });

  it('validates a correct FacilitationSession', () => {
    expect(() =>
      FacilitationSessionSchema.parse({
        sessionId: '00000000-0000-4000-8000-000000000001',
        roomId: ROOM_ID,
        facilitatorUserId: USER_ID,
        sessionState: 'active',
        currentPhase: 'brainstorm',
        phaseHistory: [
          { phase: 'brainstorm', startedAt: '2026-03-23T10:00:00.000Z', endedAt: null },
        ],
        startedAt: '2026-03-23T10:00:00.000Z',
        pausedAt: null,
        endedAt: null,
        pauseReason: null,
        organizationId: ORG_ID,
      })
    ).not.toThrow();
  });

  it('validates a correct PlatformSeamRecord', () => {
    expect(() =>
      PlatformSeamRecordSchema.parse({
        seamId: '00000000-0000-4000-8000-000000000001',
        toolName: 'whiteboard',
        seamType: 'room_binding',
        currentState: 'module_local',
        v4SeamRef: null,
        organizationId: ORG_ID,
        createdAt: '2026-03-23T10:00:00.000Z',
        migratedAt: null,
      })
    ).not.toThrow();
  });

  it('validates a correct ToolEventRegistration', () => {
    expect(() =>
      ToolEventRegistrationSchema.parse({
        registrationId: '00000000-0000-4000-8000-000000000001',
        eventType: 'board.object_created',
        toolName: 'whiteboard',
        deliveryTier: 'durable',
        surfaceContext: true,
        registered: true,
        organizationId: ORG_ID,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates RegisterResourceTypeMappingParams', () => {
    expect(() => RegisterResourceTypeMappingParamsSchema.parse(makeMappingParams())).not.toThrow();
  });

  it('validates UpdateSurfacePresenceParams', () => {
    expect(() =>
      UpdateSurfacePresenceParamsSchema.parse(makeSurfacePresenceParams())
    ).not.toThrow();
  });

  it('validates StartFacilitationParams', () => {
    expect(() => StartFacilitationParamsSchema.parse(makeFacilitationParams())).not.toThrow();
  });

  it('validates RegisterSeamParams', () => {
    expect(() => RegisterSeamParamsSchema.parse(makeSeamParams())).not.toThrow();
  });

  it('validates RegisterToolEventParams', () => {
    expect(() => RegisterToolEventParamsSchema.parse(makeToolEventParams())).not.toThrow();
  });
});

// ------------------------------------------
// Enum Completeness
// ------------------------------------------

describe('enum completeness', () => {
  it('WorkspaceToolValues covers all 6 tools', () => {
    expect(WorkspaceToolValues).toHaveLength(6);
    expect(WorkspaceToolValues).toContain('workspace');
    expect(WorkspaceToolValues).toContain('whiteboard');
    expect(WorkspaceToolValues).toContain('table');
    expect(WorkspaceToolValues).toContain('notebook');
    expect(WorkspaceToolValues).toContain('mindmap');
    expect(WorkspaceToolValues).toContain('processflow');
  });

  it('SurfaceValues covers all 5 surfaces', () => {
    expect(SurfaceValues).toHaveLength(5);
    expect(SurfaceValues).toContain('mindmap');
    expect(SurfaceValues).toContain('whiteboard');
    expect(SurfaceValues).toContain('process_flow');
    expect(SurfaceValues).toContain('table');
    expect(SurfaceValues).toContain('notebook');
  });

  it('FacilitationSessionStateValues covers 3 states', () => {
    expect(FacilitationSessionStateValues).toHaveLength(3);
    expect(FacilitationSessionStateValues).toContain('active');
    expect(FacilitationSessionStateValues).toContain('paused_degraded');
    expect(FacilitationSessionStateValues).toContain('ended');
  });

  it('SeamTypeValues covers all 8 seam types', () => {
    expect(SeamTypeValues).toHaveLength(8);
    expect(SeamTypeValues).toContain('room_binding');
    expect(SeamTypeValues).toContain('presence');
    expect(SeamTypeValues).toContain('events');
    expect(SeamTypeValues).toContain('locking');
    expect(SeamTypeValues).toContain('degraded_state');
    expect(SeamTypeValues).toContain('reconnect');
    expect(SeamTypeValues).toContain('authorization');
    expect(SeamTypeValues).toContain('facilitation');
  });

  it('SeamCurrentStateValues covers 3 states', () => {
    expect(SeamCurrentStateValues).toHaveLength(3);
    expect(SeamCurrentStateValues).toContain('module_local');
    expect(SeamCurrentStateValues).toContain('platform_migrated');
    expect(SeamCurrentStateValues).toContain('eliminated');
  });
});
