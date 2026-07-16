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

export function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Acceptance harness requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

export function getJwtSecret(): string {
  // Mirror server/src/config/Config.ts dev default.
  return (
    process.env.JWT_SECRET || 'development_secret_key_change_in_production_abc123xyz'
  );
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
