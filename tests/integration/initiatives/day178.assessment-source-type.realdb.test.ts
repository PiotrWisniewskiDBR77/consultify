/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET || 'day178-test-secret-do-not-reuse';
const NO_RETRY = { retry: 0 } as const;

const isAssessmentModuleInitiative = (row: any): boolean => {
  if (!row?.id) return false;
  const st = String(row?.source_type || row?.sourceType || '').toLowerCase();
  const sid = String(row?.source_id || row?.sourceId || '').trim();
  if (!sid) return false;
  return (
    st === 'assessment' ||
    st === 'assessment_report' ||
    st === 'assessment_drd' ||
    st === 'assessment_siri' ||
    st === 'assessment_adma'
  );
};

describe('Day178 assessment initiative source type through real ApiGateway', NO_RETRY, () => {
  const suffix = randomUUID();
  const organizationId = `day178-org-${suffix}`;
  const userId = randomUUID();
  const assessmentId = `day178-assessment-${suffix}`;
  const initiativeId = `day178-initiative-${suffix}`;
  const membershipId = randomUUID();
  const app = express();
  const sql = new Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.JWT_SECRET = jwtSecret;
    await sql.connect();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await sql.query(
      `INSERT INTO users(id,email,password,role,organization_id,status)
       VALUES($1,$2,'test','OWNER',$3,'active')`,
      [userId, `${userId}@day178.invalid`, organizationId]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [membershipId, organizationId, userId]
    );
    await sql.query(
      `INSERT INTO assessments(id,organization_id,name,framework_type,assessment_type,status)
       VALUES($1,$2,'Day178 DRD assessment','DRD','DRD','completed')`,
      [assessmentId, organizationId]
    );
    await sql.query(
      `INSERT INTO initiatives
         (id,organization_id,name,title,status,source_type,source_id,source_assessment_id)
       VALUES($1,$2,'Day178 assessment initiative','Day178 assessment initiative','DRAFT','assessment',$3,$3)`,
      [initiativeId, organizationId, assessmentId]
    );
  }, 30_000);

  afterAll(async () => {
    await sql.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
    await sql.query(`DELETE FROM assessments WHERE id=$1`, [assessmentId]);
    await sql.query(`DELETE FROM organization_members WHERE id=$1`, [membershipId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('uses the effective Postgres environment', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.RUN_DB_TESTS).toBe('1');
  });

  it('keeps sourceType assessment and exposes DRD separately as sourceFramework', async () => {
    const token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const response = await request(app)
      .get('/api/initiatives?source=assessment')
      .set('Authorization', `Bearer ${token}`)
      .set('x-org-context', organizationId);

    expect(response.status).toBe(200);
    const row = response.body.find((candidate: any) => candidate.id === initiativeId);
    expect(row).toBeDefined();
    expect(row.sourceType).toBe('assessment');
    expect(row.sourceType).not.toBe('DRD');
    expect(row.sourceFramework).toBe('DRD');
    expect(row.sourceId).toBe(assessmentId);
    expect(isAssessmentModuleInitiative(row)).toBe(true);

    const readback = await sql.query(
      `SELECT source_type,source_id,source_assessment_id FROM initiatives WHERE id=$1`,
      [initiativeId]
    );
    expect(readback.rows).toEqual([
      {
        source_type: 'assessment',
        source_id: assessmentId,
        source_assessment_id: assessmentId,
      },
    ]);
  });
});
