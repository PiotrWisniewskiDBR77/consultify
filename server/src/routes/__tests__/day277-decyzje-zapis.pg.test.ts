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

describe('Day 277 decision enhancements through ApiGateway and PostgreSQL', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const foreignUserId = randomUUID();
  const decisionId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization: string;
  let foreignAuthorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [
      organizationId,
      foreignOrganizationId,
    ]);
    for (const [id, org, email] of [
      [userId, organizationId, 'owner-day277@example.test'],
      [foreignUserId, foreignOrganizationId, 'foreign-day277@example.test'],
    ]) {
      await sql.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'x','ADMIN','active')`,
        [id, org, email]
      );
      await sql.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
        [randomUUID(), org, id]
      );
    }
    await sql.query(
      `INSERT INTO decisions(id,organization_id,title,created_by,decision_maker_id,status)
       VALUES($1,$2,'Day 277',$3,$3,'pending')`,
      [decisionId, organizationId, userId]
    );
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, email: 'owner-day277@example.test', organizationId, role: 'ADMIN' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;
    foreignAuthorization = `Bearer ${jwt.sign(
      {
        id: foreignUserId,
        userId: foreignUserId,
        email: 'foreign-day277@example.test',
        organizationId: foreignOrganizationId,
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
    if (!sql) return;
    await sql.query('DELETE FROM decision_enhancements WHERE decision_id=$1', [decisionId]);
    await sql.query('DELETE FROM decisions WHERE id=$1', [decisionId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id=ANY($1)', [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query('DELETE FROM users WHERE organization_id=ANY($1)', [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query('DELETE FROM organizations WHERE id=ANY($1)', [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  const payload = {
    reminders: [{ id: 'r1', daysBefore: 3, enabled: true }],
    escalationRules: [{ id: 'e1', warningDays: 2, criticalDays: 1 }],
    linkedItems: [{ id: 'task-1', type: 'task', title: 'Zależność' }],
    contextDetails: 'Kontekst zapisany na serwerze',
    consequenceScenarios: { pessimistic: { d7: 'Opóźnienie' } },
  };

  it('owner writes all five fields, SQL sees them, and detail reads them back', async () => {
    const write = await request(app)
      .put(`/api/decisions/${decisionId}/enhancements`)
      .set('Authorization', authorization)
      .send(payload);
    expect(write.status, JSON.stringify(write.body)).toBe(200);
    const direct = await sql.query(
      `SELECT reminders,escalation_rules,linked_items,context_details,consequence_scenarios
         FROM decision_enhancements WHERE decision_id=$1 AND organization_id=$2`,
      [decisionId, organizationId]
    );
    expect(direct.rows).toHaveLength(1);
    expect(direct.rows[0]).toMatchObject({
      reminders: payload.reminders,
      escalation_rules: payload.escalationRules,
      linked_items: payload.linkedItems,
      context_details: payload.contextDetails,
      consequence_scenarios: payload.consequenceScenarios,
    });
    const detail = await request(app)
      .get(`/api/decisions/${decisionId}/detail`)
      .set('Authorization', authorization);
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    expect(detail.body).toMatchObject(payload);
  });

  it('foreign tenant cannot see or overwrite the decision enhancements', async () => {
    const write = await request(app)
      .put(`/api/decisions/${decisionId}/enhancements`)
      .set('Authorization', foreignAuthorization)
      .send(payload);
    expect(write.status).toBe(404);
    const detail = await request(app)
      .get(`/api/decisions/${decisionId}/detail`)
      .set('Authorization', foreignAuthorization);
    expect(detail.status).toBe(404);
  });
});
