/**
 * Acceptance E2E — RED-MISC schema-500 fixes (Odbiór 2026-07-19).
 *
 * Rewir: calendar / audit / feature-flags / health / capability / execution-
 * control / notifications. A real-runtime probe (parity pg18 :5443, real
 * routers + real verifyToken/superadmin auth, no mocks) swept every endpoint
 * mounted in Gateway.ts from this rewir. GETs were clean; two write paths threw
 * genuine schema-500s:
 *
 *  RED-1 · POST/PUT /api/system-health/alerts  ->  42703
 *    `system_health_alerts` exists on the live DB with a LEGACY schema
 *    (condition/severity/is_enabled) while systemHealth.routes.ts's
 *    ensureAlertsTable() + write handlers expect `operator` and `enabled`.
 *    CREATE TABLE IF NOT EXISTS never reconciled the drift.
 *    FIX: additive migration 20260719_red_misc_system_health_alerts_operator_enabled.sql
 *    (ADD operator/enabled + relax legacy `condition` NOT NULL).
 *
 *  RED-2 · POST /api/user/notification-rules   ->  42804
 *    `notification_rules.is_active` is boolean, but the INSERT bound the
 *    integer LITERAL `1` in the VALUES list (a literal is typed integer;
 *    the PG adapter only rewrites the assignment form `is_active = 1`).
 *    FIX (code): literal `1` -> `TRUE` in the INSERT.
 *
 * Both fixes are asserted here end-to-end. Every row created carries the
 * reversible `odbior--redmisc--` marker and is removed in afterAll; nothing is
 * written to demo/prod (DATABASE_URL asserted local).
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, mintToken, pgClient, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

requireLocalDbUrl();

const SA_ID = 'odbior--redmisc--sa-0001';

function saToken() {
  return jwt.sign(
    {
      id: SA_ID,
      sub: SA_ID,
      email: 'odbior--redmisc--sa@acceptance.local',
      role: 'superadmin',
      organizationId: SEED.ORG_ID,
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function buildApp(): Promise<Express> {
  const systemHealth = (await import('../../server/src/routes/systemHealth.routes.js')).default;
  const notificationRules = (
    await import('../../server/src/routes/notifications/notification-rules.routes.js')
  ).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/system-health', systemHealth);
  app.use('/api/user/notification-rules', notificationRules);
  return app;
}

async function cleanup() {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM system_health_alerts WHERE name LIKE 'odbior--redmisc--%'`).catch(() => {});
    await c.query(`DELETE FROM notification_rules WHERE name LIKE 'odbior--redmisc--%'`).catch(() => {});
    await c.query(`DELETE FROM users WHERE id = $1`, [SA_ID]).catch(() => {});
  } finally {
    await c.end();
  }
}

describe('RED-MISC · schema-500 write-path fixes', () => {
  let app: Express;

  beforeAll(async () => {
    await seed();
    // Seed a platform superadmin (DB role is the source of truth for verifySuperAdmin).
    const c = pgClient();
    await c.connect();
    try {
      const now = new Date().toISOString();
      await c.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'superadmin', 'active', 'Red', 'SA', $4)
         ON CONFLICT (id) DO UPDATE SET role = 'superadmin'`,
        [SA_ID, SEED.ORG_ID, 'odbior--redmisc--sa@acceptance.local', now]
      );
    } finally {
      await c.end();
    }
    app = await buildApp();
  });

  afterAll(cleanup);

  it('RED-1 · POST /api/system-health/alerts inserts (operator/enabled columns present) → 201', async () => {
    const res = await request(app)
      .post('/api/system-health/alerts')
      .set('Authorization', `Bearer ${saToken()}`)
      .send({ name: 'odbior--redmisc--alert', metric: 'cpu', threshold: 90, operator: 'gt', channels: [] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'odbior--redmisc--alert', operator: 'gt', enabled: true });
  });

  it('RED-2 · POST /api/user/notification-rules inserts (is_active TRUE not int 1) → 201', async () => {
    const res = await request(app)
      .post('/api/user/notification-rules')
      .set('Authorization', `Bearer ${mintToken()}`)
      .send({
        name: 'odbior--redmisc--rule',
        eventType: 'task.assigned',
        conditions: {},
        actions: [],
        priority: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, name: 'odbior--redmisc--rule' });
  });
});
