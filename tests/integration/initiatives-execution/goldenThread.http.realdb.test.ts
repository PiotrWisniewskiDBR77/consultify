import { readFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';
import { createInitiativesAnalysisGoldenThread } from './helpers/goldenThreadFixture';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('production API Source-to-Analysis golden thread realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const app = express();
  const org = 'org-golden-thread';
  const project = 'project-golden-thread';
  const policy = {
    policyId: 'golden-standard',
    version: 1,
    baseline: 'STANDARD' as const,
    strictness: 2,
    source: 'ORGANIZATION' as const,
    config: {
      selfApproval: false,
      enforceGateGovernance: true,
      gates: {
        DEFINITION: {
          quorum: 1,
          requiredRoles: ['GATE_AUTHORITY'],
          separation: true,
          slaHours: 48,
        },
        ANALYSIS: { quorum: 1, requiredRoles: ['GATE_AUTHORITY'], separation: true, slaHours: 48 },
      },
      roleBindings: [{ roleKey: 'GATE_AUTHORITY', principalId: 'phase2-gate-authority' }],
    },
  };
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user'),
      organizationId: req.header('x-test-org'),
      role: 'USER',
    };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (actor, projectId) => actor.organizationId === org && projectId === project,
      resolvePolicy: async () => policy,
    })
  );

  beforeAll(async () => {
    for (const migration of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
      '934_organization_governance_profiles.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', migration), 'utf8'));
  });
  beforeEach(async () => {
    await pool.query(`DELETE FROM initiative_candidates WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_initiative_card_versions WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_initiative_card_selection WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_governance_role_bindings WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_governance_policies WHERE organization_id=$1`, [org]);
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_governance_policies(organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json,status)
       VALUES($1,'ORGANIZATION',$1,$2,1,'STANDARD',2,$3::jsonb,'ACTIVE')`,
      [org, policy.policyId, JSON.stringify({ ...policy.config, roleBindings: undefined })]
    );
    await pool.query(
      `INSERT INTO ie_governance_role_bindings(organization_id,policy_id,policy_version,role_key,principal_id,project_id)
       VALUES($1,$2,1,'GATE_AUTHORITY','phase2-gate-authority',$3)`,
      [org, policy.policyId, project]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });

  it('uses only production HTTP commands and returns reusable stable phase-2 refs', async () => {
    const fixture = await createInitiativesAnalysisGoldenThread(app, {
      prefix: 'phase2',
      organizationId: org,
      projectId: project,
    });
    expect(fixture).toMatchObject({
      organizationId: org,
      projectId: project,
      lifecycleState: 'READY_FOR_DECISION',
      policy: { policyId: policy.policyId, policyVersion: 1 },
    });
    expect(fixture.quorumRefs.DEFINITION.receiptId).toBeTruthy();
    expect(fixture.quorumRefs.ANALYSIS.receiptId).toBeTruthy();
    const counts = await pool.query(
      `SELECT (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,
              (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,
              (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox`,
      [org]
    );
    expect(counts.rows[0].receipts).toBeGreaterThan(0);
    expect(counts.rows[0].audits).toBe(counts.rows[0].receipts);
    expect(counts.rows[0].outbox).toBe(counts.rows[0].receipts);
  });
});
