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
  '/private/tmp/cx-day225-narzedzia-artefakty/day225-tool-outputs-http-db-evidence.json';

describe('Day225 GET /api/tool-outputs through real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const outputId = randomUUID();
  const toolSessionId = randomUUID();
  const evidence: unknown[] = [];
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    const target = await sql.query(
      'SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port'
    );
    evidence.push({ databaseTarget: target.rows[0] });

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Day225 tools', 'enterprise', 'active', 1, now())`,
      [organizationId]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Day', 'Two Two Five', 'ADMIN', 'active', now())`,
      [userId, organizationId, `day225-${userId}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [randomUUID(), organizationId, userId]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `day225-${userId}@example.test`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (!sql) return;
    await sql.query('DELETE FROM tool_outputs WHERE organization_id = $1', [organizationId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [
      organizationId,
    ]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await sql.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('returns 200 and an empty outputs envelope on the freshly migrated table', async () => {
    const response = await request(app)
      .get('/api/tool-outputs')
      .set('Authorization', authorization);

    evidence.push({ name: 'empty owner read', status: response.status, body: response.body });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({ outputs: [] });
  });

  it('reads an organization-owned PostgreSQL row back through the mounted route', async () => {
    await sql.query(
      `INSERT INTO tool_outputs
         (id, organization_id, tool_session_id, tool_type, method_pack_version,
          version, title, payload_json, content_hash, status, created_by)
       VALUES ($1, $2, $3, 'dynamic-swot', 'day225-v1', 1, 'Day225 output',
               $4::jsonb, 'day225-content-hash', 'approved', $5)`,
      [outputId, organizationId, toolSessionId, JSON.stringify({ items: [] }), userId]
    );

    const response = await request(app)
      .get('/api/tool-outputs')
      .set('Authorization', authorization);
    const direct = await sql.query(
      'SELECT id, organization_id, title, status FROM tool_outputs WHERE id = $1',
      [outputId]
    );

    evidence.push({
      name: 'owner row readback',
      status: response.status,
      body: response.body,
      databaseReadback: direct.rows,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.outputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: outputId, title: 'Day225 output', status: 'approved' }),
      ])
    );
    expect(direct.rows).toEqual([
      expect.objectContaining({
        id: outputId,
        organization_id: organizationId,
        title: 'Day225 output',
        status: 'approved',
      }),
    ]);
  });

  it('returns 401 without a valid signed JWT and exposes no output data', async () => {
    const response = await request(app).get('/api/tool-outputs');

    evidence.push({ name: 'unauthenticated boundary', status: response.status, body: response.body });
    expect(response.status).toBe(401);
    expect(response.body.outputs).toBeUndefined();
  });
});
