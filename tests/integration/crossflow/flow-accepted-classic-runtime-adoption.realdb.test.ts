import { readFileSync } from 'node:fs';

import express from 'express';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  TENANT_A,
  TENANT_B,
  bearer,
  cfId,
  createApprovedSwotInitiative,
  dbReachable,
  newClient,
  seedTenants,
} from './flowFixture.js';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes.js';

const realDbEnabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.FLOW_TRANSFORM_ALLOW_FIXTURE_CLEANUP === '1' &&
  Boolean(process.env.DATABASE_URL);
const realDbSuite = realDbEnabled ? describe : describe.skip;

realDbSuite('FLOW accepted classic Candidate -> Runtime-v1 adoption (real PostgreSQL)', () => {
  const projectId = cfId('project', 'accepted-classic-adoption');
  const unrelatedProjectId = cfId('project', 'accepted-classic-adoption-unrelated');
  const connectionString = process.env.DATABASE_URL || 'postgresql://disabled.invalid/disabled';
  const pool = new Pool({ connectionString, max: 4 });
  const client = new Client({ connectionString });
  const app = express();
  let lineage: Awaited<ReturnType<typeof createApprovedSwotInitiative>>;
  let seeded = false;

  beforeAll(async () => {
    if (!(await dbReachable())) throw new Error('requires disposable flow_* PostgreSQL');
    await client.connect();
    const db = (await client.query<{ current_database: string }>('SELECT current_database()'))
      .rows[0].current_database;
    if (!db.startsWith('flow_')) throw new Error(`refusing non-disposable database ${db}`);
    await client.query(
      readFileSync('server/migrations/20261061_flow_accepted_classic_runtime_adoption.sql', 'utf8')
    );
    await seedTenants(client);
    seeded = true;
    await client.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES
      ($1,$3,'Flow adoption','active',$4),($2,$3,'Unrelated adoption','active',$4)`,
      [projectId, unrelatedProjectId, TENANT_A.id, TENANT_A.owner.id]
    );
    for (const actor of [TENANT_A.owner, TENANT_A.admin, TENANT_A.member]) {
      for (const memberProjectId of [projectId, unrelatedProjectId]) {
        await client.query(
          `INSERT INTO project_members(project_id,user_id,project_role) VALUES($1,$2,'PROJECT_MANAGER') ON CONFLICT DO NOTHING`,
          [memberProjectId, actor.id]
        );
      }
    }
    lineage = await createApprovedSwotInitiative(client, 'accepted-classic-adoption');
    await client.query(`UPDATE initiatives SET project_id=$1 WHERE organization_id=$2 AND id=$3`, [
      projectId,
      TENANT_A.id,
      lineage.initiativeId,
    ]);
    const { verifyToken, validateOrgMembership } =
      await import('../../../server/src/middleware/auth.middleware.js');
    app.use(express.json(), verifyToken, validateOrgMembership);
    app.use(
      '/api/initiatives/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
        reader: new PostgresInitiativeReader(pool),
        authorize: async (actor, requestedProjectId, capability) =>
          actor.organizationId === TENANT_A.id &&
          [projectId, unrelatedProjectId].includes(requestedProjectId) &&
          capability === 'initiative.create' &&
          actor.userId !== TENANT_A.member.id,
        resolvePolicy: async () =>
          ({
            policyId: 'flow-adoption-policy',
            version: 1,
            baseline: 'STANDARD',
            strictness: 2,
            source: 'PROJECT',
            config: { selfApproval: false, enforceGateGovernance: true, gates: {} },
          }) as any,
      })
    );
  });

  afterAll(async () => {
    await pool.end();
    if (!seeded) {
      await client.end().catch(() => undefined);
      return;
    }
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role='replica'`);
    await client.query(
      `DELETE FROM flow_accepted_classic_runtime_adoptions WHERE organization_id=ANY($1)`,
      [[TENANT_A.id, TENANT_B.id]]
    );
    await client.query(
      `DELETE FROM ie_aggregate_relations WHERE organization_id=$1 AND target_id=$2`,
      [TENANT_A.id, lineage.initiativeId]
    );
    for (const table of [
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE organization_id=$1 AND aggregate_id=$2`, [
        TENANT_A.id,
        lineage.initiativeId,
      ]);
    }
    await client.query(
      `DELETE FROM swot_candidate_handoffs WHERE organization_id=$1 AND candidate_id=$2`,
      [TENANT_A.id, lineage.candidateId]
    );
    await client.query(`DELETE FROM initiative_candidates WHERE organization_id=$1 AND id=$2`, [
      TENANT_A.id,
      lineage.candidateId,
    ]);
    await client.query(`DELETE FROM initiatives WHERE organization_id=$1 AND id=$2`, [
      TENANT_A.id,
      lineage.initiativeId,
    ]);
    await client.query(`DELETE FROM tool_outputs WHERE organization_id=$1 AND id=$2`, [
      TENANT_A.id,
      lineage.toolOutputId,
    ]);
    await client.query(`DELETE FROM tool_sessions WHERE organization_id=$1 AND id=$2`, [
      TENANT_A.id,
      lineage.toolSessionId,
    ]);
    await client.query(`DELETE FROM project_members WHERE project_id=ANY($1)`, [
      [projectId, unrelatedProjectId],
    ]);
    await client.query(`DELETE FROM projects WHERE id=ANY($1)`, [[projectId, unrelatedProjectId]]);
    await client.query('COMMIT');
    await client.end();
  });

  const payload = (clientRequestId: string, initiativeId = () => lineage.initiativeId) => ({
    candidateId: lineage.candidateId,
    initiativeId: initiativeId(),
    expectedVersion: 0,
    clientRequestId,
    projectId,
    visibility: 'PROJECT',
    initiativeOwnerId: TENANT_A.owner.id,
  });

  it('adopts one accepted classic identity, replays, and preserves immutable SWOT lineage', async () => {
    const path = '/api/initiatives/runtime-v1/adoptions/accepted-classic';
    const wrongProject = await request(app)
      .post(path)
      .set('Authorization', bearer(TENANT_A.admin))
      .send({ ...payload('wrong-project'), projectId: unrelatedProjectId });
    expect(wrongProject.status).toBe(400);
    expect(wrongProject.body.error?.code).toBe('COMMAND_VALIDATION_FAILED');
    const first = await request(app)
      .post(path)
      .set('Authorization', bearer(TENANT_A.owner))
      .send(payload('flow-adopt-once'));
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.response).toMatchObject({
      initiativeId: lineage.initiativeId,
      lifecycleState: 'REGISTERED_DRAFT',
    });
    const replay = await request(app)
      .post(path)
      .set('Authorization', bearer(TENANT_A.owner))
      .send(payload('flow-adopt-once'));
    expect(replay.status).toBe(200);
    expect(replay.body.status).toBe('REPLAYED');
    const cold = newClient();
    await cold.connect();
    const proof = await cold.query(
      `SELECT a.candidate_id,a.classic_initiative_id,a.runtime_initiative_id,
      a.swot_handoff_receipt_id,a.tool_output_id,a.tool_output_version,a.tool_output_content_hash,
      c.initiative_id,c.registered_initiative_id,s.aggregate_id
      FROM flow_accepted_classic_runtime_adoptions a
      JOIN initiative_candidates c ON c.id=a.candidate_id AND c.organization_id=a.organization_id
      JOIN ie_aggregate_state s ON s.organization_id=a.organization_id AND s.aggregate_type='initiative' AND s.aggregate_id=a.runtime_initiative_id
      WHERE a.organization_id=$1`,
      [TENANT_A.id]
    );
    await cold.end();
    expect(proof.rowCount).toBe(1);
    expect(proof.rows[0]).toMatchObject({
      candidate_id: lineage.candidateId,
      classic_initiative_id: lineage.initiativeId,
      runtime_initiative_id: lineage.initiativeId,
      initiative_id: lineage.initiativeId,
      registered_initiative_id: null,
      tool_output_id: lineage.toolOutputId,
      tool_output_version: lineage.toolOutputVersion,
      tool_output_content_hash: lineage.toolOutputContentHash,
      aggregate_id: lineage.initiativeId,
    });
  });

  it('fails closed for RBAC, tenant crossing, and conflicting identity', async () => {
    const path = '/api/initiatives/runtime-v1/adoptions/accepted-classic';
    expect(
      (
        await request(app)
          .post(path)
          .set('Authorization', bearer(TENANT_A.member))
          .send(payload('denied'))
      ).status
    ).toBe(403);
    const foreign = await request(app)
      .post(path)
      .set('Authorization', bearer(TENANT_B.owner))
      .send(payload('foreign'));
    expect([403, 404]).toContain(foreign.status);
    const conflict = await request(app)
      .post(path)
      .set('Authorization', bearer(TENANT_A.admin))
      .send(payload('conflict'));
    expect(conflict.status).toBe(409);
    expect(
      (
        await client.query(
          `SELECT count(*)::int n FROM flow_accepted_classic_runtime_adoptions WHERE organization_id=$1`,
          [TENANT_A.id]
        )
      ).rows[0].n
    ).toBe(1);
  });

  it('database rejects a forged tenant graph and keeps adoption receipts immutable', async () => {
    const receipt = (
      await client.query(
        `SELECT * FROM flow_accepted_classic_runtime_adoptions WHERE organization_id=$1`,
        [TENANT_A.id]
      )
    ).rows[0];
    await expect(
      client.query(
        `INSERT INTO flow_accepted_classic_runtime_adoptions
      (organization_id,candidate_id,classic_initiative_id,runtime_initiative_id,project_id,
       swot_handoff_receipt_id,swot_source_revision,tool_output_id,tool_output_version,
       tool_output_content_hash,policy_id,policy_version,correlation_id,adopted_by)
      VALUES($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,'forged',1,'forged',$10)`,
        [
          TENANT_B.id,
          receipt.candidate_id,
          receipt.classic_initiative_id,
          receipt.project_id,
          receipt.swot_handoff_receipt_id,
          receipt.swot_source_revision,
          receipt.tool_output_id,
          receipt.tool_output_version,
          receipt.tool_output_content_hash,
          TENANT_B.owner.id,
        ]
      )
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.query(
        `UPDATE flow_accepted_classic_runtime_adoptions SET policy_version=2 WHERE receipt_id=$1`,
        [receipt.receipt_id]
      )
    ).rejects.toBeTruthy();
    await expect(
      client.query(`DELETE FROM flow_accepted_classic_runtime_adoptions WHERE receipt_id=$1`, [
        receipt.receipt_id,
      ])
    ).rejects.toBeTruthy();
  });
});
