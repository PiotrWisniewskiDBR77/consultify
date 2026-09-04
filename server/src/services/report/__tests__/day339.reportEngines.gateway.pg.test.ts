/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT = '/private/tmp/cx-day339-silnik-raportu-wybor-artefakty/day339-session.json';

describe(
  'Day 339 — one Assessment session through Gateway for report-engine comparison',
  NO_RETRY,
  () => {
    const organizationId = 'day339-report-engine-org';
    const userId = 'day339-report-engine-owner';
    const packId = 'drd';
    const packVersion = 'day339-v1';
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
       VALUES($1,'Fabryka Pomiarowa 339','active','Produkcja przemysłowa')`,
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
        name: 'DRD Day 339 report-engine measurement',
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

    it('creates and cold-reads the same evidence-bearing session used by every measured engine', async () => {
      const http: Array<{ step: string; status: number }> = [];
      const created = await request(app)
        .post('/api/method/sessions')
        .set('Authorization', authorization)
        .set('Idempotency-Key', `day339-create-${randomUUID()}`)
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

      const unitIds = ['1A', '2A', '3A', '4A', '5A', '6A', '7A'];
      for (const [index, unitId] of unitIds.entries()) {
        const evidence = await request(app)
          .post(`/api/method/sessions/${sessionId}/events`)
          .set('Authorization', authorization)
          .set('Idempotency-Key', `day339-evidence-${unitId}-${randomUUID()}`)
          .send({
            type: 'EVIDENCE_ATTACHED',
            unitId,
            payload: {
              evidenceId: `day339-${unitId}`,
              evidenceType: 'document',
              strength: index % 2 === 0 ? 'E2' : 'E1',
            },
          });
        http.push({ step: `POST evidence ${unitId}`, status: evidence.status });
        expect(evidence.status, JSON.stringify(evidence.body)).toBe(201);

        const answer = await request(app)
          .post(`/api/method/sessions/${sessionId}/events`)
          .set('Authorization', authorization)
          .set('Idempotency-Key', `day339-answer-${unitId}-${randomUUID()}`)
          .send({
            type: 'ANSWER_CONFIRMED',
            unitId,
            level: 2,
            payload: {
              questionId: `day339-question-${unitId}`,
              answerState: 'confirmed',
              answerText: `Potwierdzona odpowiedź pomiarowa dla obszaru ${unitId}.`,
            },
          });
        http.push({ step: `POST answer ${unitId}`, status: answer.status });
        expect(answer.status, JSON.stringify(answer.body)).toBe(201);
      }

      const resumed = await request(app)
        .get(`/api/method/sessions/${sessionId}`)
        .set('Authorization', authorization);
      http.push({ step: 'GET session', status: resumed.status });
      expect(resumed.status, JSON.stringify(resumed.body)).toBe(200);
      expect(resumed.body.session.id).toBe(sessionId);

      const events = await request(app)
        .get(`/api/method/sessions/${sessionId}/events`)
        .set('Authorization', authorization);
      http.push({ step: 'GET events', status: events.status });
      expect(events.status, JSON.stringify(events.body)).toBe(200);
      expect(events.body.events).toHaveLength(14);

      const contract = await request(app)
        .get(`/api/method/sessions/${sessionId}/assessment-report-contract`)
        .set('Authorization', authorization);
      http.push({ step: 'GET assessment-report-contract', status: contract.status });
      expect(contract.status, JSON.stringify(contract.body)).toBe(200);
      expect(contract.body.reportContract.sessionId).toBe(sessionId);

      const stored = await sql.query(
        `SELECT s.id,s.organization_id,
              count(*) FILTER (WHERE e.type='ANSWER_CONFIRMED')::int AS answers,
              count(*) FILTER (WHERE e.type='EVIDENCE_ATTACHED')::int AS evidence_events
       FROM method_sessions s
       JOIN method_events e ON e.session_id=s.id AND e.organization_id=s.organization_id
       WHERE s.id=$1 AND s.organization_id=$2
       GROUP BY s.id,s.organization_id`,
        [sessionId, organizationId]
      );
      expect(stored.rows).toEqual([
        expect.objectContaining({
          id: sessionId,
          organization_id: organizationId,
          answers: 7,
          evidence_events: 7,
        }),
      ]);

      await writeFile(
        ARTIFACT,
        `${JSON.stringify(
          {
            sessionId,
            organizationId,
            userId,
            answers: stored.rows[0].answers,
            evidenceEvents: stored.rows[0].evidence_events,
            http,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }, 30_000);
  }
);
