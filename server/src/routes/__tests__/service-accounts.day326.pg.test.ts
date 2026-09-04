/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT =
  '/private/tmp/cx-day326-konta-serwisowe-artefakty/service-accounts-r1-matrix.json';
const UUID_ORG = '32600000-0000-4000-8000-000000000001';
const TEXT_ORG = 'system';
const FOREIGN_ORG = '32600000-0000-4000-8000-000000000002';
const UUID_OWNER = '32600000-0000-4000-8000-000000000011';
const TEXT_OWNER = '32600000-0000-4000-8000-000000000012';
const FOREIGN_OWNER = '32600000-0000-4000-8000-000000000013';

type Evidence = {
  cell: string;
  actor: 'foreign' | 'owner';
  status: number;
  body: unknown;
  text: string;
  contentType: string;
  databaseBefore: unknown;
  databaseAfter: unknown;
};

describe('Day 326 service-account matrix through real ApiGateway, JWT and PostgreSQL', NO_RETRY, () => {
  let app: Express;
  let sql: Client;
  const evidence: Evidence[] = [];

  const authorization = (id: string, organizationId: string) =>
    `Bearer ${jwt.sign(
      {
        id,
        userId: id,
        email: `${id}@day326.test`,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;

  const tokenFor = {
    uuid: authorization(UUID_OWNER, UUID_ORG),
    text: authorization(TEXT_OWNER, TEXT_ORG),
    foreign: authorization(FOREIGN_OWNER, FOREIGN_ORG),
  };

  const rowsFor = async (organizationId: string) =>
    (
      await sql.query(
        `SELECT id::text, organization_id::text, name
         FROM tp_service_accounts
         WHERE organization_id::text = $1
         ORDER BY name`,
        [organizationId]
      )
    ).rows;

  const call = async (
    cell: string,
    actor: 'foreign' | 'owner',
    method: 'get' | 'post' | 'delete',
    path: string,
    token: string,
    observedOrg: string,
    body?: Record<string, unknown>
  ) => {
    const databaseBefore = await rowsFor(observedOrg);
    const pending = request(app)
      [method](path)
      .set('Authorization', token)
      .set('X-Correlation-ID', `day326-${cell}-${actor}`);
    const response = body ? await pending.send(body) : await pending;
    const databaseAfter = await rowsFor(observedOrg);
    evidence.push({
      cell,
      actor,
      status: response.status,
      body: response.body,
      text: response.text,
      contentType: String(response.headers['content-type'] || ''),
      databaseBefore,
      databaseAfter,
    });
    return { response, databaseBefore, databaseAfter };
  };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations (id, name, status)
       VALUES ($1, 'Day 326 UUID', 'active'), ($2, 'Day 326 foreign', 'active')`,
      [UUID_ORG, FOREIGN_ORG]
    );
    for (const [id, organizationId] of [
      [UUID_OWNER, UUID_ORG],
      [TEXT_OWNER, TEXT_ORG],
      [FOREIGN_OWNER, FOREIGN_ORG],
    ]) {
      await sql.query(
        `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status)
         VALUES ($1, $2, $3, 'x', 'Day', '326', 'OWNER', 'active')`,
        [id, organizationId, `${id}@day326.test`]
      );
      await sql.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
        [randomUUID(), organizationId, id]
      );
    }

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (sql) await sql.end();
  });

  it('R1 GET UUID pairs foreign denial with owner seeing a real row', async () => {
    await sql.query(
      `INSERT INTO tp_service_accounts
         (organization_id, name, token_hash, token_prefix, scopes, created_by)
       VALUES ($1, 'day326-get-uuid', $2, 'day326_get', ARRAY['records:read'], $3)`,
      [UUID_ORG, 'a'.repeat(64), UUID_OWNER]
    );
    const foreign = await call(
      'get-uuid',
      'foreign',
      'get',
      `/api/admin/service-accounts?orgId=${UUID_ORG}`,
      tokenFor.foreign,
      UUID_ORG
    );
    expect(foreign.response.status).toBe(403);
    expect(foreign.response.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
    const owner = await call(
      'get-uuid',
      'owner',
      'get',
      '/api/admin/service-accounts',
      tokenFor.uuid,
      UUID_ORG
    );
    expect(owner.response.status).toBe(200);
    expect(owner.response.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'day326-get-uuid' })])
    );
  });

  it('R1 GET non-UUID pairs foreign denial with the measured owner empty response', async () => {
    expect((await sql.query("SELECT id FROM organizations WHERE id = 'system'")).rowCount).toBe(1);
    const foreign = await call(
      'get-text',
      'foreign',
      'get',
      `/api/admin/service-accounts?orgId=${TEXT_ORG}`,
      tokenFor.foreign,
      TEXT_ORG
    );
    expect(foreign.response.status).toBe(403);
    const owner = await call(
      'get-text',
      'owner',
      'get',
      '/api/admin/service-accounts',
      tokenFor.text,
      TEXT_ORG
    );
    expect(owner.response.status).toBe(200);
    expect(owner.response.body).toEqual({ success: true, data: [] });
  });

  it('R1 POST UUID pairs foreign denial with owner creating a real row', async () => {
    const foreign = await call(
      'post-uuid',
      'foreign',
      'post',
      `/api/admin/service-accounts?orgId=${UUID_ORG}`,
      tokenFor.foreign,
      UUID_ORG,
      { name: 'foreign-must-not-create', scopes: ['records:read'] }
    );
    expect(foreign.response.status).toBe(403);
    const owner = await call(
      'post-uuid',
      'owner',
      'post',
      '/api/admin/service-accounts',
      tokenFor.uuid,
      UUID_ORG,
      { name: 'day326-post-uuid', scopes: ['records:read'] }
    );
    expect(owner.response.status).toBe(201);
    expect(owner.databaseAfter).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'day326-post-uuid' })])
    );
  });

  it('R1 POST non-UUID pairs foreign denial with owner 500 and unchanged database', async () => {
    const foreign = await call(
      'post-text',
      'foreign',
      'post',
      `/api/admin/service-accounts?orgId=${TEXT_ORG}`,
      tokenFor.foreign,
      TEXT_ORG,
      { name: 'foreign-must-not-create', scopes: ['records:read'] }
    );
    expect(foreign.response.status).toBe(403);
    const owner = await call(
      'post-text',
      'owner',
      'post',
      '/api/admin/service-accounts',
      tokenFor.text,
      TEXT_ORG,
      { name: 'day326-post-text', scopes: ['records:read'] }
    );
    expect(owner.response.status).toBe(500);
    expect(owner.response.body).toEqual({});
    expect(owner.databaseAfter).toEqual(owner.databaseBefore);
  });

  it('R1 DELETE UUID pairs foreign denial with owner deleting a real row', async () => {
    const inserted = await sql.query<{ id: string }>(
      `INSERT INTO tp_service_accounts
         (organization_id, name, token_hash, token_prefix, scopes, created_by)
       VALUES ($1, 'day326-delete-uuid', $2, 'day326_del', ARRAY['records:read'], $3)
       RETURNING id::text`,
      [UUID_ORG, 'b'.repeat(64), UUID_OWNER]
    );
    const accountId = inserted.rows[0].id;
    const foreign = await call(
      'delete-uuid',
      'foreign',
      'delete',
      `/api/admin/service-accounts/${accountId}?orgId=${UUID_ORG}`,
      tokenFor.foreign,
      UUID_ORG
    );
    expect(foreign.response.status).toBe(403);
    const owner = await call(
      'delete-uuid',
      'owner',
      'delete',
      `/api/admin/service-accounts/${accountId}`,
      tokenFor.uuid,
      UUID_ORG
    );
    expect(owner.databaseBefore).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: accountId })])
    );
    expect(owner.response.status).toBe(204);
    expect(owner.databaseAfter).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: accountId })])
    );
  });

  it('R1 DELETE non-UUID pairs foreign denial with owner 500 and preserved UUID row', async () => {
    const protectedRow = await sql.query<{ id: string }>(
      `INSERT INTO tp_service_accounts
         (organization_id, name, token_hash, token_prefix, scopes, created_by)
       VALUES ($1, 'day326-delete-text-probe', $2, 'day326_txt', ARRAY['records:read'], $3)
       RETURNING id::text`,
      [UUID_ORG, 'c'.repeat(64), UUID_OWNER]
    );
    const accountId = protectedRow.rows[0].id;
    const foreign = await call(
      'delete-text',
      'foreign',
      'delete',
      `/api/admin/service-accounts/${accountId}?orgId=${TEXT_ORG}`,
      tokenFor.foreign,
      UUID_ORG
    );
    expect(foreign.response.status).toBe(403);
    const owner = await call(
      'delete-text',
      'owner',
      'delete',
      `/api/admin/service-accounts/${accountId}`,
      tokenFor.text,
      UUID_ORG
    );
    expect(owner.response.status).toBe(500);
    expect(owner.response.body).toEqual({});
    expect(owner.databaseAfter).toEqual(owner.databaseBefore);
  });
});
