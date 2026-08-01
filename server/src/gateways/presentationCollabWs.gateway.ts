/**
 * Presentation Collab — P3.3 native WebSocket /ws/presentations/:deckId
 *
 * Live presence for the Deck Builder: who is viewing/editing a deck right now,
 * which card they're on, and their cursor position. This is the realtime half
 * of P3.3; the durable half is the `presentation_deck_collaborators` table
 * (membership + roles).
 *
 * ARCHITECTURE — mirrors ideaCollabWs.gateway.ts (V4-IDEA-02) exactly:
 *   - one WebSocketServer({ noServer: true }) attached to the shared HTTP server
 *     via `server.on('upgrade')`, matching only /ws/presentations/:deckId and
 *     returning early otherwise so it coexists with /ws/collab/:ideaId;
 *   - JWT auth from ?token= on the upgrade request (401 on missing/invalid);
 *   - demo-aware active-org resolution via resolveWsOrgContext (fail-CLOSED at
 *     upgrade: unknown demo state must not bind a connection to any org);
 *   - per-room Map<socket, user>, presence broadcast, heartbeat ping/pong with
 *     stale-context revalidation on passive listeners.
 *
 * DIFFERENCE vs ideaCollabWs: this gateway broadcasts PRESENCE (join/leave/
 * update/cursor/card) rather than graph_patch mutations. It carries no shared
 * document state and performs no writes to deck content — presence is ephemeral
 * and in-memory. Access is granted to same-org users AND to users with an
 * active `presentation_deck_collaborators` row (cross-org invited editors).
 *
 * FAIL-OPEN: if this gateway fails to attach or the collaborators table is
 * unreachable, the Deck Builder still works fully in solo mode — the FE hook
 * (useCollaboration) simply reports `disconnected` and the editor never blocks
 * on presence. The collaborators lookup is best-effort and swallows errors.
 */

import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { type WebSocket, WebSocketServer } from 'ws';

import { config } from '../config/Config.js';
import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import {
  isWsOrgContextFresh,
  resolveWsOrgContext,
  type WsOrgContext,
} from '../realtime/wsOrgContext.js';
import logger from '../utils/Logger.js';
import { evaluateRealtimeAccess } from '../realtime/demoRealtimeGuard.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  activeCardIndex?: number;
  cursor?: { x: number; y: number };
  isOnline: boolean;
  lastSeen: number;
}

interface PresenceSocket extends WebSocket {
  deckId?: string;
  __user?: { userId: string; organizationId: string; userName: string; avatarUrl?: string };
  __alive?: boolean;
  __orgCtx?: WsOrgContext;
  __orgCtxRefresh?: Promise<WsOrgContext> | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const deckRooms = new Map<string, Map<PresenceSocket, PresenceUser>>();
const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#ec4899'];

const HEARTBEAT_INTERVAL_MS = 30_000;

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

function serializeUser(u: PresenceUser) {
  return {
    userId: u.userId,
    name: u.name,
    color: u.color,
    avatarUrl: u.avatarUrl,
    activeCardIndex: u.activeCardIndex,
    cursor: u.cursor,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
  };
}

/** Send the full presence roster to a single socket. */
function sendPresenceList(deckId: string, ws: PresenceSocket) {
  const room = deckRooms.get(deckId);
  if (!room || ws.readyState !== 1) return;
  const users = Array.from(room.values()).map(serializeUser);
  ws.send(JSON.stringify({ type: 'presence:list', users }));
}

/** Broadcast a message to every socket in the room, optionally excluding one. */
function broadcast(deckId: string, payload: object, exclude?: PresenceSocket) {
  const room = deckRooms.get(deckId);
  if (!room) return;
  const str = JSON.stringify(payload);
  room.forEach((_u, ws) => {
    if (ws !== exclude && ws.readyState === 1) ws.send(str);
  });
}

function cleanupUser(ws: PresenceSocket, deckId: string) {
  const room = deckRooms.get(deckId);
  if (!room) return;
  const user = room.get(ws);
  room.delete(ws);
  if (room.size === 0) {
    deckRooms.delete(deckId);
  } else if (user) {
    broadcast(deckId, { type: 'presence:left', userId: user.userId });
  }
}

// ---------------------------------------------------------------------------
// Access resolution (org-scope + collaborator membership) — fail-open
// ---------------------------------------------------------------------------

/**
 * Whether `userId` may join the presence room for `deckId`.
 *
 * Grant if EITHER:
 *   (a) the deck belongs to the connection's active org, OR
 *   (b) the user has an active `presentation_deck_collaborators` row for the
 *       deck (an invited cross-org editor/viewer).
 *
 * Fail-open on the membership lookup only: a missing collaborators table falls
 * back to the org check. The org check itself remains authoritative (a
 * non-member in another org with no membership row is still rejected).
 */
async function canJoinDeck(
  db: IDatabase,
  deckId: string,
  organizationId: string,
  userId: string
): Promise<boolean> {
  let sameOrg = false;
  try {
    const deck = await db.get<{ id: string }>(
      'SELECT id FROM presentation_decks WHERE id = ? AND organization_id = ?',
      [deckId, organizationId]
    );
    sameOrg = !!deck;
  } catch (err) {
    logger.warn('[PresentationCollabWs] deck org lookup failed', {
      deckId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (sameOrg) return true;

  // Fall back to collaborator membership (best-effort; missing table → false here,
  // but the org path above already governs the common case).
  try {
    const member = await db.get<{ id: string }>(
      `SELECT id FROM presentation_deck_collaborators
       WHERE deck_id = ? AND user_id = ? AND status = 'active' LIMIT 1`,
      [deckId, userId]
    );
    return !!member;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Org-context revalidation (parity with ideaCollabWs #101 Grupa 0)
// ---------------------------------------------------------------------------

async function ensureFreshOrgContext(
  ws: PresenceSocket,
  db: IDatabase
): Promise<WsOrgContext | null> {
  const ctx = ws.__orgCtx;
  const user = ws.__user;
  if (!ctx || !user) {
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
    logger.warn('[PresentationCollabWs] Org-context revalidation failed; closing', {
      userId: user.userId,
      deckId: ws.deckId,
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
      '[PresentationCollabWs] Org context changed mid-connection — closing stale socket',
      {
        userId: user.userId,
        deckId: ws.deckId,
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

export function attachPresentationCollabWs(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
  const db = getDatabase();

  // --- Upgrade handler with JWT auth ---
  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/presentations\/([^/]+)$/);
    if (!match) return; // not ours — let other gateways handle it

    const deckId = match[1];
    if (!deckId) return;

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
    const avatarUrl = decoded.avatarUrl || decoded.avatar_url;

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

    // Demo-aware active-org resolution (parity with ideaCollabWs): a user inside
    // a demo session must not open a realtime channel to their real org.
    resolveWsOrgContext(db, userId, organizationId)
      .then(async (orgCtx) => {
        const allowed = await canJoinDeck(db, deckId, orgCtx.organizationId, userId);
        if (!allowed) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          (ws as PresenceSocket).__user = {
            userId,
            organizationId: orgCtx.organizationId,
            userName,
            avatarUrl,
          };
          (ws as PresenceSocket).__orgCtx = orgCtx;
          wss.emit('connection', ws, request, deckId);
        });
      })
      .catch((err) => {
        // Fail CLOSED at the gate: cannot determine active org → do not bind.
        logger.warn('[PresentationCollabWs] Org-context resolution failed; rejecting upgrade', {
          userId,
          deckId,
          error: err instanceof Error ? err.message : String(err),
        });
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      });
  });

  // --- Heartbeat ---
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((raw) => {
      const ws = raw as PresenceSocket;
      if (ws.__alive === false) {
        if (ws.deckId) cleanupUser(ws, ws.deckId);
        ws.terminate();
        return;
      }
      ws.__alive = false;
      ws.ping();
      if (ws.__orgCtx && !isWsOrgContextFresh(ws.__orgCtx)) {
        void ensureFreshOrgContext(ws, db);
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
  // Don't let the presence heartbeat keep the process alive on its own — the
  // HTTP server owns the lifecycle. (Also keeps test runners from hanging on
  // teardown.) `unref` is a no-op in environments without it.
  (heartbeatInterval as { unref?: () => void }).unref?.();

  wss.on('close', () => clearInterval(heartbeatInterval));

  // --- Connection handler ---
  wss.on('connection', (raw: WebSocket, _req: unknown, deckId: string) => {
    const ws = raw as PresenceSocket;
    ws.deckId = deckId;
    ws.__alive = true;

    const authUser = ws.__user;
    if (!deckRooms.has(deckId)) deckRooms.set(deckId, new Map());
    const room = deckRooms.get(deckId)!;

    const user: PresenceUser = {
      userId: authUser?.userId || 'unknown',
      name: authUser?.userName || 'Anonymous',
      color: colorForUser(authUser?.userId || 'unknown'),
      avatarUrl: authUser?.avatarUrl,
      isOnline: true,
      lastSeen: Date.now(),
    };
    room.set(ws, user);

    ws.on('pong', () => {
      ws.__alive = true;
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'presence:join': {
            const incoming = msg.user || {};
            if (incoming.name) user.name = incoming.name;
            if (incoming.avatarUrl) user.avatarUrl = incoming.avatarUrl;
            user.lastSeen = Date.now();
            user.isOnline = true;
            // Tell everyone else this user joined, and give the joiner the roster.
            broadcast(deckId, { type: 'presence:joined', user: serializeUser(user) }, ws);
            sendPresenceList(deckId, ws);
            break;
          }

          case 'presence:heartbeat': {
            user.lastSeen = Date.now();
            break;
          }

          case 'presence:update': {
            if (typeof msg.activeCardIndex === 'number') user.activeCardIndex = msg.activeCardIndex;
            if (msg.cursor && typeof msg.cursor === 'object') {
              user.cursor = { x: Number(msg.cursor.x) || 0, y: Number(msg.cursor.y) || 0 };
            }
            user.lastSeen = Date.now();
            broadcast(deckId, { type: 'presence:update', user: serializeUser(user) }, ws);
            break;
          }

          case 'presence:leave': {
            broadcast(deckId, { type: 'presence:left', userId: user.userId }, ws);
            break;
          }

          case 'deck:change': {
            // Presence gateway carries no shared document state; we relay change
            // pings so peers can invalidate/refresh, but never persist here.
            broadcast(deckId, { type: 'deck:change', userId: user.userId, change: msg.change }, ws);
            break;
          }

          default:
            break;
        }
      } catch {
        /* ignore malformed */
      }
    });

    ws.on('close', () => {
      cleanupUser(ws, deckId);
      logger.info(`[PresentationCollabWs] Client left deck ${deckId} (user=${user.userId})`);
    });

    // Announce arrival + hand the new client the current roster.
    broadcast(deckId, { type: 'presence:joined', user: serializeUser(user) }, ws);
    sendPresenceList(deckId, ws);
    logger.info(`[PresentationCollabWs] Client joined deck ${deckId} (user=${user.userId})`);
  });

  logger.info('[PresentationCollabWs] Native WebSocket /ws/presentations/:deckId attached');
}
