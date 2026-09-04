/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

describe('Day 321 service accounts identifiers through ApiGateway', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const uuidOrg = randomUUID();
  const textOrg = `day321-org-${randomUUID()}`;
  const foreignOrg = randomUUID();
  const uuidUser = randomUUID();
  const textUser = `day321-user-${randomUUID()}`;
  const foreignUser = randomUUID();

  const token = (id: string, organizationId: string) =>
    jwt.sign(
      { id, email: `${id}@test.invalid`, name: 'Day321', role: 'ADMIN', userRole: 'ADMIN', organizationId },
      jwtSecret,
      { expiresIn: '10m' }
    );

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    for (const [orgId, userId] of [
      [uuidOrg, uuidUser],
      [textOrg, textUser],
      [foreignOrg, foreignUser],
    ]) {
      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [orgId, `Day321 ${orgId}`]);
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role, status)
         VALUES ($1, $2, $3, 'ADMIN', 'active')`,
        [userId, orgId, `${userId}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`,
        [randomUUID(), orgId, userId]
      );
    }
  }, 120_000);

  afterAll(async () => {
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  it.each([
    ['UUID', uuidOrg, uuidUser],
    ['text', textOrg, textUser],
  ])('lets the owner list service accounts for a %s organization id', async (_kind, orgId, userId) => {
    const response = await request(app)
      .get('/api/admin/service-accounts')
      .set('Authorization', `Bearer ${token(userId, orgId)}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: [] });
  });

  it.each([
    ['UUID', uuidOrg],
    ['text', textOrg],
  ])('blocks a foreign admin from a %s organization id', async (_kind, targetOrg) => {
    const response = await request(app)
      .get(`/api/admin/service-accounts?orgId=${encodeURIComponent(targetOrg)}`)
      .set('Authorization', `Bearer ${token(foreignUser, foreignOrg)}`);
    expect(response.status, JSON.stringify(response.body)).toBe(403);
    expect(response.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
  });
});
