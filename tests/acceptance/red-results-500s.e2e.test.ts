/**
 * RED-RESULTS — regression guard for 500s in the results-non-v8 +
 * finance-enterprise + value/roi rewir.
 *
 * ŁOWCA RED (2026-07-19). Discovery probe over every GET endpoint (and the
 * top-level create endpoints) of
 *   results-enterprise · results-kpi-reports · resultsValueIntelligence ·
 *   resultsStrategic · resultsDriverTree · resultsExtended · finance-enterprise
 * (real routers + real verifyToken + real Postgres PARITY :5443, zero mocks).
 *
 * Result of the sweep:
 *   - ALL ~39 GET endpoints: non-5xx (200 or a legitimate 404 gate). The parity
 *     schema (dumped from TROLLEY/demo) carries every table/column the read
 *     paths need — the rewir is GREEN for schema drift (42P01/42703/42804).
 *   - ALL top-level create POSTs: 201, EXCEPT one 500:
 *
 *       endpoint                       code   root cause
 *       POST /api/results/kpi-reports  (n/a)  ReportBuilderService.createReport
 *                                             ({sourceType:'RESULTS_KPI_REPORT'})
 *                                             -> getTemplateForSource finds NO
 *                                             template for that source_type (0
 *                                             rows for any org) and the fallback
 *                                             list only covers UPLOAD_BUNDLE /
 *                                             WORK_CANVAS -> hard-throws
 *                                             'No template found for this source
 *                                             type' -> 500 for EVERY org.
 *
 * NOT a PG schema code — it is a missing seed-data + no-fallback defect. The
 * route writes exactly five section keys (executive_summary, kpi_overview,
 * deviation_cases, action_plan, appendix), so the fix seeds the global default
 * template the route already expects:
 *   server/migrations/20260719_red_results_kpi_report_template.sql
 * (additive, idempotent; picked up by the DatabaseInitializer autorun that
 *  matches /^(7\d{2}|\d{8})_.*\.sql$/).
 *
 * This test applies the migration idempotently, asserts the whole GET rewir is
 * non-5xx, and asserts POST /api/results/kpi-reports + its :snapshotId/refresh
 * are now 200. Reverting the migration turns the two POSTs back into 500.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PID = 'odbior--redres--proj1';

let token: string;
let app: Express;

const MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../server/migrations/20260719_red_results_kpi_report_template.sql'
);

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  const org = SEED.ORG_ID;
  const del = (t: string) =>
    c.query(`DELETE FROM ${t} WHERE organization_id = $1`, [org]).catch(() => {});
  try {
    await del('results_kpi_report_snapshots');
    await del('report_builder_report_sections');
    await del('report_builder_reports');
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();

  // Apply the RED-RESULTS migration idempotently (mirrors the autorun on boot).
  const c = pgClient();
  await c.connect();
  try {
    await c.query(readFileSync(MIGRATION, 'utf8'));
  } finally {
    await c.end();
  }

  token = mintToken();

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const resultsEnterprise = (await import('../../server/src/routes/results-enterprise.routes.js')).default;
  const resultsKpiReports = (await import('../../server/src/routes/results-kpi-reports.routes.js')).default;
  const resultsValueIntelligence = (await import('../../server/src/routes/resultsValueIntelligence.routes.js')).default;
  const resultsStrategic = (await import('../../server/src/routes/resultsStrategic.routes.js')).default;
  const resultsDriverTree = (await import('../../server/src/routes/resultsDriverTree.routes.js')).default;
  const resultsExtended = (await import('../../server/src/routes/resultsExtended.routes.js')).default;
  const financeEnterprise = (await import('../../server/src/routes/finance-enterprise.routes.js')).default;

  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/results-v4', verifyToken as any, resultsEnterprise);
  app.use('/api/results', verifyToken as any, resultsKpiReports);
  app.use('/api/results-value', verifyToken as any, resultsValueIntelligence);
  app.use('/api/results-strategic', verifyToken as any, resultsStrategic);
  app.use('/api/results-driver-tree', verifyToken as any, resultsDriverTree);
  app.use('/api/results-extended', verifyToken as any, resultsExtended);
  app.use('/api/finance-v4', verifyToken as any, financeEnterprise);
}, 60_000);

afterAll(cleanup);

const authGet = (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`);
const authPost = (p: string, body: any) =>
  request(app).post(p).set('Authorization', `Bearer ${token}`).send(body);

const GETS = [
  '/api/results-v4/kpi-connectors',
  '/api/results-v4/kpi-connectors/redres--x/ingestion-log',
  '/api/results-v4/roi-evidence',
  '/api/results-v4/kpi-report-schedules',
  '/api/results-v4/kpi-report-schedules/redres--x/delivery-log',
  '/api/results-v4/wallboards',
  '/api/results-v4/wallboards/redres--x/alerts',
  '/api/results/metrics-semantic-layer',
  '/api/results/kpi-definitions',
  '/api/results/kpi-reports',
  `/api/results-value/${PID}/value-intelligence`,
  `/api/results-strategic/${PID}/strategic`,
  `/api/results-strategic/${PID}/okr`,
  `/api/results-driver-tree/${PID}/driver-tree`,
  `/api/results-extended/${PID}/signals`,
  `/api/results-extended/${PID}/run-rate`,
  `/api/results-extended/${PID}/reallocation`,
  `/api/results-extended/${PID}/adoption`,
  `/api/results-extended/${PID}/sustainment`,
  `/api/results-extended/${PID}/scenarios`,
  `/api/results-extended/${PID}/counterfactual`,
  `/api/results-extended/${PID}/finance-link`,
  `/api/results-extended/${PID}/benefit-profiles`,
  `/api/results-extended/${PID}/narrative`,
  `/api/results-extended/${PID}/funnel`,
  '/api/finance-v4/dimensions',
  '/api/finance-v4/models/redres--m/versions',
  '/api/finance-v4/models/redres--m/allocations',
  '/api/finance-v4/consolidations',
  '/api/finance-v4/models/redres--m/budgets',
  '/api/finance-v4/budgets/redres--b/variance-alerts',
  '/api/finance-v4/connectors',
  '/api/finance-v4/connectors/redres--c/sync-log',
  '/api/finance-v4/models/redres--m/valuations',
  '/api/finance-v4/valuations/redres--s/audit',
  '/api/finance-v4/models/redres--m/ai-assumptions',
  '/api/finance-v4/models/redres--m/roi-links',
];

describe('RED-RESULTS: read rewir is green (no schema-500)', () => {
  it('every GET endpoint responds non-5xx', async () => {
    for (const p of GETS) {
      const res = await authGet(p);
      expect(res.status, `${p} -> ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`).toBeLessThan(500);
    }
  }, 120_000);
});

describe('RED-RESULTS: POST /kpi-reports 500 is fixed (missing RESULTS_KPI_REPORT template seeded)', () => {
  it('POST /api/results/kpi-reports returns 200 (was 500: No template found for this source type)', async () => {
    const res = await authPost('/api/results/kpi-reports', { periodStart: '2026-01-01' });
    expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.snapshotId).toBeTruthy();
    expect(res.body?.data?.reportId).toBeTruthy();
  }, 60_000);

  it('POST /api/results/kpi-reports/:snapshotId/refresh returns 200 (same template path)', async () => {
    const create = await authPost('/api/results/kpi-reports', { periodStart: '2026-02-01' });
    expect(create.status).toBe(200);
    const snapshotId = create.body?.data?.snapshotId;
    expect(snapshotId).toBeTruthy();

    const refresh = await authPost(`/api/results/kpi-reports/${snapshotId}/refresh`, {});
    expect(refresh.status, JSON.stringify(refresh.body).slice(0, 200)).toBe(200);
    expect(refresh.body?.data?.reportId).toBeTruthy();
  }, 60_000);
});
