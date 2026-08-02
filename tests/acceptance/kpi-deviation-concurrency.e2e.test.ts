import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import { getDatabase } from '../../server/src/database/Database.js';
import { handleTimeSeriesRecorded } from '../../server/src/services/results/kpiDeviationService.js';
import { pgClient } from './harness.js';
import { SEED } from './seed.mjs';

const KPI_ID = 'odbior--res05--kpi';
const PERIOD_START = '2026-08-01';

beforeAll(async () => {
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

    const resultsRouter = (await import('../../server/src/routes/v8/results.routes.js')).default;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = {
        id: SEED.USER_ID,
        organizationId: SEED.ORG_ID,
        role: SEED.ROLE,
      };
      (req as any).v8Context = {
        organizationId: SEED.ORG_ID,
        userId: SEED.USER_ID,
        userRole: SEED.ROLE,
        isSuperAdmin: false,
      };
      next();
    });
    app.use('/api/v8/results', resultsRouter);

    await request(app).post(`/api/v8/results/deviation-cases/${caseId}/acknowledge`).expect(200);
    await request(app)
      .put(`/api/v8/results/deviation-cases/${caseId}/rca`)
      .send({ rcaText: 'Confirmed capacity bottleneck' })
      .expect(200);
    const actionResponse = await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/actions`)
      .send({ title: 'Restore delivery capacity', ownerUserId: SEED.USER_ID })
      .expect(200);
    const actionId = String(actionResponse.body.data.id);
    await request(app)
      .put(`/api/v8/results/deviation-cases/${caseId}/actions/${actionId}`)
      .send({ status: 'DONE' })
      .expect(200);
    await request(app).post(`/api/v8/results/deviation-cases/${caseId}/resolve`).expect(200);
    await request(app)
      .post(`/api/v8/results/deviation-cases/${caseId}/close`)
      .send({
        evidenceText: 'Capacity restored and corrective action completed',
        evidenceRef: 'acceptance://RES-05',
        resolutionNotes: 'Verified through governed lifecycle acceptance',
      })
      .expect(200);

    const readback = pgClient();
    await readback.connect();
    try {
      const row = await readback.query(
        `SELECT id, status, severity, rca_text, evidence_text, evidence_ref, closed_by
         FROM kpi_deviation_cases WHERE id = $1`,
        [caseId]
      );
      expect(row.rows[0]).toMatchObject({
        id: caseId,
        status: 'CLOSED',
        severity: 'RED',
        rca_text: 'Confirmed capacity bottleneck',
        evidence_text: 'Capacity restored and corrective action completed',
        evidence_ref: 'acceptance://RES-05',
        closed_by: SEED.USER_ID,
      });
      const action = await readback.query(
        'SELECT id, case_id, status, owner_user_id FROM kpi_deviation_actions WHERE id = $1',
        [actionId]
      );
      expect(action.rows[0]).toMatchObject({
        id: actionId,
        case_id: caseId,
        status: 'DONE',
        owner_user_id: SEED.USER_ID,
      });
      const audit = await readback.query(
        `SELECT event_type, section, actor_user_id, before_json, after_json
         FROM kpi_metric_audit_log
         WHERE organization_id = $1 AND kpi_id = $2
         ORDER BY created_at`,
        [SEED.ORG_ID, KPI_ID]
      );
      expect(audit.rows).toHaveLength(15);
      expect(audit.rows.every((entry) => entry.section === 'deviation_case')).toBe(true);
      const eventTypes = audit.rows.map((entry) => entry.event_type);
      expect(eventTypes.filter((event) => event === 'deviation_case_upserted')).toHaveLength(9);
      expect(eventTypes).toEqual(
        expect.arrayContaining([
          'deviation_case_acknowledged',
          'deviation_case_rca_updated',
          'deviation_case_action_created',
          'deviation_case_action_updated',
          'deviation_case_resolved',
          'deviation_case_closed',
        ])
      );
      const lifecycleAudit = audit.rows.filter(
        (entry) => entry.event_type !== 'deviation_case_upserted'
      );
      expect(lifecycleAudit.every((entry) => entry.actor_user_id === SEED.USER_ID)).toBe(true);
      expect(lifecycleAudit.every((entry) => JSON.parse(entry.after_json).caseId === caseId)).toBe(
        true
      );
      expect(
        lifecycleAudit
          .filter((entry) => entry.event_type !== 'deviation_case_action_created')
          .every((entry) => entry.before_json != null)
      ).toBe(true);
    } finally {
      await readback.end();
    }
  }, 30_000);
});
