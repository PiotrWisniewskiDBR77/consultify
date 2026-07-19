/**
 * Acceptance E2E — RED-C W4 (odbiór 2026-07-19): DEPRECATED router
 * `/api/assessment-workflow` (server/src/routes/assessment/assessment-workflow.routes.ts,
 * NIE -v2) jest wciąż zamontowany w Gateway.ts i wołany przez żywe FE
 * komponenty (WorkflowStatusBar, VersionHistoryPanel, AxisCommentsPanel,
 * SubmitForReviewModal, useAssessmentWorkflow, useAssessmentCollaboration,
 * MultiFrameworkStageGateModal, src/services/api.ts) — 0 grep-trafień na
 * `/api/assessment-workflow-v2` w tych plikach, więc router jest ŻYWY, nie
 * osierocony.
 *
 * Dwa bugi naprawione migracją 20260719_red_assessdep_workflow_schema_fixes.sql:
 *  1) assessment_workflows.organization_id był INTEGER (odziedziczone z
 *     martwej migracji 010_assessment_workflow.sql.sql, powielone w
 *     20260716_odbior_500_fixes.sql), a kod pisze/czyta tekstowe org-id
 *     (req.user.organizationId, np. `odbior--org-0001`) → Postgres 22P02 na
 *     KAŻDYM endpoincie tego routera. Fix: kolumna → TEXT (tabela pusta,
 *     lossless cast).
 *  2) GET /api/assessment-workflow-v2/:assessmentId/initiative-batches czytał
 *     b.methodology_id / b.include_chat_context / b.generated_by — kolumny,
 *     których nie ma w żywym schemacie (migracje 293/505/512 nigdy nie
 *     odpaliły — numeracja poza regexem DatabaseInitializer). Fix: kolumny
 *     dodane addytywnie.
 *
 * Real runtime: REALNY router za REALNYM verifyToken (oba routery montują
 * verifyToken same w sobie), REALNA lokalna baza (DATABASE_URL musi być
 * localhost — wymuszone przez harness.requireLocalDbUrl()).
 *
 * Izolacja: prefiks `odbior--awdep--`. Sprzątanie w afterAll. NIE push.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--awdep--';

function evidence(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

async function buildDeprecatedApp(): Promise<Express> {
  const deprecatedRouter = (
    await import('../../server/src/routes/assessment/assessment-workflow.routes.js')
  ).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assessment-workflow', deprecatedRouter);
  return app;
}

async function buildV2App(): Promise<Express> {
  const v2Router = (await import('../../server/src/routes/assessment-workflow-v2.routes.js'))
    .default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assessment-workflow-v2', v2Router);
  return app;
}

let depApp: Express;
let v2App: Express;
let token: string;

const createdAssessmentIds: string[] = [];
const createdWorkflowIds: string[] = [];

beforeAll(async () => {
  requireLocalDbUrl();
  await seed(); // idempotent — org/user/membership odbioru
  depApp = await buildDeprecatedApp();
  v2App = await buildV2App();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdWorkflowIds.length) {
      await client
        .query('DELETE FROM assessment_reviews WHERE workflow_id = ANY($1)', [
          createdWorkflowIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM assessment_workflows WHERE id = ANY($1)', [createdWorkflowIds])
        .catch(() => {});
    }
    if (createdAssessmentIds.length) {
      await client
        .query('DELETE FROM assessment_initiative_batches WHERE assessment_id = ANY($1)', [
          createdAssessmentIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM assessment_workflows WHERE assessment_id = ANY($1)', [
          createdAssessmentIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM assessments WHERE id = ANY($1)', [createdAssessmentIds])
        .catch(() => {});
    }
  } finally {
    await client.end();
  }
}, 30_000);

describe('RED-C W4 — DEPRECATED /api/assessment-workflow (non -v2) real router + auth + DB', () => {
  let assessmentId: string;

  it('creates an assessment via the live v2 create endpoint (fixture for the deprecated router)', async () => {
    const createRes = await request(v2App)
      .post('/api/assessment-workflow-v2')
      .set('Authorization', `Bearer ${token}`)
      .send({ assessmentType: 'SIRI', name: `${PREFIX}fixture-assessment` });

    expect(createRes.status).toBe(200);
    assessmentId = createRes.body?.id;
    expect(assessmentId).toBeTruthy();
    createdAssessmentIds.push(assessmentId);
    evidence(`[awdep] fixture assessments.id=${assessmentId}`);
  });

  it('GET /:assessmentId/status does NOT 500 before a workflow row exists (default DRAFT response)', async () => {
    const res = await request(depApp)
      .get(`/api/assessment-workflow/${assessmentId}/status`)
      .set('Authorization', `Bearer ${token}`);

    evidence(`[awdep] GET status (pre-init) -> ${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('DRAFT');
    expect(res.body?.organizationId).toBe(SEED.ORG_ID);
  });

  it('POST /:assessmentId/initialize does NOT 500 on the organization_id INTEGER/TEXT mismatch (22P02)', async () => {
    const res = await request(depApp)
      .post(`/api/assessment-workflow/${assessmentId}/initialize`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    evidence(`[awdep] POST initialize -> ${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(201);
    expect(res.body?.id).toBeTruthy();
    expect(res.body?.organizationId).toBe(SEED.ORG_ID);
    createdWorkflowIds.push(res.body.id);
  });

  it('GET /:assessmentId/status round-trips the persisted TEXT organization_id after initialize', async () => {
    const res = await request(depApp)
      .get(`/api/assessment-workflow/${assessmentId}/status`)
      .set('Authorization', `Bearer ${token}`);

    evidence(`[awdep] GET status (post-init) -> ${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(200);
    expect(res.body?.organizationId).toBe(SEED.ORG_ID);
    expect(res.body?.status).toBe('DRAFT');

    // Direct DB proof: organization_id column is TEXT and holds the real org id.
    const client = pgClient();
    await client.connect();
    try {
      const dbRes = await client.query(
        `SELECT organization_id, pg_typeof(organization_id) as col_type
         FROM assessment_workflows WHERE assessment_id = $1`,
        [assessmentId]
      );
      expect(dbRes.rows).toHaveLength(1);
      expect(dbRes.rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(dbRes.rows[0].col_type).toBe('text');
      evidence(
        `[awdep] DB proof — assessment_workflows.organization_id=${dbRes.rows[0].organization_id} (${dbRes.rows[0].col_type})`
      );
    } finally {
      await client.end();
    }
  });

  it('GET /api/assessment-workflow-v2/:assessmentId/initiative-batches does NOT 500 on missing columns (42703)', async () => {
    const res = await request(v2App)
      .get(`/api/assessment-workflow-v2/${assessmentId}/initiative-batches`)
      .set('Authorization', `Bearer ${token}`);

    evidence(`[awdep] GET initiative-batches -> ${res.status} ${JSON.stringify(res.body)}`);
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.batches)).toBe(true);
  });
});
