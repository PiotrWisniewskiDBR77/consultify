/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('Day 151 — Ocena -> Wywiad -> Wnioski -> Inicjatywy on real PostgreSQL', () => {
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
      'Day 151 Farma',
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
         (id,organization_id,name,assessment_type,status,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,'DRD','completed',$4,now(),now())`,
      [assessmentId, organizationId, 'Transformacja cyfrowa firmy farmaceutycznej', userId]
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

  afterAll(async () => {
    await pool.end();
  });

  it('measures the real break between an interview finding and conclusions', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const load = await request(app)
      .get(`/api/v8/assessment/${assessmentId}/workbench`)
      .set(auth);
    console.log('DAY151_HTTP_ASSESSMENT_LOAD', load.status, JSON.stringify(load.body));
    expect(load.status).toBe(200);

    const state = load.body.data.workbench;
    state.runState = 'completed';
    state.completedAt = new Date().toISOString();
    state.requiredEvidenceKinds = ['document', 'interview_note'];
    state.evidencePointers = [
      { id: randomUUID(), kind: 'document', ref: 'doc:farma', availability: 'ok' },
      { id: randomUUID(), kind: 'interview_note', ref: 'interview:farma', availability: 'ok' },
    ];
    state.scoreProposal = {
      id: randomUUID(), status: 'proposal', scoreValues: { readiness: 2 },
      scoringRationale: 'Zweryfikowane dokumentem i wywiadem',
      evidencePointerIds: state.evidencePointers.map((entry: { id: string }) => entry.id),
      assumptions: [], confidence: 0.8, proposedAt: new Date().toISOString(), proposedBy: userId,
    };
    state.scoreReview = { status: 'accepted', decidedAt: new Date().toISOString(), decidedBy: userId };
    state.interpretationProposal = {
      id: randomUUID(), status: 'proposal',
      summary: 'Rozproszone dane spowalniają decyzje jakościowe.',
      keyFindings: ['Brak wspólnego modelu danych'],
      limits: 'Pomiar obejmuje jeden proces jakościowy.',
      nextActions: ['Ujednolicić obieg danych jakościowych'],
      linksToScoreProposalId: state.scoreProposal.id,
      proposedAt: new Date().toISOString(), proposedBy: userId,
    };
    state.interpretationReview = { status: 'accepted', decidedAt: new Date().toISOString(), decidedBy: userId };
    await pool.query(`UPDATE assessments SET p28_workbench_v1=$1 WHERE id=$2 AND organization_id=$3`, [
      JSON.stringify(state), assessmentId, organizationId,
    ]);

    const promotion = await request(app)
      .post(`/api/v8/assessment/${assessmentId}/workbench/promotion`)
      .set(auth)
      .send({ targetKind: 'interview_insight', payloadSummary: 'Farma DRD handoff' });
    console.log('DAY151_HTTP_ASSESSMENT_TO_INTERVIEW', promotion.status, JSON.stringify(promotion.body));
    expect(promotion.status).toBe(200);

    const insight = await pool.query(
      `SELECT id,organization_id,status,title,generation_context_json
         FROM interview_insights WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );
    console.log('DAY151_SELECT_INTERVIEW', JSON.stringify(insight.rows));
    expect(insight.rows).toHaveLength(1);
    const insightId = insight.rows[0].id;

    const findingResponse = await request(app)
      .post(`/api/v8/interview/insights/${insightId}/findings`)
      .set(auth)
      .send({
        finding_statement: 'Brak wspólnego modelu danych wydłuża zwolnienie serii.',
        confidence_level: 'high',
        limits: 'Jeden proces jakościowy i jeden zakład.',
        next_action: 'Uruchomić pilotaż wspólnego obiegu danych.',
        evidence_pointers: [{
          type: 'attachment', sourceRef: 'doc:farma', sourceFingerprint: 'day151-farma',
          capturedExcerpt: 'Czas zwolnienia serii jest wydłużony przez ręczne uzgodnienia.',
        }],
      });
    console.log('DAY151_HTTP_INTERVIEW_FINDING', findingResponse.status, JSON.stringify(findingResponse.body));
    expect(findingResponse.status).toBe(201);

    const conclusionsResponse = await request(app).get('/api/conclusions').set(auth);
    console.log('DAY151_HTTP_INTERVIEW_TO_CONCLUSIONS', conclusionsResponse.status, JSON.stringify(conclusionsResponse.body));
    expect(conclusionsResponse.status).toBe(200);
    const conclusion = conclusionsResponse.body.conclusions.find(
      (entry: { sourceModule: string }) => entry.sourceModule === 'interview'
    );
    expect(conclusion).toBeUndefined();

    const conclusions = await pool.query(
      `SELECT id,organization_id,source_module,source_artifact_refs_json,status
         FROM conclusions WHERE organization_id=$1 ORDER BY created_at`,
      [organizationId]
    );
    console.log('DAY151_SELECT_CONCLUSIONS', JSON.stringify(conclusions.rows));
    expect(conclusions.rows).toHaveLength(0);
  }, 60000);

  it('measures conclusion conversion writing only to the classic initiative store', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const conclusionCreated = await request(app)
      .post('/api/conclusions')
      .set(auth)
      .send({
        title: 'Pilotaż wspólnego obiegu danych jakościowych',
        statement: 'Ręczne uzgodnienia wydłużają zwolnienie serii.',
        sourceModule: 'assessment_drd',
        sourceRefs: [{ type: 'assessment', id: assessmentId, title: 'Farma DRD' }],
        evidenceRefs: [{ type: 'attachment', ref: 'doc:farma', excerpt: 'Ręczne uzgodnienia.' }],
        confidenceLevel: 'high',
        limits: 'Jeden proces jakościowy i jeden zakład.',
        recommendedNextAction: 'Uruchomić pilotaż.',
      });
    console.log('DAY151_HTTP_CONCLUSION_CREATE', conclusionCreated.status, JSON.stringify(conclusionCreated.body));
    expect(conclusionCreated.status).toBe(201);

    const seededConclusion = await pool.query(
      `SELECT id,organization_id,source_module,source_artifact_refs_json,status
         FROM conclusions WHERE organization_id=$1 AND source_module='assessment_drd'
         ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );
    console.log('DAY151_SELECT_SEEDED_CONCLUSION', JSON.stringify(seededConclusion.rows));
    expect(seededConclusion.rows).toHaveLength(1);
    const conclusionId = seededConclusion.rows[0].id;

    const proposed = await request(app)
      .post('/api/artifact-conversions/propose')
      .set(auth)
      .send({ conclusionId, targetArtifactType: 'initiative', intent: 'Farma pilot' });
    console.log('DAY151_HTTP_CONVERSION_PROPOSE', proposed.status, JSON.stringify(proposed.body));
    expect(proposed.status).toBe(201);

    const converted = await request(app)
      .post(`/api/artifact-conversions/${proposed.body.conversion.id}/convert`)
      .set(auth);
    console.log('DAY151_HTTP_CONCLUSIONS_TO_INITIATIVE', converted.status, JSON.stringify(converted.body));
    expect(converted.status).toBe(200);
    const initiativeId = converted.body.initiative.id;

    const classic = await pool.query(
      `SELECT id,organization_id,source_type,source_id,status
         FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeId, organizationId]
    );
    const runtime = await pool.query(
      `SELECT aggregate_id,organization_id,aggregate_type,version,payload_json
         FROM ie_aggregate_state WHERE aggregate_id=$1 AND organization_id=$2`,
      [initiativeId, organizationId]
    );
    console.log('DAY151_SELECT_INITIATIVES', JSON.stringify(classic.rows));
    console.log('DAY151_SELECT_IE_AGGREGATE_STATE', JSON.stringify(runtime.rows));
    expect(classic.rows).toHaveLength(1);
    expect(runtime.rows).toHaveLength(0);

    const list = await request(app)
      .get('/api/initiatives/runtime-v1/initiatives')
      .set(auth);
    console.log('DAY151_HTTP_RUNTIME_LIST', list.status, JSON.stringify(list.body));
    expect(list.status).toBe(200);
    expect(list.body.initiatives.some((entry: { id?: string; aggregateId?: string }) =>
      entry.id === initiativeId || entry.aggregateId === initiativeId
    )).toBe(false);
  }, 60000);
});
