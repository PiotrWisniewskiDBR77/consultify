/** @vitest-environment node */
// KONTRAKT DYŻURU 351 — żywa trasa liczy postęp z odpowiedzi, nie z celów metodyki.
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import DRD_STRUCTURE from '../../data/drdStructure.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day 351 — assessment progress through ApiGateway/JWT/PostgreSQL', NO_RETRY, () => {
  const organizationId = 'day351-assessment-org';
  const userId = 'day351-assessment-owner';
  const partialId = 'day351-drd-7-of-39';
  const fullId = 'day351-drd-39-of-39';
  const siriTargetId = 'day351-siri-target-only';
  const siriFullId = 'day351-siri-full';
  const admaTargetId = 'day351-adma-target-only';
  const admaFullId = 'day351-adma-full';
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
    await sql.query("INSERT INTO organizations(id,name,status) VALUES($1,'Pomiar 351','active')", [organizationId]);
    await sql.query(
      "INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name) VALUES($1,$2,$3,'local-only','OWNER','active','Anna','Pomiarowa')",
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",
      [randomUUID(), organizationId, userId]
    );

    const areaIds = DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => area.id));
    expect(areaIds).toHaveLength(39);
    const makeAreas = (answered: number) =>
      Object.fromEntries(areaIds.map((id, index) => [id, { achievedLevel: index < answered ? 2 : 0, targetLevel: 4 }]));

    for (const [id, answered] of [[partialId, 7], [fullId, 39]] as const) {
      await sql.query(
        `INSERT INTO assessments(id,organization_id,name,status,assessment_type,framework_type,framework_data,answers_json,score_summary,completion_percent,created_by)
         VALUES($1,$2,$3,'IN_PROGRESS','DRD','DRD','{}',$4,'{}','0',$5)`,
        [id, organizationId, id, JSON.stringify({ drd: { areas: makeAreas(answered) } }), userId]
      );
    }
    for (const [id, type, count, field] of [
      [siriTargetId, 'SIRI', 8, 'siri'], [siriFullId, 'SIRI', 8, 'siri'],
      [admaTargetId, 'ADMA', 12, 'adma'], [admaFullId, 'ADMA', 12, 'adma'],
    ] as const) {
      const dimensions = Object.fromEntries(
        Array.from({ length: count }, (_, index) => [String(index + 1), { current: id.endsWith('full') ? 2 : 0, target: 4 }])
      );
      await sql.query(
        `INSERT INTO assessments(id,organization_id,name,status,assessment_type,framework_type,framework_data,answers_json,score_summary,completion_percent,created_by)
         VALUES($1,$2,$3,'IN_PROGRESS',$4,$4,'{}',$5,'{}','0',$6)`,
        [id, organizationId, id, type, JSON.stringify({ [field]: { dimensions } }), userId]
      );
    }

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  it('cold-reads zero completion_percent and reports 7/39 incomplete plus 39/39 complete', async () => {
    const stored = await sql.query(
      'SELECT id, completion_percent FROM assessments WHERE id = ANY($1::text[]) ORDER BY id',
      [[partialId, fullId]]
    );
    expect(Object.fromEntries(stored.rows.map((row) => [row.id, row.completion_percent]))).toEqual({
      [partialId]: '0',
      [fullId]: '0',
    });

    const response = await request(app).get('/api/assessments').set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const byId = Object.fromEntries(response.body.assessments.map((assessment: any) => [assessment.id, assessment]));
    expect(byId[partialId].completedAxes).toBeGreaterThan(0);
    expect(byId[partialId].completedAxes).toBeLessThan(7);
    expect(byId[partialId].progress).toBeLessThan(100);
    expect(byId[fullId]).toMatchObject({ completedAxes: 7, totalAxes: 7, progress: 100 });
    expect(byId[siriTargetId]).toMatchObject({ completedAxes: 0, totalAxes: 8, progress: 0 });
    expect(byId[siriFullId]).toMatchObject({ completedAxes: 8, totalAxes: 8, progress: 100 });
    expect(byId[admaTargetId]).toMatchObject({ completedAxes: 0, totalAxes: 12, progress: 0 });
    expect(byId[admaFullId]).toMatchObject({ completedAxes: 12, totalAxes: 12, progress: 100 });
  }, 30_000);
});
