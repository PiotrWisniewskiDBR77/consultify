/** INI-UI-CANON-001 — mounted signed-auth substrate for candidate and linked Execution UI. */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import { PostgresInitiativeReader } from '../../server/src/domain/initiatives-execution/postgresInitiativeReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { validateOrgMembership, verifyToken } from '../../server/src/middleware/auth.middleware.js';
import { createInitiativesExecutionRuntimeRouter } from '../../server/src/routes/pmo/initiativesExecutionRuntime.routes.js';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const databaseUrl = process.env.DATABASE_URL ?? '';

describe.skipIf(!enabled)('mounted Initiative UI canonical reads', () => {
  const prefix = `ini-ui-${randomUUID()}`;
  const org = `${prefix}-org`;
  const foreignOrg = `${prefix}-foreign-org`;
  const owner = `${prefix}-owner`;
  const admin = `${prefix}-admin`;
  const member = `${prefix}-member`;
  const revoked = `${prefix}-revoked`;
  const foreignOwner = `${prefix}-foreign-owner`;
  const project = `${prefix}-project`;
  const proposalId = `${prefix}-proposal`;
  const financeProposalId = `${prefix}-finance-proposal`;
  const financeSourceId = `${prefix}-finance-model`;
  const financeReceiptId = `${prefix}-finance-receipt`;
  const initiativeId = `${prefix}-initiative`;
  const executionCaseId = `${prefix}-execution`;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const app = express();

  const token = (id: string, organizationId: string) =>
    jwt.sign(
      {
        id,
        email: `${id}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
      [org, foreignOrg]
    );
    for (const [id, organizationId, role, status] of [
      [owner, org, 'OWNER', 'ACTIVE'],
      [admin, org, 'ADMIN', 'ACTIVE'],
      [member, org, 'MEMBER', 'ACTIVE'],
      [revoked, org, 'OWNER', 'REVOKED'],
      [foreignOwner, foreignOrg, 'OWNER', 'ACTIVE'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'x',$4,'active')`,
        [id, organizationId, `${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,$5)`,
        [randomUUID(), organizationId, id, role, status]
      );
    }
    await pool.query(
      `INSERT INTO initiative_candidates
        (id,organization_id,source_type,source_id,source_version,title,problem,proposed_outcome,
         project_id,initiative_owner_id,visibility,evidence_state,duplicate_state,status,version)
       VALUES($1,$2,'assessment-finding',$3,4,'Mounted candidate','Problem','Outcome',$4,$5,
              'PROJECT','READY','CLEAR','pending',2)`,
      [proposalId, org, `${prefix}-finding`, project, owner]
    );
    await pool.query(
      `INSERT INTO initiative_candidates
        (id,organization_id,source_type,source_id,source_version,title,problem,proposed_outcome,
         project_id,initiative_owner_id,visibility,evidence_state,duplicate_state,status,version,
         created_by)
       VALUES($1,$2,'finance_investment_case',$3,2,'Governed Finance candidate',NULL,NULL,
              NULL,NULL,'ORGANIZATION_RESTRICTED','READY','CLEAR','pending',1,$4)`,
      [financeProposalId, org, financeSourceId, owner]
    );
    await pool.query(
      `INSERT INTO finance_candidate_handoffs
        (id,organization_id,source_type,source_id,candidate_id,created_by,source_snapshot)
       VALUES($1,$2,'finance_investment_case',$3,$4,$5,$6::jsonb)`,
      [
        financeReceiptId,
        org,
        financeSourceId,
        financeProposalId,
        owner,
        JSON.stringify({ capex: 6000, opex: 147500, sourceFingerprint: `${prefix}-fingerprint` }),
      ]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state
         (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
         ($1,'initiative',$2,9,$3::jsonb),
         ($1,'execution_case',$4,3,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: project,
          lifecycleState: 'SCHEDULED',
          title: 'Mounted initiative',
          handoffPackageId: `${prefix}-handoff`,
          handoffPackageVersion: 2,
        }),
        executionCaseId,
        JSON.stringify({
          executionCaseId,
          initiativeId,
          state: 'PLANNED',
          executionManagerId: owner,
          handoffPackageId: `${prefix}-handoff`,
        }),
      ]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_relations
         (organization_id,relation_type,source_type,source_id,source_version,target_type,target_id)
       VALUES($1,'INITIATIVE_EXECUTION_CASE','initiative',$2,9,'execution_case',$3)`,
      [org, initiativeId, executionCaseId]
    );

    const authorize = async (
      actor: { organizationId: string; userId: string },
      projectId: string
    ) => {
      if (actor.organizationId !== org || projectId !== project) return false;
      const membership = await pool.query(
        `SELECT 1 FROM organization_members
          WHERE organization_id=$1 AND user_id=$2 AND UPPER(status)='ACTIVE'`,
        [actor.organizationId, actor.userId]
      );
      return membership.rowCount === 1;
    };
    app.use(express.json());
    app.use(
      '/api/initiatives/runtime-v1',
      verifyToken,
      validateOrgMembership,
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
        reader: new PostgresInitiativeReader(pool),
        authorize,
        resolvePolicy: async () => ({
          policyId: 'ini-ui-mounted',
          version: 1,
          baseline: 'STANDARD',
          strictness: 2,
          source: 'ORGANIZATION',
          config: { selfApproval: false, enforceGateGovernance: true },
        }),
      })
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ie_aggregate_relations WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM finance_candidate_handoffs WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM initiative_candidates WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [org, foreignOrg],
    ]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [
      [owner, admin, member, revoked, foreignOwner],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[org, foreignOrg]]);
    await pool.end();
  });

  it('returns the candidate and exact linked Execution case for an active signed tenant member', async () => {
    const bearer = token(owner, org);
    const candidates = await request(app)
      .get('/api/initiatives/runtime-v1/source-proposals')
      .set('Authorization', `Bearer ${bearer}`);
    expect(candidates.status, JSON.stringify(candidates.body)).toBe(200);
    const proposalIds = candidates.body.proposals.map((row: { id: string }) => row.id);
    expect(proposalIds.filter((id: string) => id === financeProposalId)).toHaveLength(1);
    expect(proposalIds).toContain(proposalId);
    expect(candidates.body.proposals).toContainEqual(
      expect.objectContaining({
        id: financeProposalId,
        sourceId: financeSourceId,
        projectId: null,
        capabilities: {
          canRegister: false,
          canMerge: false,
          canExtend: false,
          canReturn: false,
          canDefer: false,
          canDismiss: false,
        },
      })
    );
    const lineage = await pool.query(
      `SELECT candidate_id, source_id, source_snapshot
         FROM finance_candidate_handoffs
        WHERE organization_id=$1 AND id=$2`,
      [org, financeReceiptId]
    );
    expect(lineage.rows).toHaveLength(1);
    expect(lineage.rows[0]).toMatchObject({
      candidate_id: financeProposalId,
      source_id: financeSourceId,
      source_snapshot: {
        capex: 6000,
        opex: 147500,
        sourceFingerprint: `${prefix}-fingerprint`,
      },
    });

    const financeColdPool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    try {
      const coldProposals = await new PostgresInitiativeReader(financeColdPool).listSourceProposals(
        org
      );
      expect(coldProposals.filter((row) => row.id === financeProposalId)).toHaveLength(1);
    } finally {
      await financeColdPool.end();
    }

    const linked = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/execution-case`)
      .set('Authorization', `Bearer ${bearer}`);
    expect(linked.status, JSON.stringify(linked.body)).toBe(200);
    expect(linked.body).toMatchObject({
      executionCaseId,
      detail: { initiativeId, state: 'PLANNED' },
    });

    const coldPool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    try {
      const cold = await new PostgresInitiativeReader(coldPool).findExecutionCaseByInitiative(
        org,
        initiativeId
      );
      expect(cold).toMatchObject({
        executionCaseId,
        detail: { initiativeId, state: 'PLANNED' },
      });
    } finally {
      await coldPool.end();
    }
  });

  it.each([
    ['ADMIN', admin],
    ['MEMBER', member],
  ])('uses authoritative ACTIVE membership for the %s UI read path', async (role, userId) => {
    const bearer = jwt.sign(
      {
        id: userId,
        email: `${userId}@test.invalid`,
        organizationId: org,
        organization_id: org,
        role,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    const linked = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/execution-case`)
      .set('Authorization', `Bearer ${bearer}`);
    expect(linked.status, JSON.stringify(linked.body)).toBe(200);
    expect(linked.body.executionCaseId).toBe(executionCaseId);
  });

  it.each([
    ['revoked membership', () => token(revoked, org)],
    ['foreign tenant', () => token(foreignOwner, foreignOrg)],
  ])('fails closed for %s without leaking the linked case', async (_label, bearer) => {
    const candidates = await request(app)
      .get('/api/initiatives/runtime-v1/source-proposals')
      .set('Authorization', `Bearer ${bearer()}`);
    expect(
      (candidates.body.proposals ?? []).some(
        (proposal: { id: string }) => proposal.id === financeProposalId
      )
    ).toBe(false);
    const linked = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/execution-case`)
      .set('Authorization', `Bearer ${bearer()}`);
    expect([403, 404]).toContain(linked.status);
  });
});
