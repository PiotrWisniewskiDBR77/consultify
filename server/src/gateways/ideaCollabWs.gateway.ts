/**
 * Idea Collab — V4-IDEA-02 native WebSocket /ws/collab/:ideaId
 * Auth, presence, cursors, shared session state, persistence.
 */

import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { type WebSocket, WebSocketServer } from 'ws';

import { config } from '../config/Config.js';
import { featureFlags } from '../config/FeatureFlags.js';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { applyGraphPatchToCanonical, assertIdeaMembership } from '../realtime/ideaMapAccess.js';
import {
  isWsOrgContextFresh,
  resolveWsOrgContext,
  type WsOrgContext,
} from '../realtime/wsOrgContext.js';
import logger from '../utils/Logger.js';
import {
  evaluateRealtimeAccess,
  trackRealtimeConnection,
} from '../realtime/demoRealtimeGuard.js';

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
  /** Demo-aware org context this connection is bound to (#101 Grupa 0). */
  __orgCtx?: WsOrgContext;
  /** Shared in-flight re-resolution so concurrent writes don't stampede the DB. */
  __orgCtxRefresh?: Promise<WsOrgContext> | null;
  /** DP-3 (ENABLE_SHARED_IDEA_MAPS): whether this member may write to the
   *  shared canonical map, decided once at upgrade via assertIdeaMembership.
   *  Only meaningful when the flag is ON. */
  __canWrite?: boolean;
}

/** Message types that mutate shared/org state — all must pass the org gate.
 *  DP-3: when ENABLE_SHARED_IDEA_MAPS is ON these additionally require
 *  membership canWrite (a non-member is already rejected at upgrade with 403). */
const WRITE_OPS = new Set([
  'lock_node',
  'unlock_node',
  'select_nodes',
  'viewport_sync',
  'graph_patch',
]);

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

/**
 * DP-3: broadcast the new canonical version to the WHOLE room (including the
 * author) so every client can silently advance its serverVersionRef without a
 * re-hydration (frontend T6). Sent only after a successful canonical persist.
 */
function broadcastGraphVersion(ideaId: string, version: number) {
  const room = ideaRooms.get(ideaId);
  if (!room) return;
  const payload = JSON.stringify({ type: 'graph_version', version });
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

async function persistEvent(
  db: IDatabase,
  sessionId: string,
  eventType: string,
  payload?: unknown
) {
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
// Org-context enforcement (#101 Grupa 0 — WS-leak)
// ---------------------------------------------------------------------------

/**
 * Ensure the socket's org context is still the user's ACTIVE org.
 *
 * Fresh context → returned as-is. Stale context → re-resolved (one shared
 * in-flight promise per socket). If the active org changed mid-connection
 * (e.g. the user entered/left demo mode), the stale socket must not keep
 * writing to the old org: we log a warning, notify the client, and close with
 * 4403 so the frontend re-handshakes into the correct org room.
 *
 * Returns null when the write must NOT proceed (socket closed / fail-closed).
 */
async function ensureFreshOrgContext(
  ws: CollabSocket,
  db: IDatabase
): Promise<WsOrgContext | null> {
  const ctx = ws.__orgCtx;
  const user = ws.__user;
  if (!ctx || !user) {
    logger.warn('[IdeaCollabWs] Missing org context on socket; closing', { ideaId: ws.ideaId });
    try {
      ws.close(4401, 'missing org context');
    } catch {
      ws.terminate();
    }
    return null;
  }
  if (isWsOrgContextFresh(ctx)) return ctx;

  if (!ws.__orgCtxRefresh) {
    ws.__orgCtxRefresh = resolveWsOrgContext(db, user.userId, ctx.jwtOrganizationId).finally(() => {
      ws.__orgCtxRefresh = null;
    });
  }
  let fresh: WsOrgContext;
  try {
    fresh = await ws.__orgCtxRefresh;
  } catch (err) {
    // Fail CLOSED: unknown demo state must never allow a write.
    logger.warn('[IdeaCollabWs] Org-context revalidation failed; closing connection', {
      userId: user.userId,
      ideaId: ws.ideaId,
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      ws.close(1011, 'org context unavailable');
    } catch {
      ws.terminate();
    }
    return null;
  }

  if (fresh.organizationId !== ctx.organizationId) {
    logger.warn(
      '[IdeaCollabWs] Org context changed mid-connection — rejecting write, closing stale socket',
      {
        userId: user.userId,
        ideaId: ws.ideaId,
        boundOrg: ctx.organizationId,
        activeOrg: fresh.organizationId,
      }
    );
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: 'error', code: 'ORG_CONTEXT_CHANGED' }));
      } catch {
        /* best effort */
      }
    }
    try {
      ws.close(4403, 'org context changed');
    } catch {
      ws.terminate();
    }
    return null;
  }

  ws.__orgCtx = fresh;
  return fresh;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function attachIdeaCollabWs(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
  const db = getDatabase();

  // --- Upgrade handler with JWT auth ---
  server.on('upgrade', async (request, socket, head) => {
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

    // OPS-DEMO-002: a verified signature is not enough. Public demo principals get
    // no realtime connection at all — this plane bypasses `attachUser`, where the
    // HTTP read-only guard lives. Decided server-side; the handshake's
    // `organizationId` is not consulted.
    const realtimeDecision = await evaluateRealtimeAccess(userId);
    if (!realtimeDecision.allowed) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // #101 Grupa 0 (WS-leak): resolve the ACTIVE org context (demo-aware) the
    // same way HTTP does via demoContextMiddleware, then verify the idea
    // belongs to that active org — never blindly to the JWT org. A user inside
    // a demo session must not open a realtime write channel to their real org.
    //
    // DP-3 (ENABLE_SHARED_IDEA_MAPS ON): additionally require the user to be an
    // ACTIVE org member (assertIdeaMembership) of the resolved active org.
    // canRead=false → 403 (same shape as today's cross-org rejection). canWrite
    // is stashed on the socket so WRITE_OPS can be gated per-message. Flag OFF →
    // EXACTLY today's org-scope check against the active org, no membership req.
    resolveWsOrgContext(db, userId, organizationId)
      .then(async (orgCtx) => {
        const activeOrg = orgCtx.organizationId;
        const sharedMaps = featureFlags.ENABLE_SHARED_IDEA_MAPS;
        const gate = sharedMaps
          ? await assertIdeaMembership(db, activeOrg, userId, ideaId).then((m) => ({
              ok: m.canRead,
              canWrite: m.canWrite,
            }))
          : await db
              .get<{
                id: string;
              }>('SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?', [
                ideaId,
                activeOrg,
              ])
              .then((idea) => ({ ok: !!idea, canWrite: true }));

        if (!gate.ok) {
          if (orgCtx.demoMode && activeOrg !== organizationId) {
            logger.warn(
              '[IdeaCollabWs] Cross-org WS join rejected: demo session active, idea not in active org',
              { userId, ideaId, activeOrg, jwtOrg: organizationId }
            );
          }
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          (ws as CollabSocket).__user = {
            userId,
            organizationId: activeOrg,
            userName,
          };
          (ws as CollabSocket).__orgCtx = orgCtx;
          (ws as CollabSocket).__canWrite = gate.canWrite;
          // OPS-DEMO-002: register for the periodic re-evaluation sweep. A handshake
          // check alone only proves the principal qualified at connect time; this is
          // what makes a principal that stops qualifying get disconnected.
          const untrack = trackRealtimeConnection(userId, () => {
            try {
              ws.close(1008, 'realtime access revoked');
            } catch {
              /* already gone */
            }
          });
          ws.on('close', untrack);
          wss.emit('connection', ws, request, ideaId);
        });
      })
      .catch((err) => {
        // Fail CLOSED: if we cannot determine the active org (demo state
        // unknown), we must not bind the connection to any org.
        logger.warn('[IdeaCollabWs] Org-context resolution failed; rejecting upgrade', {
          userId,
          ideaId,
          error: err instanceof Error ? err.message : String(err),
        });
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
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
      // #101 Grupa 0: passive listeners also get their org context revalidated
      // so a socket left open across a demo↔real org switch is closed even if
      // it never attempts a write (closes the read-side of the stale channel).
      if (ws.__orgCtx && !isWsOrgContextFresh(ws.__orgCtx)) {
        void ensureFreshOrgContext(ws, db);
      }
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

    ws.on('message', async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // #101 Grupa 0: every mutating op must (a) run against a FRESH active
        // org context (demo switch mid-connection closes the stale socket) and
        // (b) be allowed to write (shared demo org is read-only, parity with
        // HTTP demoWriteProtection). Rejections are logged + surfaced to the
        // client — never a silent drop.
        if (WRITE_OPS.has(msg.type)) {
          const orgCtx = await ensureFreshOrgContext(ws, db);
          if (!orgCtx) return;
          if (!orgCtx.writeAllowed) {
            logger.warn('[IdeaCollabWs] Write rejected: read-only demo org context', {
              userId: user.id,
              ideaId,
              org: orgCtx.organizationId,
              op: msg.type,
            });
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'error', code: 'DEMO_READ_ONLY', op: msg.type }));
            }
            return;
          }

          // DP-3 (ENABLE_SHARED_IDEA_MAPS ON): shared-map mutations require the
          // member's write permission (decided at upgrade). A read-only member is
          // told once and the op is dropped — never silently. Flag OFF → no gate
          // (today's behavior). Non-members never reach here (403 at upgrade).
          if (featureFlags.ENABLE_SHARED_IDEA_MAPS && !ws.__canWrite) {
            logger.warn('[IdeaCollabWs] Write rejected: member lacks write permission', {
              userId: user.id,
              ideaId,
              op: msg.type,
            });
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'error', code: 'NOT_A_WRITER', op: msg.type }));
            }
            return;
          }
        }

        switch (msg.type) {
          case 'join':
            // Auth already set identity; allow name override
            if (msg.userName) user.name = msg.userName;
            user.lastSeen = Date.now();
            break;

          case 'heartbeat':
            user.lastSeen = Date.now();
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

          case 'graph_patch': {
            const patch = {
              type: 'graph_patch',
              userId: user.id,
              userName: user.name,
              timestamp: Date.now(),
              operations: msg.operations,
            };
            state.lastActivity = Date.now();
            ws.__actionsCount = (ws.__actionsCount || 0) + 1;

            // (a) Relay to the rest of the room — ALWAYS, flag on or off. Even
            // if the canonical persist fails, peers apply the live patch and
            // rehydration reconciles later (plan §3).
            const patchStr = JSON.stringify(patch);
            room.forEach((_, otherWs) => {
              if (otherWs !== ws && otherWs.readyState === 1) {
                otherWs.send(patchStr);
              }
            });

            if (ws.__sessionId) {
              persistEvent(db, ws.__sessionId, 'graph_patch', {
                opCount: Array.isArray(msg.operations) ? msg.operations.length : 0,
              });
            }

            // (b+c) DP-3: sequentially persist into the canonical row and
            // broadcast the new version to the WHOLE room (author included).
            // Flag OFF → relay-only, exactly today's behavior.
            if (featureFlags.ENABLE_SHARED_IDEA_MAPS) {
              const ops = Array.isArray(msg.operations) ? msg.operations : [];
              try {
                const { version } = await applyGraphPatchToCanonical(
                  db,
                  ideaId,
                  user.organizationId || authUser?.organizationId || '',
                  user.id,
                  ops
                );
                broadcastGraphVersion(ideaId, version);
              } catch (err) {
                logger.warn('[IdeaCollabWs] Canonical graph_patch persist failed', {
                  userId: user.id,
                  ideaId,
                  error: err instanceof Error ? err.message : String(err),
                });
                if (ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'error', code: 'GRAPH_PERSIST_FAILED' }));
                }
              }
            }
            break;
          }

          case 'graph_full_sync': {
            const syncRoom = ideaRooms.get(ideaId);
            if (!syncRoom) break;
            for (const [otherWs] of syncRoom) {
              if (otherWs !== ws && otherWs.readyState === 1) {
                otherWs.send(JSON.stringify({ type: 'graph_sync_request', requesterId: user.id }));
                break;
              }
            }
            break;
          }

          case 'graph_sync_response': {
            const targetId = msg.requesterId;
            const respRoom = ideaRooms.get(ideaId);
            if (!respRoom || !targetId) break;
            for (const [otherWs, otherUser] of respRoom) {
              if (otherUser.id === targetId && otherWs.readyState === 1) {
                otherWs.send(
                  JSON.stringify({
                    type: 'graph_full_state',
                    nodes: msg.nodes,
                    edges: msg.edges,
                    version: msg.version,
                    fromUserId: user.id,
                  })
                );
                break;
              }
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
