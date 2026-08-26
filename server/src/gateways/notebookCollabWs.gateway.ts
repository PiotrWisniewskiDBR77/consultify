/**
 * Notebook Collab — #23 native WebSocket /ws/notebook/:noteId presence.
 *
 * A faithful 1:1 mirror of presentationCollabWs.gateway (P3.3): the SAME native
 * WebSocket presence protocol (presence:join / heartbeat / update / leave /
 * list / joined / left), the SAME JWT-on-upgrade auth, the SAME demo-aware
 * org-context resolution + mid-connection revalidation. The only differences:
 *   - path is /ws/notebook/:noteId
 *   - the room key is a notebook page id
 *   - authorization is `canViewNote` against notebook_pages (org-scoped)
 *   - it carries no shared document state (presence + relay pings only)
 *
 * Fail-open by construction on the CLIENT side: if this gateway does not attach
 * or the socket cannot connect, the Notebook keeps working in solo mode and the
 * FE useNotebookPresence hook just reports `disconnected`. Never blocks editing.
 *
 * ★ presence-write (2026-07-19, registry T8): until now, presence lived ONLY
 * in the in-memory `noteRooms` Map — real for peers on the SAME server
 * process, invisible across instances (no horizontal-scaling safety) and gone
 * on every restart, with no REST fallback if a client's WS never connects
 * (unlike the Idea Table presence at my-work.routes.ts `/my-ideas/:id/presence`,
 * which is DB-backed via realtimePlatformService against `realtime_presence`).
 * This gateway now ALSO writes (best-effort, fail-open — never blocks the
 * WS broadcast/room logic) to that same `realtime_presence` table under
 * channel `notebook-${noteId}`, giving the notebook a durable presence record
 * with the same shape/guarantees the Idea Table already has.
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
import {
  isOrganizationSuspended,
  writeOrgSuspendedUpgradeRefusal,
} from '../services/organizationSuspensionGuard.js';
import {
  evaluateRealtimeAccess,
  trackRealtimeConnection,
} from '../realtime/demoRealtimeGuard.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  isOnline: boolean;
  lastSeen: number;
}

interface PresenceSocket extends WebSocket {
  noteId?: string;
  __user?: { userId: string; organizationId: string; userName: string; avatarUrl?: string };
  __alive?: boolean;
  __orgCtx?: WsOrgContext;
  __orgCtxRefresh?: Promise<WsOrgContext> | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const noteRooms = new Map<string, Map<PresenceSocket, PresenceUser>>();
const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b8ea5', '#6366f1', '#ec4899'];

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
    cursor: u.cursor,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
  };
}

/** Send the full presence roster to a single socket. */
function sendPresenceList(noteId: string, ws: PresenceSocket) {
  const room = noteRooms.get(noteId);
  if (!room || ws.readyState !== 1) return;
  const users = Array.from(room.values()).map(serializeUser);
  ws.send(JSON.stringify({ type: 'presence:list', users }));
}

/** Broadcast a message to every socket in the room, optionally excluding one. */
function broadcast(noteId: string, payload: object, exclude?: PresenceSocket) {
  const room = noteRooms.get(noteId);
  if (!room) return;
  const str = JSON.stringify(payload);
  room.forEach((_u, ws) => {
    if (ws !== exclude && ws.readyState === 1) ws.send(str);
  });
}

function cleanupUser(ws: PresenceSocket, noteId: string) {
  const room = noteRooms.get(noteId);
  if (!room) return;
  const user = room.get(ws);
  room.delete(ws);
  if (room.size === 0) {
    noteRooms.delete(noteId);
  } else if (user) {
    broadcast(noteId, { type: 'presence:left', userId: user.userId });
  }
}

/** Whether some OTHER socket in the room still belongs to this user (multi-tab). */
function hasOtherSocketForUser(
  room: Map<PresenceSocket, PresenceUser> | undefined,
  userId: string,
  exclude: PresenceSocket
): boolean {
  if (!room) return false;
  for (const [sock, u] of room) {
    if (sock !== exclude && u.userId === userId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// presence-write (T8) — best-effort DB persistence, mirrors the Idea Table
// presence pattern (my-work.routes.ts `/my-ideas/:id/presence` →
// realtimePlatformService). Never throws into the WS handlers: a DB hiccup
// degrades to "presence not durable this tick", it must NEVER drop the room
// or the live broadcast.
// ---------------------------------------------------------------------------

function presenceChannelId(noteId: string): string {
  return `notebook-${noteId}`;
}

async function writePresenceJoin(noteId: string, user: PresenceUser): Promise<void> {
  try {
    const realtimePlatformService = (await import('../services/realtimePlatformService.js'))
      .default;
    await realtimePlatformService.upsertPresence(presenceChannelId(noteId), {
      userId: user.userId,
      userName: user.name,
      userColor: user.color,
    });
  } catch (err) {
    logger.warn('[NotebookCollabWs] presence-write join degraded', {
      noteId,
      userId: user.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function writePresenceHeartbeat(noteId: string, userId: string): Promise<void> {
  try {
    const realtimePlatformService = (await import('../services/realtimePlatformService.js'))
      .default;
    await realtimePlatformService.heartbeatPresence(presenceChannelId(noteId), userId);
  } catch (err) {
    logger.warn('[NotebookCollabWs] presence-write heartbeat degraded', {
      noteId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function writePresenceLeave(noteId: string, userId: string): Promise<void> {
  try {
    const realtimePlatformService = (await import('../services/realtimePlatformService.js'))
      .default;
    await realtimePlatformService.disconnectPresence(presenceChannelId(noteId), userId);
  } catch (err) {
    logger.warn('[NotebookCollabWs] presence-write leave degraded', {
      noteId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Access resolution (org-scope) — mirrors canJoinDeck
// ---------------------------------------------------------------------------

/**
 * Whether `userId` in `organizationId` may join the presence room for `noteId`.
 * Grant if the note belongs to the connection's active org. Fail-CLOSED: any
 * lookup error → reject (a presence channel must never leak a note across orgs).
 */
async function canViewNote(
  db: IDatabase,
  noteId: string,
  organizationId: string,
  _userId: string
): Promise<boolean> {
  try {
    const note = await db.get<{ id: string }>(
      'SELECT id FROM notebook_pages WHERE id = ? AND organization_id = ?',
      [noteId, organizationId]
    );
    return !!note;
  } catch (err) {
    logger.warn('[NotebookCollabWs] note org lookup failed', {
      noteId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Org-context revalidation (parity with presentationCollabWs #101 Grupa 0)
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
    logger.warn('[NotebookCollabWs] Org-context revalidation failed; closing', {
      userId: user.userId,
      noteId: ws.noteId,
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
    logger.warn('[NotebookCollabWs] Org context changed mid-connection — closing stale socket', {
      userId: user.userId,
      noteId: ws.noteId,
      boundOrg: ctx.organizationId,
      activeOrg: fresh.organizationId,
    });
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

export function attachNotebookCollabWs(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
  const db = getDatabase();

  // --- Upgrade handler with JWT auth ---
  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/notebook\/([^/]+)$/);
    if (!match) return; // not ours — let other gateways handle it

    const noteId = match[1];
    if (!noteId) return;

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

    // Demo-aware active-org resolution (parity with presentationCollabWs): a user
    // inside a demo session must not open a realtime channel to their real org.
    resolveWsOrgContext(db, userId, organizationId)
      .then(async (orgCtx) => {
        // -------------------------------------------------------------------
        // DEC-91 / TRI-MUST-12 — suspension gate at UPGRADE time.
        //
        // Passing the org to `trackRealtimeConnection` below only gets an OPEN
        // socket closed by the next sweep; without this block a member of a
        // suspended tenant could still open one and hold it for up to a sweep
        // interval. This closes that window.
        //
        // Placed before the note gate deliberately: a suspended tenant should not
        // get to probe whether a given note exists.
        //
        // The org is resolved server-side by `resolveWsOrgContext` from the
        // authenticated principal — the caller's OWN tenant, never a
        // client-supplied id — so the refusal names its reason.
        // -------------------------------------------------------------------
        if (
          await isOrganizationSuspended(orgCtx.organizationId, (sql, params) =>
            db.get(sql, params)
          )
        ) {
          logger.info('[NotebookCollabWs] WS upgrade refused: organization suspended', {
            userId,
            organizationId: orgCtx.organizationId,
          });
          writeOrgSuspendedUpgradeRefusal(socket);
          return;
        }

        const allowed = await canViewNote(db, noteId, orgCtx.organizationId, userId);
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
          // OPS-DEMO-002: register for the periodic re-evaluation sweep. A handshake
          // check alone only proves the principal qualified at connect time; this is
          // what makes a principal that stops qualifying get disconnected.
          // DEC-91: passing the tenant enrols this connection in the suspension
          // arm of the same sweep, so an org suspended DURING an open session
          // loses its realtime channel too.
          const untrack = trackRealtimeConnection(
            userId,
            () => {
              try {
                ws.close(1008, 'realtime access revoked');
              } catch {
                /* already gone */
              }
            },
            orgCtx.organizationId
          );
          ws.on('close', untrack);
          wss.emit('connection', ws, request, noteId);
        });
      })
      .catch((err) => {
        // Fail CLOSED at the gate: cannot determine active org → do not bind.
        logger.warn('[NotebookCollabWs] Org-context resolution failed; rejecting upgrade', {
          userId,
          noteId,
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
        if (ws.noteId) cleanupUser(ws, ws.noteId);
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
  (heartbeatInterval as { unref?: () => void }).unref?.();

  wss.on('close', () => clearInterval(heartbeatInterval));

  // --- Connection handler ---
  wss.on('connection', (raw: WebSocket, _req: unknown, noteId: string) => {
    const ws = raw as PresenceSocket;
    ws.noteId = noteId;
    ws.__alive = true;

    const authUser = ws.__user;
    if (!noteRooms.has(noteId)) noteRooms.set(noteId, new Map());
    const room = noteRooms.get(noteId)!;

    const user: PresenceUser = {
      userId: authUser?.userId || 'unknown',
      name: authUser?.userName || 'Anonymous',
      color: colorForUser(authUser?.userId || 'unknown'),
      avatarUrl: authUser?.avatarUrl,
      isOnline: true,
      lastSeen: Date.now(),
    };
    room.set(ws, user);
    void writePresenceJoin(noteId, user);

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
            broadcast(noteId, { type: 'presence:joined', user: serializeUser(user) }, ws);
            sendPresenceList(noteId, ws);
            void writePresenceJoin(noteId, user);
            break;
          }

          case 'presence:heartbeat': {
            user.lastSeen = Date.now();
            void writePresenceHeartbeat(noteId, user.userId);
            break;
          }

          case 'presence:update': {
            if (msg.cursor && typeof msg.cursor === 'object') {
              user.cursor = { x: Number(msg.cursor.x) || 0, y: Number(msg.cursor.y) || 0 };
            }
            user.lastSeen = Date.now();
            broadcast(noteId, { type: 'presence:update', user: serializeUser(user) }, ws);
            break;
          }

          case 'presence:leave': {
            broadcast(noteId, { type: 'presence:left', userId: user.userId }, ws);
            if (!hasOtherSocketForUser(noteRooms.get(noteId), user.userId, ws)) {
              void writePresenceLeave(noteId, user.userId);
            }
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
      const stillPresentElsewhere = hasOtherSocketForUser(noteRooms.get(noteId), user.userId, ws);
      cleanupUser(ws, noteId);
      if (!stillPresentElsewhere) {
        void writePresenceLeave(noteId, user.userId);
      }
      logger.info(`[NotebookCollabWs] Client left note ${noteId} (user=${user.userId})`);
    });

    // Announce arrival + hand the new client the current roster.
    broadcast(noteId, { type: 'presence:joined', user: serializeUser(user) }, ws);
    sendPresenceList(noteId, ws);
    logger.info(`[NotebookCollabWs] Client joined note ${noteId} (user=${user.userId})`);
  });

  logger.info('[NotebookCollabWs] Native WebSocket /ws/notebook/:noteId attached');
}
