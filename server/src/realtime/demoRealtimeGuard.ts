/**
 * Realtime access policy for PUBLIC demo principals (OPS-DEMO-002).
 *
 * The realtime plane is a second, parallel authorization surface. Every entry
 * point verified the JWT signature and nothing else: not the public-demo marker,
 * not `demo_sessions`, not `users.status`. So a public demo credential could open
 * a socket and emit mutating events — `cell:update`, CRDT patches, presence,
 * votes, comments, edit locks — none of which pass through `attachUser`, where the
 * HTTP read-only guard lives. Worse, the handshake was the only check, so a socket
 * opened while the demo was live kept working for the remaining lifetime of the
 * access token after the session expired.
 *
 * POLICY (deliberately blunt for MVP): a public demo principal gets NO realtime
 * connection at all — not even read-only or presence.
 *
 * The alternative was a read/write event classification enforced across seven
 * gateways. That is a larger change with a much worse failure mode: one
 * unclassified event in one gateway is a silent write, and there is no single
 * place to audit. Total denial is one decision in one module, and a public demo
 * visitor loses nothing they need — the seeded workspace is read-only by design,
 * so there is no collaborator to sync with.
 *
 * Identification is entirely server-side: the verified JWT gives a user id, and
 * everything else — whether this is a public demo principal, whether its session
 * is live, which tenant it belongs to — is read from the database. Nothing the
 * client sends in the handshake (`organizationId`, demo flags, headers) is
 * consulted.
 */
import logger from '../utils/Logger.js';
import { get as dbGet } from '../utils/DbPromise.js';
import {
  DEMO_ENTRY_SOURCE_PREF_KEY,
  PUBLIC_DEMO_ENTRY_SOURCE,
} from '../services/demo/demoSignupProvisioning.js';

export const REALTIME_DEMO_DENIED_REASON = 'demo_realtime_forbidden';

export interface RealtimeAccessDecision {
  allowed: boolean;
  /** Machine-readable reason, for logs. Never sent to the client. */
  reason?: string;
}

/**
 * May this principal hold a realtime connection?
 *
 * Denies every public demo principal, whether or not its session is still live.
 * An ACTIVE session does not earn realtime: the demo is read-only, and the
 * realtime plane is where writes escape the HTTP guard.
 */
export async function evaluateRealtimeAccess(userId: string): Promise<RealtimeAccessDecision> {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return { allowed: false, reason: 'missing_principal' };

  try {
    // Read the marker DIRECTLY rather than through `resolvePublicDemoPrincipal`.
    //
    // That helper delegates to `isPublicDemoPrincipal`, which swallows a storage
    // fault and returns `false` — deliberately, because the HTTP guard must fail
    // OPEN so a database blip cannot lock every customer out of the product. The
    // consequence here was that this module documented "fail CLOSED" while the
    // catch below could never see the fault: a blip admitted every demo principal
    // to realtime. Realtime is an enhancement, so it takes the opposite trade and
    // needs the error to reach it.
    const marker = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [normalizedUserId, DEMO_ENTRY_SOURCE_PREF_KEY],
      { fallback: false }
    );
    if (String(marker?.value || '').trim() === PUBLIC_DEMO_ENTRY_SOURCE) {
      return { allowed: false, reason: REALTIME_DEMO_DENIED_REASON };
    }
    return { allowed: true };
  } catch (error: unknown) {
    // Fail CLOSED. Unlike the HTTP marker lookup — which fails open so a database
    // blip cannot lock every customer out of the product — realtime is an
    // enhancement. Refusing a socket degrades collaboration for a moment; letting
    // an unclassified principal through opens the write path this module exists to
    // close.
    logger.warn('[RealtimeDemoGuard] access evaluation failed; denying', {
      error: (error as Error)?.message || String(error),
    });
    return { allowed: false, reason: 'evaluation_failed' };
  }
}

// ---------------------------------------------------------------------------
// Post-handshake enforcement
// ---------------------------------------------------------------------------

interface TrackedConnection {
  userId: string;
  close: () => void;
}

const tracked = new Map<symbol, TrackedConnection>();
let sweepTimer: NodeJS.Timeout | null = null;

/** How often open connections are re-evaluated. */
const SWEEP_INTERVAL_MS = 60_000;

function ensureSweepRunning(): void {
  if (sweepTimer || tracked.size === 0) return;
  sweepTimer = setInterval(() => {
    void sweepRealtimeConnections();
  }, SWEEP_INTERVAL_MS);
  // Never hold the process open for this.
  sweepTimer.unref?.();
}

function stopSweepIfIdle(): void {
  if (tracked.size > 0 || !sweepTimer) return;
  clearInterval(sweepTimer);
  sweepTimer = null;
}

/**
 * Re-evaluate every open connection and close the ones that no longer qualify.
 *
 * A handshake check alone is not enough: it only proves the principal qualified
 * at connect time. This is what makes an expiry that happens DURING a session
 * take effect, rather than at the end of the access token's life.
 */
export async function sweepRealtimeConnections(): Promise<number> {
  let closed = 0;
  for (const [key, connection] of [...tracked.entries()]) {
    let decision: RealtimeAccessDecision;
    try {
      decision = await evaluateRealtimeAccess(connection.userId);
    } catch {
      decision = { allowed: false, reason: 'evaluation_failed' };
    }
    if (!decision.allowed) {
      tracked.delete(key);
      closed += 1;
      try {
        connection.close();
      } catch {
        /* the transport is already gone; nothing to do */
      }
    }
  }
  stopSweepIfIdle();
  return closed;
}

/**
 * Register an open connection for continuous re-evaluation.
 *
 * Returns the cleanup function the caller must invoke on disconnect.
 */
export function trackRealtimeConnection(userId: string, close: () => void): () => void {
  const key = Symbol('realtime-connection');
  tracked.set(key, { userId: String(userId || '').trim(), close });
  ensureSweepRunning();
  return () => {
    tracked.delete(key);
    stopSweepIfIdle();
  };
}

/**
 * Per-event gate, for gateways that want to refuse a mutating event without
 * waiting for the next sweep. Cheap: the marker behind it is cached.
 */
export async function assertRealtimeEventAllowed(userId: string): Promise<boolean> {
  const decision = await evaluateRealtimeAccess(userId);
  return decision.allowed;
}

/** Test seam. */
export function __resetRealtimeTracking(): void {
  tracked.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/** Test seam — how many connections are currently tracked. */
export function __trackedRealtimeConnections(): number {
  return tracked.size;
}
