/**
 * Consultify Acceptance Harness — REAL-runtime E2E core.
 *
 * - Connects to the LOCAL Postgres (DATABASE_URL) — the same engine the app uses.
 * - Mints a LOCAL JWT for the seeded user with the exact claims the real
 *   auth.middleware reads (id / email / organizationId / role), signed HS256
 *   with the app's JWT_SECRET.
 * - Builds an Express app that mounts the REAL notebook router behind the REAL
 *   verifyToken middleware, so requests exercise genuine auth + genuine SQL.
 *   No business-logic mocks.
 *
 * Path choice: in-process API-through-server. We mount the actual production
 * router + real auth instead of booting the whole server (server/src/index.ts),
 * because the full boot pulls ~46 self-resolving lazy-service wrappers that can
 * hang (see MEMORY finding lazyloader_46_self_resolving_hang). This keeps the
 * test on the real HTTP + auth + DB path while staying deterministic.
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';

import { SEED } from './seed.mjs';

/**
 * ASM-001A hermeticity fix (2026-08-01): this harness used to GUESS a
 * mirrored default ('development_secret_key_change_in_production_abc123xyz')
 * for when JWT_SECRET is unset — but server/src/config/Config.ts computes
 * its OWN, DIFFERENT deterministic default in that case
 * ('test-secret-key-for-testing-only-min-32-chars' when NODE_ENV=test).
 * Two independent guesses that happen to differ = every acceptance test that
 * doesn't explicitly export JWT_SECRET in its shell gets tokens signed with
 * one secret and verified against another -> 100% silent 401s, no matter how
 * correct the business logic under test is.
 *
 * Fix: pin ONE explicit test secret, in-process, at import time — before any
 * server module (which pulls in Config.ts) has a chance to compute anything.
 * `mintToken()` below and the real `verifyToken` middleware both end up
 * reading the SAME `process.env.JWT_SECRET`, by construction, not by
 * coincidence. This does NOT touch process.env.JWT_SECRET if a caller (CI,
 * shell, another harness consumer) already set it — additive only, so this
 * cannot change behavior for any of the ~90 other acceptance tests that
 * import this same file and already export their own JWT_SECRET.
 *
 * Import-order requirement for anyone using this harness: `import ... from
 * './harness.js'` (or '.ts') must be the FIRST import in the test file, so
 * this pin runs before any `await import('.../server/src/...')` call later
 * in that file has a chance to load Config.ts with an empty JWT_SECRET.
 */
const PINNED_ACCEPTANCE_JWT_SECRET =
  'consultify-acceptance-harness-pinned-test-secret-fixed-32chars-min';

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = PINNED_ACCEPTANCE_JWT_SECRET;
}

export function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Acceptance harness requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  // Fail-fast: this must be unreachable given the pin above runs at import
  // time. If it throws, something *later* stomped process.env.JWT_SECRET
  // with an invalid value after harness.ts loaded — surface that loudly
  // instead of letting jwt.sign() silently produce a token nothing accepts.
  if (!secret || secret.length < 32) {
    throw new Error(
      `Acceptance harness: JWT_SECRET is missing or too short (${secret?.length ?? 0} chars, ` +
        'need >=32) at the point mintToken() was called. harness.ts pins a default at import ' +
        "time, so this means something set process.env.JWT_SECRET to an invalid value AFTER " +
        "this file loaded, or JWT_SECRET was cleared by another module. Fix the import order " +
        "('./harness.js' must be imported before any server/src/* module) or the offending " +
        'env mutation.'
    );
  }
  return secret;
}

/**
 * Fail-fast auth-hermeticity guard: mints a token with THIS harness's
 * JWT_SECRET, fires one authenticated GET at `probePath` on the given app,
 * and throws immediately with a diagnostic message if it comes back 401.
 * Turns "0/N passed, a wall of cryptic per-assertion 401s" into one clear,
 * actionable failure at the very start of a run. Call this right after
 * mounting `verifyToken` + the router under test, before any real test
 * assertions.
 */
export async function assertAuthHermetic(app: Express, probePath: string): Promise<void> {
  const { default: request } = await import('supertest');
  const token = mintToken();
  const res = await request(app).get(probePath).set('Authorization', `Bearer ${token}`);
  if (res.status === 401) {
    const secret = getJwtSecret();
    throw new Error(
      `Auth hermeticity check FAILED: GET ${probePath} with a freshly minted harness token ` +
        `returned 401. The harness's JWT_SECRET (${secret.length} chars, starts ` +
        `"${secret.slice(0, 8)}...") does not match what the mounted verifyToken middleware ` +
        'is validating against. Likely causes: (1) a server/src/* module was imported/loaded ' +
        "before this harness's './harness.js' import, computing its own Config.ts JWT_SECRET " +
        'default first; (2) something explicitly overrode process.env.JWT_SECRET between ' +
        'harness import and app mount. This is a test-infrastructure bug, not a product bug — ' +
        'fix the import order before trusting any other assertion in this run.'
    );
  }
}

/** Mint a token with the exact claims auth.middleware.attachUser() reads. */
export function mintToken(overrides: Record<string, unknown> = {}): string {
  const payload = {
    id: SEED.USER_ID,
    email: SEED.EMAIL,
    organizationId: SEED.ORG_ID,
    organization_id: SEED.ORG_ID,
    role: SEED.ROLE,
    ...overrides,
  };
  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256', expiresIn: '1h' });
}

export function pgClient(): pg.Client {
  return new pg.Client({ connectionString: requireLocalDbUrl() });
}

/**
 * Build an Express app mounting the REAL notebook router behind REAL auth.
 * Mirrors the Gateway mount prefix (/api/my-work).
 */
export async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const notebookRouter = (await import('../../server/src/routes/my-work/notebook.routes.js'))
    .default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/my-work', verifyToken as any, notebookRouter);
  return app;
}
