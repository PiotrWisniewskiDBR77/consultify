/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day371 schema proposal execute conflict through real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const baseId = randomUUID();
  const proposalId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization = '';

  const readProposal = async () => {
    const result = await sql.query(
      'SELECT status, resolved_at FROM tp_schema_proposals WHERE id = $1',
      [proposalId]
    );
    return result.rows[0] as { status: string; resolved_at: Date | null };
  };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Day371', 'enterprise', 'active', 1, NOW())`,
      [organizationId]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'unused', 'Day', '371', 'ADMIN', 'active', NOW())`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await sql.query(
      `INSERT INTO tp_bases
         (id, workspace_id, organization_id, name, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'Day371 base', $4, NOW(), NOW())`,
      [baseId, `workspace-${baseId}`, organizationId, userId]
    );
    await sql.query(
      `INSERT INTO tp_schema_proposals
         (id, workspace_id, intent, confidence, summary, operations, warnings, status, created_by, created_at)
       VALUES ($1, $2, 'day371_conflict', 1, 'Conflict proof', $3::jsonb, '[]'::jsonb, 'pending', $4, NOW())`,
      [
        proposalId,
        `workspace-${baseId}`,
        JSON.stringify([
          {
            id: 'day371-operation-1',
            operationType: 'day371_unknown_operation',
            target: { base_id: baseId },
            payload: {},
          },
        ]),
        userId,
      ]
    );

    const [{ default: config }, { ApiGateway }] = await Promise.all([
      import('../../config/Config.js'),
      import('../../Gateway.js'),
    ]);
    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@example.test`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query("DELETE FROM tp_audit_events WHERE entity_type = 'schema_proposal' AND entity_id = $1", [
      proposalId,
    ]);
    await sql.query('DELETE FROM tp_schema_proposals WHERE id = $1', [proposalId]);
    await sql.query('DELETE FROM tp_bases WHERE id = $1', [baseId]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await sql.end();
  });

  it('returns 200 once, then typed 409 without changing resolved_at again', async () => {
    const execute = () =>
      request(app)
        .post(`/api/table-platform/schema/proposals/${proposalId}/execute`)
        .set('Authorization', authorization)
        .send({});

    const first = await execute();
    const afterFirst = await readProposal();
    const second = await execute();
    const afterSecond = await readProposal();

    console.log(
      'DAY371_EXECUTE_CONFLICT_EVIDENCE',
      JSON.stringify({
        first: { status: first.status, body: first.body, database: afterFirst },
        second: { status: second.status, body: second.body, database: afterSecond },
      })
    );

    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(afterFirst.status).not.toBe('pending');
    expect(afterFirst.resolved_at).not.toBeNull();
    expect(second.status, JSON.stringify(second.body)).toBe(409);
    expect(second.body).toMatchObject({ code: 'PROPOSAL_ALREADY_EXECUTED' });
    expect(afterSecond.status).toBe(afterFirst.status);
    expect(afterSecond.resolved_at?.toISOString()).toBe(afterFirst.resolved_at?.toISOString());
  });
});
