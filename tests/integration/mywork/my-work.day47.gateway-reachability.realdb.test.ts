import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.endsWith('/cx_day47');
const describeReal = enabled ? describe : describe.skip;
const NO_RETRY = { retry: 0 } as const;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

describeReal('Day 47 My Work live-tab reachability through the real ApiGateway', NO_RETRY, () => {
  const prefix = `day47gate_${randomUUID().replaceAll('-', '')}`;
  const organizationId = randomUUID();
  const userId = randomUUID();
  let sql: Client;
  let app: Express;
  let authorization: string;

  beforeAll(async () => {
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    const target = await sql.query<{ database: string; port: number | null }>(
      'SELECT current_database() AS database, inet_server_port() AS port'
    );
    if (target.rows[0]?.database !== 'cx_day47') {
      throw new Error(`DAY47_REFUSING_DATABASE:${target.rows[0]?.database || 'unknown'}`);
    }

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `${prefix}_organization`]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Day', 'Forty Seven', 'ADMIN', 'active', now())`,
      [userId, organizationId, `${prefix}@day47.local`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [`${prefix}_membership`, organizationId, userId]
    );
    await sql.query(
      `INSERT INTO v8.v8_feature_flags
         (flag_id, organization_id, module, enabled, updated_at)
       VALUES ($1, $2, 'my-work', 1, now())
       ON CONFLICT (organization_id, module) DO UPDATE SET enabled = excluded.enabled`,
      [`${prefix}_my_work`, organizationId]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        email: `${prefix}@day47.local`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    )}`;

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM v8.v8_feature_flags WHERE flag_id = $1', [`${prefix}_my_work`]);
    await sql.query('DELETE FROM organization_members WHERE id = $1', [`${prefix}_membership`]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await sql.end();
  });

  const authenticatedGet = (path: string) =>
    request(app).get(path).set('Authorization', authorization).set('x-org-context', organizationId);

  const liveTabs = [
    ['ideas', '/api/my-work/my-ideas'],
    ['notebook', '/api/my-work/notebooks'],
    [
      'calendar',
      '/api/my-work/calendar/unified?start=2026-08-24T00:00:00.000Z&end=2026-08-31T00:00:00.000Z',
    ],
    ['tasks', '/api/my-work/personal-tasks'],
    ['decisions', '/api/my-work/decisions'],
    ['vault', '/api/knowledge/vault-folders?scope=personal'],
    ['agent', '/api/my-work/agent-materialization/proposals'],
    ['manager', '/api/my-work/manager/snapshot?period=week'],
  ] as const;

  for (const [tab, path] of liveTabs) {
    it(`${tab}: returns an honest empty response for a fresh organization`, async () => {
      const response = await authenticatedGet(path);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body).toBeDefined();
    });
  }

  it('inbox: the V8 canonical read follows the global gate', async () => {
    const response = await authenticatedGet('/api/v8/my-work/inbox/canonical');
    if (process.env.ENABLE_V8_GLOBAL === 'true') {
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body?.data?.items).toEqual([]);
    } else {
      expect(response.status).toBe(404);
      expect(response.body?.code).toBe('V8_DISABLED');
    }
  });

  it('calendar: the real router refuses a request without a token', async () => {
    const response = await request(app).get(
      '/api/my-work/calendar/unified?start=2026-08-24T00:00:00.000Z&end=2026-08-31T00:00:00.000Z'
    );
    expect(response.status).toBe(401);
  });
});
