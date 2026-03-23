/**
 * V8 CollaborationRoom Service
 *
 * Manages the multiplayer room lifecycle for the V8 runtime.
 * Creates rooms, tracks presence/membership, validates state transitions,
 * and records collaboration events.
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CollaborationEvent,
  CollaborationEventType,
  CollaborationRoom,
  CreateRoomParams,
  GetEventsOptions,
  RecordEventParams,
  RoomMembership,
  RoomPresence,
  RoomState,
  PresenceType,
  UpdatePresenceParams,
} from '../../types/collaborationRoom.js';
import {
  CreateRoomParamsSchema,
  JoinRoomParamsSchema,
  RecordEventParamsSchema,
  UpdatePresenceParamsSchema,
  VALID_ROOM_TRANSITIONS,
  TERMINAL_ROOM_STATES,
} from '../../types/collaborationRoom.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:CollaborationRoom]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
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

interface MembershipRow {
  membership_id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  role: string;
}

interface EventRow {
  event_id: string;
  room_id: string;
  event_type: string;
  actor_id: string;
  actor_type: string;
  delivery: string;
  payload: string;
  timestamp: string;
  state_version: number | null;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToRoom(row: RoomRow): CollaborationRoom {
  return {
    roomId: row.room_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    organizationId: row.organization_id,
    roomState: row.room_state as RoomState,
    createdAt: row.created_at,
    closedAt: row.closed_at || null,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

function rowToPresence(row: PresenceRow): RoomPresence {
  return {
    presenceId: row.presence_id,
    roomId: row.room_id,
    userId: row.user_id,
    presenceType: row.presence_type as PresenceType,
    cursorState: safeJsonParse<Record<string, unknown> | null>(row.cursor_state, null),
    lastHeartbeat: row.last_heartbeat,
    connectedAt: row.connected_at,
    clientId: row.client_id,
    isStale: Boolean(row.is_stale),
  };
}

function rowToMembership(row: MembershipRow): RoomMembership {
  return {
    membershipId: row.membership_id,
    roomId: row.room_id,
    userId: row.user_id,
    joinedAt: row.joined_at,
    leftAt: row.left_at || null,
    role: row.role as PresenceType,
  };
}

function rowToEvent(row: EventRow): CollaborationEvent {
  return {
    eventId: row.event_id,
    roomId: row.room_id,
    eventType: row.event_type as CollaborationEvent['eventType'],
    actorId: row.actor_id,
    actorType: row.actor_type as CollaborationEvent['actorType'],
    delivery: row.delivery as CollaborationEvent['delivery'],
    payload: safeJsonParse(row.payload, {}),
    timestamp: row.timestamp,
    stateVersion: row.state_version ?? null,
  };
}

// ==========================================
// STATE MACHINE VALIDATION
// ==========================================

function isValidRoomTransition(from: RoomState, to: RoomState): boolean {
  const allowed = VALID_ROOM_TRANSITIONS[from];
  return allowed.includes(to);
}

// ==========================================
// PUBLIC API — ROOMS
// ==========================================

/**
 * Create a new CollaborationRoom in `active` state, bound to a resource.
 */
export async function createRoom(params: CreateRoomParams): Promise<CollaborationRoom> {
  const validated = CreateRoomParamsSchema.parse(params);

  const roomId = uuidv4();
  const now = new Date().toISOString();

  const room: CollaborationRoom = {
    roomId,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    organizationId: validated.organizationId,
    roomState: 'active',
    createdAt: now,
    closedAt: null,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_collaboration_rooms (
      room_id, resource_type, resource_id, organization_id,
      room_state, created_at, closed_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      room.roomId,
      room.resourceType,
      room.resourceId,
      room.organizationId,
      room.roomState,
      room.createdAt,
      room.closedAt,
      JSON.stringify(room.metadata),
    ],
  );

  await recordEvent({
    roomId,
    eventType: 'room.created',
    actorId: 'system',
    actorType: 'system',
    delivery: 'durable',
    payload: { resourceType: room.resourceType, resourceId: room.resourceId },
  });

  logger.info(`${LOG_PREFIX} Created room ${roomId} for ${room.resourceType}:${room.resourceId} in org ${room.organizationId}`);
  return room;
}

/**
 * Retrieve a room by ID with organization-level isolation.
 */
export async function getRoom(
  roomId: string,
  organizationId: string,
): Promise<CollaborationRoom | null> {
  const row = await dbGet<RoomRow>(
    `SELECT * FROM v8_collaboration_rooms
     WHERE room_id = ? AND organization_id = ?`,
    [roomId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToRoom(row);
}

/**
 * Find the active (non-closed) room for a given resource.
 * Enforces 1:1 binding between resource and active room.
 */
export async function getRoomByResource(
  resourceType: string,
  resourceId: string,
  organizationId: string,
): Promise<CollaborationRoom | null> {
  const row = await dbGet<RoomRow>(
    `SELECT * FROM v8_collaboration_rooms
     WHERE resource_type = ? AND resource_id = ? AND organization_id = ?
       AND room_state != 'closed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [resourceType, resourceId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToRoom(row);
}

/**
 * Transition a room to a new state. Validates the transition.
 */
export async function transitionRoomState(
  roomId: string,
  organizationId: string,
  toState: RoomState,
  reason?: string,
): Promise<CollaborationRoom> {
  const room = await getRoom(roomId, organizationId);
  if (!room) {
    throw new Error(`Room ${roomId} not found in organization ${organizationId}`);
  }

  const fromState = room.roomState;

  if (!isValidRoomTransition(fromState, toState)) {
    throw new Error(
      `Invalid room state transition: ${fromState} → ${toState}. ` +
      `Allowed from ${fromState}: [${VALID_ROOM_TRANSITIONS[fromState].join(', ')}]`,
    );
  }

  const now = new Date().toISOString();
  const closedAt = TERMINAL_ROOM_STATES.has(toState) ? now : room.closedAt;

  await dbRun(
    `UPDATE v8_collaboration_rooms
     SET room_state = ?, closed_at = ?
     WHERE room_id = ? AND organization_id = ?`,
    [toState, closedAt, roomId, organizationId],
  );

  const eventTypeMap: Record<string, CollaborationEvent['eventType']> = {
    active: 'room.activated',
    idle: 'room.idle',
    closed: 'room.closed',
    error: 'room.error',
  };

  await recordEvent({
    roomId,
    eventType: eventTypeMap[toState],
    actorId: 'system',
    actorType: 'system',
    delivery: 'durable',
    payload: { fromState, toState, reason: reason ?? null },
  });

  logger.info(`${LOG_PREFIX} Room ${roomId}: ${fromState} → ${toState}`);

  return {
    ...room,
    roomState: toState,
    closedAt,
  };
}

// ==========================================
// PUBLIC API — PRESENCE & MEMBERSHIP
// ==========================================

/**
 * Join a room: creates a presence record and a durable membership record.
 * Supports multi-tab via unique (roomId, userId, clientId).
 */
export async function joinRoom(
  roomId: string,
  userId: string,
  presenceType: PresenceType,
  clientId: string,
): Promise<RoomPresence> {
  JoinRoomParamsSchema.parse({ roomId, userId, presenceType, clientId });

  const presenceId = uuidv4();
  const membershipId = uuidv4();
  const now = new Date().toISOString();

  const presence: RoomPresence = {
    presenceId,
    roomId,
    userId,
    presenceType,
    cursorState: null,
    lastHeartbeat: now,
    connectedAt: now,
    clientId,
    isStale: false,
  };

  await dbRun(
    `INSERT INTO v8_room_presence (
      presence_id, room_id, user_id, presence_type,
      cursor_state, last_heartbeat, connected_at, client_id, is_stale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      presence.presenceId,
      presence.roomId,
      presence.userId,
      presence.presenceType,
      null,
      presence.lastHeartbeat,
      presence.connectedAt,
      presence.clientId,
      0,
    ],
  );

  await dbRun(
    `INSERT INTO v8_room_memberships (
      membership_id, room_id, user_id, joined_at, left_at, role
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [membershipId, roomId, userId, now, null, presenceType],
  );

  await recordEvent({
    roomId,
    eventType: 'membership.joined',
    actorId: userId,
    actorType: presenceType === 'ai_agent' ? 'ai_agent' : 'human',
    delivery: 'durable',
    payload: { presenceType, clientId },
  });

  logger.info(`${LOG_PREFIX} User ${userId} (client ${clientId}) joined room ${roomId} as ${presenceType}`);
  return presence;
}

/**
 * Leave a room: removes presence record, stamps membership.leftAt.
 */
export async function leaveRoom(
  roomId: string,
  userId: string,
  clientId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await dbRun(
    `DELETE FROM v8_room_presence
     WHERE room_id = ? AND user_id = ? AND client_id = ?`,
    [roomId, userId, clientId],
  );

  await dbRun(
    `UPDATE v8_room_memberships
     SET left_at = ?
     WHERE room_id = ? AND user_id = ? AND left_at IS NULL`,
    [now, roomId, userId],
  );

  await recordEvent({
    roomId,
    eventType: 'membership.left',
    actorId: userId,
    actorType: 'human',
    delivery: 'durable',
    payload: { clientId },
  });

  logger.info(`${LOG_PREFIX} User ${userId} (client ${clientId}) left room ${roomId}`);
}

/**
 * Update presence: heartbeat + optional cursor state.
 */
export async function updatePresence(
  roomId: string,
  userId: string,
  clientId: string,
  updates: UpdatePresenceParams,
): Promise<RoomPresence> {
  UpdatePresenceParamsSchema.parse(updates);

  const now = new Date().toISOString();
  const cursorStateJson = updates.cursorState !== undefined
    ? (updates.cursorState ? JSON.stringify(updates.cursorState) : null)
    : undefined;

  if (cursorStateJson !== undefined) {
    await dbRun(
      `UPDATE v8_room_presence
       SET last_heartbeat = ?, cursor_state = ?, is_stale = 0
       WHERE room_id = ? AND user_id = ? AND client_id = ?`,
      [now, cursorStateJson, roomId, userId, clientId],
    );
  } else {
    await dbRun(
      `UPDATE v8_room_presence
       SET last_heartbeat = ?, is_stale = 0
       WHERE room_id = ? AND user_id = ? AND client_id = ?`,
      [now, roomId, userId, clientId],
    );
  }

  const row = await dbGet<PresenceRow>(
    `SELECT * FROM v8_room_presence
     WHERE room_id = ? AND user_id = ? AND client_id = ?`,
    [roomId, userId, clientId],
    { fallback: true },
  );

  if (!row) {
    throw new Error(`Presence not found for user ${userId} client ${clientId} in room ${roomId}`);
  }

  return rowToPresence(row);
}

/**
 * Get all active (non-stale) presence records for a room.
 */
export async function getActivePresence(roomId: string): Promise<RoomPresence[]> {
  const rows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence
     WHERE room_id = ? AND is_stale = 0
     ORDER BY connected_at ASC`,
    [roomId],
    { fallback: true },
  );

  return (rows || []).map(rowToPresence);
}

/**
 * Mark stale presence records and remove them. Returns removed userIds.
 * A presence is stale if its last_heartbeat is older than staleThresholdMs.
 */
export async function cleanStalePresence(
  roomId: string,
  staleThresholdMs: number,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();

  const staleRows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence
     WHERE room_id = ? AND is_stale = 0 AND last_heartbeat < ?`,
    [roomId, cutoff],
    { fallback: true },
  );

  const staleRecords = staleRows || [];
  if (staleRecords.length === 0) return [];

  await dbRun(
    `UPDATE v8_room_presence
     SET is_stale = 1
     WHERE room_id = ? AND is_stale = 0 AND last_heartbeat < ?`,
    [roomId, cutoff],
  );

  const removedUserIds: string[] = [];
  for (const row of staleRecords) {
    removedUserIds.push(row.user_id);

    await recordEvent({
      roomId,
      eventType: 'presence.stale_removed',
      actorId: 'system',
      actorType: 'system',
      delivery: 'durable',
      payload: { userId: row.user_id, clientId: row.client_id, lastHeartbeat: row.last_heartbeat },
    });
  }

  logger.info(`${LOG_PREFIX} Cleaned ${staleRecords.length} stale presence records from room ${roomId}`);
  return removedUserIds;
}

// ==========================================
// PUBLIC API — EVENTS
// ==========================================

/**
 * Append a collaboration event to the durable event stream.
 */
export async function recordEvent(params: RecordEventParams): Promise<CollaborationEvent> {
  const validated = RecordEventParamsSchema.parse(params);

  const eventId = uuidv4();
  const now = new Date().toISOString();

  const event: CollaborationEvent = {
    eventId,
    roomId: validated.roomId,
    eventType: validated.eventType,
    actorId: validated.actorId,
    actorType: validated.actorType,
    delivery: validated.delivery,
    payload: validated.payload,
    timestamp: now,
    stateVersion: validated.stateVersion ?? null,
  };

  await dbRun(
    `INSERT INTO v8_collaboration_events (
      event_id, room_id, event_type, actor_id, actor_type,
      delivery, payload, timestamp, state_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.eventId,
      event.roomId,
      event.eventType,
      event.actorId,
      event.actorType,
      event.delivery,
      JSON.stringify(event.payload),
      event.timestamp,
      event.stateVersion,
    ],
  );

  return event;
}

/**
 * Retrieve events for a room with optional type filter and pagination.
 */
export async function getEventsByRoom(
  roomId: string,
  options?: GetEventsOptions,
): Promise<CollaborationEvent[]> {
  const { eventType, limit = 100, offset = 0 } = options ?? {};

  let query: string;
  let queryParams: unknown[];

  if (eventType) {
    query = `SELECT * FROM v8_collaboration_events
             WHERE room_id = ? AND event_type = ?
             ORDER BY timestamp ASC
             LIMIT ? OFFSET ?`;
    queryParams = [roomId, eventType, limit, offset];
  } else {
    query = `SELECT * FROM v8_collaboration_events
             WHERE room_id = ?
             ORDER BY timestamp ASC
             LIMIT ? OFFSET ?`;
    queryParams = [roomId, limit, offset];
  }

  const rows = await dbAll<EventRow>(query, queryParams, { fallback: true });
  return (rows || []).map(rowToEvent);
}

// ==========================================
// PUBLIC API — PRESENCE RUNTIME (Wave 7)
// ==========================================

const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Detect stale presence entries older than the threshold.
 * Records `presence.stale_removed` events for each stale entry.
 */
export async function detectStalePresence(
  roomId: string,
  organizationId: string,
  staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
): Promise<RoomPresence[]> {
  const room = await getRoom(roomId, organizationId);
  if (!room) {
    throw new Error(`Room ${roomId} not found in organization ${organizationId}`);
  }

  const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();

  const staleRows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence
     WHERE room_id = ? AND is_stale = 0 AND last_heartbeat < ?`,
    [roomId, cutoff],
    { fallback: true },
  );

  const staleRecords = (staleRows || []).map(rowToPresence);

  for (const entry of staleRecords) {
    await recordEvent({
      roomId,
      eventType: 'presence.stale_removed',
      actorId: 'system',
      actorType: 'system',
      delivery: 'durable',
      payload: { userId: entry.userId, clientId: entry.clientId, lastHeartbeat: entry.lastHeartbeat },
    });
  }

  if (staleRecords.length > 0) {
    logger.info(`${LOG_PREFIX} Detected ${staleRecords.length} stale presence entries in room ${roomId}`);
  }

  return staleRecords;
}

/**
 * Room health summary for monitoring and degraded-mode detection.
 */
export interface RoomHealthSummary {
  state: RoomState;
  memberCount: number;
  activePresenceCount: number;
  stalePresenceCount: number;
  lastEventAt: string | null;
  degradedSince: string | null;
}

/**
 * Get a room health summary: member count, active/stale presence, last event, degraded status.
 */
export async function getRoomHealth(
  roomId: string,
  organizationId: string,
): Promise<RoomHealthSummary> {
  const room = await getRoom(roomId, organizationId);
  if (!room) {
    throw new Error(`Room ${roomId} not found in organization ${organizationId}`);
  }

  const activeRows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence WHERE room_id = ? AND is_stale = 0`,
    [roomId],
    { fallback: true },
  );
  const activePresenceCount = (activeRows || []).length;

  const staleRows = await dbAll<PresenceRow>(
    `SELECT * FROM v8_room_presence WHERE room_id = ? AND is_stale = 1`,
    [roomId],
    { fallback: true },
  );
  const stalePresenceCount = (staleRows || []).length;

  const memberRows = await dbAll<MembershipRow>(
    `SELECT * FROM v8_room_memberships WHERE room_id = ? AND left_at IS NULL`,
    [roomId],
    { fallback: true },
  );
  const memberCount = (memberRows || []).length;

  const lastEvent = await dbGet<EventRow>(
    `SELECT * FROM v8_collaboration_events WHERE room_id = ? ORDER BY timestamp DESC LIMIT 1`,
    [roomId],
    { fallback: true },
  );

  const degradedRow = await dbGet<{ degraded_since: string | null }>(
    `SELECT degraded_since FROM v8_collaboration_rooms WHERE room_id = ? AND organization_id = ?`,
    [roomId, organizationId],
    { fallback: true },
  );

  let degradedSince = degradedRow?.degraded_since ?? null;

  if (!degradedSince && stalePresenceCount > activePresenceCount && activePresenceCount + stalePresenceCount > 0) {
    degradedSince = new Date().toISOString();
  }

  return {
    state: room.roomState,
    memberCount,
    activePresenceCount,
    stalePresenceCount,
    lastEventAt: lastEvent?.timestamp ?? null,
    degradedSince,
  };
}

/**
 * Enter degraded mode: transition room to `error` state and record `system.degraded` event.
 */
export async function enterDegradedMode(
  roomId: string,
  organizationId: string,
  reason: string,
): Promise<CollaborationRoom> {
  const room = await getRoom(roomId, organizationId);
  if (!room) {
    throw new Error(`Room ${roomId} not found in organization ${organizationId}`);
  }

  if (room.roomState === 'error') {
    logger.info(`${LOG_PREFIX} Room ${roomId} already in error state`);
    return room;
  }

  const now = new Date().toISOString();

  const transitioned = await transitionRoomState(roomId, organizationId, 'error', reason);

  await dbRun(
    `UPDATE v8_collaboration_rooms SET degraded_since = ? WHERE room_id = ? AND organization_id = ?`,
    [now, roomId, organizationId],
  );

  await recordEvent({
    roomId,
    eventType: 'system.degraded',
    actorId: 'system',
    actorType: 'system',
    delivery: 'durable',
    payload: { reason },
  });

  logger.info(`${LOG_PREFIX} Room ${roomId} entered degraded mode: ${reason}`);
  return transitioned;
}

/**
 * Recover from degraded mode: transition room from `error` back to `active`.
 * Records `system.reconnected` event.
 */
export async function recoverFromDegraded(
  roomId: string,
  organizationId: string,
): Promise<CollaborationRoom> {
  const room = await getRoom(roomId, organizationId);
  if (!room) {
    throw new Error(`Room ${roomId} not found in organization ${organizationId}`);
  }

  if (room.roomState !== 'error') {
    throw new Error(`Room ${roomId} is not in error state (current: ${room.roomState})`);
  }

  const transitioned = await transitionRoomState(roomId, organizationId, 'active', 'Recovered from degraded');

  await dbRun(
    `UPDATE v8_collaboration_rooms SET degraded_since = NULL WHERE room_id = ? AND organization_id = ?`,
    [roomId, organizationId],
  );

  await recordEvent({
    roomId,
    eventType: 'system.reconnected',
    actorId: 'system',
    actorType: 'system',
    delivery: 'durable',
    payload: { recoveredAt: new Date().toISOString() },
  });

  logger.info(`${LOG_PREFIX} Room ${roomId} recovered from degraded mode`);
  return transitioned;
}

/**
 * Get all non-closed rooms for an organization.
 */
export async function getActiveRoomsByOrg(
  organizationId: string,
  limit: number = 100,
): Promise<CollaborationRoom[]> {
  const rows = await dbAll<RoomRow>(
    `SELECT * FROM v8_collaboration_rooms
     WHERE organization_id = ? AND room_state != 'closed'
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, limit],
    { fallback: true },
  );

  return (rows || []).map(rowToRoom);
}

/**
 * Broadcast a durable event to a room (convenience wrapper for recordEvent).
 */
export async function broadcastEvent(
  roomId: string,
  organizationId: string,
  eventType: CollaborationEventType,
  payload: Record<string, unknown>,
): Promise<CollaborationEvent> {
  const room = await getRoom(roomId, organizationId);
  if (!room) {
    throw new Error(`Room ${roomId} not found in organization ${organizationId}`);
  }

  return recordEvent({
    roomId,
    eventType,
    actorId: 'system',
    actorType: 'system',
    delivery: 'durable',
    payload,
  });
}
