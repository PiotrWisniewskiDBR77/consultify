/**
 * V8 Workspace Collaboration Service
 *
 * Manages workspace-level collaboration sessions that sit ABOVE individual
 * tool rooms (managed by collaborationRoomService). A workspace session groups
 * multiple tool rooms and provides shared context and a unified activity feed.
 *
 * All queries enforce organization-level isolation.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  WorkspaceSession,
  WorkspaceSessionState,
  ActivityFeedEntry,
  CreateSessionParams,
  RecordActivityParams,
  SharedContextUpdate,
} from '../../types/workspaceCollaboration.js';
import {
  CreateSessionParamsSchema,
  LinkRoomParamsSchema,
  RecordActivityParamsSchema,
  UpdateSharedContextParamsSchema,
  VALID_SESSION_TRANSITIONS,
  TERMINAL_SESSION_STATES,
} from '../../types/workspaceCollaboration.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:WorkspaceCollaboration]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

function isValidSessionTransition(from: WorkspaceSessionState, to: WorkspaceSessionState): boolean {
  const allowed = VALID_SESSION_TRANSITIONS[from];
  return allowed.includes(to);
}

// ==========================================
// ROW TYPES
// ==========================================

interface SessionRow {
  session_id: string;
  workspace_id: string;
  organization_id: string;
  title: string;
  state: string;
  created_by: string;
  linked_room_ids: string;
  shared_context: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ActivityFeedRow {
  entry_id: string;
  session_id: string;
  organization_id: string;
  entry_type: string;
  actor_id: string;
  actor_display_name: string;
  payload: string;
  created_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToSession(row: SessionRow): WorkspaceSession {
  return {
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    organizationId: row.organization_id,
    title: row.title,
    state: row.state as WorkspaceSessionState,
    createdBy: row.created_by,
    linkedRoomIds: safeJsonParse<string[]>(row.linked_room_ids, []),
    sharedContext: safeJsonParse<Record<string, unknown>>(row.shared_context, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
  };
}

function rowToActivityFeedEntry(row: ActivityFeedRow): ActivityFeedEntry {
  return {
    entryId: row.entry_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    entryType: row.entry_type as ActivityFeedEntry['entryType'],
    actorId: row.actor_id,
    actorDisplayName: row.actor_display_name,
    payload: safeJsonParse<Record<string, unknown>>(row.payload, {}),
    createdAt: row.created_at,
  };
}

// ==========================================
// PUBLIC API — SESSIONS
// ==========================================

/**
 * Create a new workspace session in `active` state.
 */
export async function createSession(params: CreateSessionParams): Promise<WorkspaceSession> {
  const validated = CreateSessionParamsSchema.parse(params);

  const sessionId = uuidv4();
  const now = new Date().toISOString();

  const session: WorkspaceSession = {
    sessionId,
    workspaceId: validated.workspaceId,
    organizationId: validated.organizationId,
    title: validated.title,
    state: 'active',
    createdBy: validated.createdBy,
    linkedRoomIds: [],
    sharedContext: {},
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_workspace_sessions (
      session_id, workspace_id, organization_id, title, state,
      created_by, linked_room_ids, shared_context,
      created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.sessionId,
      session.workspaceId,
      session.organizationId,
      session.title,
      session.state,
      session.createdBy,
      JSON.stringify(session.linkedRoomIds),
      JSON.stringify(session.sharedContext),
      session.createdAt,
      session.updatedAt,
      session.completedAt,
    ],
  );

  await recordActivity({
    sessionId,
    organizationId: validated.organizationId,
    entryType: 'session.started',
    actorId: validated.createdBy,
    actorDisplayName: validated.createdBy,
    payload: { title: session.title },
  });

  logger.info(`${LOG_PREFIX} Created session ${sessionId} in workspace ${session.workspaceId} org ${session.organizationId}`);
  return session;
}

/**
 * Retrieve a session by ID with organization-level isolation.
 */
export async function getSession(
  sessionId: string,
  organizationId: string,
): Promise<WorkspaceSession | null> {
  const row = await dbGet<SessionRow>(
    `SELECT * FROM v8_workspace_sessions
     WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToSession(row);
}

/**
 * Pause an active session.
 */
export async function pauseSession(
  sessionId: string,
  organizationId: string,
): Promise<WorkspaceSession> {
  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  if (!isValidSessionTransition(session.state, 'paused')) {
    throw new Error(
      `Invalid session state transition: ${session.state} → paused. ` +
      `Allowed from ${session.state}: [${VALID_SESSION_TRANSITIONS[session.state].join(', ')}]`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_workspace_sessions
     SET state = 'paused', updated_at = ?
     WHERE session_id = ? AND organization_id = ?`,
    [now, sessionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Session ${sessionId} paused`);

  return {
    ...session,
    state: 'paused',
    updatedAt: now,
  };
}

/**
 * Resume a paused session back to active.
 */
export async function resumeSession(
  sessionId: string,
  organizationId: string,
): Promise<WorkspaceSession> {
  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  if (!isValidSessionTransition(session.state, 'active')) {
    throw new Error(
      `Invalid session state transition: ${session.state} → active. ` +
      `Allowed from ${session.state}: [${VALID_SESSION_TRANSITIONS[session.state].join(', ')}]`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_workspace_sessions
     SET state = 'active', updated_at = ?
     WHERE session_id = ? AND organization_id = ?`,
    [now, sessionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Session ${sessionId} resumed`);

  return {
    ...session,
    state: 'active',
    updatedAt: now,
  };
}

/**
 * Complete a session. Terminal state — sets completedAt.
 */
export async function completeSession(
  sessionId: string,
  organizationId: string,
): Promise<WorkspaceSession> {
  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  if (!isValidSessionTransition(session.state, 'completed')) {
    throw new Error(
      `Invalid session state transition: ${session.state} → completed. ` +
      `Allowed from ${session.state}: [${VALID_SESSION_TRANSITIONS[session.state].join(', ')}]`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_workspace_sessions
     SET state = 'completed', updated_at = ?, completed_at = ?
     WHERE session_id = ? AND organization_id = ?`,
    [now, now, sessionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Session ${sessionId} completed`);

  return {
    ...session,
    state: 'completed',
    updatedAt: now,
    completedAt: now,
  };
}

// ==========================================
// PUBLIC API — ROOM LINKING
// ==========================================

/**
 * Link a collaboration room to a workspace session.
 */
export async function linkRoom(
  sessionId: string,
  roomId: string,
  organizationId: string,
): Promise<WorkspaceSession> {
  LinkRoomParamsSchema.parse({ sessionId, roomId, organizationId });

  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  if (TERMINAL_SESSION_STATES.has(session.state)) {
    throw new Error(`Cannot link room to session ${sessionId} in terminal state '${session.state}'`);
  }

  if (session.linkedRoomIds.includes(roomId)) {
    logger.info(`${LOG_PREFIX} Room ${roomId} already linked to session ${sessionId}`);
    return session;
  }

  const updatedRoomIds = [...session.linkedRoomIds, roomId];
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_workspace_sessions
     SET linked_room_ids = ?, updated_at = ?
     WHERE session_id = ? AND organization_id = ?`,
    [JSON.stringify(updatedRoomIds), now, sessionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Linked room ${roomId} to session ${sessionId}`);

  return {
    ...session,
    linkedRoomIds: updatedRoomIds,
    updatedAt: now,
  };
}

/**
 * Unlink a collaboration room from a workspace session.
 */
export async function unlinkRoom(
  sessionId: string,
  roomId: string,
  organizationId: string,
): Promise<WorkspaceSession> {
  LinkRoomParamsSchema.parse({ sessionId, roomId, organizationId });

  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  if (TERMINAL_SESSION_STATES.has(session.state)) {
    throw new Error(`Cannot unlink room from session ${sessionId} in terminal state '${session.state}'`);
  }

  const updatedRoomIds = session.linkedRoomIds.filter((id) => id !== roomId);
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_workspace_sessions
     SET linked_room_ids = ?, updated_at = ?
     WHERE session_id = ? AND organization_id = ?`,
    [JSON.stringify(updatedRoomIds), now, sessionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Unlinked room ${roomId} from session ${sessionId}`);

  return {
    ...session,
    linkedRoomIds: updatedRoomIds,
    updatedAt: now,
  };
}

/**
 * Get all linked room IDs for a session.
 */
export async function getLinkedRooms(
  sessionId: string,
  organizationId: string,
): Promise<string[]> {
  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  return session.linkedRoomIds;
}

// ==========================================
// PUBLIC API — SHARED CONTEXT
// ==========================================

/**
 * Merge context updates into the session's sharedContext.
 */
export async function updateSharedContext(
  sessionId: string,
  organizationId: string,
  updates: SharedContextUpdate[],
): Promise<WorkspaceSession> {
  UpdateSharedContextParamsSchema.parse({ sessionId, organizationId, updates });

  const session = await getSession(sessionId, organizationId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found in organization ${organizationId}`);
  }

  if (TERMINAL_SESSION_STATES.has(session.state)) {
    throw new Error(`Cannot update shared context on session ${sessionId} in terminal state '${session.state}'`);
  }

  const updatedContext = { ...session.sharedContext };
  for (const update of updates) {
    updatedContext[update.key] = update.value;
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_workspace_sessions
     SET shared_context = ?, updated_at = ?
     WHERE session_id = ? AND organization_id = ?`,
    [JSON.stringify(updatedContext), now, sessionId, organizationId],
  );

  logger.info(`${LOG_PREFIX} Updated shared context on session ${sessionId}: ${updates.map((u) => u.key).join(', ')}`);

  return {
    ...session,
    sharedContext: updatedContext,
    updatedAt: now,
  };
}

// ==========================================
// PUBLIC API — ACTIVITY FEED
// ==========================================

/**
 * Record an activity feed entry for a workspace session.
 */
export async function recordActivity(params: RecordActivityParams): Promise<ActivityFeedEntry> {
  const validated = RecordActivityParamsSchema.parse(params);

  const entryId = uuidv4();
  const now = new Date().toISOString();

  const entry: ActivityFeedEntry = {
    entryId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    entryType: validated.entryType,
    actorId: validated.actorId,
    actorDisplayName: validated.actorDisplayName,
    payload: validated.payload,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_activity_feed (
      entry_id, session_id, organization_id, entry_type,
      actor_id, actor_display_name, payload, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.entryId,
      entry.sessionId,
      entry.organizationId,
      entry.entryType,
      entry.actorId,
      entry.actorDisplayName,
      JSON.stringify(entry.payload),
      entry.createdAt,
    ],
  );

  return entry;
}

/**
 * Get activity feed entries for a session, ordered by creation time descending.
 */
export async function getActivityFeed(
  sessionId: string,
  organizationId: string,
  limit: number = 100,
): Promise<ActivityFeedEntry[]> {
  const rows = await dbAll<ActivityFeedRow>(
    `SELECT * FROM v8_activity_feed
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [sessionId, organizationId, limit],
    { fallback: true },
  );

  return (rows || []).map(rowToActivityFeedEntry);
}

// ==========================================
// PUBLIC API — WORKSPACE QUERIES
// ==========================================

/**
 * Get sessions for a workspace. By default excludes completed/abandoned sessions.
 */
export async function getSessionsByWorkspace(
  workspaceId: string,
  organizationId: string,
  includeCompleted: boolean = false,
): Promise<WorkspaceSession[]> {
  let query: string;
  let queryParams: unknown[];

  if (includeCompleted) {
    query = `SELECT * FROM v8_workspace_sessions
             WHERE workspace_id = ? AND organization_id = ?
             ORDER BY created_at DESC`;
    queryParams = [workspaceId, organizationId];
  } else {
    query = `SELECT * FROM v8_workspace_sessions
             WHERE workspace_id = ? AND organization_id = ?
               AND state NOT IN ('completed', 'abandoned')
             ORDER BY created_at DESC`;
    queryParams = [workspaceId, organizationId];
  }

  const rows = await dbAll<SessionRow>(query, queryParams, { fallback: true });
  return (rows || []).map(rowToSession);
}
