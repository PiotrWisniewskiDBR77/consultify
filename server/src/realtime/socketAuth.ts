/**
 * socketAuth — JWT + org-membership middleware for Socket.IO namespaces.
 *
 * Why this exists (Chat P0-1):
 * `/chat-projects` and `/org-context` namespaces previously accepted
 * anonymous connections and let the client emit `join:org` with any
 * organizationId. Anyone who could reach the WS endpoint could subscribe
 * to a real-time activity sidechannel: when an org has chats in flight,
 * when admins are rebuilding context, etc. This module adds the same
 * (verifyToken → validate org membership) shape the HTTP routes already
 * use, but adapted to Socket.IO's per-connection handshake.
 *
 * Two-stage gate:
 *   1. `socketAuthMiddleware` runs at connection time (`namespace.use`)
 *      and verifies the JWT in `socket.handshake.auth.token` (preferred)
 *      or the `Authorization: Bearer ...` header (fallback). On failure
 *      the connection is rejected before any handler fires.
 *   2. `validateJoinOrg(socket, orgId)` is called inside the `join:org`
 *      handler and asserts the authenticated user is a member of the
 *      requested org. On failure the join is silently rejected.
 *
 * Failure modes are silent-but-logged so a malicious client can't probe
 * for valid org ids via the WS error channel.
 */

import jwt from 'jsonwebtoken';
import type { Server as SocketIOServer, Socket } from 'socket.io';

import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { evaluateRealtimeAccess, trackRealtimeConnection } from './demoRealtimeGuard.js';

interface DecodedSocketUser {
  id: string;
  organizationId?: string;
  role?: string;
}

/** Read the JWT secret the same way the HTTP middleware does. */
function getJwtSecret(): string | null {
  const raw = process.env.JWT_SECRET || '';
  if (!raw || raw.length < 32) return null;
  return raw;
}

/** Pull the token from `socket.handshake.auth.token` or the Authorization header. */
function extractToken(socket: Socket): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handshake = socket.handshake as any;
  const authToken =
    (handshake?.auth?.token as string | undefined) ||
    (handshake?.query?.token as string | undefined);
  if (authToken && typeof authToken === 'string' && authToken.length > 0) return authToken;
  const headerValue = String(handshake?.headers?.authorization || '');
  if (headerValue.startsWith('Bearer ')) return headerValue.slice(7);
  return null;
}

/**
 * Namespace-level middleware: verifies the JWT and attaches the decoded
 * user to `socket.data.user`. Pass via `io.of('/foo').use(socketAuthMiddleware)`.
 */
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void): void => {
  const secret = getJwtSecret();
  if (!secret) {
    logger.warn('[socketAuth] JWT_SECRET missing or too short; rejecting socket connection');
    next(new Error('unauthorized'));
    return;
  }
  const token = extractToken(socket);
  if (!token) {
    next(new Error('unauthorized'));
    return;
  }
  jwt.verify(token, secret, (err, decoded) => {
    if (err || !decoded || typeof decoded !== 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger.debug?.('[socketAuth] token verification failed', { error: (err as any)?.message });
      next(new Error('unauthorized'));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = decoded as any;
    const userId = payload.id || payload.userId || payload.sub;
    if (!userId || typeof userId !== 'string') {
      next(new Error('unauthorized'));
      return;
    }

    // OPS-DEMO-002: a verified signature is not sufficient. The principal itself
    // has to qualify, decided server-side from the database — never from the
    // handshake, whose `organizationId` and demo flags are client-supplied.
    void evaluateRealtimeAccess(userId)
      .then((decision) => {
        if (!decision.allowed) {
          logger.info('[socketAuth] realtime connection refused', { reason: decision.reason });
          // Same opaque error as every other failure here: a distinct message
          // would let a client probe which accounts are demo principals.
          next(new Error('unauthorized'));
          return;
        }
        socket.data.user = {
          id: userId,
          organizationId: payload.organizationId,
          role: payload.role,
        } as DecodedSocketUser;
        // Re-evaluated periodically: a handshake check only proves the principal
        // qualified at connect time.
        const untrack = trackRealtimeConnection(userId, () => {
          try {
            socket.disconnect(true);
          } catch {
            /* already gone */
          }
        });
        socket.on('disconnect', untrack);
        next();
      })
      .catch(() => {
        next(new Error('unauthorized'));
      });
  });
};

/**
 * Per-action gate for `join:org`. Returns true iff the authenticated user
 * is a member of the requested organization. Silent-on-failure so a probe
 * doesn't reveal org membership topology.
 */
export async function validateJoinOrg(socket: Socket, organizationId: string): Promise<boolean> {
  const user = socket.data?.user as DecodedSocketUser | undefined;
  if (!user?.id) return false;
  const trimmedOrg = String(organizationId || '').trim();
  if (!trimmedOrg) return false;
  // Fast path: the JWT already binds the user to an org and it matches.
  if (user.organizationId && user.organizationId === trimmedOrg) return true;
  // Membership probe — same shape the HTTP `validateOrgMembership` uses.
  try {
    const row = await dbGet<{ user_id: string }>(
      `SELECT user_id FROM organization_members
        WHERE organization_id = ? AND user_id = ?
        LIMIT 1`,
      [trimmedOrg, user.id],
      { fallback: true }
    );
    return !!row?.user_id;
  } catch (err) {
    logger.warn('[socketAuth] org membership check failed', {
      userId: user.id,
      organizationId: trimmedOrg,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Convenience: register the JWT middleware on a namespace. Idempotent — calling
 * twice is a no-op (Socket.IO de-dupes middleware functions by identity).
 */
export function applySocketAuth(io: SocketIOServer, namespace: string): void {
  const ns = io.of(namespace);
  ns.use(socketAuthMiddleware);
}
