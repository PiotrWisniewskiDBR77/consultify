/** @vitest-environment node */
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PROJECT_ID = 'odbior--m5--project-0001';
const INITIATIVE_ID = 'odbior--m5--initiative-0001';
const MILESTONE_ID = 'odbior--m5--milestone-0001';
const GATE_ID = 'odbior--m5--gate-0001';
const DECISION_ID = 'odbior--m5--decision-0001';
const createdReportIds: string[] = [];
let app: Express;
let token: string;

beforeAll(async () => {
  await seed();
  const db = pgClient();
  await db.connect();
  try {
    await db.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, is_closed)
       VALUES ($1,$2,'M5 management reports','active',$3,0)
       ON CONFLICT (id) DO UPDATE SET status='active',is_closed=0`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID]
    );
    await db.query(
      `INSERT INTO initiatives (id,organization_id,project_id,name,status,created_by)
       VALUES ($1,$2,$3,'M5 canonical initiative','IN_EXECUTION',$4)
       ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,status='IN_EXECUTION'`,
      [INITIATIVE_ID, SEED.ORG_ID, PROJECT_ID, SEED.USER_ID]
    );
    await db.query(
      `INSERT INTO initiative_milestones
         (id,initiative_id,organization_id,name,target_date,status,order_index,created_by)
       VALUES ($1,$2,$3,'M5 canonical milestone','2026-10-01','PLANNED',1,$4)
       ON CONFLICT (id) DO UPDATE SET target_date=EXCLUDED.target_date,status='PLANNED'`,
      [MILESTONE_ID, INITIATIVE_ID, SEED.ORG_ID, SEED.USER_ID]
    );
    await db.query(
      `INSERT INTO stage_gates (id,organization_id,project_id,gate_type,status,requested_by)
       VALUES ($1,$2,$3,'PLANNING_GATE','PENDING',$4)
       ON CONFLICT (id) DO UPDATE SET status='PENDING'`,
      [GATE_ID, SEED.ORG_ID, PROJECT_ID, SEED.USER_ID]
    );
    await db.query(
      `INSERT INTO decisions
         (id,organization_id,project_id,title,type,status,decision_owner_id,created_by,escalation_level)
       VALUES ($1,$2,$3,'M5 steering decision','STRATEGIC','PENDING',$4,$4,'2')
       ON CONFLICT (id) DO UPDATE SET status='PENDING',type='STRATEGIC',escalation_level='2'`,
      [DECISION_ID, SEED.ORG_ID, PROJECT_ID, SEED.USER_ID]
    );
  } finally {
    await db.end();
  }

  const router = (await import('../../server/src/routes/managementReports.routes.js')).default;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/management-reports', router as unknown as express.RequestHandler);
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const db = pgClient();
  await db.connect();
  try {
    if (createdReportIds.length) {
      await db.query('DELETE FROM management_reports WHERE id = ANY($1)', [createdReportIds]);
    }
    await db.query('DELETE FROM decisions WHERE id=$1', [DECISION_ID]);
    await db.query('DELETE FROM stage_gates WHERE id=$1', [GATE_ID]);
    await db.query('DELETE FROM initiative_milestones WHERE id=$1', [MILESTONE_ID]);
    await db.query('DELETE FROM initiatives WHERE id=$1', [INITIATIVE_ID]);
    await db.query('DELETE FROM projects WHERE id=$1', [PROJECT_ID]);
  } finally {
    await db.end();
  }
});

const CASES = [
  { reportType: 'TEAM_MEETING', scope: 'PROJECT', projectId: PROJECT_ID },
  { reportType: 'TEAM_WEEKLY', scope: 'PROJECT', projectId: PROJECT_ID },
  { reportType: 'STEERING_COMMITTEE', scope: 'PROJECT', projectId: PROJECT_ID },
  { reportType: 'PORTFOLIO_HEALTH', scope: 'PORTFOLIO' },
  { reportType: 'RAID', scope: 'PROJECT', projectId: PROJECT_ID },
] as const;

describe('M5 management report generation on the real PostgreSQL schema', () => {
  it.each(CASES)('$reportType/$scope returns and persists one report', async (reportCase) => {
    const response = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...reportCase,
        aiEnhancement: false,
        language: 'en',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(response.body?.report?.reportType).toBe(reportCase.reportType);
    if (reportCase.reportType === 'STEERING_COMMITTEE') {
      expect(response.body.report.content.decisionsRequired).toEqual([
        expect.objectContaining({ id: DECISION_ID, requestedBy: SEED.USER_ID }),
      ]);
      expect(response.body.report.content.forecast.nextMilestones).toEqual([
        expect.objectContaining({ id: MILESTONE_ID, name: 'M5 canonical milestone' }),
      ]);
      expect(response.body.report.content.forecast.nextGates).toEqual([
        expect.objectContaining({ id: GATE_ID, gateType: 'PLANNING_GATE' }),
      ]);
    }
    if (reportCase.reportType === 'RAID') {
      expect(response.body.report.content.decisionsRequired).toEqual([
        expect.objectContaining({ id: DECISION_ID, requestedBy: SEED.USER_ID }),
      ]);
    }
    createdReportIds.push(response.body.report.id);

    const db = pgClient();
    await db.connect();
    try {
      const persisted = await db.query(
        `SELECT report_type,scope,organization_id,project_id
           FROM management_reports WHERE id=$1`,
        [response.body.report.id]
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0]).toMatchObject({
        report_type: reportCase.reportType,
        scope: reportCase.scope,
        organization_id: SEED.ORG_ID,
        project_id: 'projectId' in reportCase ? PROJECT_ID : null,
      });
    } finally {
      await db.end();
    }
  });
});
