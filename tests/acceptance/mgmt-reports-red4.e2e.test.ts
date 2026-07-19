/**
 * Acceptance: RED #4 (audyt adwersaryjny fali W3, agent B10) — two Management
 * Reports bugs found on the live parity schema (docker consultify-parity-pg18,
 * :5443), fixed together because the same request path exercises both:
 *
 *  1. `management_reports_report_type_check` only allowed
 *     ('TEAM_MEETING', 'STEERING_COMMITTEE') while managementReportsService
 *     (and the /generate route's validTypes list) support 5 types —
 *     TEAM_MEETING / TEAM_WEEKLY / STEERING_COMMITTEE / PORTFOLIO_HEALTH / RAID.
 *     INSERT of the 3 missing types 500d. Fixed by
 *     server/migrations/20260719_management_reports_type_check.sql (widens
 *     the CHECK, additive/idempotent, same DO-block pattern as
 *     20260417_chat_message_types_execution_family.sql).
 *
 *  2. `ManagementReportRepository.getBasicTaskMetrics` ran `AVG(progress)`
 *     where `tasks.progress` is TEXT on Postgres ("function avg(text) does
 *     not exist"). generatePortfolioHealthReport() calls this once per active
 *     project in the org, so ANY org with an active project + task 500d on
 *     PORTFOLIO_HEALTH generation regardless of report scope. Fixed by
 *     casting via CAST(NULLIF(progress, '') AS NUMERIC).
 *
 * This test drives the REAL `/api/management-reports/generate` router behind
 * REAL auth, hits the REAL repository query, and asserts against Postgres
 * directly — no mocks. aiEnhancement is left off (generateAiNarrative()
 * short-circuits when falsy — see managementReportsService.ts) so this proves
 * only the two RED #4 bugs, not the separate AI-narrative path already
 * covered by aiExecutiveReporting.e2e.test.ts.
 *
 * Bug #1 is proven via a TEAM_WEEKLY/PROJECT report (not PORTFOLIO_HEALTH)
 * deliberately: generatePortfolioHealthReport() also calls
 * getRiskStatistics(), which queries a `risk_register` table that does not
 * exist at all on the live parity schema (`relation "risk_register" does not
 * exist`) — a THIRD, unrelated pre-existing bug (schema drift, not a RED #4
 * item; flagged separately). TEAM_WEEKLY only exercises tasks/initiatives/
 * decisions (all present) and was itself one of the 3 types the old 2-value
 * CHECK rejected, so it isolates bug #1 cleanly. Bug #2 is proven directly
 * against the repository method (below), independent of which report type
 * calls it.
 */
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

async function buildManagementReportsApp(): Promise<Express> {
  const managementReportsRouter = (
    await import('../../server/src/routes/managementReports.routes.js')
  ).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/management-reports', managementReportsRouter as unknown as express.RequestHandler);
  return app;
}

const PROJECT_ID = 'odbior--mgmt--project-0001';
const TASK_ID_A = 'odbior--mgmt--task-0001';
const TASK_ID_B = 'odbior--mgmt--task-0002';

let app: Express;
let token: string;
const createdReportIds: string[] = [];

beforeAll(async () => {
  await seed(); // idempotent — safe if runner already seeded

  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, is_closed)
       VALUES ($1, $2, 'Odbior Mgmt RED4 Project', 'active', $3, 0)
       ON CONFLICT (id) DO UPDATE SET is_closed = 0, status = 'active'`,
      [PROJECT_ID, SEED.ORG_ID, SEED.USER_ID]
    );
    // Two tasks with genuine numeric-string progress ('40'/'80') — proves the
    // CAST path handles real data, not just the all-NULL rows already on the
    // shared parity DB.
    await client.query(
      `INSERT INTO tasks (id, project_id, organization_id, title, status, progress)
       VALUES
         ($1, $3, $4, 'RED4 task A', 'in_progress', '40'),
         ($2, $3, $4, 'RED4 task B', 'DONE', '80')
       ON CONFLICT (id) DO UPDATE SET progress = EXCLUDED.progress, status = EXCLUDED.status`,
      [TASK_ID_A, TASK_ID_B, PROJECT_ID, SEED.ORG_ID]
    );
  } finally {
    await client.end();
  }

  app = await buildManagementReportsApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdReportIds.length > 0) {
      await client.query('DELETE FROM management_reports WHERE id = ANY($1)', [
        createdReportIds,
      ]);
    }
    // ON DELETE CASCADE (tasks_project_id_fkey) removes the two tasks too.
    await client.query('DELETE FROM projects WHERE id = $1', [PROJECT_ID]);
  } finally {
    await client.end();
  }
});

describe('Acceptance: RED #4 — management_reports CHECK + getBasicTaskMetrics AVG(TEXT)', () => {
  it('odbior--mgmt--TEAM_WEEKLY generation succeeds (was 500 on the CHECK constraint)', async () => {
    const res = await request(app)
      .post('/api/management-reports/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reportType: 'TEAM_WEEKLY',
        scope: 'PROJECT',
        projectId: PROJECT_ID,
        organizationId: SEED.ORG_ID,
        aiEnhancement: false,
      });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);

    const report = res.body?.report;
    expect(report?.id).toBeTruthy();
    createdReportIds.push(report.id);

    // Bug #1 proof: the row actually persisted with a report_type the old
    // 2-value CHECK ('TEAM_MEETING', 'STEERING_COMMITTEE' only) would have
    // rejected outright with a CHECK-violation 500.
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT report_type, organization_id, project_id FROM management_reports WHERE id = $1`,
        [report.id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].report_type).toBe('TEAM_WEEKLY');
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(rows[0].project_id).toBe(PROJECT_ID);
    } finally {
      await client.end();
    }
  });

  it('odbior--mgmt--getBasicTaskMetrics returns a numeric avgProgress for a project with tasks', async () => {
    const { default: managementReportRepository } = await import(
      '../../server/src/repositories/ManagementReportRepository.js'
    );

    const metrics = await managementReportRepository.getBasicTaskMetrics(PROJECT_ID);

    expect(Number(metrics.totalTasks)).toBe(2);
    expect(Number(metrics.completedTasks)).toBe(1);
    // (40 + 80) / 2 = 60 — proves the CAST actually averages real values,
    // not just avoids throwing.
    expect(Number(metrics.avgProgress)).toBe(60);
  });
});
