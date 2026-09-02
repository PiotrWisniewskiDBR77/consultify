/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day 219 Admin schema through real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const invoiceId = randomUUID();
  const ownMappingId = randomUUID();
  const foreignMappingId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Day 219', 'enterprise', 'active', 1, now()),
              ($2, 'Day 219 foreign', 'enterprise', 'active', 1, now())`,
      [organizationId, foreignOrganizationId]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Day', '219', 'ADMIN', 'active', now())`,
      [userId, organizationId, `day219-${userId}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(
      `INSERT INTO invoices
         (id, organization_id, invoice_number, status, amount_due, amount_paid, currency, issue_date, due_date)
       VALUES ($1, $2, 'DAY219-1', 'open', 1200, 0, 'PLN', now(), now() + interval '14 days')`,
      [invoiceId, organizationId]
    );
    await sql.query(
      `INSERT INTO scim_group_mappings
         (id, organization_id, external_group_id, external_group_name, internal_role)
       VALUES ($1, $2, 'own-group', 'Own group', 'member'),
              ($3, $4, 'foreign-group', 'Foreign group', 'member')`,
      [ownMappingId, organizationId, foreignMappingId, foreignOrganizationId]
    );

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'ADMIN' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM scim_group_mappings WHERE id = ANY($1::text[])', [
      [ownMappingId, foreignMappingId],
    ]);
    await sql.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [
      organizationId,
    ]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  it('R1 returns status ok and the persisted invoice when issue_date exists', async () => {
    const response = await request(app)
      .get('/api/admin/billing/invoices')
      .set('Authorization', authorization);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.invoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: invoiceId, invoice_number: 'DAY219-1' }),
      ])
    );
  });

  it('R2 keeps the foreign SCIM mapping invisible while the owner mapping remains visible', async () => {
    const response = await request(app)
      .get('/api/admin/identity/scim')
      .set('Authorization', authorization);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const ids = response.body.summary.groupMappings.map((row: { id: string }) => row.id);
    expect(ids).toContain(ownMappingId);
    expect(ids).not.toContain(foreignMappingId);
  });

  it('R1 distinguishes a missing issue_date column from an honest empty invoice list', async () => {
    await sql.query('ALTER TABLE invoices DROP COLUMN issue_date');
    try {
      const response = await request(app)
        .get('/api/admin/billing/invoices')
        .set('Authorization', authorization);

      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body).toMatchObject({ status: 'unavailable', invoices: [] });
    } finally {
      await sql.query(
        'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      );
      await sql.query('UPDATE invoices SET issue_date = created_at WHERE issue_date IS NULL');
    }
  });
});
