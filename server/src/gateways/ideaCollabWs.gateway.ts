/**
 * Idea Collab — V4-IDEA-02 native WebSocket /ws/collab/:ideaId
 * Auth, presence, cursors, shared session state, persistence.
 */

import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketServer, type WebSocket } from 'ws';

import { config } from '../config/Config.js';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  activeNodeId?: string;
  lastSeen: number;
  organizationId?: string;
}

interface SessionState {
  lockedNodes: Map<string, string>; // nodeId -> userId
  selections: Map<string, string[]>; // userId -> nodeIds
  viewportSync: boolean;
  lastActivity: number;
}

interface CollabSocket extends WebSocket {
  ideaId?: string;
  __user?: { userId: string; organizationId: string; userName: string };
  __sessionId?: string;
  __actionsCount?: number;
  __alive?: boolean;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const ideaRooms = new Map<string, Map<CollabSocket, CollabUser>>();
const sessionStates = new Map<string, SessionState>();
const COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899'];

const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrCreateSessionState(ideaId: string): SessionState {
  let state = sessionStates.get(ideaId);
  if (!state) {
    state = {
      lockedNodes: new Map(),
      selections: new Map(),
      viewportSync: false,
      lastActivity: Date.now(),
    };
    sessionStates.set(ideaId, state);
  }
  return state;
}

function serializeSessionState(state: SessionState) {
  return {
    lockedNodes: Object.fromEntries(state.lockedNodes),
    selections: Object.fromEntries(state.selections),
    viewportSync: state.viewportSync,
    lastActivity: state.lastActivity,
  };
}

function broadcastPresence(ideaId: string, exclude?: CollabSocket) {
  const room = ideaRooms.get(ideaId);
  if (!room) return;
  const users = Array.from(room.values()).map((u) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    cursorX: u.cursorX,
    cursorY: u.cursorY,
    activeNodeId: u.activeNodeId,
    lastSeen: u.lastSeen,
  }));
  const payload = JSON.stringify({ type: 'presence', users });
  room.forEach((_, ws) => {
    if (ws !== exclude && ws.readyState === 1) ws.send(payload);
  });
}

function broadcastSessionState(ideaId: string) {
  const room = ideaRooms.get(ideaId);
  const state = sessionStates.get(ideaId);
  if (!room || !state) return;
  const payload = JSON.stringify({ type: 'session_state', ...serializeSessionState(state) });
  room.forEach((_, ws) => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

function cleanupUser(ws: CollabSocket, ideaId: string) {
  const room = ideaRooms.get(ideaId);
  if (!room) return;

  const user = room.get(ws);
  room.delete(ws);

  const state = sessionStates.get(ideaId);
  if (state && user) {
    // Unlock nodes held by this user
    for (const [nodeId, lockHolder] of state.lockedNodes) {
      if (lockHolder === user.id) state.lockedNodes.delete(nodeId);
    }
    state.selections.delete(user.id);
  }

  if (room.size === 0) {
    ideaRooms.delete(ideaId);
    sessionStates.delete(ideaId);
  } else {
    broadcastPresence(ideaId);
    broadcastSessionState(ideaId);
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function persistJoin(
  db: IDatabase,
  ideaId: string,
  userId: string,
  organizationId: string
): Promise<string | null> {
  try {
    const row = await db.get<{ id: string }>(
      `INSERT INTO collab_sessions (idea_id, organization_id, user_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [ideaId, organizationId, userId]
    );
    return row?.id ?? null;
  } catch (err) {
    logger.warn('[IdeaCollabWs] Failed to persist join:', err);
    return null;
  }
}

async function persistLeave(db: IDatabase, sessionId: string, actionsCount: number) {
  try {
    await db.run(
      `UPDATE collab_sessions
       SET left_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::integer,
           actions_count = $1
       WHERE id = $2`,
      [actionsCount, sessionId]
    );
  } catch (err) {
    logger.warn('[IdeaCollabWs] Failed to persist leave:', err);
  }
}

async function persistEvent(db: IDatabase, sessionId: string, eventType: string, payload?: unknown) {
  try {
    await db.run(
      `INSERT INTO collab_session_events (session_id, event_type, payload_json)
       VALUES ($1, $2, $3)`,
      [sessionId, eventType, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    logger.warn('[IdeaCollabWs] Failed to persist event:', err);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function attachIdeaCollabWs(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
  const db = getDatabase();

  // --- Upgrade handler with JWT auth ---
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/collab\/([^/]+)$/);
    if (!match) return;

    const ideaId = match[1];
    if (!ideaId) return;

    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const userId = decoded.id || decoded.userId;
    const organizationId = decoded.organizationId || '';
    const userName = decoded.name || decoded.email || 'User';

    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      (ws as CollabSocket).__user = { userId, organizationId, userName };
      wss.emit('connection', ws, request, ideaId);
    });
  });

  // --- Heartbeat ---
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((raw) => {
      const ws = raw as CollabSocket;
      if (ws.__alive === false) {
        if (ws.ideaId) cleanupUser(ws, ws.ideaId);
        ws.terminate();
        return;
      }
      ws.__alive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeatInterval));

  // --- Connection handler ---
  wss.on('connection', (raw: WebSocket, _req: unknown, ideaId: string) => {
    const ws = raw as CollabSocket;
    ws.ideaId = ideaId;
    ws.__alive = true;
    ws.__actionsCount = 0;

    const authUser = ws.__user;
    if (!ideaRooms.has(ideaId)) ideaRooms.set(ideaId, new Map());
    const room = ideaRooms.get(ideaId)!;
    const color = COLORS[room.size % COLORS.length];

    const user: CollabUser = {
      id: authUser?.userId || 'unknown',
      name: authUser?.userName || 'Anonymous',
      color,
      cursorX: 0,
      cursorY: 0,
      lastSeen: Date.now(),
      organizationId: authUser?.organizationId,
    };
    room.set(ws, user);

    // Persist join
    persistJoin(db, ideaId, user.id, user.organizationId || '').then((sid) => {
      if (sid) ws.__sessionId = sid;
    });

    const state = getOrCreateSessionState(ideaId);

    ws.on('pong', () => {
      ws.__alive = true;
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'join':
            // Auth already set identity; allow name override
            if (msg.userName) user.name = msg.userName;
            break;

          case 'cursor':
            user.cursorX = msg.x ?? 0;
            user.cursorY = msg.y ?? 0;
            user.activeNodeId = msg.activeNodeId;
            user.lastSeen = Date.now();
            break;

          case 'lock_node': {
            const nodeId = msg.nodeId;
            if (!nodeId) break;
            const currentHolder = state.lockedNodes.get(nodeId);
            if (currentHolder && currentHolder !== user.id) {
              ws.send(JSON.stringify({ type: 'lock_rejected', nodeId, heldBy: currentHolder }));
              break;
            }
            state.lockedNodes.set(nodeId, user.id);
            state.lastActivity = Date.now();
            ws.__actionsCount = (ws.__actionsCount || 0) + 1;
            broadcastSessionState(ideaId);
            if (ws.__sessionId) persistEvent(db, ws.__sessionId, 'lock_node', { nodeId });
            break;
          }

          case 'unlock_node': {
            const nodeId = msg.nodeId;
            if (!nodeId) break;
            if (state.lockedNodes.get(nodeId) === user.id) {
              state.lockedNodes.delete(nodeId);
              state.lastActivity = Date.now();
              ws.__actionsCount = (ws.__actionsCount || 0) + 1;
              broadcastSessionState(ideaId);
              if (ws.__sessionId) persistEvent(db, ws.__sessionId, 'unlock_node', { nodeId });
            }
            break;
          }

          case 'select_nodes': {
            const nodeIds = Array.isArray(msg.nodeIds) ? msg.nodeIds : [];
            state.selections.set(user.id, nodeIds);
            state.lastActivity = Date.now();
            broadcastSessionState(ideaId);
            break;
          }

          case 'viewport_sync': {
            if (typeof msg.enabled === 'boolean') {
              state.viewportSync = msg.enabled;
              state.lastActivity = Date.now();
              broadcastSessionState(ideaId);
            }
            break;
          }

          default:
            break;
        }

        broadcastPresence(ideaId, ws);
      } catch {
        /* ignore malformed */
      }
    });

    ws.on('close', () => {
      if (ws.__sessionId) {
        persistLeave(db, ws.__sessionId, ws.__actionsCount || 0);
      }
      cleanupUser(ws, ideaId);
      logger.info(`[IdeaCollabWs] Client left idea ${ideaId}`);
    });

    // Send initial state to the new client
    ws.send(JSON.stringify({ type: 'session_state', ...serializeSessionState(state) }));
    broadcastPresence(ideaId);
    logger.info(`[IdeaCollabWs] Client joined idea ${ideaId} (user=${user.id})`);
  });

  logger.info('[IdeaCollabWs] Native WebSocket /ws/collab/:ideaId attached (auth+session)');
}
