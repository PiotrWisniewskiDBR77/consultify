/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

describe('Day 275 — panel jakości czyta dokładne answers.drd przez ApiGateway i RealPG', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const assessmentId = randomUUID();
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    await pool.query(`INSERT INTO organizations (id,name,status) VALUES ($1,$2,'active')`, [
      organizationId,
      'Day 275',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused-local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO assessments
         (id,organization_id,name,assessment_type,status,created_by,answers_json,created_at,updated_at)
       VALUES ($1,$2,'Day 275 DRD','DRD','DRAFT',$3,$4,now(),now())`,
      [
        assessmentId,
        organizationId,
        userId,
        JSON.stringify({ drd: { areas: { '1A': { achievedLevel: 3, targetLevel: 5 } } } }),
      ]
    );
    await pool.query(
      `INSERT INTO assessment_axis_evidence
         (id,organization_id,assessment_id,axis_id,area_id,evidence_type,title,created_by,created_at)
       VALUES ($1,$2,$3,'1','1A','document','Dowód Day 275',$4,now())`,
      [randomUUID(), organizationId, assessmentId, userId]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  }, 30000);

  afterAll(async () => pool.end());

  it('zwraca dokładny stan obszaru oraz scoring z tej samej tenantowej bazy', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const detail = await request(app).get(`/api/v8/assessment/${assessmentId}`).set(auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.assessment.answers.drd.areas['1A']).toEqual({
      achievedLevel: 3,
      targetLevel: 5,
    });

    const evidence = await request(app)
      .get(`/api/v8/assessment/${assessmentId}/evidence`)
      .set(auth);
    expect(evidence.status).toBe(200);
    expect(evidence.body.data.evidence).toHaveLength(1);
    expect(
      evidence.body.data.scoring.axes.find((axis: { axisId: string }) => axis.axisId === '1')
    ).toMatchObject({ answeredAreas: 1, avgAchievedLevel: 3, avgTargetLevel: 5, evidenceCount: 1 });

    const readback = await pool.query(
      `SELECT answers_json FROM assessments WHERE id=$1 AND organization_id=$2`,
      [assessmentId, organizationId]
    );
    const persisted =
      typeof readback.rows[0].answers_json === 'string'
        ? JSON.parse(readback.rows[0].answers_json)
        : readback.rows[0].answers_json;
    expect(persisted.drd.areas['1A']).toEqual({ achievedLevel: 3, targetLevel: 5 });
  });
});
