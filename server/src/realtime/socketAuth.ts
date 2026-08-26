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
 * row when the token carries no org. Returns `''` only when the user genuinely
 * has no organization — the caller then has nothing to check.
 *
 * THROWS when the lookup fails, and that distinction is the whole point. The
 * first revision passed `{ fallback: true }` and swallowed errors into `''`,
 * which the caller could not tell apart from "no org" — so a database blip
 * silently SKIPPED the suspension gate and handed out a live socket. The caller
 * now treats a failure as a refusal, which is exactly how it already treats a
 * failing `evaluateRealtimeAccess` a few lines below: on this plane, an
 * identity we cannot resolve does not get a long-lived privileged channel.
 */
async function resolveSocketOrganizationId(
  userId: string,
  tokenOrganizationId: unknown
): Promise<string> {
  const fromToken = typeof tokenOrganizationId === 'string' ? tokenOrganizationId.trim() : '';
  if (fromToken) return fromToken;
  const row = await dbGet<{ organization_id?: string }>(
    'SELECT organization_id FROM users WHERE id = ? LIMIT 1',
    [userId],
    { fallback: false }
  );
  return String(row?.organization_id || '').trim();
}

/**
 * `DbPromise.get` pinned to reject instead of resolving `null` on failure.
 * The guard reads a `null` row as "not suspended", so a swallowed error would
 * silently open the gate.
 */
const strictDbGet = <T,>(sql: string, params?: unknown[]): Promise<T | null> =>
  dbGet<T>(sql, params, { fallback: false });

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
            if (organizationId && (await isOrganizationSuspended(organizationId, strictDbGet))) {
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
          .catch((resolveErr) => {
            // Fail CLOSED, and say so in the log. An unresolvable tenant used to
            // mean "skip the suspension gate and connect anyway"; now it means
            // no socket. Logged because a database outage must not be invisible
            // here — the refusal would otherwise look like a client problem.
            logger.warn('[socketAuth] refusing socket: org resolution failed', {
              error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr),
            });
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

  // ---------------------------------------------------------------------------
  // ORDER MATTERS — MEMBERSHIP FIRST, SUSPENSION SECOND (DEC-91 FIX-5).
  //
  // `organizationId` here is whatever the client put in its `join:org` payload.
  // The first revision asked the suspension guard about it BEFORE establishing
  // that the caller has anything to do with that tenant, which handed an
  // authenticated socket a way to drive the guard's cache with ids of its own
  // choosing — a Map with no ceiling, spammed by a loop of random 128-character
  // ids. An adversarial audit called that out, correctly.
  //
  // Establishing membership first means the guard is only ever asked about a
  // tenant this user is genuinely bound to, so the cache key space is bounded
  // by real tenants. (The guard also no longer caches absent rows, and carries
  // a hard entry ceiling — three layers, because this one is easy to reorder
  // back by accident.)
  // ---------------------------------------------------------------------------
  let isMember = Boolean(user.organizationId) && user.organizationId === trimmedOrg;

  if (!isMember) {
    // Membership probe — same shape the HTTP `validateOrgMembership` uses.
    try {
      const row = await dbGet<{ user_id: string }>(
        `SELECT user_id FROM organization_members
        WHERE organization_id = ? AND user_id = ?
        LIMIT 1`,
        [trimmedOrg, user.id],
        { fallback: true }
      );
      isMember = !!row?.user_id;
    } catch (err) {
      logger.warn('[socketAuth] org membership check failed', {
        userId: user.id,
        organizationId: trimmedOrg,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  if (!isMember) return false;

  // DEC-91: a verified member still may not join a SUSPENDED tenant's room. The
  // handshake gate covers the org the socket was seated in; this covers the org
  // the client asked to join, which for a multi-org user need not be the same.
  //
  // Silent, like every other refusal in this function: the caller now provably
  // belongs to this tenant, but keeping the answer indistinguishable from a
  // plain membership failure costs nothing and keeps one uniform contract.
  //
  // Fails CLOSED on a lookup error, matching the membership probe directly
  // above rather than the guard's own fail-open default — on this plane the
  // house style is to refuse what it cannot verify.
  try {
    if (await isOrganizationSuspended(trimmedOrg, strictDbGet)) {
      logger.info('[socketAuth] join:org refused: organization suspended', {
        organizationId: trimmedOrg,
      });
      return false;
    }
  } catch (err) {
    logger.warn('[socketAuth] join:org refused: suspension lookup failed', {
      organizationId: trimmedOrg,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }

  return true;
}

/**
 * Convenience: register the JWT middleware on a namespace. Idempotent — calling
 * twice is a no-op (Socket.IO de-dupes middleware functions by identity).
 */
export function applySocketAuth(io: SocketIOServer, namespace: string): void {
  const ns = io.of(namespace);
  ns.use(socketAuthMiddleware);
}
