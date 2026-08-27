import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.includes('/cx_day42');
const describeReal = RUN ? describe : describe.skip;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

describeReal('Day 42 Partner portal global-gate diagnosis through the real ApiGateway', () => {
  let sql: Client;
  let app: Express;
  const prefix = `day42_${randomUUID().replaceAll('-', '')}`;
  const orgA = `${prefix}_org_a`;
  const orgB = `${prefix}_org_b`;
  const unboundUser = randomUUID();
  const boundUser = randomUUID();
  const partnerA = randomUUID();
  const partnerB = randomUUID();

  const token = (userId: string, organizationId: string) =>
    jwt.sign(
      { id: userId, email: `${userId}@day42.local`, organizationId, role: 'OWNER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

  const auth = (userId: string, organizationId: string) => ({
    Authorization: `Bearer ${token(userId, organizationId)}`,
    'x-org-context': organizationId,
  });

  beforeAll(async () => {
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    const target = await sql.query<{ name: string }>('SELECT current_database() AS name');
    if (target.rows[0]?.name !== 'cx_day42') {
      throw new Error(`DAY42_REFUSING_DATABASE:${target.rows[0]?.name || 'unknown'}`);
    }

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, 'Day42 A', 'enterprise', 'active'), ($2, 'Day42 B', 'enterprise', 'active')`,
      [orgA, orgB]
    );
    for (const [userId, organizationId] of [
      [unboundUser, orgA],
      [boundUser, orgA],
    ]) {
      await sql.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'x', 'OWNER', 'active')`,
        [userId, organizationId, `${userId}@day42.local`]
      );
      await sql.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
        [`${prefix}_${userId}`, organizationId, userId]
      );
    }
    await sql.query(
      `INSERT INTO partner_organizations
         (id, name, contact_email, status, owner_organization_id)
       VALUES ($1, 'Partner A', 'a@day42.local', 'active', $2),
              ($3, 'Partner B', 'b@day42.local', 'active', $4)`,
      [partnerA, orgA, partnerB, orgB]
    );
    await sql.query(
      `INSERT INTO partner_users (partner_org_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [partnerA, boundUser]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    if (!sql) return;
    await sql.query('DELETE FROM partner_users WHERE user_id = ANY($1::uuid[])', [
      [unboundUser, boundUser],
    ]);
    await sql.query('DELETE FROM partner_organizations WHERE id = ANY($1::uuid[])', [
      [partnerA, partnerB],
    ]);
    await sql.query('DELETE FROM organization_members WHERE id LIKE $1', [`${prefix}%`]);
    await sql.query('DELETE FROM users WHERE id = ANY($1::text[])', [[unboundUser, boundUser]]);
    await sql.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [[orgA, orgB]]);
    await sql.end();
  });

  it('returns the pre-authentication 404 V8_DISABLED on representative partner routes when the env flag is absent', async () => {
    delete process.env.ENABLE_V8_GLOBAL;
    const probes: Array<{ method: 'get' | 'post' | 'put'; path: string }> = [
      { method: 'get', path: '/api/v8/partner/connection' },
      { method: 'get', path: '/api/v8/partner/clients' },
      { method: 'get', path: '/api/v8/partner/earnings-summary' },
      { method: 'post', path: '/api/v8/partner/campaign-links' },
      { method: 'put', path: '/api/v8/partner/organization' },
    ];
    for (const probe of probes) {
      const response = await request(app)[probe.method](probe.path).send({});
      expect(response.status, `${probe.method.toUpperCase()} ${probe.path}`).toBe(404);
      expect(response.body.code).toBe('V8_DISABLED');
    }
  });

  it('opens the global gate but preserves connection=false and PARTNER_ORG_REQUIRED for an unbound member', async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    const connection = await request(app)
      .get('/api/v8/partner/connection')
      .set(auth(unboundUser, orgA));
    expect(connection.status).toBe(200);
    expect(connection.body.data.connected).toBe(false);

    const clients = await request(app).get('/api/v8/partner/clients').set(auth(unboundUser, orgA));
    expect(clients.status).toBe(403);
    expect(clients.body.code).toBe('PARTNER_ORG_REQUIRED');
  });

  it('reaches the real clients handler for an exactly bound tenant and user', async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    const clients = await request(app).get('/api/v8/partner/clients').set(auth(boundUser, orgA));
    expect(clients.status).toBe(200);
    expect(clients.body.meta.partnerOrgId).toBe(partnerA);
  });

  it('rejects a foreign tenant header and leaves both partner organizations unchanged', async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    const before = await sql.query(
      'SELECT id, name, updated_at FROM partner_organizations WHERE id = ANY($1::uuid[]) ORDER BY id',
      [[partnerA, partnerB]]
    );
    const response = await request(app)
      .put('/api/v8/partner/organization')
      .set('Authorization', `Bearer ${token(boundUser, orgA)}`)
      .set('x-org-context', orgB)
      .send({ organizationId: orgB, name: 'FOREIGN-MUTATION' });
    expect(response.status).not.toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('Partner B');
    const after = await sql.query(
      'SELECT id, name, updated_at FROM partner_organizations WHERE id = ANY($1::uuid[]) ORDER BY id',
      [[partnerA, partnerB]]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('proves the partner mount bypasses the org-level V8 flag while remaining behind the global gate', async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    const response = await request(app)
      .get('/api/v8/partner/connection')
      .set(auth(unboundUser, orgA));
    expect(response.status).toBe(200);
    expect(response.body.code).not.toBe('V8_ORG_DISABLED');
  });

  it('statically proves autorun excludes the historical migrations that create the Partner binding schema', () => {
    const migrationIdentity = readFileSync(
      'server/src/services/tablePlatform/migrationIdentity.ts',
      'utf8'
    );
    const bindingMigration = readFileSync(
      'server/migrations/955_partner_connection_receipts.sql',
      'utf8'
    );
    expect(migrationIdentity).toContain('/^(7\\d{2}|\\d{8})_.*\\.sql$/');
    expect(bindingMigration).toContain('ADD COLUMN IF NOT EXISTS owner_organization_id');
    expect('955_partner_connection_receipts.sql').not.toMatch(/^(7\d{2}|\d{8})_.*\.sql$/);
  });
});
