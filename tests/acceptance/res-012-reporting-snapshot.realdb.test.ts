import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const KPI_ID = 'res12-kpi';
const FOREIGN_KPI_ID = 'res12-foreign-kpi';
const FOREIGN_ORG_ID = 'res12-foreign-org';
const FOREIGN_USER_ID = 'res12-foreign-user';
const FOREIGN_EMAIL = 'res12-foreign@acceptance.local';
const FOREIGN_MEMBER_ID = 'res12-foreign-member';
const MEASUREMENT_ID = 'res12-measurement';
const OUTSIDE_MEASUREMENT_ID = 'res12-outside-measurement';
const INITIATIVE_ID = 'res12-initiative';
const FOREIGN_INITIATIVE_ID = 'res12-foreign-initiative';
const PREFIX = 'RES-12 immutable report';

let app: Express;
let token: string;
let snapshotV1 = '';
let reportV1 = '';

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const reportRows = await client.query(
      `SELECT id FROM report_builder_reports WHERE title LIKE $1 AND organization_id = $2`,
      [`${PREFIX}%`, SEED.ORG_ID]
    );
    const reportIds = reportRows.rows.map((row) => row.id);
    if (reportIds.length) {
      await client.query(`DELETE FROM report_builder_sections WHERE report_id = ANY($1::text[])`, [
        reportIds,
      ]);
      await client.query(`DELETE FROM report_builder_activity WHERE report_id = ANY($1::text[])`, [
        reportIds,
      ]);
      await client.query(`DELETE FROM report_builder_reports WHERE id = ANY($1::text[])`, [
        reportIds,
      ]);
    }
    await client.query(`DELETE FROM results_kpi_report_snapshots WHERE title LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await client.query(`DELETE FROM kpi_time_series WHERE id IN ($1, $2)`, [
      MEASUREMENT_ID,
      OUTSIDE_MEASUREMENT_ID,
    ]);
    await client.query(`DELETE FROM initiative_kpis WHERE id IN ($1, $2)`, [
      KPI_ID,
      FOREIGN_KPI_ID,
    ]);
    await client.query(`DELETE FROM initiatives WHERE id IN ($1, $2)`, [
      INITIATIVE_ID,
      FOREIGN_INITIATIVE_ID,
    ]);
    await client.query(`DELETE FROM organization_members WHERE id = $1`, [FOREIGN_MEMBER_ID]);
    await client.query(`DELETE FROM users WHERE id = $1`, [FOREIGN_USER_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  await cleanup();

  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, status, created_at)
       VALUES ($1, 'RES-12 foreign org', 'active', NOW())`,
      [FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'acceptance-only', 'ADMIN', 'active', 'RES-12', 'Foreign', NOW())`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, FOREIGN_EMAIL]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', NOW())`,
      [FOREIGN_MEMBER_ID, FOREIGN_ORG_ID, FOREIGN_USER_ID]
    );
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, title, status, created_at, updated_at)
       VALUES
         ($1, $2, 'RES-12 initiative', 'RES-12 initiative', 'DRAFT', NOW(), NOW()),
         ($3, $4, 'RES-12 foreign initiative', 'RES-12 foreign initiative', 'DRAFT', NOW(), NOW())`,
      [INITIATIVE_ID, SEED.ORG_ID, FOREIGN_INITIATIVE_ID, FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO initiative_kpis
         (id, initiative_id, organization_id, name, unit, baseline_value, target_value, current_value,
          measurement_frequency, direction, owner_user_id, created_at, updated_at)
       VALUES
         ($1, $2, $3, 'RES-12 OEE', '%', 30, 80, 40, 'MONTHLY', 'HIGHER_IS_BETTER', $4, NOW(), NOW()),
         ($5, $6, $7, 'Foreign KPI', '%', 0, 100, 10, 'MONTHLY', 'HIGHER_IS_BETTER', NULL, NOW(), NOW())`,
      [
        KPI_ID,
        INITIATIVE_ID,
        SEED.ORG_ID,
        SEED.USER_ID,
        FOREIGN_KPI_ID,
        FOREIGN_INITIATIVE_ID,
        FOREIGN_ORG_ID,
      ]
    );
    await client.query(
      `INSERT INTO kpi_time_series
         (id, kpi_id, organization_id, value, period_start, source, recorded_by, created_at)
       VALUES
         ($1, $2, $3, 40, '2026-02-15', 'manual', $4, NOW()),
         ($5, $2, $3, 99, '2026-03-15', 'manual', $4, NOW() + INTERVAL '1 minute')`,
      [MEASUREMENT_ID, KPI_ID, SEED.ORG_ID, SEED.USER_ID, OUTSIDE_MEASUREMENT_ID]
    );
  } finally {
    await client.end();
  }

  token = mintToken();
  const router = (await import('../../server/src/routes/results-kpi-reports.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/results', router);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: error?.message || 'Internal error' })
  );
});

afterAll(cleanup);

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('RES-12 — immutable KPI reporting snapshot and Report Builder lineage', () => {
  it('creates a period-bounded snapshot and a reopenable report with exact lineage', async () => {
    const response = await request(app)
      .post('/api/results/kpi-reports')
      .set(auth())
      .send({
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        title: `${PREFIX} v1`,
        kpiIds: [KPI_ID],
      });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    snapshotV1 = response.body.data.snapshotId;
    reportV1 = response.body.data.reportId;

    const reopen = await request(app).get(`/api/results/kpi-reports/${snapshotV1}`).set(auth());
    expect(reopen.status).toBe(200);
    expect(reopen.body.data.snapshot.kpis).toHaveLength(1);
    expect(reopen.body.data.snapshot.kpis[0]).toEqual(
      expect.objectContaining({ id: KPI_ID, latestValue: 40, latestMeasurementDate: '2026-02-15' })
    );

    const client = pgClient();
    await client.connect();
    try {
      const report = await client.query(
        `SELECT source_type, source_id, status FROM report_builder_reports WHERE id = $1`,
        [reportV1]
      );
      expect(report.rows[0]).toEqual({
        source_type: 'RESULTS_KPI_REPORT',
        source_id: snapshotV1,
        status: 'GENERATED',
      });
      const sections = await client.query(
        `SELECT section_key, edited_content FROM report_builder_sections
         WHERE report_id = $1 ORDER BY order_index`,
        [reportV1]
      );
      expect(sections.rows.map((row) => row.section_key)).toEqual(
        expect.arrayContaining([
          'executive_summary',
          'kpi_overview',
          'deviation_cases',
          'action_plan',
          'appendix',
        ])
      );
      expect(
        sections.rows.find((row) => row.section_key === 'kpi_overview')?.edited_content
      ).toContain('40 %');
    } finally {
      await client.end();
    }
  });

  it('keeps v1 immutable and creates v2 from the changed measurement', async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`UPDATE kpi_time_series SET value = 90 WHERE id = $1`, [MEASUREMENT_ID]);
      await client.query(`UPDATE initiative_kpis SET current_value = 90 WHERE id = $1`, [KPI_ID]);
    } finally {
      await client.end();
    }

    const oldSnapshot = await request(app)
      .get(`/api/results/kpi-reports/${snapshotV1}`)
      .set(auth());
    expect(oldSnapshot.body.data.snapshot.kpis[0].latestValue).toBe(40);

    const refreshed = await request(app)
      .post(`/api/results/kpi-reports/${snapshotV1}/refresh`)
      .set(auth())
      .send({});
    expect(refreshed.status, JSON.stringify(refreshed.body)).toBe(200);
    expect(refreshed.body.data.snapshotId).not.toBe(snapshotV1);

    const v2 = await request(app)
      .get(`/api/results/kpi-reports/${refreshed.body.data.snapshotId}`)
      .set(auth());
    expect(v2.body.data.snapshot.kpis[0].latestValue).toBe(90);
  });

  it('does not leak the snapshot or a foreign KPI across tenants', async () => {
    const foreignSnapshotRead = await request(app)
      .get(`/api/results/kpi-reports/${snapshotV1}`)
      .set(
        'Authorization',
        `Bearer ${mintToken({ id: FOREIGN_USER_ID, email: FOREIGN_EMAIL, organizationId: FOREIGN_ORG_ID, organization_id: FOREIGN_ORG_ID })}`
      );
    expect(foreignSnapshotRead.status).toBe(404);

    const foreignKpiCreate = await request(app)
      .post('/api/results/kpi-reports')
      .set(auth())
      .send({
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        title: `${PREFIX} forbidden`,
        kpiIds: [FOREIGN_KPI_ID],
      });
    expect(foreignKpiCreate.status).toBe(404);
    expect(foreignKpiCreate.body.code).toBe('RESULTS_KPI_REPORT_KPI_NOT_FOUND');
  });
});
