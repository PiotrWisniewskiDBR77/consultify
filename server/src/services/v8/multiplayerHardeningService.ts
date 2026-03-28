/**
 * V8 Multiplayer Platform Hardening Service
 *
 * Extends the Wave 1 CollaborationRoom baseline with:
 * - Per-tool room mapping registration and resolution (Decision W4-1)
 * - Surface-aware presence (Decision W4-5)
 * - Facilitation lifecycle with pause/resume (Decision W4-2)
 * - Platform seam registry
 * - Tool event registration
 *
 * All queries enforce organization-level isolation.
 * Does NOT modify existing collaborationRoomService.ts.
 */

import { v4 as uuidv4 } from 'uuid';

import type { CollaborationRoom, RoomPresence, RoomState } from '../../types/collaborationRoom.js';
import type {
  FacilitationPauseReason,
  FacilitationPhaseEntry,
  FacilitationSession,
  FacilitationSessionState,
  PlatformSeamRecord,
  RegisterResourceTypeMappingParams,
  RegisterSeamParams,
  RegisterToolEventParams,
  ResourceTypeMapping,
  StartFacilitationParams,
  Surface,
  SurfacePresence,
  ToolEventRegistration,
  UpdateSurfacePresenceParams,
  WorkspaceTool,
} from '../../types/multiplayerHardening.js';
import {
  RegisterResourceTypeMappingParamsSchema,
  RegisterSeamParamsSchema,
  RegisterToolEventParamsSchema,
  StartFacilitationParamsSchema,
  TERMINAL_FACILITATION_STATES,
  UpdateSurfacePresenceParamsSchema,
  VALID_FACILITATION_TRANSITIONS,
} from '../../types/multiplayerHardening.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:MultiplayerHardening]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

function isValidFacilitationTransition(
  from: FacilitationSessionState,
  to: FacilitationSessionState
): boolean {
  const allowed = VALID_FACILITATION_TRANSITIONS[from];
  return allowed.includes(to);
}

// ==========================================
// ROW TYPES
// ==========================================

interface ResourceTypeMappingRow {
  mapping_id: string;
  resource_type: string;
  room_granularity: string;
  embedded_in: string | null;
  surface_aware: number;
  organization_id: string;
  created_at: string;
}

interface SurfacePresenceRow {
  surface_presence_id: string;
  user_id: string;
  room_id: string;
  active_surface: string;
  presence_type: string;
  cursor_state: string | null;
  last_heartbeat: string;
  organization_id: string;
}

interface FacilitationSessionRow {
  session_id: string;
  room_id: string;
  facilitator_user_id: string;
  session_state: string;
  current_phase: string | null;
  phase_history: string;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  pause_reason: string | null;
  organization_id: string;
}

interface PlatformSeamRow {
  seam_id: string;
  tool_name: string;
  seam_type: string;
  current_state: string;
  v4_seam_ref: string | null;
  organization_id: string;
  created_at: string;
  migrated_at: string | null;
}

interface ToolEventRow {
  registration_id: string;
  event_type: string;
  tool_name: string;
  delivery_tier: string;
  surface_context: number;
  registered: number;
  organization_id: string;
  created_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToResourceTypeMapping(row: ResourceTypeMappingRow): ResourceTypeMapping {
  return {
    mappingId: row.mapping_id,
    resourceType: row.resource_type as WorkspaceTool,
    roomGranularity: row.room_granularity as ResourceTypeMapping['roomGranularity'],
    embeddedIn: (row.embedded_in as WorkspaceTool) || null,
    surfaceAware: Boolean(row.surface_aware),
    organizationId: row.organization_id,
    createdAt: row.created_at,
  };
}

function rowToSurfacePresence(row: SurfacePresenceRow): SurfacePresence {
  return {
    surfacePresenceId: row.surface_presence_id,
    userId: row.user_id,
    roomId: row.room_id,
    activeSurface: row.active_surface as Surface,
    presenceType: row.presence_type as SurfacePresence['presenceType'],
    cursorState: safeJsonParse<Record<string, unknown> | null>(row.cursor_state, null),
    lastHeartbeat: row.last_heartbeat,
    organizationId: row.organization_id,
  };
}

function rowToFacilitationSession(row: FacilitationSessionRow): FacilitationSession {
  return {
    sessionId: row.session_id,
    roomId: row.room_id,
    facilitatorUserId: row.facilitator_user_id,
    sessionState: row.session_state as FacilitationSessionState,
    currentPhase: row.current_phase || null,
    phaseHistory: safeJsonParse<FacilitationPhaseEntry[]>(row.phase_history, []),
    startedAt: row.started_at,
    pausedAt: row.paused_at || null,
    endedAt: row.ended_at || null,
    pauseReason: (row.pause_reason as FacilitationPauseReason) || null,
    organizationId: row.organization_id,
  };
}

function rowToSeamRecord(row: PlatformSeamRow): PlatformSeamRecord {
  return {
    seamId: row.seam_id,
    toolName: row.tool_name as WorkspaceTool,
    seamType: row.seam_type as PlatformSeamRecord['seamType'],
    currentState: row.current_state as PlatformSeamRecord['currentState'],
    v4SeamRef: row.v4_seam_ref || null,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    migratedAt: row.migrated_at || null,
  };
}

function rowToToolEventRegistration(row: ToolEventRow): ToolEventRegistration {
  return {
    registrationId: row.registration_id,
    eventType: row.event_type,
    toolName: row.tool_name as WorkspaceTool,
    deliveryTier: row.delivery_tier as ToolEventRegistration['deliveryTier'],
    surfaceContext: Boolean(row.surface_context),
    registered: Boolean(row.registered),
    organizationId: row.organization_id,
    createdAt: row.created_at,
  };
}

// ==========================================
// PUBLIC API — RESOURCE TYPE MAPPING
// ==========================================

/**
 * Register how a workspace tool maps to collaboration rooms.
 */
export async function registerResourceTypeMapping(
  params: RegisterResourceTypeMappingParams
): Promise<ResourceTypeMapping> {
  const validated = RegisterResourceTypeMappingParamsSchema.parse(params);

  const mappingId = uuidv4();
  const now = new Date().toISOString();

  const mapping: ResourceTypeMapping = {
    mappingId,
    resourceType: validated.resourceType,
    roomGranularity: validated.roomGranularity,
    embeddedIn: validated.embeddedIn,
    surfaceAware: validated.surfaceAware,
    organizationId: validated.organizationId,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_resource_type_mappings (
      mapping_id, resource_type, room_granularity, embedded_in,
      surface_aware, organization_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      mapping.mappingId,
      mapping.resourceType,
      mapping.roomGranularity,
      mapping.embeddedIn,
      mapping.surfaceAware ? 1 : 0,
      mapping.organizationId,
      mapping.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered resource type mapping: ${mapping.resourceType} (${mapping.roomGranularity}) in org ${mapping.organizationId}`
  );
  return mapping;
}

/**
 * Decision W4-1: Resolve room binding for a resource.
 * Embedded surfaces bind to parent workspace room; standalone surfaces bind to their own room.
 */
export async function resolveRoomBinding(
  resourceType: WorkspaceTool,
  resourceId: string,
  organizationId: string,
  parentResourceId?: string
): Promise<{ roomResourceType: string; roomResourceId: string }> {
  const mapping = await dbGet<ResourceTypeMappingRow>(
    `SELECT * FROM v8_resource_type_mappings
     WHERE resource_type = ? AND organization_id = ?`,
    [resourceType, organizationId],
    { fallback: true }
  );

  if (!mapping) {
    return { roomResourceType: resourceType, roomResourceId: resourceId };
  }

  if (mapping.embedded_in && parentResourceId) {
    return {
      roomResourceType: mapping.embedded_in,
      roomResourceId: parentResourceId,
    };
  }

  return { roomResourceType: resourceType, roomResourceId: resourceId };
}

/**
 * Get the resource type mapping for a tool in an organization.
 */
export async function getResourceTypeMapping(
  resourceType: WorkspaceTool,
  organizationId: string
): Promise<ResourceTypeMapping | null> {
  const row = await dbGet<ResourceTypeMappingRow>(
    `SELECT * FROM v8_resource_type_mappings
     WHERE resource_type = ? AND organization_id = ?`,
    [resourceType, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToResourceTypeMapping(row);
}

// ==========================================
// PUBLIC API — SURFACE PRESENCE
// ==========================================

/**
 * Decision W4-5: Update surface-aware presence with surface detail.
 * Upserts by (room_id, user_id) — one presence per user per room.
 */
export async function updateSurfacePresence(
  params: UpdateSurfacePresenceParams
): Promise<SurfacePresence> {
  const validated = UpdateSurfacePresenceParamsSchema.parse(params);

  const now = new Date().toISOString();
  const cursorStateJson = validated.cursorState ? JSON.stringify(validated.cursorState) : null;

  const existing = await dbGet<SurfacePresenceRow>(
    `SELECT * FROM v8_surface_presence
     WHERE room_id = ? AND user_id = ?`,
    [validated.roomId, validated.userId],
    { fallback: true }
  );

  if (existing) {
    await dbRun(
      `UPDATE v8_surface_presence
       SET active_surface = ?, presence_type = ?, cursor_state = ?,
           last_heartbeat = ?, organization_id = ?
       WHERE room_id = ? AND user_id = ?`,
      [
        validated.activeSurface,
        validated.presenceType,
        cursorStateJson,
        now,
        validated.organizationId,
        validated.roomId,
        validated.userId,
      ]
    );

    return {
      surfacePresenceId: existing.surface_presence_id,
      userId: validated.userId,
      roomId: validated.roomId,
      activeSurface: validated.activeSurface,
      presenceType: validated.presenceType,
      cursorState: validated.cursorState ?? null,
      lastHeartbeat: now,
      organizationId: validated.organizationId,
    };
  }

  const surfacePresenceId = uuidv4();

  await dbRun(
    `INSERT INTO v8_surface_presence (
      surface_presence_id, user_id, room_id, active_surface,
      presence_type, cursor_state, last_heartbeat, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      surfacePresenceId,
      validated.userId,
      validated.roomId,
      validated.activeSurface,
      validated.presenceType,
      cursorStateJson,
      now,
      validated.organizationId,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Surface presence: user ${validated.userId} on ${validated.activeSurface} in room ${validated.roomId}`
  );

  return {
    surfacePresenceId,
    userId: validated.userId,
    roomId: validated.roomId,
    activeSurface: validated.activeSurface,
    presenceType: validated.presenceType,
    cursorState: validated.cursorState ?? null,
    lastHeartbeat: now,
    organizationId: validated.organizationId,
  };
}

/**
 * Get all surface presence records for a workspace room (aggregated across surfaces).
 */
export async function getWorkspacePresence(
  roomId: string,
  orgId: string
): Promise<SurfacePresence[]> {
  const rows = await dbAll<SurfacePresenceRow>(
    `SELECT * FROM v8_surface_presence
     WHERE room_id = ? AND organization_id = ?
     ORDER BY last_heartbeat DESC`,
    [roomId, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToSurfacePresence);
}

/**
 * Get surface presence filtered by a specific surface within a room.
 */
export async function getPresenceBySurface(
  roomId: string,
  surface: Surface,
  orgId: string
): Promise<SurfacePresence[]> {
  const rows = await dbAll<SurfacePresenceRow>(
    `SELECT * FROM v8_surface_presence
     WHERE room_id = ? AND active_surface = ? AND organization_id = ?
     ORDER BY last_heartbeat DESC`,
    [roomId, surface, orgId],
    { fallback: true }
  );

  return (rows || []).map(rowToSurfacePresence);
}

// ==========================================
// PUBLIC API — FACILITATION LIFECYCLE
// ==========================================

/**
 * Start a new facilitation session on a room.
 */
export async function startFacilitationSession(
  params: StartFacilitationParams
): Promise<FacilitationSession> {
  const validated = StartFacilitationParamsSchema.parse(params);

  const sessionId = uuidv4();
  const now = new Date().toISOString();

  const phaseHistory: FacilitationPhaseEntry[] = validated.initialPhase
    ? [{ phase: validated.initialPhase, startedAt: now, endedAt: null }]
    : [];

  const session: FacilitationSession = {
    sessionId,
    roomId: validated.roomId,
    facilitatorUserId: validated.facilitatorUserId,
    sessionState: 'active',
    currentPhase: validated.initialPhase ?? null,
    phaseHistory,
    startedAt: now,
    pausedAt: null,
    endedAt: null,
    pauseReason: null,
    organizationId: validated.organizationId,
  };

  await dbRun(
    `INSERT INTO v8_facilitation_sessions (
      session_id, room_id, facilitator_user_id, session_state,
      current_phase, phase_history, started_at, paused_at, ended_at,
      pause_reason, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.sessionId,
      session.roomId,
      session.facilitatorUserId,
      session.sessionState,
      session.currentPhase,
      JSON.stringify(session.phaseHistory),
      session.startedAt,
      session.pausedAt,
      session.endedAt,
      session.pauseReason,
      session.organizationId,
    ]
  );

  logger.info(`${LOG_PREFIX} Facilitation session ${sessionId} started in room ${session.roomId}`);
  return session;
}

/**
 * Get a facilitation session by ID with org isolation.
 */
export async function getFacilitationSession(
  sessionId: string,
  organizationId: string
): Promise<FacilitationSession | null> {
  const row = await dbGet<FacilitationSessionRow>(
    `SELECT * FROM v8_facilitation_sessions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToFacilitationSession(row);
}

/**
 * Decision W4-2: Pause a facilitation session with explicit reason.
 * Timer stops, votes and phase state preserved, explicit resume required.
 */
export async function pauseFacilitationSession(
  sessionId: string,
  reason: FacilitationPauseReason,
  organizationId: string
): Promise<FacilitationSession> {
  const session = await getFacilitationSession(sessionId, organizationId);
  if (!session) {
    throw new Error(
      `Facilitation session ${sessionId} not found in organization ${organizationId}`
    );
  }

  if (!isValidFacilitationTransition(session.sessionState, 'paused_degraded')) {
    throw new Error(
      `Invalid facilitation state transition: ${session.sessionState} → paused_degraded. ` +
        `Allowed from ${session.sessionState}: [${VALID_FACILITATION_TRANSITIONS[session.sessionState].join(', ')}]`
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_facilitation_sessions
     SET session_state = 'paused_degraded', paused_at = ?, pause_reason = ?
     WHERE session_id = ? AND organization_id = ?`,
    [now, reason, sessionId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Facilitation session ${sessionId} paused: ${reason}`);

  return {
    ...session,
    sessionState: 'paused_degraded',
    pausedAt: now,
    pauseReason: reason,
  };
}

/**
 * Resume a paused facilitation session.
 */
export async function resumeFacilitationSession(
  sessionId: string,
  organizationId: string
): Promise<FacilitationSession> {
  const session = await getFacilitationSession(sessionId, organizationId);
  if (!session) {
    throw new Error(
      `Facilitation session ${sessionId} not found in organization ${organizationId}`
    );
  }

  if (!isValidFacilitationTransition(session.sessionState, 'active')) {
    throw new Error(
      `Invalid facilitation state transition: ${session.sessionState} → active. ` +
        `Allowed from ${session.sessionState}: [${VALID_FACILITATION_TRANSITIONS[session.sessionState].join(', ')}]`
    );
  }

  await dbRun(
    `UPDATE v8_facilitation_sessions
     SET session_state = 'active', paused_at = NULL, pause_reason = NULL
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Facilitation session ${sessionId} resumed`);

  return {
    ...session,
    sessionState: 'active',
    pausedAt: null,
    pauseReason: null,
  };
}

/**
 * End a facilitation session. Terminal state — no further transitions.
 */
export async function endFacilitationSession(
  sessionId: string,
  organizationId: string
): Promise<FacilitationSession> {
  const session = await getFacilitationSession(sessionId, organizationId);
  if (!session) {
    throw new Error(
      `Facilitation session ${sessionId} not found in organization ${organizationId}`
    );
  }

  if (!isValidFacilitationTransition(session.sessionState, 'ended')) {
    throw new Error(
      `Invalid facilitation state transition: ${session.sessionState} → ended. ` +
        `Allowed from ${session.sessionState}: [${VALID_FACILITATION_TRANSITIONS[session.sessionState].join(', ')}]`
    );
  }

  const now = new Date().toISOString();

  const updatedPhaseHistory = [...session.phaseHistory];
  if (session.currentPhase && updatedPhaseHistory.length > 0) {
    const lastPhase = updatedPhaseHistory[updatedPhaseHistory.length - 1];
    if (!lastPhase.endedAt) {
      lastPhase.endedAt = now;
    }
  }

  await dbRun(
    `UPDATE v8_facilitation_sessions
     SET session_state = 'ended', ended_at = ?, phase_history = ?
     WHERE session_id = ? AND organization_id = ?`,
    [now, JSON.stringify(updatedPhaseHistory), sessionId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Facilitation session ${sessionId} ended`);

  return {
    ...session,
    sessionState: 'ended',
    endedAt: now,
    phaseHistory: updatedPhaseHistory,
  };
}

// ==========================================
// PUBLIC API — PLATFORM SEAM REGISTRY
// ==========================================

/**
 * Register a platform seam for tracking migration progress.
 */
export async function registerSeam(params: RegisterSeamParams): Promise<PlatformSeamRecord> {
  const validated = RegisterSeamParamsSchema.parse(params);

  const seamId = uuidv4();
  const now = new Date().toISOString();

  const record: PlatformSeamRecord = {
    seamId,
    toolName: validated.toolName,
    seamType: validated.seamType,
    currentState: validated.currentState,
    v4SeamRef: validated.v4SeamRef,
    organizationId: validated.organizationId,
    createdAt: now,
    migratedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_platform_seam_registry (
      seam_id, tool_name, seam_type, current_state,
      v4_seam_ref, organization_id, created_at, migrated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.seamId,
      record.toolName,
      record.seamType,
      record.currentState,
      record.v4SeamRef,
      record.organizationId,
      record.createdAt,
      record.migratedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered seam: ${record.toolName}/${record.seamType} (${record.currentState})`
  );
  return record;
}

/**
 * Mark a seam as migrated to the platform.
 */
export async function migrateSeam(
  seamId: string,
  organizationId: string
): Promise<PlatformSeamRecord> {
  const row = await dbGet<PlatformSeamRow>(
    `SELECT * FROM v8_platform_seam_registry
     WHERE seam_id = ? AND organization_id = ?`,
    [seamId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Seam ${seamId} not found in organization ${organizationId}`);
  }

  if (row.current_state === 'platform_migrated' || row.current_state === 'eliminated') {
    throw new Error(`Seam ${seamId} is already ${row.current_state} — cannot migrate again`);
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_platform_seam_registry
     SET current_state = 'platform_migrated', migrated_at = ?
     WHERE seam_id = ? AND organization_id = ?`,
    [now, seamId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Seam ${seamId} migrated to platform`);

  return {
    ...rowToSeamRecord(row),
    currentState: 'platform_migrated',
    migratedAt: now,
  };
}

/**
 * Get all seam records for an organization, optionally filtered by tool.
 */
export async function getSeamsByOrg(
  organizationId: string,
  toolName?: WorkspaceTool
): Promise<PlatformSeamRecord[]> {
  if (toolName) {
    const rows = await dbAll<PlatformSeamRow>(
      `SELECT * FROM v8_platform_seam_registry
       WHERE organization_id = ? AND tool_name = ?
       ORDER BY created_at ASC`,
      [organizationId, toolName],
      { fallback: true }
    );
    return (rows || []).map(rowToSeamRecord);
  }

  const rows = await dbAll<PlatformSeamRow>(
    `SELECT * FROM v8_platform_seam_registry
     WHERE organization_id = ?
     ORDER BY created_at ASC`,
    [organizationId],
    { fallback: true }
  );
  return (rows || []).map(rowToSeamRecord);
}

// ==========================================
// PUBLIC API — TOOL EVENT REGISTRATION
// ==========================================

/**
 * Register a tool-specific event type in the platform event registry.
 */
export async function registerToolEvent(
  params: RegisterToolEventParams
): Promise<ToolEventRegistration> {
  const validated = RegisterToolEventParamsSchema.parse(params);

  const registrationId = uuidv4();
  const now = new Date().toISOString();

  const registration: ToolEventRegistration = {
    registrationId,
    eventType: validated.eventType,
    toolName: validated.toolName,
    deliveryTier: validated.deliveryTier,
    surfaceContext: validated.surfaceContext,
    registered: true,
    organizationId: validated.organizationId,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_event_registry (
      registration_id, event_type, tool_name, delivery_tier,
      surface_context, registered, organization_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      registration.registrationId,
      registration.eventType,
      registration.toolName,
      registration.deliveryTier,
      registration.surfaceContext ? 1 : 0,
      registration.registered ? 1 : 0,
      registration.organizationId,
      registration.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered tool event: ${registration.eventType} for ${registration.toolName}`
  );
  return registration;
}

/**
 * Get all registered events for a tool in an organization.
 */
export async function getToolEvents(
  toolName: WorkspaceTool,
  organizationId: string
): Promise<ToolEventRegistration[]> {
  const rows = await dbAll<ToolEventRow>(
    `SELECT * FROM v8_tool_event_registry
     WHERE tool_name = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [toolName, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToToolEventRegistration);
}

// ==========================================
// PUBLIC API — CROSS-CANVAS PRESENCE (Wave 7)
// ==========================================

interface RoomRow {
  room_id: string;
  resource_type: string;
  resource_id: string;
  organization_id: string;
  room_state: string;
  created_at: string;
  closed_at: string | null;
  metadata: string;
  degraded_since: string | null;
}

interface PresenceRow {
  presence_id: string;
  room_id: string;
  user_id: string;
  presence_type: string;
  cursor_state: string | null;
  last_heartbeat: string;
  connected_at: string;
  client_id: string;
  is_stale: number;
}

function rowToPresenceEntry(row: PresenceRow): RoomPresence {
  return {
    presenceId: row.presence_id,
    roomId: row.room_id,
    userId: row.user_id,
    presenceType: row.presence_type as RoomPresence['presenceType'],
    cursorState: safeJsonParse<Record<string, unknown> | null>(row.cursor_state, null),
    lastHeartbeat: row.last_heartbeat,
    connectedAt: row.connected_at,
    clientId: row.client_id,
    isStale: Boolean(row.is_stale),
  };
}

export interface CrossCanvasPresenceEntry {
  roomId: string;
  resourceType: string;
  resourceId: string;
  presenceEntries: RoomPresence[];
}

/**
 * Get presence across all rooms in a workspace (cross-canvas aggregation).
 * Returns presence grouped by room with resource metadata.
 */
export async function getCrossCanvasPresence(
  workspaceId: string,
  organizationId: string
): Promise<CrossCanvasPresenceEntry[]> {
  const roomRows = await dbAll<RoomRow>(
    `SELECT * FROM v8_collaboration_rooms
     WHERE organization_id = ? AND room_state != 'closed'
       AND (resource_id = ? OR metadata LIKE ?)
     ORDER BY created_at DESC`,
    [organizationId, workspaceId, `%"workspaceId":"${workspaceId}"%`],
    { fallback: true }
  );

  const rooms = roomRows || [];
  if (rooms.length === 0) return [];

  const result: CrossCanvasPresenceEntry[] = [];

  for (const room of rooms) {
    const presenceRows = await dbAll<PresenceRow>(
      `SELECT * FROM v8_room_presence
       WHERE room_id = ? AND is_stale = 0
       ORDER BY connected_at ASC`,
      [room.room_id],
      { fallback: true }
    );

    const presenceEntries = (presenceRows || []).map(rowToPresenceEntry);

    result.push({
      roomId: room.room_id,
      resourceType: room.resource_type,
      resourceId: room.resource_id,
      presenceEntries,
    });
  }

  logger.info(
    `${LOG_PREFIX} Cross-canvas presence for workspace ${workspaceId}: ${result.length} rooms`
  );
  return result;
}

export interface ToolRoomStatus {
  room: CollaborationRoom | null;
  activePresenceCount: number;
  stalePresenceCount: number;
  state: RoomState | null;
}

/**
 * Get the room status for a specific tool+resource combination.
 */
export async function getToolRoomStatus(
  toolType: WorkspaceTool,
  resourceId: string,
  organizationId: string
): Promise<ToolRoomStatus> {
  const roomRow = await dbGet<RoomRow>(
    `SELECT * FROM v8_collaboration_rooms
     WHERE resource_type = ? AND resource_id = ? AND organization_id = ?
       AND room_state != 'closed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [toolType, resourceId, organizationId],
    { fallback: true }
  );

  if (!roomRow) {
    return { room: null, activePresenceCount: 0, stalePresenceCount: 0, state: null };
  }

  const room: CollaborationRoom = {
    roomId: roomRow.room_id,
    resourceType: roomRow.resource_type,
    resourceId: roomRow.resource_id,
    organizationId: roomRow.organization_id,
    roomState: roomRow.room_state as RoomState,
    createdAt: roomRow.created_at,
    closedAt: roomRow.closed_at || null,
    metadata: safeJsonParse(roomRow.metadata, {}),
  };

  const activeRows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence WHERE room_id = ? AND is_stale = 0`,
    [room.roomId],
    { fallback: true }
  );

  const staleRows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence WHERE room_id = ? AND is_stale = 1`,
    [room.roomId],
    { fallback: true }
  );

  return {
    room,
    activePresenceCount: (activeRows || []).length,
    stalePresenceCount: (staleRows || []).length,
    state: room.roomState,
  };
}
