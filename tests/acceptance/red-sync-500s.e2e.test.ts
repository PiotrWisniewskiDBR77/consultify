/**
 * RED-SYNC — regression guard for schema-500s in the sync / integrations /
 * connectors / webhooks / knowledge-base / retrieval rewir.
 *
 * ŁOWCA RED (2026-07-19). Discovery probe over every GET (+ representative
 * write) endpoint in:
 *   routes/syncHub.routes.ts · routes/integrations/* · routes/connectors.routes.ts
 *   (dead/orphan, see below) · routes/webhooks/* · routes/knowledgeBase.routes.ts ·
 *   routes/v8/knowledge-base.routes.ts · routes/v8/retrieval.routes.ts
 * (real routers + real verifyToken + real Postgres PARITY :5443, zero mocks)
 * found two reachable schema-500s and one masked uncaught-500:
 *
 *   endpoint                                        code   root cause
 *   GET/POST /api/integrations/automation/keys       503    integration_api_keys
 *                                                            table missing (legacy
 *                                                            256_integrations_system.sql
 *                                                            never auto-runs — its
 *                                                            filename doesn't match
 *                                                            the live migration
 *                                                            runner pattern
 *                                                            /^(7\d{2}|\d{8})_.*\.sql$/)
 *   GET /api/integrations/available                  42703  integration_providers.sort_order
 *                                                            missing; masked to a
 *                                                            silent `[]` 200 by
 *                                                            DbPromise.all()'s
 *                                                            fallback=true default —
 *                                                            catalog was also 0 rows
 *                                                            (canonical seed never ran)
 *   POST /api/sync-hub/connect (missing connector    500    integrationHubService
 *   required config field, e.g. gmail without               .connectIntegration()
 *   `config.domain`)                                         throws a plain Error for
 *                                                            a validation failure;
 *                                                            the route didn't catch it,
 *                                                            so it fell through to the
 *                                                            generic Express error
 *                                                            handler as an uncaught 500
 *                                                            instead of a 400.
 *
 * Fixes:
 *  - Additive, idempotent migration
 *    server/migrations/20260719_red_sync_integration_api_keys_and_providers.sql
 *    (CREATE TABLE IF NOT EXISTS integration_api_keys incl. the `updated_at`
 *    column the live INSERT writes but the legacy migration never defined;
 *    ALTER TABLE integration_providers ADD COLUMN IF NOT EXISTS for the 4
 *    columns from the canonical 256_ definition; re-seed the seventeen
 *    canonical providers via INSERT ... ON CONFLICT (id) DO NOTHING).
 *  - Code fix in syncHub.routes.ts POST /connect: catch the
 *    "Missing required field:" / "Unknown connector:" validation Errors from
 *    connectIntegration() and return 400 instead of letting them fall
 *    through as an uncaught 500.
 *
 * Also inventoried (not RED, noted for completeness):
 *  - routes/connectors.routes.ts, routes/webhooks.routes.ts,
 *    routes/webhookSubscriptions.routes.ts, routes/calendarIntegrations.routes.ts,
 *    routes/userIntegrations.routes.ts (top-level, distinct from routes/integrations/*
 *    of the same basename) are never imported by Gateway.ts — orphaned/dead code,
 *    unreachable, not RED.
 *  - routes/integrations/index.ts (integrationsDomainRoutes, mounting scim+sso
 *    under /integrations/scim and /integrations/sso) is exported from
 *    routes/index.ts but never mounted by Gateway.ts either — the individual
 *    scimRoutes/ssoRoutes ARE mounted directly at /api/scim/* and /api/sso.
 *  - KnowledgeBaseService's full-text search availability probe
 *    (`SELECT name FROM sqlite_master WHERE type='table' AND
 *    name='kb_articles_fts'`, shared by knowledgeBase.routes.ts and
 *    v8/knowledge-base.routes.ts) is SQLite-only syntax with no Postgres
 *    equivalent; it 42703s on every request and is silently swallowed by the
 *    same fallback=true default, degrading FTS search to a non-FTS fallback.
 *    Non-fatal (always 200) — reported as a masked-degradation finding, not
 *    fixed here: building a real Postgres tsvector/GIN equivalent is out of
 *    scope for an additive schema-500 patch.
 *  - GET /api/v8/retrieval/memory/entries returns a genuine 400 (Zod
 *    validation, not a schema-500) without required query params — expected,
 *    not RED.
 *
 * Assertions below prove the FIXED contract. Reverting either the migration
 * or the code fix turns the first two rows back to 5xx (or the third back to
 * the old uncaught 500 for the same input).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { seed } from './seed.mjs';

const PREFIX = 'odbior--redsync--';

let token: string;
let app: Express;

const MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../server/migrations/20260719_red_sync_integration_api_keys_and_providers.sql'
);

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM integration_api_keys WHERE name LIKE $1`, [`${PREFIX}%`]).catch(() => {});
    await c.query(`DELETE FROM integrations WHERE display_name LIKE $1`, [`${PREFIX}%`]).catch(() => {});
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();

  // Apply the RED-SYNC migration idempotently (mirrors the autorun on demo boot).
  const c = pgClient();
  await c.connect();
  try {
    await c.query(readFileSync(MIGRATION, 'utf8'));
  } finally {
    await c.end();
  }

  token = mintToken();

  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const syncHub = (await import('../../server/src/routes/syncHub.routes.js')).default;
  const automation = (await import('../../server/src/routes/integrations/automation.routes.js')).default;
  const integrations = (await import('../../server/src/routes/integrations/integrations.routes.js')).default;

  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/sync-hub', syncHub);
  app.use('/api/integrations/automation', automation);
  app.use('/api/integrations', verifyToken as any, integrations);
}, 60_000);

afterAll(cleanup);

const authGet = (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`);
const authPost = (p: string, body: any) =>
  request(app).post(p).set('Authorization', `Bearer ${token}`).send(body);

describe('RED-SYNC schema-500 regressions (fixed)', () => {
  it('GET /api/integrations/automation/keys is not 5xx (was 503: integration_api_keys table missing)', async () => {
    const res = await authGet('/api/integrations/automation/keys');
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('keys');
  });

  it('GET /api/integrations/available is not 5xx and returns the real catalog (was masked 42703: sort_order missing → silent [])', async () => {
    const res = await authGet('/api/integrations/available');
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Pre-fix this was always `[]` (swallowed 42703). Post-fix + re-seed it
    // must contain the canonical catalog.
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.some((p: any) => p.id === 'slack')).toBe(true);
  });

  it('POST /api/sync-hub/connect with a missing required connector config field is 400, not 500 (was uncaught Error → 500)', async () => {
    const res = await authPost('/api/sync-hub/connect', {
      connectorId: 'gmail', // requires config.domain
      displayName: `${PREFIX}gmail-missing-domain`,
    });
    expect(res.status).toBe(400);
    expect(res.body?.error).toMatch(/Missing required field/i);
  });

  it('write paths that depend on the new table/columns succeed', async () => {
    // Exercises integration_api_keys INSERT incl. the added `updated_at` column.
    const keyRes = await authPost('/api/integrations/automation/keys', {
      name: `${PREFIX}key-0001`,
    });
    expect(keyRes.status).toBe(201);
    expect(keyRes.body?.plainTextKey).toMatch(/^ik_/);

    // Exercises the connectIntegration() happy path with a valid required
    // config field, proving the 400 above is validation-specific, not a
    // regression that broke the whole connect flow.
    const connectRes = await authPost('/api/sync-hub/connect', {
      connectorId: 'gmail',
      config: { domain: 'redsync.example.com' },
      displayName: `${PREFIX}gmail-ok`,
    });
    expect(connectRes.status).toBe(200);
    expect(connectRes.body?.success).toBe(true);
  });
});
