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
const ARTIFACT = '/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-initiative-http-db.json';

describe('Day 172 initiative status through real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const selfServiceInitiativeId = randomUUID();
  const approvalInitiativeId = randomUUID();
  const workbookId = randomUUID();
  const evidence: unknown[] = [];
  let app: Express;
  let sql: Client;
  let authorization: string;

  const readState = async (initiativeId: string) => {
    const [initiative, statusHistory, history] = await Promise.all([
      sql.query('SELECT id,status FROM initiatives WHERE id=$1 AND organization_id=$2', [
        initiativeId,
        organizationId,
      ]),
      sql.query(
        `SELECT from_status,to_status,gate_type,changed_by
           FROM initiative_status_history WHERE initiative_id=$1 ORDER BY created_at`,
        [initiativeId]
      ),
      sql.query(
        `SELECT action,old_value,new_value,changed_by
           FROM initiative_history WHERE initiative_id=$1 ORDER BY changed_at`,
        [initiativeId]
      ),
    ]);
    return {
      initiative: initiative.rows,
      initiativeStatusHistory: statusHistory.rows,
      initiativeHistory: history.rows,
    };
  };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();

    await sql.query(`INSERT INTO organizations (id,name,status) VALUES ($1,$2,'active')`, [
      organizationId,
      'Day 172 initiative status proof',
    ]);
    await sql.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused-local-only','CONSULTANT','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO generated_workbooks
         (id,organization_id,title,schema_json,sheet_count,file_name,file_size,pipeline_log,created_by)
       VALUES ($1,$2,$3,$4,1,'day172.xlsx',128,$5,$6)`,
      [
        workbookId,
        organizationId,
        'Day 172 persisted workbook',
        JSON.stringify({
          title: 'Day 172 persisted workbook',
          sheets: [{ id: 'sheet-1', name: 'Sheet 1', columns: [], rows: [] }],
        }),
        JSON.stringify([
          { phase: 'plan', status: 'ok', durationMs: 12, detail: 'Plan persisted' },
          { phase: 'generate', status: 'ok', durationMs: 34, detail: 'Workbook persisted' },
        ]),
        userId,
      ]
    );
    await sql.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'CONSULTANT','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(
      `INSERT INTO initiatives
         (id,organization_id,name,status,owner_execution_id,created_by,updated_by)
       VALUES ($1,$2,$3,'DRAFT',$4,$4,$4),($5,$2,$6,'PLANNING',$4,$4,$4)`,
      [
        selfServiceInitiativeId,
        organizationId,
        'Day 172 self-service transition',
        userId,
        approvalInitiativeId,
        'Day 172 approval-required transition',
      ]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'CONSULTANT',
        email: `${userId}@test.invalid`,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30000);

  afterAll(async () => {
    writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (sql) await sql.end();
  });

  it('allows the author-consultant self-service DRAFT to PENDING_REVIEW transition', async () => {
    const before = await readState(selfServiceInitiativeId);
    const response = await request(app)
      .patch(`/api/initiatives/${selfServiceInitiativeId}/status`)
      .set('Authorization', authorization)
      .send({ status: 'PENDING_REVIEW', reason: 'Day 172 self-service proof' });
    const after = await readState(selfServiceInitiativeId);
    evidence.push({
      targetStatus: 'PENDING_REVIEW',
      status: response.status,
      body: response.body,
      before,
      after,
    });
    console.log('DAY172_HTTP_SELF_SERVICE', response.status, JSON.stringify(response.body));
    console.log('DAY172_DB_SELF_SERVICE_BEFORE', JSON.stringify(before));
    console.log('DAY172_DB_SELF_SERVICE_AFTER', JSON.stringify(after));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(after.initiative).toEqual([{ id: selfServiceInitiativeId, status: 'PENDING_REVIEW' }]);
    expect(after.initiativeStatusHistory).toHaveLength(1);
    expect(after.initiativeHistory).toHaveLength(1);
  });

  it('rejects PLANNING to APPROVED without the steering-committee role and writes nothing', async () => {
    const before = await readState(approvalInitiativeId);
    const response = await request(app)
      .patch(`/api/initiatives/${approvalInitiativeId}/status`)
      .set('Authorization', authorization)
      .send({ status: 'APPROVED', reason: 'Day 172 negative authorization proof' });
    const after = await readState(approvalInitiativeId);
    evidence.push({
      targetStatus: 'APPROVED',
      status: response.status,
      body: response.body,
      before,
      after,
    });
    console.log('DAY172_HTTP_APPROVER_REQUIRED', response.status, JSON.stringify(response.body));
    console.log('DAY172_DB_APPROVER_REQUIRED_BEFORE', JSON.stringify(before));
    console.log('DAY172_DB_APPROVER_REQUIRED_AFTER', JSON.stringify(after));
    expect(response.status, JSON.stringify(response.body)).toBe(403);
    expect(response.body).toMatchObject({ gate: 'APPROVE', from: 'PLANNING', to: 'APPROVED' });
    expect(after).toEqual(before);
  });

  it('returns the persisted workbook pipeline log on reopen', async () => {
    const response = await request(app)
      .get(`/api/workbook/${workbookId}`)
      .set('Authorization', authorization);
    evidence.push({ workbookId, status: response.status, pipelineLog: response.body?.pipelineLog });
    console.log('DAY172_HTTP_WORKBOOK_REOPEN', response.status, JSON.stringify(response.body));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.pipelineLog).toEqual([
      { phase: 'plan', status: 'ok', durationMs: 12, detail: 'Plan persisted' },
      { phase: 'generate', status: 'ok', durationMs: 34, detail: 'Workbook persisted' },
    ]);
  });
});
