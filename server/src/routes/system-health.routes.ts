/**
 * Public readiness probe — `/api/system` (mounted in `server/src/index.ts`).
 *
 * WHAT THIS FILE USED TO BE, and why it is now four lines of logic.
 *
 * `GET /api/system/health` was an anonymous, unrate-limited "comprehensive system
 * health check". It ran twelve sequential SQL queries plus a `bcrypt.compare` on
 * every request, and its response body disclosed:
 *
 *   - a hardcoded administrator address and its password, verbatim, in ALL THREE
 *     branches of a "default login" check — including a success branch that
 *     answered `Default credentials working` together with that account's role.
 *     That is a live credential oracle: anyone on the internet could ask the server
 *     whether a known administrator password still worked and get a straight
 *     answer. The pair is deliberately not repeated here — it is recorded in
 *     SEC-PUB-002, and it should be treated as compromised and rotated;
 *   - the email address and role of EVERY `ADMIN`/`SUPERADMIN` account;
 *   - the total user count, table names, environment configuration and connection
 *     pool internals.
 *
 * The bcrypt call also made it a cheap asymmetric CPU attack, and the twelve
 * queries a database one, from an unauthenticated endpoint with no limiter.
 *
 * Detailed diagnostics were NOT reimplemented here. They already exist, correctly
 * guarded, in `server/src/routes/systemHealth.routes.ts` — mounted at
 * `/api/system-health` from the Gateway behind `defaultRateLimiter` +
 * `verifySuperAdmin`. Duplicating them behind a second guard would just be a
 * second thing to get wrong. (Those two modules have near-identical names; that
 * confusion has already cost this programme a review round, hence this note.)
 *
 * What remains public is a readiness probe and nothing else: a fixed, small cost
 * and a body that carries no users, no addresses, no credentials, no table names,
 * no configuration, no filesystem paths and no error text.
 */
import { Request, Response, Router } from 'express';

import { getDatabaseAsync } from '../database/index.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * How long the probe waits for the database before calling itself not-ready.
 * Bounded so the endpoint cannot be used to pin request handlers open.
 */
const READINESS_TIMEOUT_MS = 2000;

async function isDatabaseReady(): Promise<boolean> {
  try {
    const db = await getDatabaseAsync();
    // One trivial round trip. Deliberately not a table audit: readiness answers
    // "can this process serve traffic", not "is the schema what I expect".
    const probe = db.query<unknown>('SELECT 1', []);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('readiness timeout')), READINESS_TIMEOUT_MS)
    );
    await Promise.race([probe, timeout]);
    return true;
  } catch (error) {
    // Logged server-side only. The response body never carries error text: a
    // driver message names hosts, databases and sometimes credentials.
    logger.warn('[SystemReadiness] not ready', {
      error: (error as Error)?.message || String(error),
    });
    return false;
  }
}

/**
 * GET /api/system/health — public readiness.
 *
 * Answers `ready` or `not-ready` and nothing else. Rate limited despite the small
 * cost, because it is anonymous and mounted before the global limiter.
 */
router.get('/health', defaultRateLimiter, async (_req: Request, res: Response) => {
  const ready = await isDatabaseReady();
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    timestamp: new Date().toISOString(),
  });
});

/**
 * REMOVED (SEC-PUB-001): `POST /repair` — served here as `POST /api/system/repair`
 * via the unguarded `app.use('/api/system', ...)` mount in `index.ts`.
 *
 * It ran `child_process.exec('npm run db:test')` with no `verifyToken` and no
 * `requireSuperAdmin`, so any anonymous request spawned a shell that mutated the
 * database, and repeating it was a trivial process-exhaustion DoS. It had no
 * caller: the only frontend reference, `src/views/SystemHealthDashboard.tsx`, is
 * never imported and fetched a path (`/api/system/health/repair`) that never
 * routed here anyway.
 *
 * Do not reinstate it on this router. Any future version must be a separate
 * superadmin-only router behind `requireSuperAdmin`, gated by an explicit env
 * flag defaulting to false, with no `child_process` in the web process (dispatch
 * to a dedicated job/worker instead), a distributed lock, rate limiting, an audit
 * log entry per invocation, and an execution timeout with concurrency control.
 *
 * Coverage: tests/integration/systemHealthRepairRemoved.contract.test.ts
 *
 * REMOVED (SEC-PUB-002): the detailed health checks and the default-login probe —
 * see the file header. Coverage:
 * tests/integration/publicSystemSurface.contract.test.ts
 */

export default router;
