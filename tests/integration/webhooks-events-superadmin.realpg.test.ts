/**
 * SECURITY FIX VERIFICATION — cross-tenant webhook metadata leak (2026-08-28).
 *
 * `GET /api/webhooks/events` (server/src/routes/integrations/webhooks.routes.ts)
 * used to be gated by `verifyToken + verifyAdmin` — an ORG-scoped admin check.
 * `webhook_events` has no tenant column (GitHub/generic senders arrive
 * unauthenticated, so nothing to stamp on insert), so ANY tenant admin could
 * see the metadata (id, provider, event_type, processed, created_at) of the
 * 100 most recent webhook events across the ENTIRE platform — every tenant's
 * integrations, not just their own.
 *
 * Fix: the route now uses `verifySuperAdmin` (server/src/middleware/superAdmin.middleware.ts)
 * — the same guard `feedback.routes.ts` and `superadmin.routes.ts` use — instead
 * of `verifyAdmin`. This file mounts the REAL router (no route interception, no
 * mocked persistence layer) behind its REAL production middleware, against a
 * REAL disposable PostgreSQL database, with REAL signed JWTs and REAL
 * `users.role` rows, and proves:
 *   (a) superadmin -> 200 with the event list
 *   (b) tenant admin ('admin' role)      -> 403
 *   (c) regular user ('member' role)     -> 403
 *   (d) anonymous (no Authorization)     -> 401
 *   (e) POST /github (unauthenticated webhook receiver) still works — zero
 *       regression on webhook ingestion, which MUST stay public.
 *
 * OPT-IN GATE. Skipped (never failed) unless RUN_DB_TESTS=1, MOCK_DB=false and
 * DATABASE_URL is set. `beforeAll` refuses (throws) to run against a database
 * whose name does not start with the disposable prefix below, so a
 * mislabelled DATABASE_URL cannot cause this file to DROP/CREATE tables
 * against a real, shared database.
 *
 * RUN COMMAND (disposable Postgres already started on host port 55941):
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgresql://webhooksfix:webhooksfix@127.0.0.1:55941/webhooksfix_disposable \
 *   npx vitest run tests/integration/webhooks-events-superadmin.realpg.test.ts --retry=0
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DISPOSABLE_PREFIX = 'webhooksfix_disposable';

const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL);

const describeReal = RUN ? describe : describe.skip;

const JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';
process.env.JWT_SECRET = JWT_SECRET;

function mintToken(userId: string, role: string): string {
  return jwt.sign({ id: userId, role, organizationId: 'org-fixture' }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

describeReal('GET /api/webhooks/events — superadmin-only fix (REAL router, REAL PG)', () => {
  let client: Client;
  let app: Express;
  const superadminId = `sa-${randomUUID()}`;
  const tenantAdminId = `admin-${randomUUID()}`;
  const memberId = `member-${randomUUID()}`;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const { rows } = await client.query('SELECT current_database() AS db');
    const currentDb = String(rows[0]?.db || '');
    if (!currentDb.startsWith(DISPOSABLE_PREFIX)) {
      throw new Error(
        `Refusing to run: current_database() = "${currentDb}" does not start with required disposable prefix "${DISPOSABLE_PREFIX}". This file DROPs/CREATEs tables and must only run against a throwaway database.`
      );
    }

    await client.query('DROP TABLE IF EXISTS webhook_events');
    await client.query('DROP TABLE IF EXISTS users');
    await client.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        email TEXT UNIQUE,
        role TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES
        ($1, 'org-platform', 'superadmin@fixture.test', 'superadmin'),
        ($2, 'org-tenant-a', 'admin@fixture.test', 'admin'),
        ($3, 'org-tenant-a', 'member@fixture.test', 'member')`,
      [superadminId, tenantAdminId, memberId]
    );

    // The route's own ensureWebhookEventsTable() will create webhook_events
    // lazily on first use — do NOT pre-create it, so the superadmin-200 and
    // POST /github assertions also prove that lazy path still works.

    const routerModule = await import(
      '../../server/src/routes/integrations/webhooks.routes.ts'
    );
    const webhookRoutes = routerModule.default;

    app = express();
    app.use(express.json());
    app.use('/api/webhooks', webhookRoutes);
  }, 60_000);

  afterAll(async () => {
    if (client) {
      await client.query('DROP TABLE IF EXISTS webhook_events');
      await client.query('DROP TABLE IF EXISTS users');
      await client.end();
    }
  });

  it('(a) superadmin -> 200 with the event list', async () => {
    const token = mintToken(superadminId, 'superadmin');
    const res = await request(app)
      .get('/api/webhooks/events')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('(b) tenant admin (org-scoped admin role) -> 403', async () => {
    const token = mintToken(tenantAdminId, 'admin');
    const res = await request(app)
      .get('/api/webhooks/events')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('(c) regular user -> 403', async () => {
    const token = mintToken(memberId, 'member');
    const res = await request(app)
      .get('/api/webhooks/events')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('(d) anonymous (no Authorization header) -> 401', async () => {
    const res = await request(app).get('/api/webhooks/events');
    expect(res.status).toBe(401);
  });

  it('(e) POST /api/webhooks/github (unauthenticated webhook receiver) still works — zero regression on ingestion', async () => {
    const res = await request(app)
      .post('/api/webhooks/github')
      .set('x-github-event', 'push')
      .set('x-github-delivery', `del-${randomUUID()}`)
      .send({ ref: 'refs/heads/main' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});
