/** @vitest-environment node */
// KONTRAKT DYŻURU 346 — pełna sesja 39/39 przez realny ApiGateway/JWT/PostgreSQL.

import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import DRD_STRUCTURE from '../../../data/drdStructure.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT = '/private/tmp/cx-day346-falszywa-kompletnosc-artefakty/day346-session.json';

describe('Day 346 — complete 39/39 Assessment session for report-engine comparison', NO_RETRY, () => {
  const organizationId = 'day346-report-engine-org';
  const userId = 'day346-report-engine-owner';
  const packId = 'drd';
  const packVersion = 'day346-v1';
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();

    await sql.query('DELETE FROM users WHERE id=$1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await sql.query(
      `INSERT INTO organizations(id,name,status,industry)
       VALUES($1,'Fabryka Pomiarowa 346','active','Produkcja przemysłowa')`,
      [organizationId]
    );
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name)
       VALUES($1,$2,$3,'local-only','OWNER','active','Anna','Pomiarowa')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );

    const { methodPackRegistry } = await import('../../../method-core/MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId,
      packId,
      version: packVersion,
      name: 'DRD Day 346 full-session engine measurement',
      readiness: 'released',
    });

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  it('creates 39 answers, cold-reads them, and returns the report contract', async () => {
    const http: Array<{ step: string; status: number }> = [];
    const created = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', authorization)
      .set('Idempotency-Key', `day346-create-${randomUUID()}`)
      .send({
        module: 'assessment',
        methodPackId: packId,
        methodPackVersion: packVersion,
        mode: 'guided_manual',
        projectId: null,
      });
    http.push({ step: 'POST /api/method/sessions', status: created.status });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const sessionId = String(created.body.session.id);
    const unitIds = DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => area.id));
    expect(unitIds).toHaveLength(39);

    for (const unitId of unitIds) {
      const answer = await request(app)
        .post(`/api/method/sessions/${sessionId}/events`)
        .set('Authorization', authorization)
        .set('Idempotency-Key', `day346-answer-${unitId}-${randomUUID()}`)
        .send({
          type: 'ANSWER_CONFIRMED',
          unitId,
          level: 2,
          payload: {
            questionId: `day346-question-${unitId}`,
            answerState: 'confirmed',
            answerText: `Potwierdzona odpowiedź pomiarowa dla obszaru ${unitId}.`,
          },
        });
      http.push({ step: `POST answer ${unitId}`, status: answer.status });
      expect(answer.status, `${unitId}: ${JSON.stringify(answer.body)}`).toBe(201);
    }

    const events = await request(app)
      .get(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', authorization);
    http.push({ step: 'GET events', status: events.status });
    expect(events.status, JSON.stringify(events.body)).toBe(200);
    expect(events.body.events).toHaveLength(39);

    const contract = await request(app)
      .get(`/api/method/sessions/${sessionId}/assessment-report-contract`)
      .set('Authorization', authorization);
    http.push({ step: 'GET assessment-report-contract', status: contract.status });
    expect(contract.status, JSON.stringify(contract.body)).toBe(200);
    expect(contract.body.reportContract.sessionId).toBe(sessionId);

    const stored = await sql.query(
      `SELECT s.id,s.organization_id,
              count(*) FILTER (WHERE e.type='ANSWER_CONFIRMED')::int AS answers
       FROM method_sessions s
       JOIN method_events e ON e.session_id=s.id AND e.organization_id=s.organization_id
       WHERE s.id=$1 AND s.organization_id=$2
       GROUP BY s.id,s.organization_id`,
      [sessionId, organizationId]
    );
    expect(stored.rows).toEqual([
      expect.objectContaining({ id: sessionId, organization_id: organizationId, answers: 39 }),
    ]);

    await writeFile(
      ARTIFACT,
      `${JSON.stringify({ sessionId, organizationId, userId, answers: 39, http }, null, 2)}\n`,
      'utf8'
    );
  }, 60_000);
});
