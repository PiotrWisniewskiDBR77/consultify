/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

describe('Day 142 — KPI survival after canonical initiative closure', () => {
  const databaseUrl = process.env.DATABASE_URL || '';
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const initiativeId = randomUUID();
  const kpiId = randomUUID();
  const transformationCaseId = `tc_${randomUUID()}`;
  const proposalVersionId = `pv_${randomUUID()}`;
  const reviewId = `review_${randomUUID()}`;
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2)', [
      organizationId,
      'Day 142 KPI survival proof',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role,status)
       VALUES ($1,$2,$3,'OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives
         (id,organization_id,name,status,owner_business_id,created_by,updated_by,
          planned_start_date,planned_end_date)
       VALUES ($1,$2,$3,'EXECUTING',$4,$4,$4,'2026-01-01','2026-12-31')`,
      [initiativeId, organizationId, 'Day 142 closing initiative', userId]
    );
    await pool.query(
      `INSERT INTO initiative_kpis
         (id,initiative_id,organization_id,name,target_value,current_value,unit,measurement_frequency)
       VALUES ($1,$2,$3,$4,100,40,'percent','monthly')`,
      [kpiId, initiativeId, organizationId, 'Day 142 durable KPI']
    );
    await pool.query(
      `INSERT INTO transformation_cases
         (transformation_case_id,organization_id,initiated_by_user_id,mandate,lineage_id,idempotency_key)
       VALUES ($1,$2,$3,'Day 142 closure proof',$4,$5)`,
      [
        transformationCaseId,
        organizationId,
        userId,
        `lineage_${transformationCaseId}`,
        `idem_${transformationCaseId}`,
      ]
    );
    await pool.query(
      `INSERT INTO v8_agent_proposal_versions
         (proposal_version_id,proposal_id,organization_id,canonical_run_id,proposal_version,plan_version,
          context_digest,before_json,after_json,approval_scopes_json,reviewer_authority_json,
          expires_at,status,created_by_user_id)
       VALUES ($1,$2,$3,$4,1,1,$5,'{}'::jsonb,'{}'::jsonb,'[]'::jsonb,'{}'::jsonb,
               now()+interval '1 day','approved',$6)`,
      [
        proposalVersionId,
        `proposal_${proposalVersionId}`,
        organizationId,
        `run_${proposalVersionId}`,
        'a'.repeat(64),
        userId,
      ]
    );
    await pool.query(
      `INSERT INTO v8_agent_proposal_scope_reviews
         (review_id,proposal_version_id,scope_key,decision,reason,reviewed_by_user_id)
       VALUES ($1,$2,'CLOSURE','approved','Day 142 closure proof',$3)`,
      [reviewId, proposalVersionId, userId]
    );
    await pool.query(
      `INSERT INTO initiative_lifecycle_gate_decisions
         (decision_id,organization_id,initiative_id,transformation_case_id,pmo_domain,version,
          decision_status,source_digest,source_case_version,baseline_refs_json,a05_proposal_version_id,
          a05_approval_receipt_ref,human_actor_user_id,human_authority_ref,rationale,deadline_at,
          idempotency_key,input_digest)
       VALUES ($1,$2,$3,$4,'CLOSURE',1,'approved',$5,1,$6::jsonb,$7,$8,$9,
               'day142-test-authority','Day 142 approved closure proof',now()+interval '1 day',$10,$11)`,
      [
        `decision_${randomUUID()}`,
        organizationId,
        initiativeId,
        transformationCaseId,
        'b'.repeat(64),
        JSON.stringify(['day142-baseline']),
        proposalVersionId,
        reviewId,
        userId,
        `idem_gate_${randomUUID()}`,
        'c'.repeat(64),
      ]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      { id: userId, userId, organizationId, role: 'OWNER', email: `${userId}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  }, 30000);

  afterAll(async () => {
    await pool.end();
  });

  it('keeps the KPI present, visible, and measurable after PATCH /api/initiatives/:id/status closes the initiative', async () => {
    const before = await pool.query(
      `SELECT i.status AS initiative_status,k.id AS kpi_id,k.initiative_id,
              k.current_value,k.target_value,k.unit,k.archived_at
         FROM initiatives i
         JOIN initiative_kpis k ON k.initiative_id=i.id
        WHERE i.id=$1 AND i.organization_id=$2 AND k.id=$3`,
      [initiativeId, organizationId, kpiId]
    );
    console.log('DAY142_SELECT_BEFORE', JSON.stringify(before.rows));

    const response = await request(app)
      .patch(`/api/initiatives/${initiativeId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE', reason: 'Day 142 canonical closure survival measurement' });
    console.log('DAY142_HTTP_CLOSE', response.status, JSON.stringify(response.body));
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('DONE');

    const after = await pool.query(
      `SELECT i.status AS initiative_status,k.id AS kpi_id,k.initiative_id,
              k.current_value,k.target_value,k.unit,k.archived_at
         FROM initiatives i
         JOIN initiative_kpis k ON k.initiative_id=i.id
        WHERE i.id=$1 AND i.organization_id=$2 AND k.id=$3`,
      [initiativeId, organizationId, kpiId]
    );
    console.log('DAY142_SELECT_AFTER', JSON.stringify(after.rows));

    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]).toMatchObject({
      initiative_status: 'DONE',
      kpi_id: kpiId,
      initiative_id: initiativeId,
      current_value: 40,
      target_value: 100,
      unit: 'percent',
      archived_at: null,
    });
  });
});
