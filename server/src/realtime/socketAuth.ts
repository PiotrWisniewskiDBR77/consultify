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

import {
  buildOrgSuspendedResponseBody,
  isOrganizationSuspended,
  ORG_SUSPENDED_CODE,
} from '../services/organizationSuspensionGuard.js';
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
 * Resolve the tenant this socket is seated in, server-side.
 *
 * Prefers the claim from the just-verified JWT; falls back to the user's own
 * row when the token carries no org. Returns `''` when neither is available —
 * the caller then has nothing to check, and must not invent a refusal.
 */
async function resolveSocketOrganizationId(
  userId: string,
  tokenOrganizationId: unknown
): Promise<string> {
  const fromToken = typeof tokenOrganizationId === 'string' ? tokenOrganizationId.trim() : '';
  if (fromToken) return fromToken;
  try {
    const row = await dbGet<{ organization_id?: string }>(
      'SELECT organization_id FROM users WHERE id = ? LIMIT 1',
      [userId],
      { fallback: true }
    );
    return String(row?.organization_id || '').trim();
  } catch {
    return '';
  }
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
        // -------------------------------------------------------------------
        // DEC-91 / TRI-MUST-12 — the realtime handshake is a THIRD front door.
        //
        // This module runs its own `jwt.verify` and never reaches `attachUser`,
        // so the HTTP enforcement does not cover it: a member of a suspended
        // tenant was refused every REST call and still held a live activity
        // sidechannel.
        //
        // The org is resolved server-side (`resolveSocketOrganizationId`), not
        // taken from `socket.handshake` — same rule the demo check above
        // follows. The token claim is acceptable because the signature was
        // just verified; the `users` row is the fallback when the token has no
        // org claim at all.
        // -------------------------------------------------------------------
        void resolveSocketOrganizationId(userId, payload.organizationId)
          .then(async (organizationId) => {
            if (organizationId && (await isOrganizationSuspended(organizationId, dbGet))) {
              logger.info('[socketAuth] realtime connection refused: organization suspended', {
                organizationId,
              });
              // Unlike the demo refusal above, this one names its reason. It is
              // not a probe risk: the tenant is the caller's OWN, derived from
              // their own verified token or their own user row — never from a
              // client-supplied id — so nothing about any other tenant leaks.
              const refusal = new Error(ORG_SUSPENDED_CODE) as Error & {
                data?: Record<string, unknown>;
              };
              refusal.data = buildOrgSuspendedResponseBody();
              next(refusal);
              return;
            }

            socket.data.user = {
              id: userId,
              organizationId: payload.organizationId,
              role: payload.role,
            } as DecodedSocketUser;
            // Re-evaluated periodically: a handshake check only proves the principal
            // qualified at connect time. Passing the org id enrols this connection
            // in the suspension arm of the same sweep, so a tenant suspended DURING
            // an open session is disconnected within one sweep interval rather than
            // surviving until the client happens to reconnect.
            const untrack = trackRealtimeConnection(
              userId,
              () => {
                try {
                  socket.disconnect(true);
                } catch {
                  /* already gone */
                }
              },
              organizationId
            );
            socket.on('disconnect', untrack);
            next();
          })
          .catch(() => {
            next(new Error('unauthorized'));
          });
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

  // DEC-91: refuse joining a SUSPENDED tenant's room, before the membership
  // question is even asked. The handshake gate covers the org the socket was
  // seated in; this covers the org the client is asking to join, which for a
  // multi-org user need not be the same one. Silent, like every other refusal
  // in this function — here the org id IS client-supplied, so naming the reason
  // would let a stranger probe which tenants exist and are suspended.
  try {
    if (await isOrganizationSuspended(trimmedOrg, dbGet)) {
      logger.info('[socketAuth] join:org refused: organization suspended', {
        organizationId: trimmedOrg,
      });
      return false;
    }
  } catch {
    // Fail open, consistent with the guard itself.
  }

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
