import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import { getDatabase } from '../../server/src/database/Database.js';
import { handleTimeSeriesRecorded } from '../../server/src/services/results/kpiDeviationService.js';
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const KPI_ID = 'odbior--res05--kpi';
const PERIOD_START = '2026-08-01';
const VNEXT_KPI_ID = randomUUID();
const VNEXT_DEFINITION_ID = randomUUID();
const VNEXT_MEASUREMENT_ID = randomUUID();
const VNEXT_CASE_ID = randomUUID();
const VNEXT_POLICY_ID = randomUUID();
const REVIEWER_ID = `odbior--res05--reviewer-${VNEXT_CASE_ID}`;
let reviewerToken: string;

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM kpi_metric_audit_log WHERE kpi_id = $1', [KPI_ID]);
    await client.query(
      'DELETE FROM kpi_deviation_actions WHERE case_id IN (SELECT id FROM kpi_deviation_cases WHERE kpi_id = $1)',
      [KPI_ID]
    );
    await client.query('DELETE FROM kpi_deviation_cases WHERE kpi_id = $1', [KPI_ID]);
    await client.query('DELETE FROM initiative_kpis WHERE id = $1', [KPI_ID]);
    await client.query(
      `INSERT INTO initiative_kpis
         (id, organization_id, name, target_value, direction, threshold_mode,
          amber_threshold_pct, red_threshold_pct)
       VALUES ($1, $2, 'RES-05 concurrency KPI', 100, 'HIGHER_IS_BETTER',
               'PERCENT_FROM_TARGET', 0.10, 0.20)`,
      [KPI_ID, SEED.ORG_ID]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'x','ADMIN','active','RES05','Reviewer',CURRENT_TIMESTAMP)`,
      [REVIEWER_ID, SEED.ORG_ID, `${REVIEWER_ID}@acceptance.local`]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE',CURRENT_TIMESTAMP)`,
      [`${REVIEWER_ID}-membership`, SEED.ORG_ID, REVIEWER_ID]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by)
       VALUES ($1,$2,$3,'active',$4,$4)`,
      [VNEXT_KPI_ID, SEED.ORG_ID, `RES05-${VNEXT_KPI_ID}`, SEED.USER_ID]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id,kpi_id,organization_id,version_number,name,target_geometry,
          target_value,warning_low,critical_low,approval_status,effective_from,created_by,
          submitted_by,submitted_at,approved_by,approved_at)
       VALUES ($1,$2,$3,1,'RES-05 canonical KPI','threshold_min',100,90,80,'approved',
               CURRENT_TIMESTAMP,$4,$4,CURRENT_TIMESTAMP,$5,CURRENT_TIMESTAMP)`,
      [VNEXT_DEFINITION_ID, VNEXT_KPI_ID, SEED.ORG_ID, SEED.USER_ID, REVIEWER_ID]
    );
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id=$1 WHERE kpi_id=$2`,
      [VNEXT_DEFINITION_ID, VNEXT_KPI_ID]
    );
    await client.query(
      `INSERT INTO rvn_kpi_measurements
         (measurement_id,kpi_id,definition_version_id,organization_id,period_start,period_end,
          actual_value,performance_status,data_quality_status,source,recorded_by)
       VALUES ($1,$2,$3,$4,'2026-08-01','2026-08-31',70,'critical','verified','acceptance',$5)`,
      [VNEXT_MEASUREMENT_ID, VNEXT_KPI_ID, VNEXT_DEFINITION_ID, SEED.ORG_ID, SEED.USER_ID]
    );
    await client.query(
      `INSERT INTO rvn_kpi_deviation_cases
         (case_id,organization_id,kpi_id,trigger_measurement_id,severity,status,
          owner_user_id,manager_user_id,created_by)
       VALUES ($1,$2,$3,$4,'critical','open',$5,$6,$5)`,
      [VNEXT_CASE_ID, SEED.ORG_ID, VNEXT_KPI_ID, VNEXT_MEASUREMENT_ID, SEED.USER_ID, REVIEWER_ID]
    );
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (policy_id,organization_id,domain,policy_version,visibility_mode,created_by)
       VALUES ($1,$2,$3,1,'OPEN_ORG',$4)`,
      [VNEXT_POLICY_ID, SEED.ORG_ID, `res05-${VNEXT_CASE_ID}`, SEED.USER_ID]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type,resource_id,organization_id,visibility_mode,policy_id,owner_user_id)
       VALUES ('kpi',$1,$2,'OPEN_ORG',$3,$4)`,
      [VNEXT_KPI_ID, SEED.ORG_ID, VNEXT_POLICY_ID, SEED.USER_ID]
    );
    reviewerToken = mintToken({
      id: REVIEWER_ID,
      email: `${REVIEWER_ID}@acceptance.local`,
      role: 'ADMIN',
    });
  } finally {
    await client.end();
  }
});

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM kpi_metric_audit_log WHERE kpi_id = $1', [KPI_ID]);
    await client.query(
      'DELETE FROM kpi_deviation_actions WHERE case_id IN (SELECT id FROM kpi_deviation_cases WHERE kpi_id = $1)',
      [KPI_ID]
    );
    await client.query('DELETE FROM kpi_deviation_cases WHERE kpi_id = $1', [KPI_ID]);
    await client.query('DELETE FROM initiative_kpis WHERE id = $1', [KPI_ID]);
  } finally {
    await client.end();
  }
});

describe('RES-05 deviation case concurrency', () => {
  it('coalesces concurrent RED measurements and audits the full governed lifecycle', async () => {
    const db = await getDatabase();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        handleTimeSeriesRecorded({
          db,
          orgId: SEED.ORG_ID,
          kpiId: KPI_ID,
          value: 70 - index,
          periodStart: PERIOD_START,
          periodEnd: '2026-08-31',
        })
      )
    );

    const ids = new Set(results.map((result) => result.createdOrUpdatedCaseId));
    expect(ids.size).toBe(1);
    const caseId = String(results[0].createdOrUpdatedCaseId);
    expect(caseId).toBeTruthy();

    const client = pgClient();
    await client.connect();
    try {
      const persisted = await client.query(
        `SELECT id, status, severity, organization_id, kpi_id, period_start
         FROM kpi_deviation_cases
         WHERE organization_id = $1 AND kpi_id = $2 AND period_start = $3`,
        [SEED.ORG_ID, KPI_ID, PERIOD_START]
      );
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0]).toMatchObject({
        id: caseId,
        status: 'OPEN',
        severity: 'RED',
        organization_id: SEED.ORG_ID,
        kpi_id: KPI_ID,
      });

      await client.query(
        `UPDATE kpi_deviation_cases
         SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [caseId]
      );
    } finally {
      await client.end();
    }

    const reopened = await handleTimeSeriesRecorded({
      db,
      orgId: SEED.ORG_ID,
      kpiId: KPI_ID,
      value: 65,
      periodStart: PERIOD_START,
      periodEnd: '2026-08-31',
    });
    expect(reopened.createdOrUpdatedCaseId).toBe(caseId);

    const resultsRouter = (await import('../../server/src/routes/resultsVnext/kpiDeviation.routes.js')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/vnext/results/kpi/deviation-cases', resultsRouter);
    const ownerToken = mintToken();

    const acknowledged = await request(app)
      .post(`/api/vnext/results/kpi/deviation-cases/${VNEXT_CASE_ID}/acknowledge`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedVersion: 1 })
      .expect(200);
    expect(acknowledged.body.case.status).toBe('analysis_required');
    const rootCause = await request(app)
      .put(`/api/vnext/results/kpi/deviation-cases/${VNEXT_CASE_ID}/root-cause`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        expectedVersion: acknowledged.body.resultingVersion,
        rootCauseSummary: 'Confirmed capacity bottleneck',
        rootCauseCategory: 'capacity',
      })
      .expect(200);
    const actionResponse = await request(app)
      .post(`/api/vnext/results/kpi/deviation-cases/${VNEXT_CASE_ID}/corrective-actions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Restore delivery capacity', ownerUserId: SEED.USER_ID })
      .expect(201);
    const actionId = String(actionResponse.body.action.actionId);
    const submitted = await request(app)
      .post(`/api/vnext/results/kpi/deviation-cases/${VNEXT_CASE_ID}/plan/submit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedVersion: rootCause.body.resultingVersion })
      .expect(200);
    const approved = await request(app)
      .post(`/api/vnext/results/kpi/deviation-cases/${VNEXT_CASE_ID}/plan/approve`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ expectedVersion: submitted.body.resultingVersion })
      .expect(200);
    expect(approved.body.case.status).toBe('approved');

    const readback = pgClient();
    await readback.connect();
    try {
      const row = await readback.query(
        `SELECT case_id,status,severity,root_cause_summary,plan_submitted_by,plan_approved_by
           FROM rvn_kpi_deviation_cases WHERE case_id=$1`,
        [VNEXT_CASE_ID]
      );
      expect(row.rows[0]).toMatchObject({
        case_id: VNEXT_CASE_ID,
        status: 'approved',
        severity: 'critical',
        root_cause_summary: 'Confirmed capacity bottleneck',
        plan_submitted_by: SEED.USER_ID,
        plan_approved_by: REVIEWER_ID,
      });
      const action = await readback.query(
        'SELECT action_id,deviation_case_id,status,owner_user_id FROM rvn_kpi_corrective_actions WHERE action_id=$1',
        [actionId]
      );
      expect(action.rows[0]).toMatchObject({
        action_id: actionId,
        deviation_case_id: VNEXT_CASE_ID,
        status: 'planned',
        owner_user_id: SEED.USER_ID,
      });
      const audit = await readback.query(
        `SELECT event_type,actor_user_id,resulting_version
           FROM rvn_platform_events
          WHERE organization_id=$1 AND aggregate_id=$2
          ORDER BY resulting_version`,
        [SEED.ORG_ID, VNEXT_CASE_ID]
      );
      const eventTypes = audit.rows.map((entry) => entry.event_type);
      expect(eventTypes).toEqual(
        expect.arrayContaining([
          'kpi.deviation_corrective_action_added',
          'kpi.deviation_acknowledged',
          'kpi.deviation_root_cause_submitted',
          'kpi.deviation_corrective_plan_submitted',
          'kpi.deviation_corrective_plan_approved',
        ])
      );
      expect(audit.rows).toHaveLength(5);
      expect(audit.rows.at(-1)?.actor_user_id).toBe(REVIEWER_ID);
    } finally {
      await readback.end();
    }
  }, 30_000);
});
